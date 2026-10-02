import json
import sqlite3
from unittest import mock

from bgmi.config import cfg
from bgmi.lib.update import _migrate_from_v4


def test_personal_v4_metadata_survives_v5_migration(tmp_path):
    db_path = tmp_path / "bangumi.db"
    with sqlite3.connect(db_path) as db:
        db.executescript(
            """
            CREATE TABLE bangumi (
                id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
                subtitle_group TEXT NOT NULL, keyword TEXT,
                update_time CHAR(5) NOT NULL, cover TEXT,
                status INTEGER NOT NULL, source TEXT,
                in_library INTEGER, library_path TEXT
            );
            CREATE TABLE followed (
                id INTEGER PRIMARY KEY, bangumi_name TEXT UNIQUE,
                episode INTEGER, status INTEGER, updated_time INTEGER
            );
            CREATE TABLE filter (
                bangumi_name TEXT PRIMARY KEY, subtitle TEXT,
                "include" TEXT, "exclude" TEXT, regex TEXT
            );
            CREATE TABLE download (
                id INTEGER PRIMARY KEY, name TEXT NOT NULL,
                title TEXT NOT NULL, episode INTEGER NOT NULL,
                download TEXT NOT NULL, status INTEGER NOT NULL,
                created_time INTEGER NOT NULL
            );
            CREATE TABLE bangumi_issue (
                id INTEGER PRIMARY KEY, bangumi_name TEXT,
                issue_type TEXT, episode TEXT, file_path TEXT,
                note TEXT, marked_at INTEGER, metadata TEXT
            );
            INSERT INTO bangumi VALUES
                (7, 'LocalAnime', '[]', '', 'Mon', '', 1, 'local', 1, 'Anime/LocalAnime'),
                (8, 'RemoteAnime', '[]', 'mikan-remote', 'Tue', '', 0, 'remote', 0, '');
            INSERT INTO followed VALUES (1, 'LocalAnime', 3, 1, 1234);
            INSERT INTO filter VALUES ('LocalAnime', 'sub1', '1080p', '', '.*');
            INSERT INTO download VALUES (11, 'LocalAnime', 'Episode 3', 3, 'magnet:test', 2, 9876);
            INSERT INTO bangumi_issue VALUES
                (5, 'LocalAnime', 'missing_episodes', '2', NULL, 'check', 333, '{"episodes":[2]}');
            """
        )

    with mock.patch.object(cfg, "save_path", tmp_path / "save"), mock.patch("bgmi.lib.fetch.website"):
        _migrate_from_v4(db_path)

    with sqlite3.connect(db_path) as db:
        local = db.execute(
            "SELECT id, source, in_library, library_path FROM bangumi WHERE name = 'LocalAnime'"
        ).fetchone()
        remote = db.execute("SELECT id FROM bangumi WHERE name = 'RemoteAnime'").fetchone()
        followed = db.execute("SELECT episodes, subtitle, \"include\" FROM followed").fetchone()
        created = db.execute("SELECT created_time FROM download WHERE id = 11").fetchone()
        issue = db.execute("SELECT issue_type, metadata FROM bangumi_issue WHERE id = 5").fetchone()

    assert local == ("local:7", "local", 1, "Anime/LocalAnime")
    assert remote == ("mikan-remote",)
    assert json.loads(followed[0]) == [1, 2, 3]
    assert json.loads(followed[1]) == ["sub1"]
    assert json.loads(followed[2]) == ["1080p"]
    assert created == (9876,)
    assert issue == ("missing_episodes", '{"episodes":[2]}')
