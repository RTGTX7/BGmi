import datetime as dt
import json
import os
import re
import shutil
import subprocess
import time
from os import environ
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from peewee import fn

from bgmi import __version__
from bgmi.config import BGMI_PATH, cfg
from bgmi.front.player_assets import local_media_routing_state
from bgmi.lib.fetch import website
from bgmi.lib.mikan_resolver import resolve_bangumi
from bgmi.lib.models import (
    STATUS_DELETED,
    STATUS_END,
    STATUS_UPDATED,
    Bangumi,
    BangumiIssue,
    Filter,
    Followed,
    ISSUE_EMPTY_LOCAL_FOLDER,
    ISSUE_MISSING_EPISODES,
    ISSUE_MISSING_PLAYABLE_SOURCE,
    ISSUE_MISSING_FOLDER,
    ISSUE_PERMISSION_DENIED,
)
from bgmi.script import ScriptRunner
from bgmi.utils import convert_cover_url_to_path, download_cover, resolve_cover_season
from bgmi.website.base import BaseWebsite

VIDEO_EXTENSIONS = {".mkv", ".mp4", ".avi", ".mov", ".webm", ".flv", ".ts", ".m2ts"}
MAX_LIBRARY_SCAN_DEPTH = 23


def _iso_timestamp(timestamp: Optional[float]) -> Optional[str]:
    if not timestamp:
        return None
    return dt.datetime.fromtimestamp(timestamp, dt.timezone.utc).astimezone().isoformat()


def _current_season_key(today: Optional[dt.date] = None) -> str:
    current = today or dt.date.today()
    month = current.month
    if month <= 3:
        quarter = 1
    elif month <= 6:
        quarter = 4
    elif month <= 9:
        quarter = 7
    else:
        quarter = 10
    return f"{current.year}{quarter:02d}"


def _normalize_name(name: str) -> str:
    return re.sub(r"[\s\-_·・:：\[\]【】()（）'\"!！?？.,，。/]+", "", name or "").lower()


def _append_maintenance_log(action: str, payload: Dict[str, Any]) -> None:
    log_path = BGMI_PATH.joinpath("maintenance.log")
    entry = {
        "time": dt.datetime.now().astimezone().isoformat(),
        "action": action,
        "version": __version__,
        "payload": payload,
    }
    with log_path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _resolve_dashboard_working_directory() -> Path:
    configured_path = (
        environ.get("BGMI_DASHBOARD_WORKDIR")
        or environ.get("BGMI_HTTP_WORKDIR")
        or environ.get("BGMI_WORKDIR")
        or str(BGMI_PATH)
    )
    return Path(configured_path).expanduser().resolve()


def _path_error_message(path: Path, label: str) -> Optional[str]:
    try:
        if not path.exists():
            return f"{label} not found: {path}"
        if not path.is_dir():
            return f"{label} is not a directory: {path}"
        next(path.iterdir(), None)
    except PermissionError:
        return f"Permission denied while accessing {label}: {path}"
    except OSError as exc:
        return f"Failed to access {label}: {path} ({exc})"
    return None


def _collect_local_bangumi_folders() -> Tuple[List[Path], List[str]]:
    save_path = cfg.save_path
    folders: List[Path] = []
    errors: List[str] = []

    path_error = _path_error_message(save_path, "media library directory")
    if path_error:
        errors.append(path_error)
        return folders, errors

    try:
        for path in sorted(save_path.iterdir(), key=lambda item: item.name.lower()):
            if not path.is_dir():
                continue
            if path.name.startswith(".") or path.name == "cover":
                continue
            folders.append(path)
    except PermissionError:
        errors.append(f"Permission denied while scanning media library directory: {save_path}")
    except OSError as exc:
        errors.append(f"Failed to scan media library directory: {save_path} ({exc})")

    return folders, errors


def _local_bangumi_folders() -> List[Path]:
    folders, _ = _collect_local_bangumi_folders()
    return folders


def _cache_cover_urls(cover_urls: List[str]) -> Tuple[int, List[Dict[str, str]]]:
    normalized_urls = []
    seen = set()
    for cover_url in cover_urls:
        value = str(cover_url or "").strip().split("?")[0]
        if not value or value in seen:
            continue
        seen.add(value)
        normalized_urls.append(value)

    if not normalized_urls:
        return 0, []

    try:
        download_cover(normalized_urls)
    except Exception as exc:  # pragma: no cover - defensive
        return 0, [{"bangumi": "cover-cache", "error": str(exc)}]

    cached_count = 0
    errors: List[Dict[str, str]] = []
    for cover_url in normalized_urls:
        _, file_path = convert_cover_url_to_path(cover_url)
        if Path(file_path).exists():
            cached_count += 1
        else:
            errors.append({"bangumi": "cover-cache", "error": f"cover cache missing after download: {cover_url}"})

    return cached_count, errors


def _compute_anomaly_report(limit: int = 50) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    missing_poster = 0
    missing_season = 0
    missing_keyword = 0

    for bangumi in Bangumi.select():
        bangumi_name = bangumi.name
        if not bangumi.cover:
            missing_poster += 1
            items.append({"type": "missing_poster", "name": bangumi_name, "detail": "Missing poster URL"})
        _, _, season = resolve_cover_season(bangumi.cover)
        if not season:
            missing_season += 1
            items.append({"type": "missing_season", "name": bangumi_name, "detail": "Failed to resolve season from cover URL"})
        if not bangumi.keyword:
            missing_keyword += 1
            items.append({"type": "missing_keyword", "name": bangumi_name, "detail": "Missing Mikan / source keyword"})

    dangling_followed = 0
    for followed in Followed.select().where(Followed.status != STATUS_DELETED):
        if not Bangumi.select().where(Bangumi.name == followed.bangumi_name).exists():
            dangling_followed += 1
            items.append({"type": "dangling_followed", "name": followed.bangumi_name, "detail": "Followed record has no matching Bangumi metadata"})

    duplicate_bangumi = (
        Bangumi.select(Bangumi.name, fn.COUNT(Bangumi.id).alias("count"))
        .group_by(Bangumi.name)
        .having(fn.COUNT(Bangumi.id) > 1)
    )
    duplicate_followed = (
        Followed.select(Followed.bangumi_name, fn.COUNT(Followed.id).alias("count"))
        .group_by(Followed.bangumi_name)
        .having(fn.COUNT(Followed.id) > 1)
    )

    duplicate_count = 0
    for row in duplicate_bangumi:
        duplicate_count += 1
        items.append({"type": "duplicate_bangumi", "name": row.name, "detail": f"Bangumi duplicate records: {row.count}"})
    for row in duplicate_followed:
        duplicate_count += 1
        items.append({"type": "duplicate_followed", "name": row.bangumi_name, "detail": f"Followed duplicate records: {row.count}"})

    issue_counts = {
        ISSUE_MISSING_EPISODES: 0,
        ISSUE_MISSING_PLAYABLE_SOURCE: 0,
        ISSUE_EMPTY_LOCAL_FOLDER: 0,
        ISSUE_MISSING_FOLDER: 0,
        ISSUE_PERMISSION_DENIED: 0,
    }
    for issue in BangumiIssue.select().order_by(BangumiIssue.marked_at.desc()):
        issue_counts[issue.issue_type] = issue_counts.get(issue.issue_type, 0) + 1
        items.append(
            {
                "type": issue.issue_type,
                "name": issue.bangumi_name,
                "detail": issue.note or issue.file_path or issue.episode or issue.issue_type,
                "episode": issue.episode,
                "filePath": issue.file_path,
                "markedAt": _iso_timestamp(float(issue.marked_at)) if issue.marked_at else None,
            }
        )

    total = (
        missing_poster
        + missing_season
        + missing_keyword
        + dangling_followed
        + duplicate_count
        + issue_counts.get(ISSUE_MISSING_EPISODES, 0)
        + issue_counts.get(ISSUE_MISSING_PLAYABLE_SOURCE, 0)
        + issue_counts.get(ISSUE_EMPTY_LOCAL_FOLDER, 0)
        + issue_counts.get(ISSUE_MISSING_FOLDER, 0)
        + issue_counts.get(ISSUE_PERMISSION_DENIED, 0)
    )

    return {
        "summary": {
            "total": total,
            "missingPoster": missing_poster,
            "missingSeason": missing_season,
            "missingKeyword": missing_keyword,
            "danglingFollowed": dangling_followed,
            "duplicateRecords": duplicate_count,
            "missingEpisodes": issue_counts.get(ISSUE_MISSING_EPISODES, 0),
            "missingPlayableSource": issue_counts.get(ISSUE_MISSING_PLAYABLE_SOURCE, 0),
            "emptyLocalFolder": issue_counts.get(ISSUE_EMPTY_LOCAL_FOLDER, 0),
            "missingFolder": issue_counts.get(ISSUE_MISSING_FOLDER, 0),
            "permissionDenied": issue_counts.get(ISSUE_PERMISSION_DENIED, 0),
        },
        "items": items[:limit],
    }


def _normalize_library_path(path: Path) -> str:
    try:
        return path.relative_to(cfg.save_path).as_posix()
    except ValueError:
        return path.as_posix()


def _resolve_library_path(row: Bangumi) -> Path:
    raw_path = (row.library_path or '').strip() or cfg.save_path_map.get(row.name) or row.name
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate
    return cfg.save_path.joinpath(candidate)


def _scan_library_for_video_files(folder: Path) -> Dict[str, Any]:
    if not folder.exists() or not folder.is_dir():
        return {"status": "missingFolder", "hasVideoFiles": False, "videoFileCount": 0, "sampleFile": ""}

    count = 0
    sample_file = ''

    def walk(path: Path, depth: int) -> None:
        nonlocal count, sample_file
        if depth > MAX_LIBRARY_SCAN_DEPTH:
            return
        with os.scandir(path) as entries:
            for entry in entries:
                if entry.name.startswith('.'):
                    continue
                if entry.is_file(follow_symlinks=False):
                    if Path(entry.name).suffix.lower() in VIDEO_EXTENSIONS:
                        count += 1
                        if not sample_file:
                            sample_file = Path(entry.path).as_posix()
                    continue
                if entry.is_dir(follow_symlinks=False):
                    walk(Path(entry.path), depth + 1)

    try:
        walk(folder, 0)
    except PermissionError:
        return {"status": "permissionDenied", "hasVideoFiles": False, "videoFileCount": 0, "sampleFile": ""}
    except OSError as exc:
        return {
            "status": "permissionDenied",
            "hasVideoFiles": False,
            "videoFileCount": 0,
            "sampleFile": "",
            "error": str(exc),
        }

    return {
        "status": "ok",
        "hasVideoFiles": count > 0,
        "videoFileCount": count,
        "sampleFile": sample_file,
    }


def _folder_existing_match(folder_name: str) -> Optional[Bangumi]:
    normalized_folder = _normalize_name(folder_name)
    for bangumi in Bangumi.select():
        normalized_name = _normalize_name(bangumi.name)
        if normalized_name == normalized_folder:
            return bangumi
    try:
        return Bangumi.fuzzy_get(name=folder_name)
    except Bangumi.DoesNotExist:
        return None


def _rename_existing_metadata(target_name: str, folder_name: str) -> None:
    if folder_name == target_name:
        return

    existing_folder = Followed.select().where(Followed.bangumi_name == folder_name).first()
    existing_target = Followed.select().where(Followed.bangumi_name == target_name).first()
    if existing_folder and not existing_target:
        existing_folder.bangumi_name = target_name
        existing_folder.save()

    existing_filter = Filter.select().where(Filter.bangumi_name == folder_name).first()
    target_filter = Filter.select().where(Filter.bangumi_name == target_name).first()
    if existing_filter and not target_filter:
        existing_filter.bangumi_name = target_name
        existing_filter.save()


def _has_protected_user_data(bangumi_name: str) -> Tuple[bool, List[str]]:
    reasons: List[str] = []

    followed = Followed.select().where(Followed.bangumi_name == bangumi_name).first()
    if followed and followed.status != STATUS_DELETED:
        reasons.append('isSubscribed')
    if followed and (followed.episode or 0) > 0:
        reasons.append('watchProgress')

    filter_row = Filter.select().where(Filter.bangumi_name == bangumi_name).first()
    if filter_row and any([filter_row.subtitle, filter_row.include, filter_row.exclude, filter_row.regex]):
        reasons.append('customFilter')

    if (
        BangumiIssue.select()
        .where(
            (BangumiIssue.bangumi_name == bangumi_name)
            & (BangumiIssue.issue_type == ISSUE_MISSING_EPISODES)
        )
        .exists()
    ):
        reasons.append('missingEpisodesMarked')

    return bool(reasons), reasons


def _clear_local_scan_issues(bangumi_name: str) -> None:
    (
        BangumiIssue.delete()
        .where(
            (BangumiIssue.bangumi_name == bangumi_name)
            & (BangumiIssue.issue_type.in_([ISSUE_EMPTY_LOCAL_FOLDER, ISSUE_MISSING_FOLDER, ISSUE_PERMISSION_DENIED]))
        )
        .execute()
    )


def _set_local_scan_issue(bangumi_name: str, issue_type: str, note: str, file_path: Optional[str] = None) -> None:
    BangumiIssue.set_issue(
        bangumi_name=bangumi_name,
        issue_type=issue_type,
        note=note,
        file_path=file_path,
        marked_at=int(time.time()),
    )


def _set_missing_playable_source_issue(
    bangumi_name: str,
    episodes: List[str],
    file_path: Optional[str] = None,
) -> None:
    normalized = [str(item).strip() for item in episodes if str(item).strip()]
    episode_value = ", ".join(normalized[:20])
    note = "episode source not found" if len(normalized) <= 1 else f"episode source not found: {episode_value}"
    BangumiIssue.set_issue(
        bangumi_name=bangumi_name,
        issue_type=ISSUE_MISSING_PLAYABLE_SOURCE,
        episode=episode_value or None,
        file_path=file_path,
        note=note,
        marked_at=int(time.time()),
        metadata=json.dumps({"episodes": normalized}, ensure_ascii=False),
    )


def _clear_missing_playable_source_issue(bangumi_name: str) -> None:
    BangumiIssue.clear_issue(bangumi_name, ISSUE_MISSING_PLAYABLE_SOURCE)


def _refresh_local_scan_issues() -> Dict[str, Any]:
    rows = list(
        Bangumi.select().where(
            (Bangumi.in_library == True)
            | (Bangumi.source.in_(["local", "hybrid"]))
            | (Bangumi.library_path != "")
        )
    )

    checked_count = 0
    empty_local_folder_count = 0
    missing_folder_count = 0
    permission_denied_count = 0
    missing_playable_source_count = 0
    cleared_count = 0
    errors: List[Dict[str, str]] = []

    for row in rows:
        checked_count += 1
        folder = _resolve_library_path(row)
        folder_path = folder.as_posix()

        try:
            scan = _scan_library_for_video_files(folder)
        except Exception as exc:  # pragma: no cover - defensive
            errors.append({"bangumi": row.name, "error": str(exc)})
            continue

        if scan["status"] == "missingFolder":
            _clear_missing_playable_source_issue(row.name)
            _set_local_scan_issue(row.name, ISSUE_MISSING_FOLDER, f"Missing library folder: {folder_path}", folder_path)
            missing_folder_count += 1
            continue

        if scan["status"] == "permissionDenied":
            _clear_missing_playable_source_issue(row.name)
            _set_local_scan_issue(
                row.name,
                ISSUE_PERMISSION_DENIED,
                scan.get("error") or f"Permission denied while scanning {folder_path}",
                folder_path,
            )
            permission_denied_count += 1
            continue

        if not scan.get("hasVideoFiles"):
            _clear_missing_playable_source_issue(row.name)
            _set_local_scan_issue(
                row.name,
                ISSUE_EMPTY_LOCAL_FOLDER,
                "No valid video files found under this folder",
                folder_path,
            )
            empty_local_folder_count += 1
            continue

        missing_episodes: List[str] = []
        try:
            numeric_dirs = sorted([path for path in folder.iterdir() if path.is_dir() and path.name.isdigit()], key=lambda item: int(item.name))
        except PermissionError:
            _clear_missing_playable_source_issue(row.name)
            _set_local_scan_issue(
                row.name,
                ISSUE_PERMISSION_DENIED,
                f"Permission denied while scanning {folder_path}",
                folder_path,
            )
            permission_denied_count += 1
            continue
        except OSError as exc:
            errors.append({"bangumi": row.name, "error": str(exc)})
            continue

        for episode_dir in numeric_dirs:
            episode_scan = _scan_library_for_video_files(episode_dir)
            if episode_scan["status"] == "permissionDenied":
                _clear_missing_playable_source_issue(row.name)
                _set_local_scan_issue(
                    row.name,
                    ISSUE_PERMISSION_DENIED,
                    episode_scan.get("error") or f"Permission denied while scanning {episode_dir.as_posix()}",
                    episode_dir.as_posix(),
                )
                permission_denied_count += 1
                missing_episodes = []
                break
            if not episode_scan.get("hasVideoFiles"):
                missing_episodes.append(episode_dir.name)

        if missing_episodes:
            _set_missing_playable_source_issue(row.name, missing_episodes, folder_path)
            missing_playable_source_count += 1
        else:
            _clear_missing_playable_source_issue(row.name)

        cleared_count += int(
            BangumiIssue.delete().where(
                (BangumiIssue.bangumi_name == row.name)
                & (BangumiIssue.issue_type.in_([ISSUE_EMPTY_LOCAL_FOLDER, ISSUE_MISSING_FOLDER, ISSUE_PERMISSION_DENIED]))
            ).execute()
            or 0
        )

    return {
        "checkedCount": checked_count,
        "emptyLocalFolderCount": empty_local_folder_count,
        "missingFolderCount": missing_folder_count,
        "permissionDeniedCount": permission_denied_count,
        "missingPlayableSourceCount": missing_playable_source_count,
        "clearedCount": cleared_count,
        "failedCount": len(errors),
        "errors": errors,
    }


def mark_missing_episodes(
    bangumiName: str,
    episode: Optional[str] = None,
    filePath: Optional[str] = None,
    note: Optional[str] = None,
) -> Dict[str, Any]:
    bangumi_name = str(bangumiName or '').strip()
    if not bangumi_name:
        return {"status": "error", "message": "missing bangumiName"}

    issue = BangumiIssue.set_issue(
        bangumi_name=bangumi_name,
        issue_type=ISSUE_MISSING_EPISODES,
        episode=str(episode).strip() if episode is not None else None,
        file_path=filePath,
        note=note or 'Marked as missing episodes',
        marked_at=int(time.time()),
    )
    return {
        "status": "success",
        "message": "Missing-episodes mark saved",
        "data": {
            "bangumiName": bangumi_name,
            "issueType": ISSUE_MISSING_EPISODES,
            "episode": issue.episode,
            "filePath": issue.file_path,
            "markedAt": _iso_timestamp(float(issue.marked_at)) if issue.marked_at else None,
            "hasMissingEpisodes": True,
        },
    }


def clear_missing_episodes(bangumiName: str) -> Dict[str, Any]:
    bangumi_name = str(bangumiName or '').strip()
    if not bangumi_name:
        return {"status": "error", "message": "missing bangumiName"}

    BangumiIssue.clear_issue(bangumi_name, ISSUE_MISSING_EPISODES)
    return {
        "status": "success",
        "message": "Missing-episodes mark cleared",
        "data": {
            "bangumiName": bangumi_name,
            "issueType": ISSUE_MISSING_EPISODES,
            "hasMissingEpisodes": False,
        },
    }


def get_dashboard_overview() -> Dict[str, Any]:
    bangumi_rows = list(Bangumi.select())
    followed_rows = list(Followed.select().where(Followed.status != STATUS_DELETED))
    current_season = _current_season_key()
    local_folders, local_folder_errors = _collect_local_bangumi_folders()

    current_season_count = 0
    matched_mikan_count = 0

    for bangumi in bangumi_rows:
        _, _, season = resolve_cover_season(bangumi.cover)
        if season == current_season:
            current_season_count += 1
        if bangumi.keyword:
            matched_mikan_count += 1

    anomaly_report = _compute_anomaly_report(limit=12)
    db_mtime = cfg.db_path.stat().st_mtime if cfg.db_path.exists() else None

    return {
        "stats": {
            "subscribedTotal": len(followed_rows),
            "bangumiTotal": len(bangumi_rows),
            "currentSeasonTotal": current_season_count,
            "todayUpdatedTotal": Followed.select().where(Followed.status == STATUS_UPDATED).count(),
            "matchedMikanTotal": matched_mikan_count,
            "anomalyTotal": anomaly_report["summary"]["total"],
            "localFolderTotal": len(local_folders),
            "lastSyncTime": _iso_timestamp(db_mtime),
            "currentSeasonKey": current_season,
            "workingDirectory": str(_resolve_dashboard_working_directory()),
            "configPath": str(BGMI_PATH.joinpath("config.toml")),
            "bgmiPath": str(BGMI_PATH),
            "savePath": str(cfg.save_path),
            "savePathStatus": local_folder_errors[0] if local_folder_errors else "ok",
        },
        "anomalies": anomaly_report,
        "playerSettings": {
            "localMediaRouting": local_media_routing_state(),
        },
    }


def save_local_media_routing_config(
    enabled: bool = False,
    localEntryHosts: Optional[Any] = None,
    localMediaOrigin: str = "",
) -> Dict[str, Any]:
    hosts_raw = localEntryHosts or []
    if isinstance(hosts_raw, str):
        hosts_iterable = hosts_raw.split(",")
    elif isinstance(hosts_raw, list):
        hosts_iterable = hosts_raw
    else:
        hosts_iterable = []

    local_entry_hosts: list[str] = []
    seen: set[str] = set()
    for item in hosts_iterable:
        host = str(item or "").strip().lower()
        if not host or host in seen:
            continue
        seen.add(host)
        local_entry_hosts.append(host)

    local_media_origin = str(localMediaOrigin or "").strip().rstrip("/")
    origin_pattern = re.compile(r"^https?://[^/:\s]+:\d+$")

    if local_media_origin and not origin_pattern.match(local_media_origin):
        return {"status": "error", "message": "localMediaOrigin must include protocol, host, and port"}

    if enabled and not local_media_origin:
        return {"status": "error", "message": "localMediaOrigin is required when local media routing is enabled"}

    player_config = dict(cfg.player) if isinstance(cfg.player, dict) else {}
    player_config["local_media_routing"] = {
        "enabled": bool(enabled),
        "local_entry_hosts": local_entry_hosts,
        "local_media_origin": local_media_origin,
    }
    cfg.player = player_config
    cfg.save()

    payload = local_media_routing_state()
    _append_maintenance_log("save_local_media_routing_config", payload)
    return {"status": "success", "message": "Local media routing settings saved", "data": payload}


def preview_reset_episodes() -> Dict[str, Any]:
    affected_count = Followed.select().where(Followed.status != STATUS_DELETED).count()
    return {
        "status": "success",
        "message": "已生成剧集清零预览",
        "data": {
            "action": "reset_episodes",
            "confirmKeyword": "RESET",
            "affectedCount": affected_count,
            "fields": ["episode"],
        },
    }


def execute_reset_episodes(confirmText: str = "") -> Dict[str, Any]:
    if confirmText != "RESET":
        return {"status": "error", "message": "confirmText mismatch, expected RESET"}

    targets = list(Followed.select().where(Followed.status != STATUS_DELETED))
    success_count = 0
    for row in targets:
        row.episode = 0
        row.save()
        success_count += 1

    payload = {
        "affectedCount": len(targets),
        "successCount": success_count,
        "failedCount": 0,
        "skippedCount": 0,
        "errors": [],
    }
    _append_maintenance_log("reset_episodes", payload)
    return {"status": "success", "message": "剧集进度已重置", "data": payload}


def sync_mikan_data() -> Dict[str, Any]:
    bangumi_before = Bangumi.select().count()
    result = website.fetch(group_by_weekday=False) or []
    bangumi_after = Bangumi.select().count()
    payload = {
        "affectedCount": len(result),
        "successCount": len(result),
        "failedCount": 0,
        "skippedCount": max(bangumi_before - bangumi_after, 0),
        "errors": [],
        "lastSyncTime": _iso_timestamp(dt.datetime.now().timestamp()),
    }
    _append_maintenance_log("sync_mikan_data", payload)
    return {"status": "success", "message": "Mikan 数据已重新同步", "data": payload}


def check_anomalies() -> Dict[str, Any]:
    local_scan = _refresh_local_scan_issues()
    report = _compute_anomaly_report(limit=100)
    report["localScan"] = local_scan
    _append_maintenance_log("check_anomalies", {"summary": report.get("summary", {}), "localScan": local_scan})
    return {"status": "success", "message": "????????", "data": report}


def submit_download_jobs() -> Dict[str, Any]:
    command = "bgmi"
    args = ["update", "--download"]
    started_at = dt.datetime.now().astimezone()
    started_perf = time.perf_counter()
    working_directory = _resolve_dashboard_working_directory()
    config_path = BGMI_PATH.joinpath("config.toml")
    command_path = shutil.which(command)

    working_directory_error = _path_error_message(working_directory, "working directory")
    if working_directory_error:
        payload = {
            "ok": False,
            "status": "error",
            "command": "bgmi update --download",
            "exitCode": None,
            "stdout": "",
            "stderr": working_directory_error,
            "startedAt": started_at.isoformat(),
            "finishedAt": dt.datetime.now().astimezone().isoformat(),
            "durationMs": int((time.perf_counter() - started_perf) * 1000),
            "workingDirectory": str(working_directory),
            "configPath": str(config_path),
            "bgmiPath": str(BGMI_PATH),
            "successCount": 0,
            "skippedCount": 0,
            "failedCount": 1,
            "errors": [{"bangumi": "bgmi update --download", "error": working_directory_error}],
        }
        _append_maintenance_log("submit_download_jobs", payload)
        return {"status": "success", "message": "bgmi update --download failed", "data": payload}

    if command_path is None:
        payload = {
            "ok": False,
            "status": "error",
            "command": "bgmi update --download",
            "exitCode": None,
            "stdout": "",
            "stderr": "bgmi command not found",
            "startedAt": started_at.isoformat(),
            "finishedAt": dt.datetime.now().astimezone().isoformat(),
            "durationMs": int((time.perf_counter() - started_perf) * 1000),
            "workingDirectory": str(working_directory),
            "configPath": str(config_path),
            "bgmiPath": str(BGMI_PATH),
            "successCount": 0,
            "skippedCount": 0,
            "failedCount": 1,
            "errors": [{"bangumi": "bgmi update --download", "error": "bgmi command not found"}],
        }
        _append_maintenance_log("submit_download_jobs", payload)
        return {"status": "success", "message": "bgmi update --download failed", "data": payload}

    env = environ.copy()
    env.setdefault("BGMI_PATH", str(BGMI_PATH))

    try:
        process = subprocess.Popen(
            [command_path, *args],
            cwd=working_directory,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        stdout, stderr = process.communicate()
        exit_code: Optional[int] = process.returncode
    except PermissionError:
        payload = {
            "ok": False,
            "status": "error",
            "command": "bgmi update --download",
            "exitCode": None,
            "stdout": "",
            "stderr": "Permission denied while executing bgmi update --download",
            "startedAt": started_at.isoformat(),
            "finishedAt": dt.datetime.now().astimezone().isoformat(),
            "durationMs": int((time.perf_counter() - started_perf) * 1000),
            "workingDirectory": str(working_directory),
            "configPath": str(config_path),
            "bgmiPath": str(BGMI_PATH),
            "successCount": 0,
            "skippedCount": 0,
            "failedCount": 1,
            "errors": [{"bangumi": "bgmi update --download", "error": "Permission denied while executing bgmi update --download"}],
        }
        _append_maintenance_log("submit_download_jobs", payload)
        return {"status": "success", "message": "bgmi update --download failed", "data": payload}
    except FileNotFoundError:
        payload = {
            "ok": False,
            "status": "error",
            "command": "bgmi update --download",
            "exitCode": None,
            "stdout": "",
            "stderr": "bgmi command not found",
            "startedAt": started_at.isoformat(),
            "finishedAt": dt.datetime.now().astimezone().isoformat(),
            "durationMs": int((time.perf_counter() - started_perf) * 1000),
            "workingDirectory": str(working_directory),
            "configPath": str(config_path),
            "bgmiPath": str(BGMI_PATH),
            "successCount": 0,
            "skippedCount": 0,
            "failedCount": 1,
            "errors": [{"bangumi": "bgmi update --download", "error": "bgmi command not found"}],
        }
        _append_maintenance_log("submit_download_jobs", payload)
        return {"status": "success", "message": "bgmi update --download failed", "data": payload}
    except Exception as exc:  # pragma: no cover - defensive
        payload = {
            "ok": False,
            "status": "error",
            "command": "bgmi update --download",
            "exitCode": None,
            "stdout": "",
            "stderr": str(exc),
            "startedAt": started_at.isoformat(),
            "finishedAt": dt.datetime.now().astimezone().isoformat(),
            "durationMs": int((time.perf_counter() - started_perf) * 1000),
            "workingDirectory": str(working_directory),
            "configPath": str(config_path),
            "bgmiPath": str(BGMI_PATH),
            "successCount": 0,
            "skippedCount": 0,
            "failedCount": 1,
            "errors": [{"bangumi": "bgmi update --download", "error": str(exc)}],
        }
        _append_maintenance_log("submit_download_jobs", payload)
        return {"status": "success", "message": "bgmi update --download failed", "data": payload}

    stderr_summary = (stderr or "").strip()
    payload = {
        "ok": exit_code == 0,
        "status": "success" if exit_code == 0 else "error",
        "command": "bgmi update --download",
        "exitCode": exit_code,
        "stdout": stdout or "",
        "stderr": stderr or "",
        "startedAt": started_at.isoformat(),
        "finishedAt": dt.datetime.now().astimezone().isoformat(),
        "durationMs": int((time.perf_counter() - started_perf) * 1000),
        "workingDirectory": str(working_directory),
        "configPath": str(config_path),
        "bgmiPath": str(BGMI_PATH),
        "successCount": 1 if exit_code == 0 else 0,
        "skippedCount": 0,
        "failedCount": 0 if exit_code == 0 else 1,
        "errors": [] if exit_code == 0 else [{"bangumi": "bgmi update --download", "error": stderr_summary or f"exit code {exit_code}"}],
    }
    _append_maintenance_log("submit_download_jobs", payload)
    return {
        "status": "success",
        "message": "bgmi update --download completed" if payload["ok"] else "bgmi update --download failed",
        "data": payload,
    }


def refresh_episodes_and_posters() -> Dict[str, Any]:
    bangumi_before = Bangumi.select().count()
    cover_seed = ScriptRunner().get_download_cover()

    try:
        fetched_rows = website.fetch(group_by_weekday=False) or []
    except Exception as exc:  # pragma: no cover - defensive
        payload = {
            "updatedCount": 0,
            "posterUpdatedCount": 0,
            "episodeUpdatedCount": 0,
            "skippedCount": bangumi_before,
            "failedCount": 1,
            "errors": [{"bangumi": "mikan-reindex", "error": str(exc)}],
            "reindexedCount": 0,
        }
        _append_maintenance_log("refresh_episodes_and_posters", payload)
        return {"status": "success", "message": "Refresh metadata failed", "data": payload}

    bangumi_after = Bangumi.select().count()
    fetched_cover_urls = [row.cover for row in fetched_rows if getattr(row, "cover", "")]
    cached_count, cache_errors = _cache_cover_urls([*cover_seed, *fetched_cover_urls])
    failed_count = len(cache_errors)

    payload = {
        "updatedCount": bangumi_after,
        "posterUpdatedCount": cached_count,
        "episodeUpdatedCount": 0,
        "skippedCount": max(bangumi_before - bangumi_after, 0),
        "failedCount": failed_count,
        "errors": cache_errors,
        "reindexedCount": len(fetched_rows),
    }
    _append_maintenance_log("refresh_episodes_and_posters", payload)
    return {"status": "success", "message": "Refresh metadata completed", "data": payload}


def _sync_save_path_map(target_name: str, folder_name: str) -> None:
    if folder_name == target_name:
        if target_name in cfg.save_path_map:
            cfg.save_path_map.pop(target_name, None)
            cfg.save()
        return

    current = cfg.save_path_map.get(target_name)
    if current != folder_name:
        cfg.save_path_map[target_name] = folder_name
        cfg.save()


def _build_rebuild_item_from_folder(folder: Path) -> Dict[str, Any]:
    folder_name = folder.name
    scan = _scan_library_for_video_files(folder)
    item: Dict[str, Any] = {
        'folderName': folder_name,
        'path': folder.as_posix(),
        'hasVideoFiles': bool(scan.get('hasVideoFiles')),
        'videoFileCount': int(scan.get('videoFileCount') or 0),
        'sampleFile': scan.get('sampleFile', ''),
        'status': 'unmatched',
        'action': 'skip',
        'reason': '',
        'queries': [],
        'candidates': [],
        'matchedName': '',
        'keyword': '',
        'cover': '',
        'matchSource': '',
    }

    existing = _folder_existing_match(folder_name)
    if existing is not None:
        item['existingBangumiName'] = existing.name
        item['existingSource'] = existing.source
        item['existingInLibrary'] = bool(existing.in_library)

    if scan['status'] == 'missingFolder':
        item['status'] = 'missingFolder'
        item['reason'] = f'folder not found: {folder}'
        return item
    if scan['status'] == 'permissionDenied':
        item['status'] = 'permissionDenied'
        item['reason'] = scan.get('error') or f'Permission denied while scanning {folder}'
        return item

    if not item['hasVideoFiles']:
        item['status'] = 'emptyLibraryItem'
        item['reason'] = 'No valid video files found under this folder'
        if existing is not None:
            protected, reasons = _has_protected_user_data(existing.name)
            if protected:
                item['action'] = 'skipProtected'
                item['reason'] = f'Protected record: {", ".join(reasons)}'
            elif existing.source == 'local':
                item['action'] = 'deleteEmptyLocal'
                item['reason'] = 'Local-only record will be removed because the folder has no video files'
        return item

    if existing is not None:
        item.update(
            {
                'status': 'matched',
                'action': 'update',
                'matchedName': existing.name,
                'keyword': existing.keyword,
                'cover': existing.cover,
                'matchSource': 'existing',
                'reason': 'Matched existing Bangumi record',
            }
        )
        return item

    chosen, candidate_list, query_list = resolve_bangumi(folder_name)
    item['queries'] = query_list
    if chosen:
        matched_name = str(chosen['name'])
        item.update(
            {
                'status': 'matched',
                'matchedName': matched_name,
                'keyword': str(chosen['keyword']),
                'cover': chosen.get('cover', ''),
                'matchSource': chosen.get('matchType', 'remote'),
                'action': 'update' if Bangumi.select().where(Bangumi.name == matched_name).exists() else 'create',
                'reason': f'Matched via Mikan ({chosen.get("matchType", "remote")})',
            }
        )
        return item

    if candidate_list:
        item['status'] = 'multiple'
        item['candidates'] = candidate_list[:3]
        item['reason'] = 'Multiple candidates matched; manual resolution required'
        return item

    item['status'] = 'unmatched'
    item['reason'] = 'No Bangumi matched from existing records or Mikan'
    return item


def _build_rebuild_item_from_existing_local(row: Bangumi) -> Optional[Dict[str, Any]]:
    folder = _resolve_library_path(row)
    try:
        normalized_path = folder.resolve().as_posix()
    except OSError:
        normalized_path = folder.as_posix()

    if folder.exists() and folder.is_dir():
        return None

    protected, reasons = _has_protected_user_data(row.name)
    action = 'skipProtected' if protected else 'skip'
    reason = f'Missing library folder: {folder}'
    if reasons:
        reason = f'{reason} ({", ".join(reasons)})'

    return {
        'folderName': Path(row.library_path or row.name).name,
        'path': normalized_path,
        'hasVideoFiles': False,
        'videoFileCount': 0,
        'sampleFile': '',
        'status': 'missingFolder',
        'action': action,
        'reason': reason,
        'queries': [],
        'candidates': [],
        'matchedName': row.name,
        'keyword': row.keyword,
        'cover': row.cover,
        'matchSource': 'existing-local',
        'existingBangumiName': row.name,
        'existingSource': row.source,
        'existingInLibrary': bool(row.in_library),
    }


def _collect_rebuild_preview(offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
    folders, scan_errors = _collect_local_bangumi_folders()
    total_folders = len(folders)
    safe_offset = max(offset, 0)
    folders = folders[safe_offset:]
    if limit is not None and limit >= 0:
        folders = folders[:limit]

    preview_items: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = [{"folderName": '', "error": error} for error in scan_errors]
    matched_count = 0
    unmatched_count = 0
    multi_candidate_count = 0
    create_count = 0
    update_count = 0
    skip_count = 0
    empty_folder_count = 0
    will_delete_empty_local_count = 0
    will_skip_protected_empty_count = 0

    scanned_paths = set()
    for folder in folders:
        try:
            scanned_paths.add(str(folder.resolve()))
        except OSError:
            scanned_paths.add(folder.as_posix())

        try:
            item = _build_rebuild_item_from_folder(folder)
            preview_items.append(item)
        except Exception as exc:  # pragma: no cover - defensive
            item = {
                'folderName': folder.name,
                'path': folder.as_posix(),
                'hasVideoFiles': False,
                'videoFileCount': 0,
                'sampleFile': '',
                'status': 'permissionDenied',
                'action': 'skip',
                'reason': str(exc),
                'queries': [],
                'candidates': [],
                'matchedName': '',
                'keyword': '',
                'cover': '',
                'matchSource': '',
            }
            preview_items.append(item)
            errors.append({'folderName': folder.name, 'error': str(exc)})

        status = item['status']
        action = item['action']
        if status == 'matched':
            matched_count += 1
        elif status == 'unmatched':
            unmatched_count += 1
        elif status == 'multiple':
            multi_candidate_count += 1
        elif status == 'emptyLibraryItem':
            empty_folder_count += 1

        if action == 'create':
            create_count += 1
        elif action == 'update':
            update_count += 1
        else:
            skip_count += 1

        if action == 'deleteEmptyLocal':
            will_delete_empty_local_count += 1
        elif status == 'emptyLibraryItem' and action == 'skipProtected':
            will_skip_protected_empty_count += 1

    existing_local_rows = list(
        Bangumi.select().where((Bangumi.source == 'local') | (Bangumi.in_library == True))
    )
    for row in existing_local_rows:
        folder = _resolve_library_path(row)
        try:
            folder_key = str(folder.resolve())
        except OSError:
            folder_key = folder.as_posix()
        if folder_key in scanned_paths:
            continue

        extra_item = _build_rebuild_item_from_existing_local(row)
        if extra_item is None:
            continue
        preview_items.append(extra_item)
        skip_count += 1

    return {
        'foldersScanned': len(folders),
        'totalFolders': total_folders,
        'offset': safe_offset,
        'limit': limit,
        'hasMore': safe_offset + len(folders) < total_folders,
        'matchedCount': matched_count,
        'unmatchedCount': unmatched_count,
        'multiCandidateCount': multi_candidate_count,
        'createCount': create_count,
        'updateCount': update_count,
        'skipCount': skip_count,
        'emptyFolderCount': empty_folder_count,
        'willDeleteEmptyLocalCount': will_delete_empty_local_count,
        'willSkipProtectedEmptyCount': will_skip_protected_empty_count,
        'failedCount': len(errors),
        'errors': errors,
        'items': preview_items,
    }


def preview_rebuild_repository(offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
    preview = _collect_rebuild_preview(offset=offset, limit=limit)
    return {
        'status': 'success',
        'message': 'Generated rebuild repository dry-run preview',
        'data': {
            'action': 'rebuild_repository',
            'confirmKeyword': 'REBUILD',
            **preview,
        },
    }


def _resolve_local_source(existing_source: str) -> str:
    if existing_source in ('remote', 'hybrid'):
        return 'hybrid'
    return 'local'


def _upsert_local_bangumi_from_item(item: Dict[str, Any]) -> Tuple[Bangumi, List[str]]:
    target_name = item['matchedName']
    folder_name = item['folderName']
    keyword = item.get('keyword') or ''
    cover_urls: List[str] = []
    bangumi_row = Bangumi.select().where(Bangumi.name == target_name).first()

    if keyword:
        bangumi_info = website.fetch_single_bangumi(keyword)
        if bangumi_info is not None:
            bangumi_info.name = target_name
            if item.get('cover') and not bangumi_info.cover:
                bangumi_info.cover = item['cover']
            BaseWebsite.save_bangumi(bangumi_info)
            if bangumi_info.cover:
                cover_urls.append(bangumi_info.cover)
            bangumi_row = Bangumi.select().where(Bangumi.keyword == keyword).first() or Bangumi.select().where(Bangumi.name == target_name).first()

    if bangumi_row is None and keyword:
        bangumi_row = Bangumi.select().where(Bangumi.keyword == keyword).first()
        if bangumi_row is not None and bangumi_row.name != target_name:
            bangumi_row.name = target_name
            bangumi_row.save()

    if bangumi_row is None:
        bangumi_row = Bangumi.create(
            name=target_name,
            subtitle_group='',
            keyword=keyword,
            update_time='Unknown',
            cover=item.get('cover', ''),
            status=STATUS_END,
            source='local',
            in_library=True,
            library_path=folder_name,
        )
    else:
        if not bangumi_row.cover and item.get('cover'):
            bangumi_row.cover = item['cover']
            cover_urls.append(item['cover'])
        bangumi_row.status = STATUS_END
        bangumi_row.source = _resolve_local_source(bangumi_row.source or 'remote')
        bangumi_row.in_library = True
        bangumi_row.library_path = folder_name
        if keyword and not bangumi_row.keyword:
            bangumi_row.keyword = keyword
        bangumi_row.save()

    _rename_existing_metadata(target_name, folder_name)
    _sync_save_path_map(target_name, folder_name)
    _clear_local_scan_issues(target_name)
    return bangumi_row, cover_urls


def _delete_empty_local_row(row: Bangumi) -> None:
    BangumiIssue.delete().where(BangumiIssue.bangumi_name == row.name).execute()
    Filter.delete().where(Filter.bangumi_name == row.name).execute()
    Followed.delete().where(Followed.bangumi_name == row.name).execute()
    if row.name in cfg.save_path_map:
        cfg.save_path_map.pop(row.name, None)
        cfg.save()
    row.delete_instance()


def execute_rebuild_repository(confirmText: str = '', offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
    if confirmText != 'REBUILD':
        return {'status': 'error', 'message': 'confirmText mismatch, expected REBUILD'}

    preview = _collect_rebuild_preview(offset=offset, limit=limit)
    success_count = 0
    failed_count = len(preview.get('errors', []))
    skipped_count = 0
    deleted_empty_local_count = 0
    skipped_protected_empty_count = 0
    failed_delete_count = 0
    errors: List[Dict[str, str]] = list(preview.get('errors', []))
    cover_urls_to_cache: List[str] = []

    for item in preview['items']:
        action = item['action']
        folder_name = item['folderName']
        target_name = item.get('matchedName') or item.get('existingBangumiName') or folder_name

        try:
            if action in {'create', 'update'} and item['status'] == 'matched':
                _, cover_urls = _upsert_local_bangumi_from_item(item)
                cover_urls_to_cache.extend(cover_urls)
                success_count += 1
                continue

            if action == 'deleteEmptyLocal':
                row = Bangumi.select().where(Bangumi.name == target_name).first()
                if row is None:
                    skipped_count += 1
                    continue
                _delete_empty_local_row(row)
                deleted_empty_local_count += 1
                success_count += 1
                continue

            if item['status'] == 'emptyLibraryItem' and action == 'skipProtected':
                skipped_protected_empty_count += 1
                skipped_count += 1
                _set_local_scan_issue(target_name, ISSUE_EMPTY_LOCAL_FOLDER, item['reason'], item.get('path'))
                continue

            if item['status'] == 'missingFolder':
                skipped_count += 1
                _set_local_scan_issue(target_name, ISSUE_MISSING_FOLDER, item['reason'], item.get('path'))
                continue

            if item['status'] == 'permissionDenied':
                skipped_count += 1
                _set_local_scan_issue(target_name, ISSUE_PERMISSION_DENIED, item['reason'], item.get('path'))
                continue

            skipped_count += 1
        except Exception as exc:  # pragma: no cover - defensive
            if action == 'deleteEmptyLocal':
                failed_delete_count += 1
            failed_count += 1
            errors.append({'folderName': folder_name, 'error': str(exc)})

    cached_cover_count, cache_errors = _cache_cover_urls(cover_urls_to_cache)
    failed_count += len(cache_errors)
    errors.extend(cache_errors)

    payload = {
        'affectedCount': preview['foldersScanned'],
        'totalFolders': preview.get('totalFolders', preview['foldersScanned']),
        'offset': preview.get('offset', 0),
        'limit': preview.get('limit'),
        'hasMore': preview.get('hasMore', False),
        'successCount': success_count,
        'failedCount': failed_count,
        'skippedCount': skipped_count,
        'deletedEmptyLocalCount': deleted_empty_local_count,
        'skippedProtectedEmptyCount': skipped_protected_empty_count,
        'failedDeleteCount': failed_delete_count,
        'errors': errors,
        'posterUpdatedCount': cached_cover_count,
        'preview': {
            'matchedCount': preview['matchedCount'],
            'unmatchedCount': preview['unmatchedCount'],
            'multiCandidateCount': preview['multiCandidateCount'],
            'createCount': preview['createCount'],
            'updateCount': preview['updateCount'],
            'skipCount': preview['skipCount'],
            'emptyFolderCount': preview['emptyFolderCount'],
            'willDeleteEmptyLocalCount': preview['willDeleteEmptyLocalCount'],
            'willSkipProtectedEmptyCount': preview['willSkipProtectedEmptyCount'],
        },
    }
    _append_maintenance_log('rebuild_repository', payload)
    return {'status': 'success', 'message': 'Rebuild repository completed', 'data': payload}
