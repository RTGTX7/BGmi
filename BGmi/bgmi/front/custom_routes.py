"""Compatibility routes for the customized frontend on the BGmi 5 backend."""

import datetime as dt
import os
import re
import subprocess
import sys
import time
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, unquote, urlparse

import fastapi
import requests
import sqlalchemy as sa
from bs4 import BeautifulSoup
from fastapi.responses import RedirectResponse

from bgmi import __version__
from bgmi.config import BGMI_PATH, CONFIG_FILE_PATH, cfg
from bgmi.front.index import VIDEO_EXTENSIONS, get_player, get_player_versions
from bgmi.front.player_assets import (
    build_browser_assets,
    ensure_hls_profile,
    get_hls_profile_status,
    local_media_routing_state,
    local_video_origin_candidate,
    resolve_media_origin_for_host,
    start_hls_profile_generation,
)
from bgmi.lib import controllers as ctl
from bgmi.lib.fetch import website
from bgmi.lib.maintenance import execute_rebuild_repository, preview_rebuild_repository
from bgmi.lib.mikan_release import mikan_release_by_hash, release_title_key, torrent_info_hash
from bgmi.lib.mikan_resolver import resolve_bangumi
from bgmi.lib.table import Bangumi, BangumiIssue, Download, Followed, Session, Subtitle
from bgmi.utils import normalize_path
from bgmi.website.mikan import get_text, server_root

router = fastapi.APIRouter()


@lru_cache(maxsize=128)
def _glass_cover(url: str) -> tuple[bytes, str]:
    try:
        with requests.get(url, timeout=12, allow_redirects=False, stream=True) as response:
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").split(";")[0]
            if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
                raise ValueError("Unsupported image")
            content = bytearray()
            for chunk in response.iter_content(65536):
                content.extend(chunk)
                if len(content) > 8 * 1024 * 1024:
                    raise ValueError("Image too large")
            return bytes(content), content_type
    except (requests.RequestException, ValueError) as exc:
        raise fastapi.HTTPException(502, "Cover unavailable") from exc


@router.get("/glass-cover")
def glass_cover(url: str) -> fastapi.Response:
    parsed = urlparse(url)
    if (parsed.scheme != "https" or parsed.hostname not in {
        "bangumi.moe", "mikanani.me", "mikanime.tv", "dummyimage.com", "lain.bgm.tv",
    } or parsed.port not in {None, 443} or parsed.username or parsed.password):
        raise fastapi.HTTPException(400, "Unsupported cover source")
    content, content_type = _glass_cover(url)
    return fastapi.Response(content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})

ISSUE_MISSING_EPISODES = "missing_episodes"
ISSUE_MISSING_PLAYABLE_SOURCE = "missing_playable_source"


def simulator_enabled() -> bool:
    return os.getenv("BGMI_SIMULATOR", "0").lower() in {"1", "true", "yes"}


def require_simulator() -> None:
    if not simulator_enabled():
        raise fastapi.HTTPException(404, "Simulator endpoints are disabled")


def envelope(data: Any = None, *, status: str = "success", message: str = "") -> dict[str, Any]:
    return {
        "version": __version__,
        "latest_version": None,
        "frontend_version": "2.1.5",
        "status": status,
        "lang": cfg.lang,
        "danmaku_api": cfg.http.danmaku_api_url,
        "data": data,
        "message": message,
    }


def require_token(token: Optional[str] = fastapi.Header(None, alias="bgmi-token")) -> None:
    if token != cfg.http.admin_token:
        raise fastapi.HTTPException(401, "Unauthorized Request")


@router.get("/debug/status")
def debug_status() -> dict[str, Any]:
    require_simulator()
    with Session.begin() as session:
        bangumi_count = session.scalar(sa.select(sa.func.count()).select_from(Bangumi)) or 0
        followed_count = session.scalar(sa.select(sa.func.count()).select_from(Followed)) or 0
    return envelope({
        "simulator": True,
        "version": __version__,
        "database": str(cfg.db_path),
        "savePath": str(cfg.save_path),
        "bangumiCount": int(bangumi_count),
        "followedCount": int(followed_count),
        "debug": os.getenv("DEBUG", "").lower() in {"1", "true", "yes"},
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
    })


@router.post("/debug/seed", dependencies=[fastapi.Depends(require_token)])
def debug_seed() -> dict[str, Any]:
    require_simulator()
    now = int(time.time())
    fixtures = [
        ("simulator:new", "Simulator New Anime", "Mon 20:00", Bangumi.STATUS_UPDATING,
         "https://dummyimage.com/480x720/2563eb/ffffff.png&text=NEW", {1, 2, 3}, Followed.STATUS_UPDATED),
        ("simulator:archive", "Simulator Archived Anime", "Unknown", Bangumi.STATUS_END,
         "https://dummyimage.com/480x720/475569/ffffff.png&text=ARCHIVE", {1, 2, 3, 4, 5}, Followed.STATUS_END),
    ]
    with Session.begin() as session:
        for item_id, name, update_day, status, cover, episodes, follow_status in fixtures:
            if session.get(Bangumi, item_id) is None:
                session.add(Bangumi(id=item_id, name=name, update_day=update_day, cover=cover,
                                    status=status, source="remote", in_library=False))
            if session.get(Followed, name) is None:
                session.add(Followed(bangumi_name=name, episodes=episodes, status=follow_status,
                                     updated_time=now, season=1))

        # Also expose any user-provided top-level video folders as fixtures.
        for folder in sorted(cfg.save_path.iterdir()) if cfg.save_path.exists() else ():
            if not folder.is_dir() or folder.name.startswith(".") or folder.name.startswith("_"):
                continue
            video_files = [path for path in folder.rglob("*") if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS]
            if not video_files:
                continue
            episode_numbers = set()
            for video_file in video_files:
                match = re.search(
                    r"(?:^|[-_\s])(?:e|ep|第)?\s*(\d{1,3})(?=\s|$|\[|\.)",
                    unquote(video_file.stem),
                    re.IGNORECASE,
                )
                episode_numbers.add(int(match.group(1)) if match else 1)
            item_id = f"simulator:file:{folder.name}"
            local_bangumi = session.get(Bangumi, item_id)
            # Keep local test media visible in the season based frontend.
            local_cover = "https://dummyimage.com/480x720/0f766e/ffffff.png?text=Bangumi/202610"
            if local_bangumi is None:
                session.add(Bangumi(id=item_id, name=folder.name, update_day="Simulator", cover=local_cover,
                                    status=Bangumi.STATUS_UPDATING, source="local", in_library=True,
                                    library_path=str(folder)))
            else:
                local_bangumi.cover = local_cover
                local_bangumi.status = Bangumi.STATUS_UPDATING
                local_bangumi.source = "local"
                local_bangumi.in_library = True
                local_bangumi.library_path = str(folder)
            followed = session.get(Followed, folder.name)
            if followed is None:
                session.add(Followed(bangumi_name=folder.name, episodes=episode_numbers, status=Followed.STATUS_FOLLOWED,
                                     updated_time=now, season=1))
            else:
                followed.episodes = episode_numbers
                followed.updated_time = now
    return debug_status()


@router.post("/debug/reset", dependencies=[fastapi.Depends(require_token)])
def debug_reset() -> dict[str, Any]:
    require_simulator()
    with Session.begin() as session:
        session.execute(sa.delete(Followed).where(Followed.bangumi_name.like("Simulator %")))
        session.execute(sa.delete(Bangumi).where(Bangumi.id.like("simulator:%")))
    return debug_status()


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


def player_versions_map(bangumi: Bangumi, followed: Optional[Followed]) -> dict[int, list[dict[str, str]]]:
    episodes = followed.episodes if followed and cfg.enable_path_formatter else ()
    versions_by_episode = get_player_versions(
        bangumi.name, episodes=episodes, season=followed.season if followed else 1,
        episode_offset=followed.episode_offset if followed else 0,
        display_name=followed.display_name if followed else "",
    )
    if not versions_by_episode:
        return versions_by_episode
    with Session.begin() as session:
        downloads = session.scalars(
            sa.select(Download).where(
                Download.bangumi_name == bangumi.name,
                Download.episode.in_(versions_by_episode),
            )
        ).all()
    for episode, versions in versions_by_episode.items():
        for version in versions:
            path = version["path"]
            file_title = release_title_key(Path(version["fileName"]).stem)
            matches = [
                row for row in downloads
                if row.episode == episode and (
                    row.video_path == path or (not row.video_path and release_title_key(row.title) == file_title)
                )
            ]
            if len(matches) != 1:
                continue
            download = matches[0]
            info_hash = torrent_info_hash(download.download, download.task_id or "")
            release = mikan_release_by_hash(info_hash) if info_hash else None
            if not release or release_title_key(release["title"]) != release_title_key(download.title):
                continue
            if bangumi.mikan_id and bangumi.mikan_id != release["mikanId"]:
                continue
            version.update({
                "group": release["group"],
                "groupSource": "mikan",
                "mikanUrl": release["url"],
                "mikanGroupId": release["groupId"],
            })
    return versions_by_episode


def list_item(bangumi: Bangumi, followed: Optional[Followed], missing: set[str], *, include_versions: bool = False) -> dict[str, Any]:
    year, quarter, season = cover_season(bangumi.cover)
    item = {
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
    if include_versions:
        item["player_versions"] = player_versions_map(bangumi, followed)
    return item


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


def find_source(name: str, episode: str, player_group: str = "") -> Path:
    bangumi = find_bangumi(name)
    try:
        number = int(episode)
    except ValueError as error:
        raise fastapi.HTTPException(400, "invalid episode") from error
    with Session.begin() as session:
        followed = session.get(Followed, bangumi.name)
    versions = player_versions_map(bangumi, followed).get(number, []) if player_group else []
    entry = next((version for version in versions if version["group"] == player_group), None)
    entry = entry or player_map(bangumi, followed).get(number)
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
    return envelope(list_item(row, followed, missing, include_versions=True))


@lru_cache(maxsize=256)
def mikan_overview(mikan_id: str) -> str:
    html = get_text(f"{server_root}Home/Bangumi/{mikan_id}")
    soup = BeautifulSoup(html, "html.parser")
    info = soup.select_one(".m-detail-intro .info")
    return info.get_text("\n", strip=True) if info else ""


@lru_cache(maxsize=256)
def mikan_subtitle_group_links(mikan_id: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(get_text(f"{server_root}Home/Bangumi/{mikan_id}"), "html.parser")
    groups: list[dict[str, str]] = []
    seen: set[str] = set()
    for section in soup.select(".subgroup-text"):
        group_link = section.select_one('a[href^="/Home/PublishGroup/"]')
        rss_link = section.select_one('a[href^="/RSS/Bangumi?"]')
        if not rss_link:
            continue
        # Mikan's raw/unknown group has a plain text heading, no publisher link.
        group_name = group_link.get_text(" ", strip=True) if group_link else " ".join(
            str(text).strip() for text in section.find_all(string=True, recursive=False) if str(text).strip()
        )
        if not group_name:
            continue
        subgroup_id = parse_qs(urlparse(str(rss_link.get("href") or "")).query).get("subgroupid", [""])[0]
        if not subgroup_id.isdigit() or subgroup_id in seen:
            continue
        seen.add(subgroup_id)
        groups.append({
            "id": subgroup_id,
            "name": group_name,
            "url": f"{server_root}Home/Bangumi/{mikan_id}#{subgroup_id}",
        })
    return groups


def linked_mikan_id(row: Bangumi) -> str:
    if re.fullmatch(r"\d+", row.mikan_id or ""):
        return row.mikan_id
    if cfg.data_source == "mikan_project" and row.source != "local" and re.fullmatch(r"\d+", row.id):
        mikan_id = row.id
    else:
        _, candidates, _ = resolve_bangumi(row.name)
        # Search may return a single result from a shortened query for another
        # season. Only persist an ID when the Mikan title matches this row.
        def title_key(value: str) -> str:
            normalized = unicodedata.normalize("NFKC", value).casefold()
            return re.sub(r"[\W_]+", "", normalized)

        matching_ids = {
            str(candidate.get("keyword") or "")
            for candidate in candidates
            if title_key(str(candidate.get("name") or "")) == title_key(row.name)
        }
        mikan_id = matching_ids.pop() if len(matching_ids) == 1 else ""
    if re.fullmatch(r"\d+", mikan_id):
        with Session.begin() as session:
            session.execute(
                sa.update(Bangumi)
                .where(Bangumi.id == row.id, Bangumi.mikan_id == "")
                .values(mikan_id=mikan_id)
            )
        return mikan_id
    return ""


@router.get("/player/overview")
def legacy_player_overview(bangumi: str) -> dict[str, Any]:
    row = find_bangumi(bangumi.strip())
    mikan_id = linked_mikan_id(row)
    if not re.fullmatch(r"\d+", mikan_id):
        return envelope({"synopsis": "", "mikanId": ""})
    return envelope({"synopsis": mikan_overview(mikan_id), "mikanId": mikan_id})


@router.get("/mikan/subtitle-groups")
def legacy_mikan_subtitle_groups(bangumi: str) -> dict[str, Any]:
    row = find_bangumi(bangumi.strip())
    mikan_id = linked_mikan_id(row)
    if not re.fullmatch(r"\d+", mikan_id):
        return envelope({"mikanId": "", "groups": []})
    return envelope({"mikanId": mikan_id, "groups": mikan_subtitle_group_links(mikan_id)})


@router.get("/player")
def legacy_player_assets(request: fastapi.Request, bangumi: str, episode: str, player_group: str = "") -> dict[str, Any]:
    source = find_source(bangumi, episode, player_group)
    try:
        data = build_browser_assets(source, bangumi, episode)
    except Exception as error:
        raise fastapi.HTTPException(500, str(error)) from error
    data["mediaOrigin"] = local_video_origin_candidate()
    data["advancedHlsQualities"] = bool((cfg.player or {}).get("advanced_hls_qualities", False))
    return envelope(data)


@router.get("/player/hls")
def legacy_player_hls(request: fastapi.Request, bangumi: str, episode: str, profile: str, player_group: str = "") -> RedirectResponse:
    source = find_source(bangumi, episode, player_group)
    hls_path = ensure_hls_profile(source, profile)
    origin = resolve_media_origin_for_host(request.headers.get("host", ""))
    return RedirectResponse(f"{origin}/bangumi{hls_path}")


@router.post("/player/hls/start")
def legacy_player_hls_start(bangumi: str, episode: str, profile: str, player_group: str = "") -> dict[str, Any]:
    return envelope(start_hls_profile_generation(find_source(bangumi, episode, player_group), profile))


@router.get("/player/hls/status")
def legacy_player_hls_status(bangumi: str, episode: str, profile: str, player_group: str = "") -> dict[str, Any]:
    return envelope(get_hls_profile_status(find_source(bangumi, episode, player_group), profile))


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
        if not bangumi:
            raise fastapi.HTTPException(404, "bangumi not found")
        if followed and followed.status == Followed.STATUS_DELETED:
            followed = None
        available = {item.name: item.id for item in session.scalars(sa.select(Subtitle)).all() if item.id in bangumi.subtitle_group}
        # Official 5.0.2 resolves names from the local Subtitle table. Custom
        # Mikan calendar entries can have a valid Mikan id but no local rows yet;
        # merge those groups into the same mapping so both screens use one source.
        try:
            mikan_id = linked_mikan_id(bangumi)
            groups = mikan_subtitle_group_links(mikan_id) if re.fullmatch(r"\d+", mikan_id) else []
        except requests.RequestException:
            # A source outage must not make saved local settings unavailable.
            groups = []
        for group in groups:
            group_id = str(group.get("id") or "").strip()
            group_name = str(group.get("name") or "").strip()
            if not group_id or not group_name:
                continue
            available.setdefault(group_name, group_id)
            if group_id not in bangumi.subtitle_group:
                bangumi.subtitle_group = [*bangumi.subtitle_group, group_id]
            if not session.get(Subtitle, group_id):
                session.add(Subtitle(id=group_id, name=group_name))
        writing = any(field in payload for field in ("subtitle", "include", "exclude", "regex"))
        if writing and not followed:
            raise fastapi.HTTPException(404, "bangumi not followed")
        if writing:
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
            "followed": [title for title, identifier in available.items() if followed and identifier in followed.subtitle],
            "include": ",".join(followed.include) if followed else "",
            "exclude": ",".join(followed.exclude) if followed else "",
            "regex": followed.regex if followed else "",
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
            "playerSettings": {
                "localMediaRouting": local_media_routing_state(),
                "advancedHlsQualities": bool((cfg.player or {}).get("advanced_hls_qualities", False)),
            },
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
    if origin and not re.fullmatch(r"https?://[^/:\s]+:\d+", origin):
        raise fastapi.HTTPException(400, "localMediaOrigin must include protocol, host, and port")
    if enabled and not origin:
        raise fastapi.HTTPException(400, "localMediaOrigin required")
    cfg.player = {**cfg.player, "local_media_routing": {"enabled": enabled, "local_entry_hosts": hosts, "local_media_origin": origin}}
    cfg.save()
    return envelope(local_media_routing_state())


@router.post("/dashboard-player-quality-settings", dependencies=[fastapi.Depends(require_token)])
def dashboard_quality_settings(payload: dict[str, Any]) -> dict[str, Any]:
    enabled = bool(payload.get("advancedHlsQualities"))
    cfg.player = {**cfg.player, "advanced_hls_qualities": enabled}
    cfg.save()
    return envelope({"advancedHlsQualities": enabled})


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
