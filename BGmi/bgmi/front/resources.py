import datetime
import html
import os
from collections import defaultdict

from icalendar import Calendar, Event, Todo

from bgmi.config import cfg
from bgmi.front.base import BaseHandler
from bgmi.lib.constants import BANGUMI_UPDATE_TIME
from bgmi.lib.models import Download, Followed


class BangumiHandler(BaseHandler):
    def get(self, _: str = "") -> None:
        if not _:
            entries = []
            if cfg.save_path.exists():
                for path in sorted(cfg.save_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                    suffix = "/" if path.is_dir() else ""
                    entry_name = html.escape(f"{path.name}{suffix}")
                    entry_href = html.escape(f"/bangumi/{path.name}{suffix}", quote=True)
                    entry_type = "Folder" if path.is_dir() else "File"
                    entries.append(
                        """
                        <a class="entry-card" href="{href}">
                            <span class="entry-icon">{icon}</span>
                            <span class="entry-meta">
                                <span class="entry-type">{type_}</span>
                                <span class="entry-name">{name}</span>
                            </span>
                            <span class="entry-arrow">›</span>
                        </a>
                        """.format(
                            href=entry_href,
                            icon="📁" if path.is_dir() else "🎞️",
                            type_=entry_type,
                            name=entry_name,
                        )
                    )

            self.set_header("Content-Type", "text/html; charset=utf-8")
            save_path = html.escape(str(cfg.save_path))
            save_parts = [html.escape(part) for part in cfg.save_path.parts if part]
            breadcrumbs = "".join(
                f'<span class="crumb">{part}</span>' for part in save_parts[-4:]
            ) or '<span class="crumb">bangumi</span>'
            body = """
            <!doctype html>
            <html lang="zh-CN">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>BGmi Files</title>
                <style>
                    :root {{
                        color-scheme: dark;
                        --bg: radial-gradient(circle at top center, rgba(255,255,255,0.04), transparent 30%),
                              linear-gradient(180deg, #10151d 0%, #0b1017 100%);
                        --grid: rgba(255,255,255,0.035);
                        --panel: rgba(17, 22, 30, 0.94);
                        --panel-soft: rgba(15, 20, 28, 0.96);
                        --panel-border: rgba(255,255,255,0.08);
                        --panel-border-strong: rgba(255,255,255,0.14);
                        --text-main: rgba(245,247,250,0.96);
                        --text-sub: rgba(170,180,194,0.72);
                        --text-faint: rgba(132,143,156,0.72);
                    }}
                    * {{ box-sizing: border-box; }}
                    body {{
                        margin: 0;
                        min-height: 100vh;
                        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                        background: var(--bg);
                        color: var(--text-main);
                        position: relative;
                    }}
                    body::before {{
                        content: "";
                        position: fixed;
                        inset: 0;
                        pointer-events: none;
                        background-image:
                            linear-gradient(var(--grid) 1px, transparent 1px),
                            linear-gradient(90deg, var(--grid) 1px, transparent 1px);
                        background-size: 28px 28px;
                        mask-image: linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.18));
                    }}
                    .shell {{
                        max-width: 1120px;
                        margin: 0 auto;
                        padding: 44px 24px 56px;
                    }}
                    .hero {{
                        position: relative;
                        overflow: hidden;
                        border-radius: 20px;
                        padding: 26px 28px 24px;
                        background: linear-gradient(180deg, rgba(17,22,30,0.96), rgba(14,19,27,0.96));
                        border: 1px solid var(--panel-border);
                        box-shadow: 0 18px 44px rgba(0,0,0,0.26);
                    }}
                    .hero::before {{
                        content: "";
                        position: absolute;
                        inset: 0;
                        border-radius: 20px;
                        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 38%);
                        pointer-events: none;
                    }}
                    h1 {{
                        margin: 0 0 8px;
                        font-size: clamp(34px, 4vw, 50px);
                        line-height: 1;
                        letter-spacing: -0.04em;
                    }}
                    .subtitle {{
                        margin: 0;
                        color: var(--text-sub);
                        font-size: 14px;
                    }}
                    .path-card {{
                        margin-top: 18px;
                        padding: 16px 18px 14px;
                        border-radius: 16px;
                        background: linear-gradient(180deg, rgba(15,20,28,0.94), rgba(12,17,24,0.94));
                        border: 1px solid var(--panel-border);
                        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
                    }}
                    .path-label {{
                        display: inline-block;
                        margin-bottom: 10px;
                        color: var(--text-faint);
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.18em;
                    }}
                    .breadcrumbs {{
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                        margin-bottom: 10px;
                    }}
                    .crumb {{
                        display: inline-flex;
                        align-items: center;
                        padding: 5px 10px;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.08);
                        font-size: 11px;
                        color: rgba(233,237,242,0.84);
                    }}
                    .raw-path {{
                        font-family: Consolas, "SFMono-Regular", monospace;
                        font-size: 12px;
                        color: rgba(170,180,194,0.82);
                        word-break: break-all;
                        line-height: 1.5;
                    }}
                    .section-title {{
                        margin: 28px 0 12px;
                        font-size: 14px;
                        color: rgba(255,255,255,0.96);
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                    }}
                    .grid {{
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px;
                    }}
                    .entry-card {{
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        width: 100%;
                        min-height: 78px;
                        padding: 13px 14px;
                        border-radius: 14px;
                        text-decoration: none;
                        color: inherit;
                        background: linear-gradient(180deg, rgba(18,23,31,0.98), rgba(15,20,28,0.98));
                        border: 1px solid rgba(255,255,255,0.07);
                        box-shadow: 0 10px 18px rgba(0,0,0,0.18);
                        transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
                        position: relative;
                    }}
                    .entry-card::before {{
                        content: "";
                        position: absolute;
                        inset: 1px;
                        border-radius: inherit;
                        pointer-events: none;
                        background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 28%);
                    }}
                    .entry-card:hover {{
                        transform: translateY(-1px);
                        border-color: var(--panel-border-strong);
                        background: linear-gradient(180deg, rgba(22,28,37,1), rgba(17,22,31,1));
                        box-shadow: 0 14px 24px rgba(0,0,0,0.22);
                    }}
                    .entry-icon {{
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 38px;
                        height: 38px;
                        border-radius: 10px;
                        background: rgba(255,255,255,0.06);
                        border: 1px solid rgba(255,255,255,0.08);
                        font-size: 18px;
                        flex-shrink: 0;
                        position: relative;
                        z-index: 1;
                    }}
                    .entry-meta {{
                        display: flex;
                        min-width: 0;
                        flex-direction: column;
                        gap: 3px;
                        position: relative;
                        z-index: 1;
                    }}
                    .entry-type {{
                        color: var(--text-faint);
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.14em;
                    }}
                    .entry-name {{
                        font-size: 15px;
                        font-weight: 600;
                        line-height: 1.25;
                        word-break: break-word;
                        letter-spacing: -0.01em;
                    }}
                    .entry-arrow {{
                        margin-left: auto;
                        color: rgba(255,255,255,0.28);
                        font-size: 18px;
                        position: relative;
                        z-index: 1;
                    }}
                    .empty {{
                        padding: 18px;
                        border-radius: 14px;
                        background: rgba(255,255,255,0.03);
                        border: 1px dashed rgba(255,255,255,0.10);
                        color: var(--text-sub);
                    }}
                    @media (max-width: 860px) {{
                        .grid {{
                            grid-template-columns: 1fr;
                        }}
                    }}
                    @media (max-width: 640px) {{
                        .shell {{
                            padding: 24px 14px 36px;
                        }}
                        .hero {{
                            padding: 20px 18px 18px;
                            border-radius: 18px;
                        }}
                        .path-card {{
                            padding: 14px;
                        }}
                    }}
                </style>
            </head>
            <body>
                <main class="shell">
                    <section class="hero">
                        <h1>BGmi Files</h1>
                        <p class="subtitle">本地番剧目录入口，点击即可继续浏览或直接打开资源文件。</p>
                        <div class="path-card">
                            <span class="path-label">Current Save Path</span>
                            <div class="breadcrumbs">{breadcrumbs}</div>
                            <div class="raw-path">{save_path}</div>
                        </div>
                    </section>
                    <h2 class="section-title">Directory Contents</h2>
                    <section class="grid">
                        {entries}
                    </section>
                </main>
            </body>
            </html>
            """.format(
                breadcrumbs=breadcrumbs,
                save_path=save_path,
                entries="".join(entries) if entries else '<div class="empty">当前目录为空。</div>',
            )
            self.write(body)
            self.finish()
            return

        if os.environ.get("DEV"):  # pragma: no cover
            with open(os.path.join(cfg.save_path, _), "rb") as f:
                self.write(f.read())
                self.finish()
        else:
            self.set_header("Content-Type", "text/html")
            self.write("<h1>BGmi HTTP Service</h1>")
            self.write(
                "<pre>Please modify your web server configure file\n"
                f"to server this path to '{cfg.save_path}'.\n"
                "e.g.\n\n"
                "...\n"
                "autoindex on;\n"
                "location /bangumi {\n"
                f"    alias {cfg.save_path};\n"
                "}\n"
                "...\n\n"
                "If you want to use Tornado to serve static files, please enable\n"
                "<code>[http]</code>"
                "<code>serve_static_files = true</code></pre>"
            )
            self.finish()


class RssHandler(BaseHandler):
    def get(self) -> None:
        data = Download.get_all_downloads()
        self.set_header("Content-Type", "text/xml")
        self.render("templates/download.xml", data=data)


class CalendarHandler(BaseHandler):
    def get(self) -> None:
        type_ = self.get_argument("type", None)

        cal = Calendar()
        cal.add("prodid", "-//BGmi Followed Bangumi Calendar//bangumi.ricterz.me//")
        cal.add("version", "2.0")

        data = Followed.get_all_followed()
        data.extend(self.patch_list)

        if type_ is None:
            bangumi = defaultdict(list)

            for j in data:
                bangumi[BANGUMI_UPDATE_TIME.index(j["update_time"]) + 1].append(j["bangumi_name"])

            weekday = datetime.datetime.now().weekday()
            for i, k in enumerate(range(weekday, weekday + 7)):
                if k % 7 in bangumi:
                    for v in bangumi[k % 7]:
                        event = Event()
                        event.add("summary", v)
                        event.add(
                            "dtstart",
                            datetime.datetime.now().date() + datetime.timedelta(i - 1),
                        )
                        event.add(
                            "dtend",
                            datetime.datetime.now().date() + datetime.timedelta(i - 1),
                        )
                        cal.add_component(event)
        elif type_ == "download":
            data = [
                item for item in Download.get_all_downloads() if item["created_time"] and int(item["created_time"]) != 0
            ]
            for d in data:
                todo = Todo()
                todo.add("summary", f"{d['name']}: {d['episode']}")
                todo.add("dstart", datetime.datetime.fromtimestamp(int(d["created_time"])))
                cal.add_component(todo)

        else:
            data = [bangumi for bangumi in data if bangumi["status"] == 2]
            for d in data:
                event = Event()
                event.add("summary", "Updated: {}".format(d["bangumi_name"]))
                event.add("dtstart", datetime.datetime.now().date())
                event.add("dtend", datetime.datetime.now().date())
                cal.add_component(event)

        cal.add("name", "Bangumi Calendar")
        cal.add("X-WR-CALNAM", "Bangumi Calendar")
        cal.add("description", "Followed Bangumi Calendar")
        cal.add("X-WR-CALDESC", "Followed Bangumi Calendar")

        self.write(cal.to_ical())
        self.finish()
