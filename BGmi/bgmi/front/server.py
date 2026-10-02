import click
import uvicorn
from xml.etree import ElementTree as ET
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from bgmi.config import cfg
from bgmi.front.mcp_server import create_mcp_app, create_mcp_streamable_route
from bgmi.front.resources import CalendarHandler
from bgmi.lib.table import Download
from .routes import app as api


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: dict) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or "." in path.rsplit("/", 1)[-1]:
                raise
            return await super().get_response("index.html", scope)


@click.command()
@click.option(
    "--port",
    type=int,
    default=8888,
    help="listen on the port",
)
@click.option("--address", default="0.0.0.0", help="binding at given address", type=str)
def main(address: str, port: int) -> None:
    app = make_app()

    print(f"BGmi HTTP Server listening on {address}:{port:d}")
    uvicorn.run(app, host=address, port=port)


def index_need_config(_: Request) -> HTMLResponse:
    return HTMLResponse(
        "<h1>BGmi HTTP Service</h1>"
        "<pre>Please modify your web server configure file\n"
        f"to server this path to '{cfg.save_path}'.\n"
        "e.g.\n\n"
        "...\n"
        "autoindex on;\n"
        "location / {\n"
        f"    alias {cfg.front_static_path.as_posix()}/;\n"
        "}\n"
        "location /bangumi {\n"
        f"    alias {cfg.save_path.as_posix()}/;\n"
        "}\n"
        "...\n\n"
        "If use want main to serve static files, please run this command and <strong>restart main</strong>\n"
        "\n"
        "<code>bgmi config set http serve_static_files --value true</code></pre>"
    )


def download_feed(_: Request) -> Response:
    root = ET.Element("rss", version="2.0")
    channel = ET.SubElement(root, "channel")
    ET.SubElement(channel, "title").text = "BGmi Feed"
    for row in Download.get_all_downloads():
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = row.title
        ET.SubElement(item, "enclosure", url=row.download, length="1", type="application/x-bittorrent")
    return Response(ET.tostring(root, encoding="utf-8", xml_declaration=True), media_type="application/rss+xml")


def make_app(debug: bool = False) -> Starlette:
    from bgmi.front.player_assets import start_player_cache_maintenance

    start_player_cache_maintenance()
    mcp_app = create_mcp_app()
    routes = [
        create_mcp_streamable_route("/mcp"),
        Mount("/mcp", app=mcp_app),
        Mount("/api/", app=api),
        Route("/resource/feed.xml", download_feed),
        Route("/resource/calendar.ics", CalendarHandler),
    ]

    if cfg.http.serve_static_files:
        print("will handle static files")
        routes.extend(
            [
                Mount(
                    "/bangumi",
                    app=CORSMiddleware(
                        StaticFiles(directory=cfg.save_path),
                        allow_origins=["*"],
                        allow_methods=["GET", "HEAD", "OPTIONS"],
                        allow_headers=["Range", "Content-Type", "Accept", "Origin"],
                        expose_headers=["Accept-Ranges", "Content-Length", "Content-Range"],
                    ),
                ),
                Mount("/", app=SPAStaticFiles(directory=cfg.front_static_path, html=True)),
            ]
        )
    else:
        routes.extend(
            [
                Route("/bangumi/", endpoint=index_need_config),
                Route("/", endpoint=index_need_config),
            ]
        )

    app = Starlette(routes=routes, debug=debug, lifespan=mcp_app.router.lifespan_context)

    return app


if __name__ == "__main__":
    main(address="127.0.0.1", port=8999)
