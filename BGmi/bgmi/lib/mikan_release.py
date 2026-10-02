"""Resolve a downloaded Mikan release by its torrent info hash."""

import re
import unicodedata
from functools import lru_cache
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from bgmi.website.mikan import get_text, server_root


def release_title_key(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").casefold()
    return re.sub(r"[\W_]+", "", value)


def torrent_info_hash(download_url: str, task_id: str = "") -> str:
    query = parse_qs(urlparse(download_url or "").query)
    for xt in query.get("xt", []):
        match = re.fullmatch(r"urn:btih:([0-9a-fA-F]{40})", xt, re.IGNORECASE)
        if match:
            return match.group(1).lower()
    return task_id.lower() if re.fullmatch(r"[0-9a-fA-F]{40}", task_id or "") else ""


@lru_cache(maxsize=512)
def mikan_release_by_hash(info_hash: str) -> dict[str, str] | None:
    if not re.fullmatch(r"[0-9a-f]{40}", info_hash):
        return None
    try:
        soup = BeautifulSoup(get_text(f"{server_root}Home/Episode/{info_hash}"), "html.parser")
    except Exception:
        return None
    magnet = soup.select_one('a[href^="magnet:"]')
    if not magnet or torrent_info_hash(str(magnet.get("href") or "")) != info_hash:
        return None
    bangumi_link = soup.select_one('a[href^="/Home/Bangumi/"]')
    group_link = soup.select_one('a[href^="/Home/PublishGroup/"]')
    title = soup.title.get_text(" ", strip=True).removesuffix(" - Mikan Project") if soup.title else ""
    if not bangumi_link or not group_link or not title:
        return None
    match = re.fullmatch(r"/Home/Bangumi/(\d+)#(\d+)", str(bangumi_link.get("href") or ""))
    if not match:
        return None
    return {
        "title": title,
        "group": group_link.get_text(" ", strip=True),
        "mikanId": match.group(1),
        "groupId": match.group(2),
        "url": f"{server_root}Home/Episode/{info_hash}",
    }
