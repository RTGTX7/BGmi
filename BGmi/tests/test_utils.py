import shutil
from pathlib import Path
from typing import List, Tuple
from unittest import mock

import pytest

from bgmi.config import cfg
from bgmi.front.index import get_player
from bgmi.utils import (
    bangumi_save_path,
    episode_filter_regex,
    extract_cover_date_token,
    normalize_cover_date_token_to_season,
    parse_episode,
    resolve_cover_season,
)
from bgmi.website.model import Episode

_episode_cases: List[Tuple[str, int]] = [
    (
        "[YMDR][哥布林殺手][Goblin Slayer][2018][01][1080p][AVC][JAP][BIG5][MP4-AAC][繁中]",
        1,
    ),
    ("【安達與島村】【第二話】【1080P】【繁體中文】【AVC】", 2),
    ("のんのんびより のんすとっぷ 第02话 BIG5 720p MP4", 2),
    ("OVA 噬血狂袭 Strike the Blood IV [E01][720P][GB][BDrip]", 1),
    ("Kumo Desu ga, Nanika - 01 v2 [1080p][繁体]", 1),
    ("Re Zero Isekai Seikatsu S02 - 17 [Baha][1080p][AVC AAC]", 17),
    # range as 0
    ("[从零开始的异世界生活 第二季_Re Zero S2][34-35][繁体][720P][MP4]", 0),
    ("Strike The Blood IV][OVA][05-06][1080P][GB][MP4]", 0),
    ("[Legend of the Galactic Heroes 银河英雄传说][全110话+外传+剧场版][MKV][外挂繁中]", 0),
    ("不知道什么片 全二十话", 0),
    ("不知道什么片 全20话", 0),
    (
        (
            "[Lilith-Raws] 如果究极进化的完全沉浸 RPG 比现实还更像垃圾游戏的话 / Full Dive - 02 "
            "[Baha][WEB-DL][1080p][AVC AAC][CHT][MP4]"
        ),
        2,
    ),
    (
        "[Lilith-Raws] 86 - Eighty Six - 01 [Baha][WEB-DL][1080p][AVC AAC][CHT][MP4]",
        1,
    ),
    ("[银色子弹字幕组][名侦探柯南][第1068集 圆谷光彦的侦探笔记][简日双语MP4][1080P]", 1068),
    ("[银色子弹字幕组][名侦探柯南][第1071集 工藤优作的推理秀（前篇）][简日双语MP4][1080P]", 1071),
]


@pytest.mark.parametrize(("title", "episode"), _episode_cases)
def test_episode_parse(title, episode):
    assert (
        parse_episode(title) == episode
    ), f"\ntitle: {title!r}\nepisode: {episode}\nparsed episode: {parse_episode(title)}"


def test_remove_dupe():
    e = Episode.remove_duplicated_bangumi(
        [
            Episode(name="1", title="1", download="1", episode=1),
            Episode(name="1", title="1", download="1", episode=1),
            Episode(name="2", title="2", download="2", episode=2),
            Episode(name="2", title="2", download="2", episode=2),
            Episode(name="3", title="3", download="3", episode=3),
            Episode(name="5", title="5", download="5", episode=5),
        ]
    )
    assert len(e) == 4, e
    assert {x.episode for x in e} == {1, 2, 3, 5}


def test_episode_regex():
    e = episode_filter_regex(
        [
            Episode(name="1", title="720", download="1", episode=1),
            Episode(name="2", title="1080", download="1", episode=1),
            Episode(name="2", title="23", download="2", episode=2),
            Episode(name="1", title="17202", download="2", episode=2),
            Episode(name="3", title="..71..", download="3", episode=3),
            Episode(name="5", title="no", download="5", episode=5),
        ],
        ".*720.*",
    )
    assert len(e) == 2, e
    assert {x.name for x in e} == {"1"}


def test_episode_exclude_word():
    assert Episode(title="a b c", download="").contains_any_words(["a"])
    assert Episode(title="A B c", download="").contains_any_words(["a", "b"])
    assert not Episode(title="a b c", download="").contains_any_words(["d", "ab"])


def test_get_player():
    shutil.rmtree(cfg.save_path.joinpath("test-save-path"), ignore_errors=True)

    cfg.save_path.joinpath("test-save-path")
    cfg.save_path_map["test-save-path"] = Path("./test-save-path/ss/")

    shutil.copytree(
        Path(__file__).joinpath("../fixtures/test-save-path").resolve(), cfg.save_path.joinpath("test-save-path")
    )

    assert get_player("test-save-path") == {
        1: {"path": "/test-save-path/ss/1/q/bigger.mkv"},
        2: {"path": "/test-save-path/ss/2/2.mp4"},
    }


def test_bangumi_save_path_normalizes_windows_relative_path():
    cfg.save_path_map["test-path-normalize"] = r".\test-path-normalize\Season 1"

    assert bangumi_save_path("test-path-normalize") == cfg.save_path.joinpath("test-path-normalize/Season 1")


def test_bangumi_save_path_rejects_windows_absolute_path_on_non_windows():
    cfg.save_path_map["test-windows-absolute"] = r"C:\Anime\test-windows-absolute"

    with mock.patch("bgmi.utils.IS_WINDOWS", False):
        assert bangumi_save_path("test-windows-absolute") == cfg.save_path.joinpath("test-windows-absolute")


def test_extract_cover_date_token_from_mikan_cover_url():
    cover_url = "https://mikanani.me/images/Bangumi/202604/7892f7c2.jpg"
    assert extract_cover_date_token(cover_url) == "202604"


@pytest.mark.parametrize(
    ("token", "expected"),
    [
        ("202601", "202601"),
        ("202602", "202601"),
        ("202603", "202601"),
        ("202604", "202604"),
        ("202606", "202604"),
        ("202607", "202607"),
        ("202509", "202507"),
        ("202510", "202510"),
        ("202512", "202510"),
    ],
)
def test_normalize_cover_date_token_to_season(token, expected):
    assert normalize_cover_date_token_to_season(token) == expected


def test_resolve_cover_season_from_local_cover_proxy_path():
    cover_url = "/bangumi/cover/https/mikanani.me/images/Bangumi/202603/abcd.jpg"
    assert resolve_cover_season(cover_url) == (2026, 1, "202601")
