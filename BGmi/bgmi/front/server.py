import asyncio
from itertools import chain
from pathlib import Path
from typing import Any, List

import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.routing
import tornado.template
import tornado.web
from tornado.options import define, options

from bgmi.config import IS_WINDOWS, cfg
from bgmi.front.admin import API_MAP_GET, API_MAP_POST, AdminApiHandler, UpdateHandler
from bgmi.front.index import (
    BangumiListHandler,
    IndexHandler,
    PlayerAssetHandler,
    PlayerHlsHandler,
    PlayerHlsStartHandler,
    PlayerHlsStatusHandler,
)
from bgmi.front.resources import BangumiHandler, CalendarHandler, RssHandler
from bgmi.setup import create_dir, init_db

define("port", default=8888, help="listen on the port", type=int)
define("address", default="0.0.0.0", help="binding at given address", type=str)


class SpaIndexHandler(tornado.web.RequestHandler):
    def get(self, path: str = "") -> None:
        index_path = Path(cfg.front_static_path).joinpath("index.html")
        self.set_header("Content-Type", "text/html; charset=utf-8")
        self.write(index_path.read_text(encoding="utf-8"))
        self.finish()


def make_app() -> tornado.web.Application:
    create_dir()
    init_db()

    settings = {
        "autoreload": True,
        "gzip": True,
        "debug": True,
    }
    api_actions = "|".join(chain(API_MAP_GET.keys(), API_MAP_POST.keys()))

    handlers: List[Any] = [
        (r"^/api/(old|index)", BangumiListHandler),
        (r"^/api/player$", PlayerAssetHandler),
        (r"^/api/player/hls$", PlayerHlsHandler),
        (r"^/api/player/hls/start$", PlayerHlsStartHandler),
        (r"^/api/player/hls/status$", PlayerHlsStatusHandler),
        (r"^/resource/feed.xml$", RssHandler),
        (r"^/resource/calendar.ics$", CalendarHandler),
        (r"^/api/update", UpdateHandler),
        (rf"^/api/(?P<action>{api_actions})", AdminApiHandler),
    ]

    if cfg.http.serve_static_files:
        handlers.extend(
            [
                (r"^/bangumi/?$", BangumiHandler),
                (r"/bangumi/(.*)", tornado.web.StaticFileHandler, {"path": cfg.save_path}),
                (r"^/assets/(.*)$", tornado.web.StaticFileHandler, {"path": Path(cfg.front_static_path).joinpath("assets")}),
                (r"^/package/(.*)$", tornado.web.StaticFileHandler, {"path": Path(cfg.front_static_path).joinpath("package")}),
                (r"^/(logo\.jpg)$", tornado.web.StaticFileHandler, {"path": cfg.front_static_path}),
                (
                    r"^/(.*)$",
                    SpaIndexHandler,
                ),
            ]
        )
    else:
        handlers.extend(
            [
                (r"^/bangumi/?(.*)", BangumiHandler),
                (r"^/(.*)$", IndexHandler),
            ]
        )

    return tornado.web.Application(handlers, **settings)  # type: ignore


def main() -> None:
    if IS_WINDOWS:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    tornado.options.parse_command_line()
    print(f"BGmi HTTP Server listening on {options.address}:{options.port:d}")
    http_server = tornado.httpserver.HTTPServer(make_app())
    http_server.listen(options.port, address=options.address)
    tornado.ioloop.IOLoop.current().start()


if __name__ == "__main__":
    main()
