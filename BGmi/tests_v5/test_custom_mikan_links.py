import sqlite3
from types import SimpleNamespace

from bgmi.front import custom_routes
from bgmi.front.index import _video_versions
from bgmi.lib import mikan_release
from bgmi.config import Source, cfg
from bgmi.lib.update import _ensure_custom_columns


def test_mikan_group_link_targets_bangumi_section(monkeypatch):
    html = """
    <div class="subgroup-text">
      <a href="/Home/PublishGroup/392">Kirara Fantasia</a>
      <a href="/RSS/Bangumi?bangumiId=4039&subgroupid=615">RSS</a>
    </div>
    """
    monkeypatch.setattr(custom_routes, "get_text", lambda _: html)
    custom_routes.mikan_subtitle_group_links.cache_clear()
    try:
        assert custom_routes.mikan_subtitle_group_links("4039") == [
            {
                "id": "615",
                "name": "Kirara Fantasia",
                "url": "https://mikanani.me/Home/Bangumi/4039#615",
            }
        ]
    finally:
        custom_routes.mikan_subtitle_group_links.cache_clear()


def test_existing_bangumi_rows_gain_mikan_id_column(tmp_path, monkeypatch):
    monkeypatch.setattr(cfg, "data_source", Source.Mikan)
    database = tmp_path / "old.db"
    with sqlite3.connect(database) as conn:
        conn.execute("CREATE TABLE bangumi (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
        conn.executemany(
            "INSERT INTO bangumi (id, name) VALUES (?, ?)",
            [("4039", "Mikan title"), ("hashed-id", "Other title")],
        )

    _ensure_custom_columns(database)
    _ensure_custom_columns(database)
    with sqlite3.connect(database) as conn:
        assert conn.execute("SELECT id, mikan_id FROM bangumi ORDER BY id").fetchall() == [
            ("4039", "4039"),
            ("hashed-id", ""),
        ]


def test_local_numeric_id_is_not_assumed_to_be_mikan_id(tmp_path, monkeypatch):
    monkeypatch.setattr(cfg, "data_source", Source.Mikan)
    database = tmp_path / "local.db"
    with sqlite3.connect(database) as conn:
        conn.execute("CREATE TABLE bangumi (id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT NOT NULL)")
        conn.execute("INSERT INTO bangumi (id, name, source) VALUES ('12', 'Local file', 'local')")

    _ensure_custom_columns(database)
    with sqlite3.connect(database) as conn:
        assert conn.execute("SELECT mikan_id FROM bangumi WHERE id = '12'").fetchone() == ("",)


def test_official_v5_rows_survive_custom_column_upgrade(tmp_path):
    database = tmp_path / "official-v5.db"
    with sqlite3.connect(database) as conn:
        conn.executescript(
            """
            CREATE TABLE bangumi (
                id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
                subtitle_group TEXT NOT NULL DEFAULT '[]',
                update_day TEXT NOT NULL DEFAULT 'Unknown',
                cover TEXT NOT NULL DEFAULT '', status INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE followed (
                bangumi_name TEXT PRIMARY KEY, episodes TEXT NOT NULL DEFAULT '[]',
                status INTEGER NOT NULL, updated_time INTEGER NOT NULL
            );
            CREATE TABLE download (
                id INTEGER PRIMARY KEY, bangumi_name TEXT NOT NULL,
                title TEXT NOT NULL, episode INTEGER NOT NULL,
                download TEXT NOT NULL, status INTEGER NOT NULL, task_id TEXT
            );
            INSERT INTO bangumi VALUES ('source-id', 'Example', '["615"]', 'Fri', 'https://poster.test/a.jpg', 0);
            INSERT INTO followed VALUES ('Example', '[1,2]', 1, 12345);
            INSERT INTO download VALUES (7, 'Example', 'Episode 2', 2, 'magnet:test', 2, 'task-7');
            """
        )

    _ensure_custom_columns(database)
    _ensure_custom_columns(database)

    with sqlite3.connect(database) as conn:
        assert conn.execute(
            "SELECT id, name, subtitle_group, cover, mikan_id FROM bangumi"
        ).fetchone() == ("source-id", "Example", '["615"]', "https://poster.test/a.jpg", "")
        assert conn.execute("SELECT * FROM followed").fetchone() == ("Example", "[1,2]", 1, 12345)
        assert conn.execute(
            "SELECT id, bangumi_name, title, episode, download, status, task_id, created_time FROM download"
        ).fetchone() == (7, "Example", "Episode 2", 2, "magnet:test", 2, "task-7", 0)


def test_unknown_release_keeps_full_filename_and_each_file(tmp_path, monkeypatch):
    monkeypatch.setattr(custom_routes.cfg, "save_path", tmp_path)
    folder = tmp_path / "Example" / "1"
    folder.mkdir(parents=True)
    first = folder / "【得宗字幕组×拾月出云】标题 - 01.mkv"
    second = folder / "【得宗字幕组×拾月出云】标题 - 01 修正版.mkv"
    first.touch()
    second.touch()

    versions = _video_versions([first, second])
    assert {version["group"] for version in versions} == {first.name, second.name}
    assert all(version["groupSource"] == "filename" for version in versions)


def test_episode_hash_page_provides_historical_subtitle_group(monkeypatch):
    info_hash = "50213879d77ad3d0487f7293de1c7b1908269380"
    html = f"""
    <title>【得宗字幕组×拾月出云】标题 - Mikan Project</title>
    <a href="magnet:?xt=urn:btih:{info_hash}">Download</a>
    <a href="/Home/Bangumi/4039#646">Bangumi</a>
    <a href="/Home/PublishGroup/421">得宗字幕组×拾月出云</a>
    """
    monkeypatch.setattr(mikan_release, "get_text", lambda _: html)
    mikan_release.mikan_release_by_hash.cache_clear()
    try:
        assert mikan_release.mikan_release_by_hash(info_hash) == {
            "title": "【得宗字幕组×拾月出云】标题",
            "group": "得宗字幕组×拾月出云",
            "mikanId": "4039",
            "groupId": "646",
            "url": f"https://mikanani.me/Home/Episode/{info_hash}",
        }
    finally:
        mikan_release.mikan_release_by_hash.cache_clear()


def test_download_hash_identifies_group_without_filename_regex(monkeypatch):
    info_hash = "50213879d77ad3d0487f7293de1c7b1908269380"
    title = "【得宗字幕组×拾月出云】标题[23]"
    path = "/Example/23/renamed.mkv"
    download = SimpleNamespace(
        episode=23, video_path=path, title=title,
        download=f"magnet:?xt=urn:btih:{info_hash}", task_id=None,
    )
    version = {"group": "renamed.mkv", "fileName": "renamed.mkv", "path": path, "groupSource": "filename"}
    monkeypatch.setattr(custom_routes.cfg, "enable_path_formatter", False)
    monkeypatch.setattr(custom_routes, "get_player_versions", lambda *args, **kwargs: {23: [version]})
    monkeypatch.setattr(custom_routes, "mikan_release_by_hash", lambda _: {
        "title": title, "group": "得宗字幕组×拾月出云", "mikanId": "4039",
        "groupId": "646", "url": f"https://mikanani.me/Home/Episode/{info_hash}",
    })

    class FakeSession:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def scalars(self, statement):
            return self

        def all(self):
            return [download]

    monkeypatch.setattr(custom_routes.Session, "begin", FakeSession)
    bangumi = SimpleNamespace(name="Example", mikan_id="4039")

    result = custom_routes.player_versions_map(bangumi, None)
    assert result[23][0]["group"] == "得宗字幕组×拾月出云"
    assert result[23][0]["groupSource"] == "mikan"
    assert result[23][0]["mikanUrl"].endswith(info_hash)


def test_search_result_from_another_season_is_not_saved(monkeypatch):
    row = SimpleNamespace(id="hashed-id", mikan_id="", source="remote", name="擅长逃跑的殿下 第二季")
    monkeypatch.setattr(
        custom_routes,
        "resolve_bangumi",
        lambda _: (
            {"keyword": "1234", "name": "擅长逃跑的殿下"},
            [{"keyword": "1234", "name": "擅长逃跑的殿下"}],
            [],
        ),
    )

    assert custom_routes.linked_mikan_id(row) == ""


def test_duplicate_exact_titles_are_not_assigned_automatically(monkeypatch):
    row = SimpleNamespace(id="hashed-id", mikan_id="", source="remote", name="Same Title")
    monkeypatch.setattr(
        custom_routes,
        "resolve_bangumi",
        lambda _: (
            {"keyword": "100", "name": "Same Title"},
            [{"keyword": "100", "name": "Same Title"}, {"keyword": "200", "name": "Same Title"}],
            [],
        ),
    )

    assert custom_routes.linked_mikan_id(row) == ""


def test_exact_title_candidate_wins_over_shortened_query_result(monkeypatch):
    row = SimpleNamespace(id="hashed-id", mikan_id="", source="remote", name="擅长逃跑的殿下 第二季")
    monkeypatch.setattr(
        custom_routes,
        "resolve_bangumi",
        lambda _: (
            {"keyword": "1234", "name": "擅长逃跑的殿下"},
            [
                {"keyword": "1234", "name": "擅长逃跑的殿下"},
                {"keyword": "4039", "name": "擅长逃跑的殿下 第二季"},
            ],
            [],
        ),
    )

    class RecordingSession:
        writes = []

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def execute(self, statement):
            self.writes.append(statement)

    recording_session = RecordingSession()
    monkeypatch.setattr(custom_routes.Session, "begin", lambda: recording_session)

    assert custom_routes.linked_mikan_id(row) == "4039"
    assert len(recording_session.writes) == 1
