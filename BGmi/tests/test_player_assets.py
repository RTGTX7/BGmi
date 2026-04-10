from pathlib import Path

from bgmi.front import player_assets


def test_ensure_subtitle_assets_loads_all_sidecar_subtitles(tmp_path, monkeypatch):
    monkeypatch.setattr(player_assets.cfg, "save_path", tmp_path)

    episode_dir = tmp_path / "Example Bangumi" / "1"
    release_dir = episode_dir / "release"
    extras_dir = episode_dir / "subtitles"
    release_dir.mkdir(parents=True)
    extras_dir.mkdir(parents=True)

    source_path = release_dir / "episode.mkv"
    source_path.write_bytes(b"video")

    (release_dir / "episode.sc.ass").write_text(
        """[Script Info]\nTitle: test\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, Bold, Italic\nStyle: Default,Microsoft JhengHei,54,-1,0\n\n[Events]\nFormat: Layer, Start, End, Style, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,sidecar sc\n""",
        encoding="utf-8",
    )
    (release_dir / "episode.tc.ass").write_text(
        """[Script Info]\nTitle: test\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, Bold, Italic\nStyle: Default,Noto Sans CJK TC,54,0,0\n\n[Events]\nFormat: Layer, Start, End, Style, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,sidecar tc\n""",
        encoding="utf-8",
    )
    (extras_dir / "episode.jp.srt").write_text("sidecar jp", encoding="utf-8")

    subtitles = player_assets.ensure_subtitle_assets(source_path, {"streams": []})

    assert [subtitle["label"] for subtitle in subtitles] == ["episode.sc", "episode.tc", "episode.jp"]
    assert all(subtitle["source"] == "sidecar" for subtitle in subtitles)
    assert subtitles[0]["original_path"].endswith("episode.sc.ass")
    assert subtitles[1]["original_path"].endswith("episode.tc.ass")
    assert not subtitles[2]["original_path"]
    assert subtitles[2]["path"].endswith(".srt")
    assert subtitles[0]["format"] == "ass"
    assert subtitles[1]["format"] == "ass"
    assert subtitles[2]["format"] == "srt"
    assert subtitles[0]["render_style"]["font_family"] == "Microsoft JhengHei"
    assert subtitles[0]["render_style"]["font_weight"] == 700
    assert subtitles[1]["render_style"]["font_family"] == "Noto Sans CJK TC"
    assert subtitles[2]["render_style"] == {}


def test_ensure_subtitle_assets_skips_invalid_sidecar(tmp_path, monkeypatch):
    monkeypatch.setattr(player_assets.cfg, "save_path", tmp_path)

    episode_dir = tmp_path / "Example Bangumi" / "1"
    episode_dir.mkdir(parents=True)

    source_path = episode_dir / "episode.mkv"
    source_path.write_bytes(b"video")

    bad_sidecar = episode_dir / "episode.sc.srt"
    good_sidecar = episode_dir / "episode.tc.srt"
    bad_sidecar.write_text("broken", encoding="utf-8")
    good_sidecar.write_text("good", encoding="utf-8")

    original_read_subtitle_text = player_assets._read_subtitle_text

    def fake_read_subtitle_text(path: Path) -> str:
        if path == bad_sidecar:
            raise RuntimeError("invalid subtitle")
        return original_read_subtitle_text(path) or ""

    monkeypatch.setattr(player_assets, "_read_subtitle_text", fake_read_subtitle_text)

    subtitles = player_assets.ensure_subtitle_assets(source_path, {"streams": []})

    assert [subtitle["label"] for subtitle in subtitles] == ["episode.tc"]


def test_build_hls_command_transcodes_unsupported_audio_in_copy_mode(tmp_path):
    source_path = tmp_path / "episode.mkv"
    manifest_path = tmp_path / "index.m3u8"
    segment_pattern = tmp_path / "segment-%05d.ts"

    command = player_assets._build_hls_ffmpeg_command(
        source_path,
        "1080p_TS",
        {},
        {
            "streams": [
                {"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080},
                {"codec_type": "audio", "codec_name": "flac"},
            ]
        },
        manifest_path,
        segment_pattern,
        prefer_gpu=False,
    )

    assert command[command.index("-c:v") + 1] == "copy"
    assert command[command.index("-c:a") + 1] == "aac"
    assert "-b:a" in command
    assert "-ac" in command


def test_build_hls_command_keeps_supported_audio_in_copy_mode(tmp_path):
    source_path = tmp_path / "episode.mkv"
    manifest_path = tmp_path / "index.m3u8"
    segment_pattern = tmp_path / "segment-%05d.ts"

    command = player_assets._build_hls_ffmpeg_command(
        source_path,
        "1080p_TS",
        {},
        {
            "streams": [
                {"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080},
                {"codec_type": "audio", "codec_name": "aac"},
            ]
        },
        manifest_path,
        segment_pattern,
        prefer_gpu=False,
    )

    assert command[command.index("-c:v") + 1] == "copy"
    assert command[command.index("-c:a") + 1] == "copy"
    assert "-b:a" not in command


def test_embedded_ssa_extracts_as_ass(tmp_path, monkeypatch):
    monkeypatch.setattr(player_assets.cfg, "save_path", tmp_path)

    episode_dir = tmp_path / "Example Bangumi" / "1"
    episode_dir.mkdir(parents=True)

    source_path = episode_dir / "episode.mkv"
    source_path.write_bytes(b"video")

    ass_content = (
        "[Script Info]\n"
        "Title: test\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, Bold, Italic\n"
        "Style: Default,Microsoft YaHei,54,-1,0\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Text\n"
        "Dialogue: 0,0:00:00.00,0:00:01.00,Default,embedded ass\n"
    )

    def fake_safe_ffmpeg_input(path: Path) -> Path:
        return path

    def fake_run(command: list[str]):
        output_path = Path(command[-1])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(ass_content, encoding="utf-8")

        class Result:
            stdout = ""
            stderr = ""

        return Result()

    monkeypatch.setattr(player_assets, "_safe_ffmpeg_input", fake_safe_ffmpeg_input)
    monkeypatch.setattr(player_assets, "_run", fake_run)

    subtitles = player_assets.ensure_subtitle_assets(
        source_path,
        {
            "streams": [
                {
                    "index": 2,
                    "codec_type": "subtitle",
                    "codec_name": "ssa",
                    "tags": {"language": "chi", "title": "Chinese"},
                    "disposition": {"default": 1},
                }
            ]
        },
    )

    assert len(subtitles) == 1
    assert subtitles[0]["path"].endswith(".ass")
    assert subtitles[0]["original_path"].endswith(".ass")
    assert subtitles[0]["format"] == "ass"
    assert subtitles[0]["source_format"] == "ssa"
    assert subtitles[0]["render_style"]["font_family"] == "Microsoft YaHei"
