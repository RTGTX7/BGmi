import os
import re
import types
import unicodedata
from importlib.machinery import SourceFileLoader
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import bs4
from bs4 import BeautifulSoup
from strsimpy.normalized_levenshtein import NormalizedLevenshtein

from bgmi.config import cfg
from bgmi.website.mikan import get_text, server_root

_TITLE_SEPARATORS_RE = re.compile(r"[\s\-‐‑‒–—―~～·・:：/／|｜_]+")
_BRACKET_CHARS_RE = re.compile(r"[\[\](){}<>【】（）「」『』《》〈〉]")
_NOISE_PUNCT_RE = re.compile(r"[!！?？,，.。'\"“”‘’`]+")
_WEAK_TERM_RE = re.compile(
    r"(剧场版|劇場版|电影版|電影版|完全版|总集篇|總集篇|特别篇|特別篇|特装版|特裝版|ova|oad|sp|special|movie|the movie)",
    re.IGNORECASE,
)


def _nfkc(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "")


def _normalize_name(name: str) -> str:
    normalized = _nfkc(name).lower()
    normalized = _BRACKET_CHARS_RE.sub(" ", normalized)
    normalized = _NOISE_PUNCT_RE.sub(" ", normalized)
    normalized = _TITLE_SEPARATORS_RE.sub(" ", normalized)
    normalized = _WEAK_TERM_RE.sub(" ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _collapse_name(name: str) -> str:
    return _normalize_name(name).replace(" ", "")


def _normalize_cover_url(raw_url: str) -> str:
    cover = str(raw_url or "").strip().split("?")[0]
    if not cover:
        return ""
    if cover.startswith("/"):
        return server_root.rstrip("/") + cover
    return cover


def _extract_cover_from_link(link: bs4.Tag) -> str:
    image = link.select_one("img[data-src], img[src], .b-lazy[data-src], span[data-src]")
    if image is None:
        return ""
    return _normalize_cover_url(str(image.get("data-src") or image.get("src") or ""))


def _load_alias_map() -> Dict[str, List[str]]:
    alias_file = cfg.tools_path.joinpath("mikan_resolver_aliases.py")
    if not alias_file.exists():
        return {}

    try:
        loader = SourceFileLoader("mikan_resolver_aliases", os.fspath(alias_file))
        module = types.ModuleType(loader.name)
        loader.exec_module(module)
        aliases = getattr(module, "ALIASES", {})
        if not isinstance(aliases, dict):
            return {}
        return {
            str(key): [str(item).strip() for item in value if str(item).strip()]
            for key, value in aliases.items()
            if isinstance(value, list)
        }
    except Exception:
        return {}


def _dedupe_keep_order(values: Iterable[str]) -> List[str]:
    result: List[str] = []
    seen = set()
    for value in values:
        item = str(value or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _split_title_parts(name: str) -> List[str]:
    normalized = _nfkc(name)
    normalized = _BRACKET_CHARS_RE.sub(" ", normalized)
    normalized = _NOISE_PUNCT_RE.sub(" ", normalized)
    parts = [part.strip() for part in _TITLE_SEPARATORS_RE.split(normalized) if part.strip()]
    return parts


def _remove_weak_terms(name: str) -> str:
    cleaned = _WEAK_TERM_RE.sub(" ", _nfkc(name))
    cleaned = _BRACKET_CHARS_RE.sub(" ", cleaned)
    cleaned = _NOISE_PUNCT_RE.sub(" ", cleaned)
    cleaned = _TITLE_SEPARATORS_RE.sub(" ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _is_confident_query(query: str) -> bool:
    collapsed = _collapse_name(query)
    token_count = len([token for token in _normalize_name(query).split(" ") if token])
    if re.search(r"[\u3040-\u30ff\u3400-\u9fff]", collapsed):
        return len(collapsed) >= 2
    if token_count >= 2:
        return len(collapsed) >= 6
    return len(collapsed) >= 8


def _candidate_tokens(name: str) -> List[str]:
    return [token for token in _normalize_name(name).split(" ") if token]


def build_search_queries(name: str) -> List[str]:
    raw_name = _nfkc(str(name or "")).strip()
    if not raw_name:
        return []

    parts = _split_title_parts(raw_name)
    without_weak_terms = _remove_weak_terms(raw_name)
    alias_map = _load_alias_map()
    queries: List[str] = [raw_name]

    if without_weak_terms and without_weak_terms != raw_name:
        queries.append(without_weak_terms)

    if len(parts) > 1:
        queries.append(" ".join(parts))
        strong_parts = [part for part in parts if _remove_weak_terms(part)]
        queries.extend(strong_parts)
        if strong_parts:
            queries.append(" ".join(strong_parts))

    if parts:
        longest_part = max(parts, key=lambda value: len(_collapse_name(value)))
        if longest_part:
            queries.append(longest_part)

    normalized_key = _collapse_name(raw_name)
    normalized_without_weak = _collapse_name(without_weak_terms)
    for key, values in alias_map.items():
        normalized_alias_key = _collapse_name(key)
        if normalized_alias_key in {normalized_key, normalized_without_weak}:
            queries.extend(values)

    return _dedupe_keep_order(queries)


def search_bangumi_candidates(query: str) -> List[Dict[str, str]]:
    html = get_text(server_root + "Home/Search", params={"searchstr": query})
    soup = BeautifulSoup(html, "html.parser")
    candidates: List[Dict[str, str]] = []
    seen_ids = set()

    for link in soup.select('a[href*="/Home/Bangumi/"]'):
        href = str(link.get("href", ""))
        matched = re.search(r"/Home/Bangumi/(\d+)", href)
        if not matched:
            continue
        bangumi_id = matched.group(1)
        if bangumi_id in seen_ids:
            continue
        seen_ids.add(bangumi_id)

        title = str(link.get("title", "")).strip()
        if not title:
            title_node = link.select_one(".an-text, .an-info-group, .bangumi-title")
            title = title_node.get_text(strip=True) if title_node else link.get_text(strip=True)

        candidates.append(
            {
                "keyword": bangumi_id,
                "name": title,
                "cover": _extract_cover_from_link(link),
                "query": query,
            }
        )

    return candidates


def _score_candidate(query: str, target_name: str, candidate_name: str) -> float:
    levenshtein = NormalizedLevenshtein()
    query_compact = _collapse_name(query)
    target_compact = _collapse_name(target_name)
    candidate_compact = _collapse_name(candidate_name)

    if candidate_compact == target_compact:
        return 1.0
    if candidate_compact == query_compact:
        return 0.98

    query_tokens = set(_candidate_tokens(query))
    target_tokens = set(_candidate_tokens(target_name))
    candidate_tokens = set(_candidate_tokens(candidate_name))

    overlap_with_query = len(query_tokens & candidate_tokens) / max(len(query_tokens), 1)
    overlap_with_target = len(target_tokens & candidate_tokens) / max(len(target_tokens), 1)
    distance_target = 1 - levenshtein.distance(target_compact, candidate_compact) if target_compact and candidate_compact else 0
    distance_query = 1 - levenshtein.distance(query_compact, candidate_compact) if query_compact and candidate_compact else 0

    return max(
        overlap_with_query * 0.4 + overlap_with_target * 0.3 + distance_target * 0.3,
        overlap_with_query * 0.35 + distance_query * 0.35 + distance_target * 0.3,
    )


def _choose_best_candidate(
    name: str,
    query_candidates: Sequence[Tuple[str, List[Dict[str, str]]]],
) -> Tuple[Optional[Dict[str, str]], List[Dict[str, str]]]:
    scored_rows: List[Tuple[float, Dict[str, str]]] = []

    for query, candidates in query_candidates:
        normalized_query = _collapse_name(query)
        exact = [candidate for candidate in candidates if _collapse_name(candidate["name"]) == normalized_query]
        if len(exact) == 1:
            exact[0]["matchType"] = "exact"
            return exact[0], list(candidates)

        if len(candidates) == 1 and _is_confident_query(query):
            candidate = dict(candidates[0])
            candidate["matchType"] = "query-singleton"
            return candidate, list(candidates)

        for candidate in candidates:
            scored_rows.append((_score_candidate(query, name, candidate["name"]), dict(candidate)))

    if not scored_rows:
        return None, []

    scored_rows.sort(key=lambda item: item[0], reverse=True)
    best_score, best_candidate = scored_rows[0]
    second_score = scored_rows[1][0] if len(scored_rows) > 1 else 0.0

    if best_score >= 0.92:
        best_candidate["matchType"] = "exact"
        return best_candidate, [candidate for _, candidate in scored_rows[:3]]

    if best_score >= 0.76 and (best_score - second_score >= 0.08):
        best_candidate["matchType"] = "fuzzy"
        return best_candidate, [candidate for _, candidate in scored_rows[:3]]

    return None, [candidate for _, candidate in scored_rows[:3]]


def resolve_bangumi(name: str) -> Tuple[Optional[Dict[str, str]], List[Dict[str, str]], List[str]]:
    queries = build_search_queries(name)
    query_candidates: List[Tuple[str, List[Dict[str, str]]]] = []
    all_candidates: List[Dict[str, str]] = []
    seen_ids = set()

    for query in queries:
        try:
            candidates = search_bangumi_candidates(query)
        except Exception:
            continue

        query_candidates.append((query, candidates))
        for candidate in candidates:
            keyword = candidate["keyword"]
            if keyword in seen_ids:
                continue
            seen_ids.add(keyword)
            all_candidates.append(candidate)

    chosen, candidate_list = _choose_best_candidate(name, query_candidates)
    if chosen is not None:
        return chosen, all_candidates or candidate_list, queries

    return None, candidate_list or all_candidates[:3], queries
