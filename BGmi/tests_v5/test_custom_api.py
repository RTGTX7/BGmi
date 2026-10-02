import pytest
from starlette.testclient import TestClient

from bgmi.config import cfg
from bgmi.front.server import make_app
from bgmi.lib.table import Followed


client = TestClient(make_app())
headers = {"bgmi-token": cfg.http.admin_token}


@pytest.mark.usefixtures("_ensure_data")
def test_legacy_frontend_list_and_player_by_name():
    listing = client.get("/api/index")
    assert listing.status_code == 200
    item = listing.json()["data"][0]
    assert item["bangumi_name"] == "名侦探柯南"
    assert item["episode"] == 2
    assert item["isSubscribed"] is True

    player = client.get("/api/player/bangumi", params={"bangumi": item["bangumi_name"]})
    assert player.status_code == 200
    assert player.json()["data"]["id"] == item["id"]
    assert client.get("/resource/feed.xml").status_code == 200


@pytest.mark.usefixtures("_ensure_data")
def test_legacy_frontend_auth_filter_and_mark():
    assert client.post("/api/auth", json={"token": cfg.http.admin_token}).status_code == 200
    assert client.post("/api/mark", json={"name": "名侦探柯南", "episode": 3}).status_code == 401

    response = client.post("/api/filter", headers=headers, json={"name": "名侦探柯南"})
    assert response.status_code == 200
    assert response.json()["data"]["subtitle_group"] == ["sg1", "sg2"]

    response = client.post("/api/mark", headers=headers, json={"name": "名侦探柯南", "episode": 3})
    assert response.status_code == 200
    followed = Followed.get(Followed.bangumi_name == "名侦探柯南")
    assert followed.episodes == {1, 2, 3}
