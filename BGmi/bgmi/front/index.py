import glob
import os
import re
from urllib.parse import unquote
from pathlib import Path
from typing import Dict, Iterable, Optional

from bgmi.config import cfg
from bgmi.lib.season import strip_season_suffix
from bgmi.utils import bangumi_save_path, normalize_path

# HLS .ts segments are delivery artifacts, not selectable episode files.
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".webm", ".flv", ".rmvb", ".mov", ".m4v", ".m2ts"}


def get_player(
    bangumi_name: str,
    episodes: Iterable[int] = (),
    season: int = 1,
    episode_offset: int = 0,
    display_name: str = "",
) -> Dict[int, Dict[str, str]]:
    if cfg.enable_path_formatter:
        return get_formatted_player(bangumi_name, episodes, season, episode_offset, display_name)

    return get_legacy_player(bangumi_name, episodes)


def get_player_versions(
    bangumi_name: str,
    episodes: Iterable[int] = (),
    season: int = 1,
    episode_offset: int = 0,
    display_name: str = "",
) -> Dict[int, list[Dict[str, str]]]:
    """List playable releases without changing the legacy get_player contract."""
    result: Dict[int, list[Dict[str, str]]] = {}
    if cfg.enable_path_formatter:
        name = display_name or strip_season_suffix(bangumi_name)
        for episode in episodes:
            pattern = cfg.path_formatter.format(
                name=glob.escape(normalize_path(name)), season=season,
                episode=episode + episode_offset, suffix="*", title="*",
            )
            paths = (path for path in cfg.save_path.glob(pattern) if path.suffix.lower() in VIDEO_EXTENSIONS)
            result[episode] = _video_versions(paths)
    else:
        bangumi_path = bangumi_save_path(bangumi_name)
        if not bangumi_path.exists():
            return {}
        episode_dirs = [bangumi_path / str(episode) for episode in episodes] or list(bangumi_path.iterdir())
        for entry in episode_dirs:
            if entry.is_dir() and entry.name.isdigit():
                result[int(entry.name)] = _video_versions(
                    Path(root) / file for root, _, files in os.walk(entry)
                    for file in files if Path(file).suffix.lower() in VIDEO_EXTENSIONS
                )
            elif entry.is_file() and entry.suffix.lower() in VIDEO_EXTENSIONS:
                filename = unquote(entry.stem)
                match = re.search(r"(?:^|[-_\s])(?:e|ep|第)?\s*(\d{1,3})(?=\s|$|\[|\.)", filename, re.IGNORECASE)
                number = int(match.group(1)) if match else 1
                if not episodes or number in episodes:
                    result.setdefault(number, []).extend(_video_versions([entry]))
    return {episode: versions for episode, versions in result.items() if versions}


def _video_versions(paths: Iterable[Path]) -> list[Dict[str, str]]:
    return [
        {
            "group": unquote(path.name),
            "path": "/" + path.relative_to(cfg.save_path).as_posix(),
            "fileName": unquote(path.name),
            "groupSource": "filename",
        }
        for path in sorted(paths)
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    ]


def get_legacy_player(bangumi_name: str, episodes: Iterable[int] = ()) -> Dict[int, Dict[str, str]]:
    bangumi_path = bangumi_save_path(bangumi_name)

    if not bangumi_path.exists():
        return {}

    episode_list: Dict[int, Dict[str, str]] = {}
    episode_dirs = [bangumi_path / str(episode) for episode in episodes] or list(bangumi_path.iterdir())

    for episode in episode_dirs:
        if episode.is_file() and episode.suffix.lower() in VIDEO_EXTENSIONS:
            filename = unquote(episode.stem)
            match = re.search(r"(?:^|[-_\s])(?:e|ep|第)?\s*(\d{1,3})(?=\s|$|\[|\.)", filename, re.IGNORECASE)
            inferred_episode = int(match.group(1)) if match else 1
            if not episodes or inferred_episode in episodes:
                episode_list[inferred_episode] = {"path": "/" + episode.relative_to(cfg.save_path).as_posix()}
            continue
        if not episode.is_dir() or not episode.name.isdigit():
            continue
        e = find_largest_video_file(episode)
        if e:
            episode_list[int(episode.name)] = {"path": "/" + e}

    return episode_list


def get_formatted_player(
    bangumi_name: str,
    episodes: Iterable[int],
    season: int,
    episode_offset: int,
    display_name: str,
) -> Dict[int, Dict[str, str]]:
    name = display_name or strip_season_suffix(bangumi_name)
    episode_files: Dict[int, Path] = {}

    for episode in episodes:
        path = find_largest_matching_video_file(
            cfg.path_formatter.format(
                name=glob.escape(normalize_path(name)),
                season=season,
                episode=episode + episode_offset,
                suffix="*",
                title="*",
            )
        )
        if not path:
            continue

        current = episode_files.get(episode)
        if current is None or path.stat().st_size > current.stat().st_size:
            episode_files[episode] = path

    return {
        episode: {"path": "/" + path.relative_to(cfg.save_path).as_posix()}
        for episode, path in sorted(episode_files.items())
    }


def find_largest_video_file(top_dir: Path) -> Optional[str]:
    video = find_largest_file(
        Path(root).joinpath(file)
        for root, _, files in os.walk(top_dir)
        for file in files
        if Path(file).suffix.lower() in VIDEO_EXTENSIONS
    )

    if not video:
        return None

    return video.relative_to(cfg.save_path).as_posix()


def find_largest_matching_video_file(pattern: str) -> Optional[Path]:
    return find_largest_file(path for path in cfg.save_path.glob(pattern) if path.suffix.lower() in VIDEO_EXTENSIONS)


def find_largest_file(paths: Iterable[Path]) -> Optional[Path]:
    largest: Optional[Path] = None
    largest_size = -1

    for path in paths:
        if not path.is_file():
            continue
        size = path.stat().st_size
        if size > largest_size:
            largest = path
            largest_size = size

    return largest
