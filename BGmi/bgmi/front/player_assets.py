import hashlib
import copy
import json
import re
import shutil
import subprocess
import time
import uuid
from collections import defaultdict, deque
from functools import lru_cache
from urllib.parse import quote, urlparse
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Any, Callable, Dict, Optional

from bgmi.config import cfg

PLAYER_CACHE_DIR = ".bgmi-player-cache"
HLS_CACHE_DIR = ".bgmi-hls"
HLS_METADATA_FILE = ".bgmi-hls-meta.json"
SUBTITLE_FILE_PREFIX = "bgmi-subtitle"
SUBTITLE_CODEC_EXTENSIONS = {
    "ass": "ass",
    "ssa": "ass",
    "subrip": "srt",
    "srt": "srt",
    "webvtt": "vtt",
}
SIDECAR_SUBTITLE_EXTENSIONS = [".vtt", ".srt", ".ass", ".ssa"]
REMUX_AUDIO_CODECS = {"aac", "mp3", "ac3", "eac3"}
REMUX_VIDEO_CODECS = {"h264", "av1", "vp9", "hev1", "h265", "hevc"}
HLS_COPY_AUDIO_CODECS = {"aac", "ac3", "eac3", "mp3"}

SUBTITLE_TEXT_ENCODINGS = (
    "utf-8-sig",
    "utf-16",
    "utf-16-le",
    "utf-16-be",
    "utf-32",
    "gb18030",
    "cp936",
    "cp950",
    "shift_jis",
    "cp932",
)

_asset_locks: defaultdict[str, Lock] = defaultdict(Lock)
_hls_jobs_lock = Lock()
_hls_jobs: dict[str, dict[str, Any]] = {}
_browser_assets_cache_lock = Lock()
_browser_assets_cache: dict[str, tuple[tuple[tuple[str, int, int], ...], Dict[str, Any]]] = {}
_active_ffmpeg_inputs: set[Path] = set()
_active_ffmpeg_inputs_lock = Lock()
_cache_maintenance_started = False
_cache_maintenance_lock = Lock()


def local_media_routing_config() -> dict[str, Any]:
    player_config = cfg.player if isinstance(cfg.player, dict) else {}
    routing_config = player_config.get("local_media_routing", {})
    return routing_config if isinstance(routing_config, dict) else {}


def local_media_routing_state() -> dict[str, Any]:
    routing_config = local_media_routing_config()
    hosts = routing_config.get("local_entry_hosts", [])
    if not isinstance(hosts, list):
        hosts = []

    normalized_hosts: list[str] = []
    seen: set[str] = set()
    for item in hosts:
        host = str(item or "").strip().lower()
        if not host or host in seen:
            continue
        seen.add(host)
        normalized_hosts.append(host)

    media_origin = str(routing_config.get("local_media_origin") or "").strip().rstrip("/")
    parsed = urlparse(media_origin) if media_origin else None
    try:
        parsed_port = parsed.port if parsed else None
    except ValueError:
        parsed_port = None
    is_valid_origin = bool(parsed and parsed.scheme in {"http", "https"} and parsed.hostname and parsed_port)

    return {
        "enabled": bool(routing_config.get("enabled")),
        "localEntryHosts": normalized_hosts,
        "localMediaOrigin": media_origin,
        "isValidOrigin": is_valid_origin,
    }


def resolve_media_origin_for_host(request_host: str) -> str:
    state = local_media_routing_state()
    if not state["enabled"] or not state["isValidOrigin"]:
        return ""

    host = str(request_host or "").strip().lower()
    if not host:
        return ""

    if ":" in host and not host.startswith("["):
        host = host.rsplit(":", 1)[0]

    configured_hosts = set(state["localEntryHosts"])
    media_host = (urlparse(state["localMediaOrigin"]).hostname or "").lower()
    # A direct LAN visit commonly uses the same host as localMediaOrigin but
    # is not repeated in the optional entry-host list. Treat that as local too.
    return state["localMediaOrigin"] if host in configured_hosts or (media_host and host == media_host) else ""


def local_video_origin_candidate() -> str:
    state = local_media_routing_state()
    return state["localMediaOrigin"] if state["enabled"] and state["isValidOrigin"] else ""


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")


def _probe(source_path: Path) -> Dict[str, Any]:
    result = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(source_path),
        ]
    )
    return json.loads(result.stdout)


def _cache_dir(source_path: Path) -> Path:
    return source_path.parent.joinpath(PLAYER_CACHE_DIR)


def _hls_dir(source_path: Path) -> Path:
    return source_path.parent.joinpath(HLS_CACHE_DIR)


def _browser_video_target_path(source_path: Path) -> Path:
    return _cache_dir(source_path).joinpath(f"{source_path.stem}.mp4")


def _legacy_browser_video_target_path(source_path: Path) -> Path:
    return _cache_dir(source_path).joinpath(f"video-{_cache_key(source_path)}.mp4")


def _relative_url(path: Path) -> str:
    # Escape literal percent signs in filenames so the browser does not
    # decode them before the static file handler resolves the path.
    relative = path.relative_to(cfg.save_path).as_posix()
    return "/" + quote(relative, safe="/:@-._~!$&'()*+,;=[]")


def _cache_key(source_path: Path) -> str:
    return hashlib.sha1(str(source_path).encode("utf-8")).hexdigest()[:16]


def _source_signature(source_path: Path) -> tuple[tuple[str, int, int], ...]:
    paths = [source_path, *_find_sidecar_subtitles(source_path)]
    signature: list[tuple[str, int, int]] = []
    for path in paths:
        try:
            stat = path.stat()
        except OSError:
            continue
        signature.append((str(path), stat.st_mtime_ns, stat.st_size))
    return tuple(signature)


def _hls_job_key(source_path: Path, profile_name: str) -> str:
    return f"{_cache_key(source_path)}:{profile_name}"


def _replace_atomic(tmp_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.replace(target_path)


def _workspace_dir(source_path: Path) -> Path:
    return cfg.tmp_path.joinpath("player-cache", _cache_key(source_path))


def _hls_workspace_dir(source_path: Path, profile_name: str) -> Path:
    return _workspace_dir(source_path).joinpath("hls", profile_name)


def _safe_workspace_copy(source_path: Path, name: str) -> Path:
    workspace = _workspace_dir(source_path)
    workspace.mkdir(parents=True, exist_ok=True)
    safe_source = workspace.joinpath(name)

    if safe_source.exists() and safe_source.stat().st_mtime >= source_path.stat().st_mtime:
        return safe_source

    if safe_source.exists():
        safe_source.unlink()

    try:
        safe_source.hardlink_to(source_path)
    except OSError:
        shutil.copy2(source_path, safe_source)

    return safe_source


def _safe_ffmpeg_input(source_path: Path) -> Path:
    # Every conversion gets its own input so one FFmpeg job cannot unlink a
    # source still in use by another profile or subtitle extraction.
    safe_source = _safe_workspace_copy(source_path, f"input-{uuid.uuid4().hex}{source_path.suffix.lower()}")
    with _active_ffmpeg_inputs_lock:
        _active_ffmpeg_inputs.add(safe_source)
    return safe_source


def _release_ffmpeg_input(source_path: Path, safe_source: Path) -> None:
    if safe_source == source_path:
        return
    workspace = _workspace_dir(source_path)
    if safe_source.parent != workspace or not safe_source.name.startswith("input-"):
        return
    try:
        safe_source.unlink(missing_ok=True)
    finally:
        with _active_ffmpeg_inputs_lock:
            _active_ffmpeg_inputs.discard(safe_source)
    try:
        workspace.rmdir()
    except OSError:
        pass


def cleanup_stale_player_inputs(max_age_hours: int = 24) -> int:
    """Remove orphaned FFmpeg inputs, including legacy input.mkv files."""
    root = cfg.tmp_path.joinpath("player-cache")
    if not root.is_dir():
        return 0
    cutoff = time.time() - max_age_hours * 3600
    removed = 0
    for workspace in root.iterdir():
        if workspace.is_symlink() or not workspace.is_dir() or not re.fullmatch(r"[0-9a-f]{16}", workspace.name):
            continue
        for path in workspace.iterdir():
            if not path.is_file() or not re.fullmatch(r"input(?:-[0-9a-f]{32})?\.(?:mkv|mp4|avi|webm|flv|rmvb|mov|ts)", path.name, re.I):
                continue
            with _active_ffmpeg_inputs_lock:
                if path in _active_ffmpeg_inputs:
                    continue
            try:
                if path.stat().st_ctime < cutoff:
                    path.unlink()
                    removed += 1
            except OSError:
                continue
        try:
            workspace.rmdir()
        except OSError:
            pass
    return removed


def start_player_cache_maintenance() -> None:
    global _cache_maintenance_started
    with _cache_maintenance_lock:
        if _cache_maintenance_started:
            return
        _cache_maintenance_started = True

    def maintain() -> None:
        wake = Event()
        while True:
            try:
                removed = cleanup_stale_player_inputs()
                if removed:
                    print(f"[bgmi] Removed {removed} stale FFmpeg input files", flush=True)
            except OSError as error:
                print(f"[bgmi] Player cache maintenance failed: {error}", flush=True)
            wake.wait(3600)

    Thread(target=maintain, name="bgmi-player-cache-maintenance", daemon=True).start()


def _video_dimensions(probe: Dict[str, Any]) -> tuple[int, int]:
    video, _ = _source_streams(probe)
    if video is None:
        return 0, 0
    return int(video.get("width", 0) or 0), int(video.get("height", 0) or 0)


@lru_cache(maxsize=1)
def _available_encoders() -> set[str]:
    try:
        result = _run(["ffmpeg", "-hide_banner", "-encoders"])
    except Exception:
        return set()

    return {
        line.split()[1]
        for line in result.stdout.splitlines()
        if line.startswith(" ") and len(line.split()) >= 2
    }


@lru_cache(maxsize=1)
def _available_hwaccels() -> set[str]:
    try:
        result = _run(["ffmpeg", "-hide_banner", "-hwaccels"])
    except Exception:
        return set()

    return {
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip() and not line.startswith("Hardware acceleration methods")
    }


@lru_cache(maxsize=1)
def _available_filters() -> set[str]:
    try:
        result = _run(["ffmpeg", "-hide_banner", "-filters"])
    except Exception:
        return set()

    filters: set[str] = set()
    for line in result.stdout.splitlines():
        parts = line.split()
        # ffmpeg -filters output: 3-char flags (e.g. "T..", "...", "TSC") then name then type
        if len(parts) >= 3 and len(parts[0]) == 3 and all(c in "TSC." for c in parts[0]):
            filters.add(parts[1])
    return filters


@lru_cache(maxsize=1)
def _available_decoders() -> set[str]:
    try:
        result = _run(["ffmpeg", "-hide_banner", "-decoders"])
    except Exception:
        return set()

    return {
        line.split()[1]
        for line in result.stdout.splitlines()
        if line.startswith(" ") and len(line.split()) >= 2
    }


@lru_cache(maxsize=1)
def _nvenc_runtime_ok() -> bool:
    """Return True only if h264_nvenc can actually encode a frame (GPU accessible)."""
    try:
        _run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", "testsrc=size=640x480:rate=1",
                "-frames:v", "1", "-c:v", "h264_nvenc", "-f", "null", "-",
            ]
        )
        return True
    except Exception:
        return False


def _gpu_available() -> bool:
    """Return True if NVENC GPU encoding is available at runtime."""
    return "h264_nvenc" in _available_encoders() and _nvenc_runtime_ok()


def _pick_nvenc_encoder(*, is_high_bit_depth: bool = False) -> str:
    """Choose the best NVENC encoder.

    - 10-bit+ sources -> hevc_nvenc (HEVC NVENC supports 10-bit on Ampere+)
    - 8-bit sources   -> h264_nvenc (best browser compatibility)
    """
    encoders = _available_encoders()
    if is_high_bit_depth and "hevc_nvenc" in encoders:
        return "hevc_nvenc"
    return "h264_nvenc"


def _pick_cuda_decoder(probe: Dict[str, Any]) -> Optional[str]:
    if "cuda" not in _available_hwaccels():
        return None

    video, _ = _source_streams(probe)
    if video is None:
        return None

    pix_fmt = str(video.get("pix_fmt", "")).lower()
    codec_name = str(video.get("codec_name", "")).lower()

    # NVDEC chroma subsampling limits (Ampere RTX A2000):
    # 4:2:2 not supported for any codec
    if "422" in pix_fmt:
        return None
    # 4:4:4 supported for HEVC only, not H.264/VP9/AV1
    if "444" in pix_fmt and codec_name not in ("hevc", "h265"):
        return None

    decoder_map = {
        "h264": "h264_cuvid",
        "hevc": "hevc_cuvid",
        "h265": "hevc_cuvid",
        "av1": "av1_cuvid",
        "vp9": "vp9_cuvid",
    }

    decoder = decoder_map.get(codec_name)
    if decoder and decoder in _available_decoders():
        return decoder
    return None


def _profile_target_height(profile_name: str) -> Optional[int]:
    match = re.match(r"(?P<height>\d{3,4})p(?:_|$)", profile_name)
    if not match:
        return None
    return int(match.group("height"))


def _hls_config() -> dict[str, Any]:
    player_config = cfg.player if isinstance(cfg.player, dict) else {}
    hls_config = player_config.get("hls", {})
    result = dict(hls_config) if isinstance(hls_config, dict) else {}
    result.setdefault("1080p_TS", {"mode": "copy"})
    # User-selectable transcode profiles. They are exposed in the player but
    # are only started after an explicit click; automatic mode never uses them.
    result.setdefault("1080p", {"video_bitrate": "5M", "maxrate": "6M", "bufsize": "10M"})
    result.setdefault("720p", {"video_bitrate": "2.5M", "maxrate": "3M", "bufsize": "5M"})
    return result


def _hls_cache_ttl_hours() -> int:
    raw = _hls_config().get("cache_ttl_hours", 48)
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        return 48


def _hls_profiles() -> list[tuple[str, dict[str, Any]]]:
    profiles: list[tuple[str, dict[str, Any]]] = []
    for name, profile in _hls_config().items():
        if name == "cache_ttl_hours" or not isinstance(profile, dict):
            continue
        profiles.append((name, profile))
    # Always expose a source-resolution HLS option for Apple/Safari. The
    # ``_TS`` suffix keeps the original video stream and avoids quality
    # transcoding; 720p/1080p profiles remain opt-in through user config.
    if not any(name == "1080p_TS" for name, _ in profiles):
        profiles.insert(0, ("1080p_TS", {"mode": "copy"}))
    return profiles


def _source_streams(probe: Dict[str, Any]) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    video = next((item for item in probe.get("streams", []) if item.get("codec_type") == "video"), None)
    audio = next((item for item in probe.get("streams", []) if item.get("codec_type") == "audio"), None)
    return video, audio


def _is_mp4_ready(probe: Dict[str, Any]) -> bool:
    video, audio = _source_streams(probe)
    if video is None:
        return False

    if video.get("codec_name", "").lower() not in REMUX_VIDEO_CODECS:
        return False

    if audio is None:
        return True

    return audio.get("codec_name", "").lower() in REMUX_AUDIO_CODECS


def _find_sidecar_subtitles(source_path: Path) -> list[Path]:
    search_root = _episode_root_dir(source_path)
    candidates = [
        item
        for item in search_root.rglob("*")
        if item.is_file()
        and item != source_path
        and item.suffix.lower() in SIDECAR_SUBTITLE_EXTENSIONS
        and PLAYER_CACHE_DIR not in item.parts
        and HLS_CACHE_DIR not in item.parts
        and not item.name.startswith(f"{SUBTITLE_FILE_PREFIX}-")
    ]

    source_stem = source_path.stem.lower()

    def sidecar_stem(item: Path) -> str:
        item_name = item.name
        lower_name = item_name.lower()
        for extension in SIDECAR_SUBTITLE_EXTENSIONS:
            if lower_name.endswith(extension):
                return item_name[: -len(extension)]
        return item.stem

    def stem_match_rank(item: Path) -> int:
        item_stem = sidecar_stem(item).lower()
        if item_stem == source_stem:
            return 0
        if any(item_stem.startswith(f"{source_stem}{sep}") for sep in (".", "_", "-", " ")):
            return 1
        if source_stem in item_stem:
            return 2
        return 3

    def sorter(item: Path) -> tuple[int, int, int, int, str]:
        return (
            stem_match_rank(item),
            0 if item.parent == source_path.parent else 1,
            len(item.relative_to(search_root).parts),
            SIDECAR_SUBTITLE_EXTENSIONS.index(item.suffix.lower()),
            item.name.lower(),
        )

    candidates.sort(key=sorter)
    return candidates


def _episode_root_dir(source_path: Path) -> Path:
    for parent in source_path.parents:
        if parent.name.isdigit():
            return parent
    return source_path.parent


def _subtitle_target_path(source_path: Path, identifier: str, extension: str = "vtt") -> Path:
    cache_key = _cache_key(source_path)
    safe_identifier = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in identifier).strip("-") or "subtitle"
    safe_extension = "".join(ch for ch in extension.lower().strip(".") if ch.isalnum()) or "vtt"
    return source_path.parent.joinpath(f"{SUBTITLE_FILE_PREFIX}-{safe_identifier}-{cache_key}.{safe_extension}")


def _subtitle_label(title: str, language: str, fallback: str) -> str:
    title = title.strip()
    language = language.strip()
    fallback = fallback.strip()

    if title and language and language.lower() not in title.lower():
        return f"{title} [{language}]"
    if title:
        return title
    if language:
        return language
    return fallback


def _read_subtitle_text(path: Path) -> Optional[str]:
    raw = path.read_bytes()

    for encoding in SUBTITLE_TEXT_ENCODINGS:
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue

    return raw.decode("utf-8", errors="ignore")


def _parse_ass_default_style(path: Path) -> dict[str, Any]:
    if path.suffix.lower() not in {".ass", ".ssa"}:
        return {}

    try:
        content = _read_subtitle_text(path)
    except OSError:
        return {}

    if not content:
        return {}

    format_fields: list[str] = []
    style_lines: list[list[str]] = []
    in_styles = False

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";"):
            continue

        lower_line = line.lower()
        if lower_line.startswith("[v4+ styles]") or lower_line.startswith("[v4 styles]"):
            in_styles = True
            format_fields = []
            style_lines = []
            continue
        if lower_line.startswith("[") and lower_line.endswith("]") and not lower_line.startswith("[v4"):
            in_styles = False
            continue
        if not in_styles:
            continue
        if lower_line.startswith("format:"):
            format_fields = [field.strip().lower() for field in line.split(":", 1)[1].split(",")]
            continue
        if lower_line.startswith("style:"):
            style_lines.append([value.strip() for value in line.split(":", 1)[1].split(",")])

    if not format_fields or not style_lines:
        return {}

    def line_to_style(values: list[str]) -> dict[str, str]:
        padded = values + [""] * max(0, len(format_fields) - len(values))
        return {field: padded[index] for index, field in enumerate(format_fields)}

    styles = [line_to_style(values) for values in style_lines]
    default_style = next((style for style in styles if style.get("name", "").lower() == "default"), styles[0])

    font_family = default_style.get("fontname", "").strip()
    if not font_family:
        return {}

    style: dict[str, Any] = {"font_family": font_family}
    bold_value = default_style.get("bold", "").strip()
    italic_value = default_style.get("italic", "").strip()

    if bold_value in {"-1", "1"}:
        style["font_weight"] = 700
    if italic_value in {"-1", "1"}:
        style["font_style"] = "italic"

    return style


def _convert_to_vtt(input_path: Path, target_path: Path, source_path: Path) -> None:
    lock = _asset_locks[str(target_path)]
    with lock:
        if target_path.exists() and target_path.stat().st_mtime >= input_path.stat().st_mtime:
            return

        safe_input = _safe_workspace_copy(input_path, f"subtitle-{input_path.name}")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = target_path.with_name(f"{target_path.stem}.tmp.vtt")
        if tmp_path.exists():
            tmp_path.unlink()

        try:
            if input_path.suffix.lower() == ".vtt":
                shutil.copy2(safe_input, tmp_path)
            else:
                input_args = ["-f", "srt"] if input_path.suffix.lower() in {".srt", ".subrip"} else []
                _run(
                    [
                        "ffmpeg",
                        "-nostdin",
                        "-y",
                        *input_args,
                        "-i",
                        str(safe_input),
                        "-f",
                        "webvtt",
                        str(tmp_path),
                    ]
                )

            _replace_atomic(tmp_path, target_path)
        finally:
            if safe_input != input_path:
                safe_input.unlink(missing_ok=True)


def _cleanup_browser_video_cache(source_path: Path) -> None:
    target_paths = {
        _browser_video_target_path(source_path),
        _legacy_browser_video_target_path(source_path),
    }

    for target_path in target_paths:
        if target_path.exists():
            target_path.unlink()

    cache_dir = _cache_dir(source_path)
    if cache_dir.exists() and not any(cache_dir.iterdir()):
        cache_dir.rmdir()


def _touch_path(path: Path) -> None:
    now = time.time()
    path.touch(exist_ok=True)
    try:
        path.parent.touch(exist_ok=True)
    except Exception:
        pass
    os_times = (now, now)
    try:
        path.parent.utime(os_times)  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        path.utime(os_times)  # type: ignore[attr-defined]
    except Exception:
        pass


def cleanup_hls_cache(source_path: Path) -> None:
    cache_dir = _hls_dir(source_path)
    if not cache_dir.exists():
        return

    ttl_seconds = _hls_cache_ttl_hours() * 3600
    now = time.time()
    for profile_dir in cache_dir.iterdir():
        if not profile_dir.is_dir():
            continue
        age = now - profile_dir.stat().st_mtime
        if age > ttl_seconds:
            shutil.rmtree(profile_dir, ignore_errors=True)

    if not any(cache_dir.iterdir()):
        cache_dir.rmdir()


def _build_hls_url(relative_dir: str) -> str:
    return f"/bangumi{relative_dir}/index.m3u8"


def _api_hls_url(bangumi_name: str, episode: str, profile_name: str) -> str:
    return (
        f"/api/player/hls?bangumi={bangumi_name}&episode={episode}&profile={profile_name}"
    )


def _profile_audio_bitrate(profile_name: str) -> str:
    height = _profile_target_height(profile_name) or 1080
    if height <= 480:
        return "96k"
    if height <= 720:
        return "128k"
    return "160k"


def _profile_buffer_size(video_bitrate: str) -> str:
    bitrate = video_bitrate.strip().lower()
    if bitrate.endswith("m"):
        value = float(bitrate[:-1]) * 2
        if value.is_integer():
            return f"{int(value)}M"
        return f"{value:g}M"
    if bitrate.endswith("k"):
        value = int(float(bitrate[:-1]) * 2)
        return f"{value}k"
    return video_bitrate


def _audio_codec_name(probe: Dict[str, Any]) -> str:
    _, audio = _source_streams(probe)
    return str((audio or {}).get("codec_name", "")).lower()


def _profile_target_dir(source_path: Path, profile_name: str) -> Path:
    return _hls_dir(source_path).joinpath(profile_name)


def _profile_metadata_path(source_path: Path, profile_name: str) -> Path:
    return _profile_target_dir(source_path, profile_name).joinpath(HLS_METADATA_FILE)


def _build_hls_signature(profile_name: str, profile: Dict[str, Any], probe: Dict[str, Any]) -> dict[str, Any]:
    copy_mode = str(profile.get("mode") or "").lower() == "copy" or profile_name.endswith("_TS")
    return {
        "version": 2,
        "profile": profile_name,
        "copy_mode": copy_mode,
        "audio_codec": _audio_codec_name(probe),
        "audio_copy_mode": copy_mode and _audio_codec_name(probe) in HLS_COPY_AUDIO_CODECS,
        "target_height": _profile_target_height(profile_name),
        "video_bitrate": str(profile.get("video_bitrate") or "3M"),
    }


def _write_hls_signature(target_dir: Path, signature: dict[str, Any]) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    target_dir.joinpath(HLS_METADATA_FILE).write_text(
        json.dumps(signature, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )


def _is_hls_signature_match(source_path: Path, profile_name: str, signature: dict[str, Any]) -> bool:
    metadata_path = _profile_metadata_path(source_path, profile_name)
    if not metadata_path.exists():
        return False

    try:
        cached_signature = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    return cached_signature == signature


def _manifest_is_ready(source_path: Path, profile_name: str) -> bool:
    manifest = _profile_target_dir(source_path, profile_name).joinpath("index.m3u8")
    return manifest.exists() and manifest.stat().st_mtime >= source_path.stat().st_mtime


def _read_hls_job(source_path: Path, profile_name: str) -> dict[str, Any]:
    key = _hls_job_key(source_path, profile_name)
    with _hls_jobs_lock:
        job = _hls_jobs.get(key)
        return dict(job) if job else {}


def _write_hls_job(source_path: Path, profile_name: str, **patch: Any) -> dict[str, Any]:
    key = _hls_job_key(source_path, profile_name)
    with _hls_jobs_lock:
        current = dict(_hls_jobs.get(key, {}))
        current.update(patch)
        current["updated_at"] = time.time()
        _hls_jobs[key] = current
        return dict(current)


def _build_hls_ffmpeg_command(
    source_path: Path,
    profile_name: str,
    profile: Dict[str, Any],
    probe: Dict[str, Any],
    manifest_path: Path,
    segment_pattern: Path,
    *,
    prefer_gpu: bool,
) -> list[str]:
    source_width, source_height = _video_dimensions(probe)
    target_height = _profile_target_height(profile_name)
    video_bitrate = str(profile.get("video_bitrate") or "3M")
    maxrate = str(profile.get("maxrate") or video_bitrate)
    bufsize = str(profile.get("bufsize") or _profile_buffer_size(video_bitrate))

    command = [
        "ffmpeg",
        "-nostdin",
        "-y",
    ]

    # Detect source properties for GPU capability matching.
    video_stream, _ = _source_streams(probe)
    pix_fmt = str((video_stream or {}).get("pix_fmt", "")).lower()
    is_high_bit_depth = "10" in pix_fmt or "12" in pix_fmt or "16" in pix_fmt

    use_gpu = prefer_gpu and _gpu_available()
    needs_scale = bool(target_height and source_height and source_height > target_height)

    # Choose encoder: 10-bit → hevc_nvenc (full GPU), 8-bit → h264_nvenc
    if use_gpu:
        video_encoder = _pick_nvenc_encoder(is_high_bit_depth=is_high_bit_depth)
    else:
        video_encoder = "libx264"

    # Compute target width preserving aspect ratio (must be even).
    cuvid_resize_w = 0
    cuvid_resize_h = 0
    if needs_scale and target_height and source_height and source_width:
        cuvid_resize_h = target_height
        cuvid_resize_w = int(round(source_width * target_height / source_height))
        if cuvid_resize_w % 2:
            cuvid_resize_w += 1

    if use_gpu:
        decoder = _pick_cuda_decoder(probe)
        if decoder:
            # Full GPU pipeline: cuvid decode (+resize) → CUDA frames → nvenc encode.
            # hevc_nvenc handles 10-bit natively, no CPU conversion needed.
            command.extend(["-hwaccel", "cuda", "-hwaccel_output_format", "cuda", "-c:v", decoder])
            if needs_scale and cuvid_resize_w and cuvid_resize_h:
                command.extend(["-resize", f"{cuvid_resize_w}x{cuvid_resize_h}"])
        elif "cuda" in _available_hwaccels() and "422" not in pix_fmt:
            # Generic CUDA hwaccel (NVDEC via ffmpeg API).
            # Skip for 4:2:2 — NVDEC doesn't support it; CPU decode + nvenc encode instead.
            command.extend(["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"])
        # else: 4:2:2 or unsupported → CPU decode, still GPU encode via nvenc.

    command.extend(["-i", str(source_path)])

    # Apply scaling filter only when cuvid -resize was NOT used above.
    cuvid_resized = use_gpu and needs_scale and _pick_cuda_decoder(probe) is not None and cuvid_resize_w > 0
    if needs_scale and not cuvid_resized:
        command.extend(["-vf", f"scale=-2:{target_height}"])
    copy_mode = str(profile.get("mode") or "").lower() == "copy" or profile_name.endswith("_TS")
    audio_copy_mode = copy_mode and _audio_codec_name(probe) in HLS_COPY_AUDIO_CODECS

    command.extend(
        [
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "copy" if copy_mode else video_encoder,
            "-c:a",
            "copy" if audio_copy_mode else "aac",
            "-sn",
            "-dn",
        ]
    )

    if copy_mode:
        video, _ = _source_streams(probe)
        if str((video or {}).get("codec_name", "")).lower() == "h264":
            command.extend(["-bsf:v", "h264_mp4toannexb"])
    if not audio_copy_mode:
        command.extend(
            [
                "-b:a",
                _profile_audio_bitrate(profile_name),
                "-ac",
                "2",
            ]
        )

    if copy_mode:
        pass
    elif use_gpu:
        command.extend(
            [
                "-b:v",
                video_bitrate,
                "-maxrate",
                maxrate,
                "-bufsize",
                bufsize,
                "-preset",
                "p4",
                "-rc",
                "vbr",
            ]
        )
        # HEVC in HLS needs hvc1 tag for Apple/browser compatibility.
        if video_encoder == "hevc_nvenc":
            command.extend(["-tag:v", "hvc1"])
    else:
        command.extend(
            [
                "-preset",
                "veryfast",
                "-b:v",
                video_bitrate,
                "-maxrate",
                maxrate,
                "-bufsize",
                bufsize,
                "-pix_fmt",
                "yuv420p",
            ]
        )

    command.extend(
        [
            "-f",
            "hls",
            "-hls_time",
            "6",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_filename",
            str(segment_pattern),
            str(manifest_path),
        ]
    )

    return command


def _run_ffmpeg_with_progress(
    command: list[str],
    *,
    duration_seconds: float,
    on_progress: Callable[[float], None],
) -> None:
    progress_command = command[:1] + ["-progress", "pipe:1", "-nostats"] + command[1:]
    process = subprocess.Popen(
        progress_command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )

    if process.stdout is None:
        raise RuntimeError("ffmpeg progress pipe unavailable")

    latest_progress = 0.0
    output_tail: deque[str] = deque(maxlen=120)
    for raw_line in process.stdout:
        line = raw_line.strip()
        if line:
            output_tail.append(line)
        if not line or "=" not in line:
            continue

        key, value = line.split("=", 1)
        if key == "out_time_ms" and duration_seconds > 0:
            try:
                current_seconds = max(0.0, int(value) / 1_000_000)
            except ValueError:
                continue
            latest_progress = min(99.0, current_seconds / duration_seconds * 100)
            on_progress(latest_progress)
        elif key == "progress" and value == "end":
            on_progress(100.0)

    return_code = process.wait()
    if return_code != 0:
        raise subprocess.CalledProcessError(
            return_code,
            progress_command,
            output="\n".join(output_tail),
        )


def ensure_hls_profile(source_path: Path, profile_name: str, probe: Optional[Dict[str, Any]] = None) -> str:
    profile = dict(_hls_config().get(profile_name, {}))
    if not profile:
        raise ValueError(f"unknown hls profile: {profile_name}")

    cleanup_hls_cache(source_path)
    probe = probe or _probe(source_path)
    signature = _build_hls_signature(profile_name, profile, probe)

    target_dir = _profile_target_dir(source_path, profile_name)
    target_manifest = target_dir.joinpath("index.m3u8")
    lock = _asset_locks[str(target_manifest)]

    with lock:
        if target_manifest.exists() and target_manifest.stat().st_mtime >= source_path.stat().st_mtime and _is_hls_signature_match(source_path, profile_name, signature):
            now = time.time()
            try:
                target_dir.utime((now, now))  # type: ignore[attr-defined]
                target_manifest.utime((now, now))  # type: ignore[attr-defined]
            except Exception:
                pass
            return _relative_url(target_manifest)

        safe_source = _safe_ffmpeg_input(source_path)
        _, source_height = _video_dimensions(probe)
        target_height = _profile_target_height(profile_name)
        video_bitrate = str(profile.get("video_bitrate") or "3M")
        maxrate = str(profile.get("maxrate") or video_bitrate)
        bufsize = str(profile.get("bufsize") or _profile_buffer_size(video_bitrate))

        workspace = _hls_workspace_dir(source_path, profile_name)
        tmp_dir = workspace.joinpath("out")
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
        tmp_dir.mkdir(parents=True, exist_ok=True)

        manifest_path = tmp_dir.joinpath("index.m3u8")
        segment_pattern = tmp_dir.joinpath("segment-%05d.ts")
        gpu_command = _build_hls_ffmpeg_command(
            safe_source,
            profile_name,
            profile,
            probe,
            manifest_path,
            segment_pattern,
            prefer_gpu=True,
        )
        cpu_command = _build_hls_ffmpeg_command(
            safe_source,
            profile_name,
            profile,
            probe,
            manifest_path,
            segment_pattern,
            prefer_gpu=False,
        )

        try:
            try:
                _run(gpu_command)
            except subprocess.CalledProcessError as exc:
                print(
                    f"[bgmi] GPU HLS build failed for {source_path.name} [{profile_name}], "
                    f"falling back to CPU.\n{(exc.stderr or exc.stdout or str(exc)).strip()}",
                    flush=True,
                )
                if tmp_dir.exists():
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                    tmp_dir.mkdir(parents=True, exist_ok=True)
                _run(cpu_command)
        finally:
            _release_ffmpeg_input(source_path, safe_source)

        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        _write_hls_signature(tmp_dir, signature)
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(tmp_dir), str(target_dir))

    return _relative_url(target_manifest)


def _generate_hls_profile_job(source_path: Path, profile_name: str) -> None:
    try:
        profile = dict(_hls_config().get(profile_name, {}))
        if not profile:
            raise ValueError(f"unknown hls profile: {profile_name}")
        copy_mode = str(profile.get("mode") or "").lower() == "copy" or profile_name.endswith("_TS")

        cleanup_hls_cache(source_path)
        probe = _probe(source_path)
        signature = _build_hls_signature(profile_name, profile, probe)
        duration_seconds = float(probe.get("format", {}).get("duration") or 0.0)

        target_dir = _profile_target_dir(source_path, profile_name)
        target_manifest = target_dir.joinpath("index.m3u8")
        lock = _asset_locks[str(target_manifest)]

        with lock:
            if _manifest_is_ready(source_path, profile_name) and _is_hls_signature_match(source_path, profile_name, signature):
                manifest_url = _relative_url(target_manifest)
                _write_hls_job(
                    source_path,
                    profile_name,
                    state="ready",
                    progress=100.0,
                    url=f"/bangumi{manifest_url}",
                    profile=profile_name,
                    error="",
                )
                return

            workspace = _hls_workspace_dir(source_path, profile_name)
            tmp_dir = workspace.joinpath("out")
            if tmp_dir.exists():
                shutil.rmtree(tmp_dir, ignore_errors=True)
            tmp_dir.mkdir(parents=True, exist_ok=True)

            manifest_path = tmp_dir.joinpath("index.m3u8")
            segment_pattern = tmp_dir.joinpath("segment-%05d.ts")
            safe_source = _safe_ffmpeg_input(source_path)
            gpu_command = _build_hls_ffmpeg_command(
                safe_source,
                profile_name,
                profile,
                probe,
                manifest_path,
                segment_pattern,
                prefer_gpu=True,
            )
            cpu_command = _build_hls_ffmpeg_command(
                safe_source,
                profile_name,
                profile,
                probe,
                manifest_path,
                segment_pattern,
                prefer_gpu=False,
            )

            default_stage = "direct-segment" if copy_mode else "gpu-transcode"

            def report(progress: float, stage: str = default_stage) -> None:
                _write_hls_job(
                    source_path,
                    profile_name,
                    state="running",
                    progress=round(progress, 2),
                    profile=profile_name,
                    stage=stage,
                    url="",
                    error="",
                )

            report(0.0)
            try:
                try:
                    _run_ffmpeg_with_progress(gpu_command, duration_seconds=duration_seconds, on_progress=report)
                except subprocess.CalledProcessError as exc:
                    if tmp_dir.exists():
                        shutil.rmtree(tmp_dir, ignore_errors=True)
                        tmp_dir.mkdir(parents=True, exist_ok=True)
                    gpu_error = (exc.output or str(exc)).strip()
                    print(
                        f"[bgmi] GPU HLS job failed for {source_path.name} [{profile_name}], "
                        f"falling back to CPU.\n{gpu_error}",
                        flush=True,
                    )
                    _write_hls_job(
                        source_path,
                        profile_name,
                        state="running",
                        progress=0.0,
                        profile=profile_name,
                        stage="cpu-fallback",
                        url="",
                        error=gpu_error,
                    )
                    _run_ffmpeg_with_progress(cpu_command, duration_seconds=duration_seconds, on_progress=report)
            finally:
                _release_ffmpeg_input(source_path, safe_source)

            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
            _write_hls_signature(tmp_dir, signature)
            target_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(tmp_dir), str(target_dir))

        manifest_url = _relative_url(target_manifest)
        _write_hls_job(
            source_path,
            profile_name,
            state="ready",
            progress=100.0,
            profile=profile_name,
            stage="ready",
            url=f"/bangumi{manifest_url}",
            error="",
        )
    except Exception as exc:
        _write_hls_job(
            source_path,
            profile_name,
            state="failed",
            progress=0.0,
            profile=profile_name,
            url="",
            error=str(exc),
        )


def start_hls_profile_generation(source_path: Path, profile_name: str) -> dict[str, Any]:
    profile = dict(_hls_config().get(profile_name, {}))
    probe = _probe(source_path)
    signature = _build_hls_signature(profile_name, profile, probe)

    if _manifest_is_ready(source_path, profile_name) and _is_hls_signature_match(source_path, profile_name, signature):
        manifest_url = _relative_url(_profile_target_dir(source_path, profile_name).joinpath("index.m3u8"))
        return _write_hls_job(
            source_path,
            profile_name,
            state="ready",
            progress=100.0,
            profile=profile_name,
            url=f"/bangumi{manifest_url}",
            error="",
        )

    current = _read_hls_job(source_path, profile_name)
    if current.get("state") == "running":
        return current

    _write_hls_job(
        source_path,
        profile_name,
        state="running",
        progress=0.0,
        profile=profile_name,
        stage="queued",
        url="",
        error="",
    )
    thread = Thread(target=_generate_hls_profile_job, args=(source_path, profile_name), daemon=True)
    thread.start()
    return _read_hls_job(source_path, profile_name)


def get_hls_profile_status(source_path: Path, profile_name: str) -> dict[str, Any]:
    if _manifest_is_ready(source_path, profile_name):
        manifest_url = _relative_url(_profile_target_dir(source_path, profile_name).joinpath("index.m3u8"))
        return _write_hls_job(
            source_path,
            profile_name,
            state="ready",
            progress=100.0,
            profile=profile_name,
            url=f"/bangumi{manifest_url}",
            error="",
        )

    current = _read_hls_job(source_path, profile_name)
    if current:
        return current

    return {
        "state": "idle",
        "progress": 0.0,
        "profile": profile_name,
        "url": "",
        "error": "",
    }


def build_quality_assets(source_path: Path, bangumi_name: str, episode: str) -> list[Dict[str, str]]:
    qualities = [
        {
            "name": "Direct Play",
            "url": _relative_url(source_path),
            "type": "auto",
        }
    ]

    for profile_name, profile in _hls_profiles():
        bitrate = str(profile.get("video_bitrate") or "").strip()
        label = profile_name if not bitrate else f"{profile_name} ({bitrate})"
        qualities.append(
            {
                "name": label,
                "url": _api_hls_url(bangumi_name, episode, profile_name),
                "type": "customHls",
            }
        )

    return qualities


def ensure_browser_video(source_path: Path, probe: Dict[str, Any]) -> str:
    if source_path.suffix.lower() == ".mp4":
        return _relative_url(source_path)

    target_path = _browser_video_target_path(source_path)
    legacy_target_path = _legacy_browser_video_target_path(source_path)
    lock = _asset_locks[str(target_path)]

    with lock:
        if (
            not target_path.exists()
            and legacy_target_path.exists()
            and legacy_target_path.stat().st_mtime >= source_path.stat().st_mtime
        ):
            target_path.parent.mkdir(parents=True, exist_ok=True)
            if target_path.exists():
                target_path.unlink()
            legacy_target_path.replace(target_path)

        if target_path.exists() and target_path.stat().st_mtime >= source_path.stat().st_mtime:
            return _relative_url(target_path)

        safe_source = _safe_ffmpeg_input(source_path)
        workspace = _workspace_dir(source_path)
        tmp_path = workspace.joinpath("video.tmp.mp4")

        if tmp_path.exists():
            tmp_path.unlink()

        copy_command = [
            "ffmpeg",
            "-nostdin",
            "-y",
            "-i",
            str(safe_source),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            "-sn",
            "-dn",
            str(tmp_path),
        ]

        transcode_command = [
            "ffmpeg",
            "-nostdin",
            "-y",
            "-i",
            str(safe_source),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "-sn",
            "-dn",
            str(tmp_path),
        ]

        try:
            try:
                if _is_mp4_ready(probe):
                    _run(copy_command)
                else:
                    _run(transcode_command)
            except subprocess.CalledProcessError:
                if tmp_path.exists():
                    tmp_path.unlink()
                _run(transcode_command)
        finally:
            _release_ffmpeg_input(source_path, safe_source)

        _replace_atomic(tmp_path, target_path)

        if legacy_target_path.exists() and legacy_target_path != target_path:
            legacy_target_path.unlink()

    return _relative_url(target_path)


def ensure_subtitle_assets(source_path: Path, probe: Dict[str, Any]) -> list[Dict[str, Any]]:
    subtitles: list[Dict[str, Any]] = []
    seen_paths: set[str] = set()
    subtitle_order = 0

    for sidecar in _find_sidecar_subtitles(source_path):
        source_extension = sidecar.suffix.lower().lstrip(".")
        if source_extension in {"ass", "ssa"}:
            target_path = sidecar
            subtitle_format = source_extension
            original_path = _relative_url(sidecar)
        elif source_extension in {"srt", "subrip"}:
            # iOS native HLS supports WebVTT reliably; keep SRT as the source
            # but expose a generated VTT asset to the browser player.
            target_path = _subtitle_target_path(source_path, f"sidecar-{sidecar.stem}", "vtt")
            subtitle_format = "vtt"
            original_path = None
        elif source_extension in {"vtt"}:
            target_path = sidecar
            subtitle_format = "vtt"
            original_path = None
        else:
            target_path = _subtitle_target_path(source_path, f"sidecar-{sidecar.stem}", "vtt")
            subtitle_format = "vtt"
            original_path = None

        try:
            if source_extension not in {"ass", "ssa", "vtt"}:
                _convert_to_vtt(sidecar, target_path, source_path)
            else:
                _read_subtitle_text(sidecar)
            relative_path = _relative_url(target_path)
        except Exception as exc:
            print(
                f"[bgmi] Skip invalid sidecar subtitle for {source_path.name}: {sidecar.name} ({exc})",
                flush=True,
            )
            continue

        if relative_path in seen_paths:
            continue
        seen_paths.add(relative_path)
        subtitles.append(
            {
                "path": relative_path,
                "original_path": original_path,
                "format": subtitle_format,
                "source_format": source_extension,
                "language": "",
                "label": sidecar.stem,
                "default": sidecar.stem == source_path.stem,
                "source": "sidecar",
                "render_style": _parse_ass_default_style(sidecar),
                "_order": subtitle_order,
            }
        )
        subtitle_order += 1

    subtitle_streams = [
        item
        for item in probe.get("streams", [])
        if item.get("codec_type") == "subtitle" and item.get("codec_name", "").lower() in SUBTITLE_CODEC_EXTENSIONS
    ]
    subtitle_streams.sort(
        key=lambda item: (
            -int(item.get("disposition", {}).get("default", 0)),
            item.get("index", 9999),
        )
    )

    for stream in subtitle_streams:
        stream_codec = str(stream.get("codec_name", "")).lower() or "vtt"
        target_extension = SUBTITLE_CODEC_EXTENSIONS.get(stream_codec, "vtt")
        target_path = _subtitle_target_path(source_path, f"embedded-{stream['index']}", target_extension)
        lock = _asset_locks[str(target_path)]

        try:
            with lock:
                if not (target_path.exists() and target_path.stat().st_mtime >= source_path.stat().st_mtime):
                    safe_source = _safe_ffmpeg_input(source_path)
                    workspace = _workspace_dir(source_path)
                    tmp_path = workspace.joinpath(f"subtitle-{stream['index']}.tmp.{target_extension}")
                    if tmp_path.exists():
                        tmp_path.unlink()

                    command = [
                        "ffmpeg",
                        "-nostdin",
                        "-y",
                        "-i",
                        str(safe_source),
                        "-map",
                        f"0:{stream['index']}",
                    ]
                    if target_extension in {"ass", "ssa", "srt"}:
                        command.extend(
                            [
                                "-c:s",
                                "copy",
                                str(tmp_path),
                            ]
                        )
                    else:
                        command.extend(
                            [
                                "-f",
                                "webvtt",
                                str(tmp_path),
                            ]
                        )

                    try:
                        _run(command)
                        _replace_atomic(tmp_path, target_path)
                    finally:
                        _release_ffmpeg_input(source_path, safe_source)
        except Exception as exc:
            print(
                f"[bgmi] Skip invalid embedded subtitle for {source_path.name} stream {stream['index']}: {exc}",
                flush=True,
            )
            continue

        language = str(stream.get("tags", {}).get("language", "")).strip()
        title = str(stream.get("tags", {}).get("title", "")).strip()
        label = _subtitle_label(title, language, f"Embedded {stream['index']}")
        relative_path = _relative_url(target_path)
        if relative_path in seen_paths:
            continue
        seen_paths.add(relative_path)
        subtitles.append(
            {
                "path": relative_path,
                "original_path": relative_path if target_extension in {"ass", "ssa"} else None,
                "format": "ass" if target_extension == "ass" else target_extension,
                "source_format": stream_codec,
                "language": language,
                "label": label,
                "default": bool(stream.get("disposition", {}).get("default", 0)),
                "source": "embedded",
                "render_style": _parse_ass_default_style(target_path),
                "_order": subtitle_order,
            }
        )
        subtitle_order += 1

    subtitles.sort(
        key=lambda item: (
            0 if item["default"] else 1,
            0 if item["source"] == "sidecar" else 1,
            item.get("_order", 0),
        )
    )

    for index, subtitle in enumerate(subtitles):
        subtitle["default"] = index == 0
        subtitle.pop("_order", None)

    return subtitles


def build_browser_assets(source_path: Path, bangumi_name: str, episode: str) -> Dict[str, Any]:
    cache_key = _cache_key(source_path)
    signature = _source_signature(source_path)
    with _browser_assets_cache_lock:
        cached = _browser_assets_cache.get(cache_key)
        if cached and cached[0] == signature:
            return copy.deepcopy(cached[1])

    probe = _probe(source_path)
    _cleanup_browser_video_cache(source_path)
    cleanup_hls_cache(source_path)
    subtitles = ensure_subtitle_assets(source_path, probe)
    data = {
        "source_path": _relative_url(source_path),
        "browser_path": _relative_url(source_path),
        "subtitle": subtitles[0] if subtitles else None,
        "subtitles": subtitles,
        "qualities": build_quality_assets(source_path, bangumi_name, episode),
    }

    with _browser_assets_cache_lock:
        _browser_assets_cache[cache_key] = (signature, copy.deepcopy(data))

    return data
