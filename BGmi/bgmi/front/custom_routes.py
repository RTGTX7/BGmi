"""Compatibility routes for the customized frontend on the BGmi 5 backend."""

import datetime as dt
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional

import fastapi
import sqlalchemy as sa
from fastapi.responses import RedirectResponse

from bgmi import __version__
from bgmi.config import BGMI_PATH, CONFIG_FILE_PATH, cfg
from bgmi.front.index import get_player
from bgmi.front.player_assets import (
    build_browser_assets,
    ensure_hls_profile,
    get_hls_profile_status,
    local_media_routing_state,
    resolve_media_origin_for_host,
    start_hls_profile_generation,
)
from bgmi.lib import controllers as ctl
from bgmi.lib.fetch import website
from bgmi.lib.maintenance import execute_rebuild_repository, preview_rebuild_repository
from bgmi.lib.table import Bangumi, BangumiIssue, Followed, Session, Subtitle
from bgmi.utils import normalize_path

router = fastapi.APIRouter()
ISSUE_MISSING_EPISODES = "missing_episodes"
ISSUE_MISSING_PLAYABLE_SOURCE = "missing_playable_source"


def envelope(data: Any = None, *, status: str = "success", message: str = "") -> dict[str, Any]:
    return {
        "version": __version__,
        "latest_version": None,
        "frontend_version": "2.1.3",
        "status": status,
        "lang": cfg.lang,
        "danmaku_api": cfg.http.danmaku_api_url,
        "data": data,
        "message": message,
    }


def require_token(token: Optional[str] = fastapi.Header(None, alias="bgmi-token")) -> None:
    if token != cfg.http.admin_token:
        raise fastapi.HTTPException(401, "Unauthorized Request")


def cover_url(cover: str) -> str:
    if not cover or cover.startswith(("http://", "https://", "/")):
        return cover
    return f"/bangumi/.cover/{normalize_path(cover)}"


def cover_season(cover: str) -> tuple[Optional[int], Optional[int], Optional[str]]:
    match = re.search(r"(?:^|/)Bangumi/(\d{4})(\d{2})(?:/|$)", cover)
    if not match:
        return None, None, None
    year, month = int(match[1]), int(match[2])
    if month not in range(1, 13):
        return None, None, None
    quarter = ((month - 1) // 3) * 3 + 1
    return year, quarter, f"{year}{quarter:02d}"


def player_map(bangumi: Bangumi, followed: Optional[Followed]) -> dict[int, dict[str, str]]:
    episodes = followed.episodes if followed and cfg.enable_path_formatter else ()
    return get_player(
        bangumi.name,
        episodes=episodes,
        season=followed.season if followed else 1,
        episode_offset=followed.episode_offset if followed else 0,
        display_name=followed.display_name if followed else "",
    )


def list_item(bangumi: Bangumi, followed: Optional[Followed], missing: set[str]) -> dict[str, Any]:
    year, quarter, season = cover_season(bangumi.cover)
    return {
        "id": bangumi.id,
        "name": bangumi.name,
        "bangumi_name": bangumi.name,
        "cover": cover_url(bangumi.cover),
        "update_time": bangumi.update_day,
        "episode": followed.episode if followed else 0,
        "status": followed.status if followed else 0,
        "updated_time": followed.updated_time if followed else 0,
        "year": year,
        "quarter": quarter,
        "season": season,
        "isSubscribed": bool(followed and followed.status != Followed.STATUS_DELETED),
        "hasMissingEpisodes": bangumi.name in missing,
        "source": bangumi.source,
        "inLibrary": bangumi.in_library,
        "libraryPath": bangumi.library_path,
        "player": player_map(bangumi, followed),
    }


def find_bangumi(name: str) -> Bangumi:
    if not name.strip():
        raise fastapi.HTTPException(400, "bangumi name required")
    with Session.begin() as session:
        bangumi = session.scalar(sa.select(Bangumi).where(Bangumi.name == name))
        if not bangumi:
            bangumi = session.scalar(sa.select(Bangumi).where(Bangumi.name.contains(name)).limit(1))
    if bangumi is None:
        raise fastapi.HTTPException(404, "bangumi not found")
    return bangumi


def find_source(name: str, episode: str) -> Path:
    bangumi = find_bangumi(name)
    try:
        number = int(episode)
    except ValueError as error:
        raise fastapi.HTTPException(400, "invalid episode") from error
    with Session.begin() as session:
        followed = session.get(Followed, bangumi.name)
    entry = player_map(bangumi, followed).get(number)
    if not entry:
        set_issue(name, ISSUE_MISSING_PLAYABLE_SOURCE, episode)
        raise fastapi.HTTPException(404, "episode source not found")
    path = (cfg.save_path / entry["path"].lstrip("/")).resolve()
    if not path.is_relative_to(cfg.save_path.resolve()) or not path.is_file():
        set_issue(name, ISSUE_MISSING_PLAYABLE_SOURCE, episode)
        raise fastapi.HTTPException(404, "episode source not found")
    clear_issue(name, ISSUE_MISSING_PLAYABLE_SOURCE)
    return path


def set_issue(name: str, issue_type: str, episode: Optional[str] = None) -> None:
    with Session.begin() as session:
        issue = session.scalar(
            sa.select(BangumiIssue).where(BangumiIssue.bangumi_name == name, BangumiIssue.issue_type == issue_type)
        )
        if issue is None:
            issue = BangumiIssue(bangumi_name=name, issue_type=issue_type)
            session.add(issue)
        issue.episode = episode
        issue.marked_at = int(time.time())


def clear_issue(name: str, issue_type: str) -> None:
    with Session.begin() as session:
        session.execute(
            sa.delete(BangumiIssue).where(BangumiIssue.bangumi_name == name, BangumiIssue.issue_type == issue_type)
        )


@router.get("/index")
@router.get("/old")
def legacy_bangumi_list(request: fastapi.Request) -> dict[str, Any]:
    old = request.url.path.rstrip("/").endswith("/old")
    wanted = Bangumi.STATUS_END if old else Bangumi.STATUS_UPDATING
    with Session.begin() as session:
        rows = session.execute(
            sa.select(Bangumi, Followed)
            .outerjoin(Followed, Bangumi.name == Followed.bangumi_name)
            .where(Bangumi.status == wanted)
        ).all()
        missing = set(
            session.scalars(
                sa.select(BangumiIssue.bangumi_name).where(BangumiIssue.issue_type == ISSUE_MISSING_EPISODES)
            )
        )
    data = [
        list_item(bangumi, followed, missing)
        for bangumi, followed in rows
        if old or (followed and followed.status != Followed.STATUS_DELETED)
    ]
    data.sort(key=lambda item: (item["updated_time"], item["bangumi_name"]), reverse=True)
    return envelope(data)


@router.get("/player/bangumi")
def legacy_player_bangumi(bangumi: str) -> dict[str, Any]:
    row = find_bangumi(bangumi.strip())
    with Session.begin() as session:
        followed = session.get(Followed, row.name)
        missing = set(
            session.scalars(
                sa.select(BangumiIssue.bangumi_name).where(BangumiIssue.issue_type == ISSUE_MISSING_EPISODES)
            )
        )
    return envelope(list_item(row, followed, missing))


@router.get("/player")
def legacy_player_assets(request: fastapi.Request, bangumi: str, episode: str) -> dict[str, Any]:
    source = find_source(bangumi, episode)
    try:
        data = build_browser_assets(source, bangumi, episode)
    except Exception as error:
        raise fastapi.HTTPException(500, str(error)) from error
    data["mediaOrigin"] = resolve_media_origin_for_host(request.headers.get("host", ""))
    return envelope(data)


@router.get("/player/hls")
def legacy_player_hls(request: fastapi.Request, bangumi: str, episode: str, profile: str) -> RedirectResponse:
    source = find_source(bangumi, episode)
    hls_path = ensure_hls_profile(source, profile)
    origin = resolve_media_origin_for_host(request.headers.get("host", ""))
    return RedirectResponse(f"{origin}/bangumi{hls_path}")


@router.post("/player/hls/start")
def legacy_player_hls_start(bangumi: str, episode: str, profile: str) -> dict[str, Any]:
    return envelope(start_hls_profile_generation(find_source(bangumi, episode), profile))


@router.get("/player/hls/status")
def legacy_player_hls_status(bangumi: str, episode: str, profile: str) -> dict[str, Any]:
    return envelope(get_hls_profile_status(find_source(bangumi, episode), profile))


@router.get("/cal")
def legacy_calendar() -> dict[str, Any]:
    result = Bangumi.get_updating_bangumi()
    for entries in result.values():
        for bangumi in entries:
            bangumi["cover"] = cover_url(bangumi["cover"])
    return envelope(result)


@router.post("/auth")
def legacy_auth(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("token") != cfg.http.admin_token:
        raise fastapi.HTTPException(401, "Unauthorized Request")
    return envelope()


@router.post("/add", dependencies=[fastapi.Depends(require_token)])
def legacy_add(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise fastapi.HTTPException(400, "bangumi name required")
    episode = payload.get("episode")
    result = ctl.add(name=name, episode=int(episode) if episode is not None else 0)
    if result["status"] == "error":
        raise fastapi.HTTPException(400, result["message"])
    return envelope(message=result.get("message", ""))


@router.post("/delete", dependencies=[fastapi.Depends(require_token)])
def legacy_delete(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise fastapi.HTTPException(400, "bangumi name required")
    result = ctl.delete(name=name)
    if result["status"] == "error":
        raise fastapi.HTTPException(404, result["message"])
    return envelope(message=result.get("message", ""))


@router.post("/mark", dependencies=[fastapi.Depends(require_token)])
def legacy_mark(payload: dict[str, Any]) -> dict[str, Any]:
    name = find_bangumi(str(payload.get("name") or "")).name
    episode = max(0, int(payload.get("episode") or 0))
    with Session.begin() as session:
        followed = session.get(Followed, name)
        if not followed or followed.status == Followed.STATUS_DELETED:
            raise fastapi.HTTPException(404, "bangumi not followed")
        followed.episodes = set(range(1, episode + 1))
    return envelope(message="episode progress saved")


@router.post("/filter", dependencies=[fastapi.Depends(require_token)])
def legacy_filter(payload: dict[str, Any]) -> dict[str, Any]:
    name = find_bangumi(str(payload.get("name") or "")).name
    with Session.begin() as session:
        followed = session.get(Followed, name)
        bangumi = session.scalar(sa.select(Bangumi).where(Bangumi.name == name))
        if not followed or not bangumi:
            raise fastapi.HTTPException(404, "bangumi not followed")
        available = {item.name: item.id for item in session.scalars(sa.select(Subtitle)).all() if item.id in bangumi.subtitle_group}
        if any(field in payload for field in ("subtitle", "include", "exclude", "regex")):
            for key in ("include", "exclude"):
                if key in payload:
                    setattr(followed, key, [part.strip() for part in (payload[key] or "").split(",") if part.strip()])
            if "regex" in payload:
                followed.regex = payload["regex"] or ""
            if "subtitle" in payload:
                names = [part.strip() for part in (payload["subtitle"] or "").split(",") if part.strip()]
                followed.subtitle = [available[item] for item in names if item in available]
        data = {
            "name": name,
            "subtitle_group": list(available),
            "followed": [title for title, identifier in available.items() if identifier in followed.subtitle],
            "include": ",".join(followed.include),
            "exclude": ",".join(followed.exclude),
            "regex": followed.regex,
        }
    return envelope(data)


@router.post("/update", dependencies=[fastapi.Depends(require_token)])
def legacy_update(payload: dict[str, Any], background: fastapi.BackgroundTasks) -> dict[str, Any]:
    name = payload.get("name") or ""
    names = [name] if isinstance(name, str) and name else name if isinstance(name, list) else []
    background.add_task(ctl.update, names, bool(payload.get("download")))
    return envelope(message="start updating")


def anomaly_report(limit: int = 50) -> dict[str, Any]:
    with Session.begin() as session:
        bangumi_rows = session.scalars(sa.select(Bangumi)).all()
        followed_rows = session.scalars(sa.select(Followed).where(Followed.status != Followed.STATUS_DELETED)).all()
        issues = session.scalars(sa.select(BangumiIssue).order_by(BangumiIssue.marked_at.desc())).all()
    names = {row.name for row in bangumi_rows}
    items: list[dict[str, Any]] = []
    counts = {
        "missingPoster": 0,
        "missingSeason": 0,
        "missingKeyword": 0,
        "danglingFollowed": 0,
        "duplicateRecords": 0,
        "missingEpisodes": 0,
        "missingPlayableSource": 0,
        "emptyLocalFolder": 0,
        "missingFolder": 0,
        "permissionDenied": 0,
    }
    for row in bangumi_rows:
        for kind, condition, detail in (
            ("missingPoster", not row.cover, "Missing poster URL"),
            ("missingSeason", cover_season(row.cover)[2] is None, "Failed to resolve season from cover URL"),
            ("missingKeyword", row.source == "local" or not row.id, "Missing source ID"),
        ):
            if condition:
                counts[kind] += 1
                items.append({"type": kind, "name": row.name, "detail": detail})
    for row in followed_rows:
        if row.bangumi_name not in names:
            counts["danglingFollowed"] += 1
            items.append({"type": "dangling_followed", "name": row.bangumi_name, "detail": "Missing bangumi metadata"})
    issue_keys = {
        "missing_episodes": "missingEpisodes",
        "missing_playable_source": "missingPlayableSource",
        "empty_local_folder": "emptyLocalFolder",
        "missing_folder": "missingFolder",
        "permission_denied": "permissionDenied",
    }
    for issue in issues:
        key = issue_keys.get(issue.issue_type)
        if key:
            counts[key] += 1
        items.append(
            {
                "type": issue.issue_type,
                "name": issue.bangumi_name,
                "detail": issue.note or issue.file_path or issue.episode or issue.issue_type,
                "episode": issue.episode,
                "filePath": issue.file_path,
                "markedAt": dt.datetime.fromtimestamp(issue.marked_at, dt.timezone.utc).isoformat() if issue.marked_at else None,
            }
        )
    counts["total"] = sum(counts.values())
    return {"summary": counts, "items": items[:limit]}


@router.get("/dashboard", dependencies=[fastapi.Depends(require_token)])
def dashboard() -> dict[str, Any]:
    with Session.begin() as session:
        bangumi_rows = session.scalars(sa.select(Bangumi)).all()
        followed_rows = session.scalars(sa.select(Followed).where(Followed.status != Followed.STATUS_DELETED)).all()
    today = dt.date.today()
    current_season = f"{today.year}{((today.month - 1) // 3) * 3 + 1:02d}"
    local_folders = [path for path in cfg.save_path.iterdir() if path.is_dir() and not path.name.startswith(".")] if cfg.save_path.exists() else []
    report = anomaly_report(limit=12)
    return envelope(
        {
            "stats": {
                "subscribedTotal": len(followed_rows),
                "bangumiTotal": len(bangumi_rows),
                "currentSeasonTotal": sum(cover_season(row.cover)[2] == current_season for row in bangumi_rows),
                "todayUpdatedTotal": sum(row.status == Followed.STATUS_UPDATED for row in followed_rows),
                "matchedMikanTotal": sum(bool(row.id) and row.source != "local" for row in bangumi_rows),
                "anomalyTotal": report["summary"]["total"],
                "localFolderTotal": len(local_folders),
                "lastSyncTime": dt.datetime.fromtimestamp(cfg.db_path.stat().st_mtime, dt.timezone.utc).isoformat() if cfg.db_path.exists() else None,
                "currentSeasonKey": current_season,
                "workingDirectory": str(Path.cwd()),
                "configPath": str(CONFIG_FILE_PATH),
                "bgmiPath": str(BGMI_PATH),
                "savePath": str(cfg.save_path),
                "savePathStatus": "ok" if cfg.save_path.is_dir() else "missing",
            },
            "anomalies": report,
            "playerSettings": {"localMediaRouting": local_media_routing_state()},
        }
    )


@router.post("/dashboard-anomalies", dependencies=[fastapi.Depends(require_token)])
def dashboard_anomalies() -> dict[str, Any]:
    return envelope(anomaly_report(limit=100))


@router.post("/dashboard-reset-preview", dependencies=[fastapi.Depends(require_token)])
def dashboard_reset_preview() -> dict[str, Any]:
    with Session.begin() as session:
        affected = session.scalar(sa.select(sa.func.count()).select_from(Followed).where(Followed.status != Followed.STATUS_DELETED)) or 0
    return envelope({"action": "reset_episodes", "confirmKeyword": "RESET", "affectedCount": affected, "fields": ["episodes"]})


@router.post("/dashboard-reset", dependencies=[fastapi.Depends(require_token)])
def dashboard_reset(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("confirmText") != "RESET":
        raise fastapi.HTTPException(400, "confirmText mismatch, expected RESET")
    with Session.begin() as session:
        followed_rows = session.scalars(sa.select(Followed).where(Followed.status != Followed.STATUS_DELETED)).all()
        for row in followed_rows:
            row.episodes = set()
    return envelope({"affectedCount": len(followed_rows), "successCount": len(followed_rows), "failedCount": 0, "skippedCount": 0, "errors": []})


@router.post("/player/mark-missing-episodes", dependencies=[fastapi.Depends(require_token)])
def mark_missing_episodes(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("bangumiName") or "").strip()
    find_bangumi(name)
    with Session.begin() as session:
        issue = session.scalar(sa.select(BangumiIssue).where(BangumiIssue.bangumi_name == name, BangumiIssue.issue_type == ISSUE_MISSING_EPISODES))
        if issue is None:
            issue = BangumiIssue(bangumi_name=name, issue_type=ISSUE_MISSING_EPISODES)
            session.add(issue)
        issue.episode = str(payload.get("episode") or "") or None
        issue.file_path = payload.get("filePath")
        issue.note = payload.get("note") or "Marked as missing episodes"
        issue.marked_at = int(time.time())
    return envelope({"bangumiName": name, "issueType": ISSUE_MISSING_EPISODES, "hasMissingEpisodes": True})


@router.post("/player/clear-missing-episodes", dependencies=[fastapi.Depends(require_token)])
def clear_missing_episodes(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("bangumiName") or "").strip()
    if not name:
        raise fastapi.HTTPException(400, "bangumiName required")
    clear_issue(name, ISSUE_MISSING_EPISODES)
    return envelope({"bangumiName": name, "issueType": ISSUE_MISSING_EPISODES, "hasMissingEpisodes": False})


@router.post("/dashboard-database-search", dependencies=[fastapi.Depends(require_token)])
def dashboard_database_search(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    wanted_id = payload.get("bangumiId")
    limit = min(max(int(payload.get("limit") or 20), 1), 100)
    with Session.begin() as session:
        statement = sa.select(Bangumi, Followed).outerjoin(Followed, Bangumi.name == Followed.bangumi_name)
        if wanted_id is not None:
            statement = statement.where(Bangumi.id.in_([str(wanted_id), f"local:{wanted_id}"]))
        elif query:
            statement = statement.where(sa.or_(Bangumi.name.contains(query), Bangumi.id.contains(query)))
        rows = session.execute(statement.limit(limit)).all()
    items = [
        {
            "id": bangumi.id,
            "name": bangumi.name,
            "keyword": bangumi.id if bangumi.source != "local" else "",
            "status": bangumi.status,
            "source": bangumi.source,
            "inLibrary": bangumi.in_library,
            "libraryPath": bangumi.library_path,
            "isSubscribed": bool(followed and followed.status != Followed.STATUS_DELETED),
            "episode": followed.episode if followed else 0,
            "subtitleGroups": bangumi.subtitle_group,
            "updateTime": bangumi.update_day,
        }
        for bangumi, followed in rows
    ]
    return envelope({"items": items, "count": len(items), "query": query, "id": wanted_id, "limit": limit})


@router.post("/dashboard-player-local-media-routing", dependencies=[fastapi.Depends(require_token)])
def dashboard_media_routing(payload: dict[str, Any]) -> dict[str, Any]:
    enabled = bool(payload.get("enabled"))
    hosts = list(dict.fromkeys(str(host).strip().lower() for host in payload.get("localEntryHosts") or [] if str(host).strip()))
    origin = str(payload.get("localMediaOrigin") or "").strip().rstrip("/")
    if enabled and not hosts:
        raise fastapi.HTTPException(400, "localEntryHosts required")
    if origin and not re.fullmatch(r"https?://[^/:\s]+:\d+", origin):
        raise fastapi.HTTPException(400, "localMediaOrigin must include protocol, host, and port")
    if enabled and not origin:
        raise fastapi.HTTPException(400, "localMediaOrigin required")
    cfg.player = {**cfg.player, "local_media_routing": {"enabled": enabled, "local_entry_hosts": hosts, "local_media_origin": origin}}
    cfg.save()
    return envelope(local_media_routing_state())


@router.post("/dashboard-sync", dependencies=[fastapi.Depends(require_token)])
def dashboard_sync() -> dict[str, Any]:
    result = website.fetch(group_by_weekday=False) or []
    return envelope({"affectedCount": len(result), "successCount": len(result), "failedCount": 0, "skippedCount": 0, "errors": [], "lastSyncTime": dt.datetime.now(dt.timezone.utc).isoformat()})


@router.post("/dashboard-submit-downloads", dependencies=[fastapi.Depends(require_token)])
def dashboard_submit_downloads() -> dict[str, Any]:
    started = dt.datetime.now(dt.timezone.utc)
    start_clock = time.perf_counter()
    environment = os.environ.copy()
    environment["BGMI_PATH"] = str(BGMI_PATH)
    try:
        process = subprocess.run(
            [sys.executable, "-m", "bgmi", "update"],
            cwd=BGMI_PATH,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=3600,
            check=False,
        )
        exit_code = process.returncode
        stdout, stderr = process.stdout, process.stderr
    except (OSError, subprocess.TimeoutExpired) as error:
        exit_code, stdout, stderr = None, "", str(error)
    finished = dt.datetime.now(dt.timezone.utc)
    ok = exit_code == 0
    return envelope(
        {
            "ok": ok,
            "status": "success" if ok else "error",
            "command": "bgmi update",
            "exitCode": exit_code,
            "stdout": stdout,
            "stderr": stderr,
            "startedAt": started.isoformat(),
            "finishedAt": finished.isoformat(),
            "durationMs": int((time.perf_counter() - start_clock) * 1000),
            "workingDirectory": str(BGMI_PATH),
            "configPath": str(CONFIG_FILE_PATH),
            "bgmiPath": str(BGMI_PATH),
        }
    )


@router.post("/dashboard/submit-download-jobs", dependencies=[fastapi.Depends(require_token)])
def dashboard_submit_download_jobs() -> dict[str, Any]:
    return dashboard_submit_downloads()


@router.post("/dashboard-refresh-metadata", dependencies=[fastapi.Depends(require_token)])
def dashboard_refresh_metadata() -> dict[str, Any]:
    result = website.fetch(group_by_weekday=False) or []
    with Session.begin() as session:
        before = {row.bangumi_name: set(row.episodes) for row in session.scalars(sa.select(Followed)).all()}
    ctl.update([], download=False)
    with Session.begin() as session:
        after = {row.bangumi_name: set(row.episodes) for row in session.scalars(sa.select(Followed)).all()}
    changed = sum(episodes != before.get(name, set()) for name, episodes in after.items())
    return envelope({"updatedCount": len(result), "posterUpdatedCount": 0, "episodeUpdatedCount": changed, "skippedCount": 0, "failedCount": 0, "errors": []})


@router.post("/dashboard-rebuild-preview", dependencies=[fastapi.Depends(require_token)])
def dashboard_rebuild_preview() -> dict[str, Any]:
    result = preview_rebuild_repository()
    if result["status"] == "error":
        raise fastapi.HTTPException(400, result["message"])
    return envelope(result.get("data"))


@router.post("/dashboard-rebuild", dependencies=[fastapi.Depends(require_token)])
def dashboard_rebuild(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("confirmText") != "REBUILD":
        raise fastapi.HTTPException(400, "confirmText mismatch, expected REBUILD")
    result = execute_rebuild_repository(confirmText="REBUILD")
    if result["status"] == "error":
        raise fastapi.HTTPException(400, result["message"])
    return envelope(result.get("data"))
