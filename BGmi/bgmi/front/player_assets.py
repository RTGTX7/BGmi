import hashlib
import json
import re
import shutil
import subprocess
import time
from collections import defaultdict, deque
from functools import lru_cache
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Callable, Dict, Optional

from bgmi.config import cfg

PLAYER_CACHE_DIR = ".bgmi-player-cache"
HLS_CACHE_DIR = ".bgmi-hls"
SUBTITLE_FILE_PREFIX = "bgmi-subtitle"
SUBTITLE_CODEC_EXTENSIONS = {
    "ass": "vtt",
    "ssa": "vtt",
    "subrip": "vtt",
    "srt": "vtt",
    "webvtt": "vtt",
}
SIDECAR_SUBTITLE_EXTENSIONS = [".vtt", ".srt", ".ass", ".ssa"]
REMUX_AUDIO_CODECS = {"aac", "mp3", "ac3", "eac3"}
REMUX_VIDEO_CODECS = {"h264", "av1", "vp9", "hev1", "h265", "hevc"}

_asset_locks: defaultdict[str, Lock] = defaultdict(Lock)
_hls_jobs_lock = Lock()
_hls_jobs: dict[str, dict[str, Any]] = {}


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
    return "/" + path.relative_to(cfg.save_path).as_posix()


def _cache_key(source_path: Path) -> str:
    return hashlib.sha1(str(source_path).encode("utf-8")).hexdigest()[:16]


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
    return _safe_workspace_copy(source_path, f"input{source_path.suffix.lower()}")


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
        if len(parts) >= 4 and parts[0] in {"T.", ".S", ".."}:
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


def _pick_video_encoder() -> str:
    return "h264_nvenc" if "h264_nvenc" in _available_encoders() else "libx264"


def _pick_cuda_decoder(probe: Dict[str, Any]) -> Optional[str]:
    if "cuda" not in _available_hwaccels():
        return None

    video, _ = _source_streams(probe)
    if video is None:
        return None

    decoder_map = {
        "h264": "h264_cuvid",
        "hevc": "hevc_cuvid",
        "h265": "hevc_cuvid",
        "av1": "av1_cuvid",
        "vp9": "vp9_cuvid",
    }

    codec_name = str(video.get("codec_name", "")).lower()
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
    return hls_config if isinstance(hls_config, dict) else {}


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
    candidates = [
        item
        for item in source_path.parent.iterdir()
        if item.is_file() and item != source_path and item.suffix.lower() in SIDECAR_SUBTITLE_EXTENSIONS
        and not item.name.startswith(f"{SUBTITLE_FILE_PREFIX}-")
    ]

    def sorter(item: Path) -> tuple[int, int, str]:
        return (
            0 if item.stem == source_path.stem else 1,
            SIDECAR_SUBTITLE_EXTENSIONS.index(item.suffix.lower()),
            item.name.lower(),
        )

    candidates.sort(key=sorter)
    return candidates


def _subtitle_target_path(source_path: Path, identifier: str) -> Path:
    cache_key = _cache_key(source_path)
    safe_identifier = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in identifier).strip("-") or "subtitle"
    return source_path.parent.joinpath(f"{SUBTITLE_FILE_PREFIX}-{safe_identifier}-{cache_key}.vtt")


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


def _convert_to_vtt(input_path: Path, target_path: Path, source_path: Path) -> None:
    lock = _asset_locks[str(target_path)]
    with lock:
        if target_path.exists() and target_path.stat().st_mtime >= input_path.stat().st_mtime:
            return

        safe_input = _safe_workspace_copy(input_path, f"subtitle-{input_path.name}")
        workspace = _workspace_dir(source_path)
        tmp_path = workspace.joinpath(f"{target_path.stem}.tmp.vtt")
        if tmp_path.exists():
            tmp_path.unlink()

        if input_path.suffix.lower() == ".vtt":
            shutil.copy2(safe_input, tmp_path)
        else:
            _run(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-y",
                    "-i",
                    str(safe_input),
                    "-f",
                    "webvtt",
                    str(tmp_path),
                ]
            )

        _replace_atomic(tmp_path, target_path)


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


def _profile_target_dir(source_path: Path, profile_name: str) -> Path:
    return _hls_dir(source_path).joinpath(profile_name)


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
    _, source_height = _video_dimensions(probe)
    target_height = _profile_target_height(profile_name)
    video_bitrate = str(profile.get("video_bitrate") or "3M")
    maxrate = str(profile.get("maxrate") or video_bitrate)
    bufsize = str(profile.get("bufsize") or _profile_buffer_size(video_bitrate))

    command = [
        "ffmpeg",
        "-nostdin",
        "-y",
    ]

    use_gpu = prefer_gpu and _pick_video_encoder() == "h264_nvenc"
    if use_gpu:
        decoder = _pick_cuda_decoder(probe)
        if decoder:
            command.extend(["-hwaccel", "cuda", "-hwaccel_output_format", "cuda", "-c:v", decoder])
        elif "cuda" in _available_hwaccels():
            command.extend(["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"])

    command.extend(["-i", str(source_path)])

    if target_height and source_height and source_height > target_height:
        if use_gpu and "scale_cuda" in _available_filters():
            command.extend(["-vf", f"scale_cuda=-2:{target_height}"])
        else:
            command.extend(["-vf", f"scale=-2:{target_height}"])

    video_encoder = "h264_nvenc" if use_gpu else "libx264"
    copy_mode = str(profile.get("mode") or "").lower() == "copy" or profile_name.endswith("_TS")

    command.extend(
        [
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "copy" if copy_mode else video_encoder,
            "-c:a",
            "copy" if copy_mode else "aac",
            "-sn",
            "-dn",
        ]
    )

    if copy_mode:
        video, _ = _source_streams(probe)
        if str((video or {}).get("codec_name", "")).lower() == "h264":
            command.extend(["-bsf:v", "h264_mp4toannexb"])
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
                "-b:a",
                _profile_audio_bitrate(profile_name),
                "-ac",
                "2",
            ]
        )
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
                "-b:a",
                _profile_audio_bitrate(profile_name),
                "-ac",
                "2",
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

    target_dir = _profile_target_dir(source_path, profile_name)
    target_manifest = target_dir.joinpath("index.m3u8")
    lock = _asset_locks[str(target_manifest)]

    with lock:
        if target_manifest.exists() and target_manifest.stat().st_mtime >= source_path.stat().st_mtime:
            now = time.time()
            try:
                target_dir.utime((now, now))  # type: ignore[attr-defined]
                target_manifest.utime((now, now))  # type: ignore[attr-defined]
            except Exception:
                pass
            return _relative_url(target_manifest)

        safe_source = _safe_ffmpeg_input(source_path)
        probe = probe or _probe(source_path)
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

        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
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
        duration_seconds = float(probe.get("format", {}).get("duration") or 0.0)

        target_dir = _profile_target_dir(source_path, profile_name)
        target_manifest = target_dir.joinpath("index.m3u8")
        lock = _asset_locks[str(target_manifest)]

        with lock:
            if _manifest_is_ready(source_path, profile_name):
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
            gpu_command = _build_hls_ffmpeg_command(
                _safe_ffmpeg_input(source_path),
                profile_name,
                profile,
                probe,
                manifest_path,
                segment_pattern,
                prefer_gpu=True,
            )
            cpu_command = _build_hls_ffmpeg_command(
                _safe_ffmpeg_input(source_path),
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

            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
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
            if _is_mp4_ready(probe):
                _run(copy_command)
            else:
                _run(transcode_command)
        except subprocess.CalledProcessError:
            if tmp_path.exists():
                tmp_path.unlink()
            _run(transcode_command)

        _replace_atomic(tmp_path, target_path)

        if legacy_target_path.exists() and legacy_target_path != target_path:
            legacy_target_path.unlink()

    return _relative_url(target_path)


def ensure_subtitle_assets(source_path: Path, probe: Dict[str, Any]) -> list[Dict[str, Any]]:
    subtitles: list[Dict[str, Any]] = []
    seen_paths: set[str] = set()

    for sidecar in _find_sidecar_subtitles(source_path):
        target_path = sidecar if sidecar.suffix.lower() == ".vtt" else _subtitle_target_path(source_path, f"sidecar-{sidecar.stem}")
        _convert_to_vtt(sidecar, target_path, source_path)
        relative_path = _relative_url(target_path)
        if relative_path in seen_paths:
            continue
        seen_paths.add(relative_path)
        subtitles.append(
            {
                "path": relative_path,
                "format": "vtt",
                "language": "",
                "label": sidecar.stem,
                "default": sidecar.stem == source_path.stem,
                "source": "sidecar",
            }
        )

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
        target_path = _subtitle_target_path(source_path, f"embedded-{stream['index']}")
        lock = _asset_locks[str(target_path)]

        with lock:
            if not (target_path.exists() and target_path.stat().st_mtime >= source_path.stat().st_mtime):
                safe_source = _safe_ffmpeg_input(source_path)
                workspace = _workspace_dir(source_path)
                tmp_path = workspace.joinpath(f"subtitle-{stream['index']}.tmp.vtt")
                if tmp_path.exists():
                    tmp_path.unlink()

                _run(
                    [
                        "ffmpeg",
                        "-nostdin",
                        "-y",
                        "-i",
                        str(safe_source),
                        "-map",
                        f"0:{stream['index']}",
                        "-f",
                        "webvtt",
                        str(tmp_path),
                    ]
                )
                _replace_atomic(tmp_path, target_path)

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
                "format": "vtt",
                "language": language,
                "label": label,
                "default": bool(stream.get("disposition", {}).get("default", 0)),
                "source": "embedded",
            }
        )

    subtitles.sort(
        key=lambda item: (
            0 if item["default"] else 1,
            0 if item["source"] == "sidecar" else 1,
            item["label"].lower(),
        )
    )

    for index, subtitle in enumerate(subtitles):
        subtitle["default"] = index == 0

    return subtitles


def build_browser_assets(source_path: Path, bangumi_name: str, episode: str) -> Dict[str, Any]:
    probe = _probe(source_path)
    _cleanup_browser_video_cache(source_path)
    cleanup_hls_cache(source_path)
    subtitles = ensure_subtitle_assets(source_path, probe)
    return {
        "source_path": _relative_url(source_path),
        "browser_path": _relative_url(source_path),
        "subtitle": subtitles[0] if subtitles else None,
        "subtitles": subtitles,
        "qualities": build_quality_assets(source_path, bangumi_name, episode),
    }
