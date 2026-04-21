from __future__ import annotations

from typing import Any, Dict, List, Optional

import peewee

from bgmi.lib.fetch import website
from bgmi.lib.mikan_resolver import resolve_bangumi
from bgmi.lib.models import (
    STATUS_DELETED,
    STATUS_END,
    Bangumi,
    BangumiIssue,
    Download,
    Filter,
    Followed,
    Scripts,
    Subtitle,
)
from bgmi.utils import download_cover
from bgmi.website.model import SubtitleGroup, WebsiteBangumi


def prepare_database_bangumi(name: str, keyword: Optional[str] = None) -> Dict[str, Any]:
    queries: List[str] = []
    candidates: List[Dict[str, Any]] = []
    chosen: Optional[Dict[str, Any]] = None

    if keyword:
        chosen = {"name": name, "keyword": keyword, "cover": "", "matchType": "manual"}
        queries = [name]
    else:
        chosen, candidates, queries = resolve_bangumi(name)
        if chosen is None and not candidates:
            return {
                "status": "error",
                "message": f"No bangumi matched for {name}",
                "data": {"queries": queries, "candidates": []},
            }

    bangumi_info: Optional[WebsiteBangumi] = None
    fetch_error = ""
    resolved_keyword = str((chosen or {}).get("keyword") or keyword or "")

    if resolved_keyword:
        try:
            bangumi_info = website.fetch_single_bangumi(resolved_keyword)
        except Exception as exc:  # pragma: no cover - defensive
            fetch_error = str(exc)

    if bangumi_info is None and chosen is not None:
        bangumi_info = WebsiteBangumi(
            name=str(chosen.get("name") or name),
            keyword=resolved_keyword,
            update_time="Unknown",
            status=STATUS_END,
            subtitle_group=[],
            cover=str(chosen.get("cover") or ""),
            episodes=[],
        )

    if bangumi_info is not None and chosen is not None:
        if chosen.get("name"):
            bangumi_info.name = str(chosen["name"])
        if chosen.get("cover") and not bangumi_info.cover:
            bangumi_info.cover = str(chosen["cover"])

    return {
        "status": "success",
        "message": "Bangumi metadata resolved",
        "data": {
            "queries": queries,
            "chosen": chosen,
            "candidates": candidates,
            "bangumi": bangumi_info,
            "fetchError": fetch_error,
        },
    }


def parse_subtitle_selection(selection: str, available: List[SubtitleGroup]) -> List[SubtitleGroup]:
    raw = (selection or "").strip()
    if not raw:
        return list(available)

    lowered = raw.lower()
    if lowered == "all":
        return list(available)
    if lowered == "skip":
        return []

    picked: List[SubtitleGroup] = []
    seen = set()
    tokens = [token.strip() for token in raw.split(",") if token.strip()]

    for token in tokens:
        match: Optional[SubtitleGroup] = None
        if token.isdigit():
            index = int(token) - 1
            if 0 <= index < len(available):
                match = available[index]
            else:
                raise ValueError(f"subtitle index out of range: {token}")
        else:
            for group in available:
                if token == group.id or token.lower() == group.name.lower():
                    match = group
                    break
        if match is None:
            raise ValueError(f"subtitle group not found: {token}")
        if match.id in seen:
            continue
        seen.add(match.id)
        picked.append(match)
    return picked


def _merge_source(existing: str, incoming: str) -> str:
    left = (existing or "").strip() or incoming
    right = (incoming or "").strip() or existing
    if "hybrid" in {left, right}:
        return "hybrid"
    if {left, right} == {"local", "remote"}:
        return "hybrid"
    return right or left or "remote"


def upsert_database_bangumi(
    bangumi_info: WebsiteBangumi,
    subtitle_groups: Optional[List[SubtitleGroup]] = None,
    download_cover_image: bool = True,
) -> Dict[str, Any]:
    if bangumi_info is None:
        return {"status": "error", "message": "bangumi metadata is empty"}

    selected_subtitles = list(subtitle_groups if subtitle_groups is not None else bangumi_info.subtitle_group)
    subtitle_value = Bangumi(subtitle_group=selected_subtitles).subtitle_group if selected_subtitles else ""

    for subtitle in selected_subtitles:
        (
            Subtitle.insert({Subtitle.id: str(subtitle.id), Subtitle.name: str(subtitle.name)})
            .on_conflict_replace()
            .execute()
        )

    row_by_name = Bangumi.select().where(Bangumi.name == bangumi_info.name).first()
    row_by_keyword = Bangumi.select().where(Bangumi.keyword == bangumi_info.keyword).first() if bangumi_info.keyword else None

    if row_by_name is not None and row_by_keyword is not None and row_by_name.id != row_by_keyword.id:
        return {
            "status": "error",
            "message": "Bangumi name and keyword point to different database records, aborting update",
            "data": {
                "nameRecordId": row_by_name.id,
                "keywordRecordId": row_by_keyword.id,
                "name": bangumi_info.name,
                "keyword": bangumi_info.keyword,
            },
        }

    row = row_by_name or row_by_keyword
    created = row is None

    if row is None:
        row = Bangumi.create(
            name=bangumi_info.name,
            subtitle_group=subtitle_value,
            keyword=bangumi_info.keyword,
            update_time=bangumi_info.update_time,
            cover=bangumi_info.cover,
            status=bangumi_info.status,
            source="remote",
            in_library=False,
            library_path="",
        )
    else:
        row.name = bangumi_info.name
        row.subtitle_group = subtitle_value
        if bangumi_info.keyword:
            row.keyword = bangumi_info.keyword
        row.update_time = bangumi_info.update_time
        if bangumi_info.cover:
            row.cover = bangumi_info.cover
        row.status = bangumi_info.status
        row.source = _merge_source(row.source or "remote", "remote")
        row.save()

    cover_downloaded = False
    cover_error = ""
    if download_cover_image and row.cover:
        try:
            download_cover([row.cover])
            cover_downloaded = True
        except Exception as exc:  # pragma: no cover - defensive
            cover_error = str(exc)

    return {
        "status": "success",
        "message": "Bangumi metadata created" if created else "Bangumi metadata updated",
        "data": {
            "created": created,
            "name": row.name,
            "keyword": row.keyword,
            "cover": row.cover,
            "statusValue": row.status,
            "source": row.source,
            "subtitleGroups": [{"id": sub.id, "name": sub.name} for sub in selected_subtitles],
            "subtitleGroupCount": len(selected_subtitles),
            "coverDownloaded": cover_downloaded,
            "coverError": cover_error,
        },
    }


def delete_database_bangumi(name: str, delete_downloads: bool = True) -> Dict[str, Any]:
    try:
        bangumi = Bangumi.fuzzy_get(name=name)
    except Bangumi.DoesNotExist:
        return {"status": "error", "message": f"Bangumi {name} does not exist in database"}

    delete_counts = {
        "bangumi": 0,
        "followed": 0,
        "filter": 0,
        "issues": 0,
        "scripts": 0,
        "downloads": 0,
    }

    delete_counts["followed"] = Followed.delete().where(Followed.bangumi_name == bangumi.name).execute()
    delete_counts["filter"] = Filter.delete().where(Filter.bangumi_name == bangumi.name).execute()
    delete_counts["issues"] = BangumiIssue.delete().where(BangumiIssue.bangumi_name == bangumi.name).execute()
    delete_counts["scripts"] = Scripts.delete().where(Scripts.bangumi_name == bangumi.name).execute()
    if delete_downloads:
        delete_counts["downloads"] = Download.delete().where(Download.name == bangumi.name).execute()
    delete_counts["bangumi"] = bangumi.delete_instance()

    return {
        "status": "success",
        "message": f"Bangumi {bangumi.name} deleted from database",
        "data": {
            "name": bangumi.name,
            "keyword": bangumi.keyword,
            "deleted": delete_counts,
        },
    }


def list_database_bangumi(
    query: Optional[str] = None,
    source: Optional[str] = None,
    subscribed: Optional[bool] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    bangumi_query = (
        Bangumi.select(Bangumi, Followed.status.alias("follow_status"), Followed.episode.alias("follow_episode"))
        .join(Followed, join_type=peewee.JOIN.LEFT_OUTER, on=(Bangumi.name == Followed.bangumi_name))
        .order_by(Bangumi.id.desc())
    )

    if query:
        bangumi_query = bangumi_query.where(Bangumi.name.contains(query) | Bangumi.keyword.contains(query))
    if source:
        bangumi_query = bangumi_query.where(Bangumi.source == source)
    if subscribed is True:
        bangumi_query = bangumi_query.where((Followed.status.is_null(False)) & (Followed.status != STATUS_DELETED))
    elif subscribed is False:
        bangumi_query = bangumi_query.where(Followed.status.is_null(True) | (Followed.status == STATUS_DELETED))

    rows = list(bangumi_query.limit(max(limit, 1)).dicts())
    result: List[Dict[str, Any]] = []
    for row in rows:
        subtitle_names = [
            item["name"] for item in Subtitle.get_subtitle_by_id(str(row.get("subtitle_group") or "").split(", "))
            if row.get("subtitle_group")
        ]
        result.append(
            {
                "id": row["id"],
                "name": row["name"],
                "keyword": row["keyword"],
                "status": row["status"],
                "source": row.get("source") or "remote",
                "inLibrary": bool(row.get("in_library")),
                "libraryPath": row.get("library_path") or "",
                "isSubscribed": row.get("follow_status") is not None and row.get("follow_status") != STATUS_DELETED,
                "episode": row.get("follow_episode") or 0,
                "subtitleGroups": subtitle_names,
                "updateTime": row.get("update_time") or "Unknown",
            }
        )
    return result
