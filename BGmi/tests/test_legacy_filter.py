"""Regression checks for the BGmi 5 frontend filter adapter."""
import unittest
from unittest.mock import patch

import fastapi
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

from bgmi.front import custom_routes as routes
from bgmi.lib.table import Base, Bangumi, Followed, Subtitle


class LegacyFilterTests(unittest.TestCase):
    def setUp(self):
        self.engine = sa.create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        self.patch = patch.object(routes, "Session", self.sessions)
        self.patch.start()
        self.mikan_patch = patch.object(routes, "linked_mikan_id", return_value="")
        self.mikan_patch.start()
        with self.sessions.begin() as session:
            session.add(Bangumi(id="show", name="Test show", subtitle_group=["group"]))
            session.add(Subtitle(id="group", name="Test group"))

    def tearDown(self):
        self.patch.stop()
        self.mikan_patch.stop()
        self.engine.dispose()

    def test_unsubscribed_read_returns_defaults_without_creating_subscription(self):
        result = routes.legacy_filter({"name": "Test show"})["data"]
        self.assertEqual(result["subtitle_group"], ["Test group"])
        self.assertEqual(result["followed"], [])
        self.assertEqual(result["regex"], "")
        with self.sessions.begin() as session:
            self.assertIsNone(session.get(Followed, "Test show"))

    def test_unsubscribed_write_still_fails(self):
        with self.assertRaises(fastapi.HTTPException) as caught:
            routes.legacy_filter({"name": "Test show", "regex": "1080"})
        self.assertEqual(caught.exception.status_code, 404)

    def test_subscribed_settings_round_trip(self):
        with self.sessions.begin() as session:
            session.add(Followed(bangumi_name="Test show"))
        routes.legacy_filter({"name": "Test show", "subtitle": "Test group", "include": "1080, HEVC", "regex": "test"})
        result = routes.legacy_filter({"name": "Test show"})["data"]
        self.assertEqual(result["followed"], ["Test group"])
        self.assertEqual(result["include"], "1080,HEVC")
        self.assertEqual(result["regex"], "test")

    def test_deleted_subscription_is_not_selected(self):
        with self.sessions.begin() as session:
            session.add(Followed(bangumi_name="Test show", status=Followed.STATUS_DELETED, subtitle=["group"]))
        self.assertEqual(routes.legacy_filter({"name": "Test show"})["data"]["followed"], [])

    def test_mikan_groups_are_available_and_saveable(self):
        with self.sessions.begin() as session:
            session.add(Followed(bangumi_name="Test show"))
        self.mikan_patch.stop()
        with patch.object(routes, "linked_mikan_id", return_value="123"), patch.object(
            routes, "mikan_subtitle_group_links", return_value=[{"id": "456", "name": "Mikan group"}]
        ):
            result = routes.legacy_filter({"name": "Test show"})["data"]
            self.assertIn("Mikan group", result["subtitle_group"])
            routes.legacy_filter({"name": "Test show", "subtitle": "Mikan group"})
            self.assertEqual(routes.legacy_filter({"name": "Test show"})["data"]["followed"], ["Mikan group"])
        self.mikan_patch.start()

    def test_missing_bangumi_still_fails(self):
        with self.assertRaises(fastapi.HTTPException) as caught:
            routes.legacy_filter({"name": "Missing show"})
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
