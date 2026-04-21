import datetime
import itertools
import os
import platform
import sys
from operator import itemgetter
from typing import List, Mapping, Optional, Tuple

import click
import pydantic
import tomlkit
import wcwidth
from loguru import logger
from pycomplete import Completer
from tornado import template

from bgmi import __version__
from bgmi.config import BGMI_PATH, CONFIG_FILE_PATH, Config, cfg, normalize_config_path_value, write_default_config
from bgmi.lib import controllers as ctl
from bgmi.lib.constants import BANGUMI_UPDATE_TIME, SPACIAL_APPEND_CHARS, SPACIAL_REMOVE_CHARS, SUPPORT_WEBSITE
from bgmi.lib.database_editor import (
    delete_database_bangumi_by_id,
    delete_database_bangumi,
    list_database_bangumi,
    parse_subtitle_selection,
    prepare_database_bangumi,
    upsert_database_bangumi,
)
from bgmi.lib.download import download_prepare
from bgmi.lib.fetch import website
from bgmi.lib.maintenance import execute_rebuild_repository, preview_rebuild_repository
from bgmi.lib.mikan_resolver import resolve_bangumi
from bgmi.lib.models import STATUS_DELETED, STATUS_FOLLOWED, STATUS_UPDATED, Bangumi, Filter, Followed, Subtitle
from bgmi.lib.update import update_database
from bgmi.script import ScriptRunner
from bgmi.setup import create_dir, init_db, install_crontab
from bgmi.utils import (
    COLOR_END,
    GREEN,
    RED,
    YELLOW,
    check_update,
    get_terminal_col,
    get_web_admin,
    print_error,
    print_info,
    print_success,
    print_version,
    print_warning,
)

__all__ = ["main_for_test", "main", "print_success"]


def _configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if stream is None:
            continue
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            encoding = (getattr(stream, "encoding", None) or "").lower()
            if encoding != "utf-8":
                reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            continue


def main() -> None:
    _configure_stdio()
    logger.remove()
    logger.add(
        sys.stderr, format="<blue>{time:YYYY-MM-DD HH:mm:ss}</blue> {level:7} | <level>{message}</level>", level="INFO"
    )
    logger.add(cfg.log_path.parent.joinpath("{time:YYYY-MM-DD}.log"), format="{time} {level} {message}", level="INFO")

    cli.main(prog_name="bgmi")


def main_for_test(args: Optional[List[str]] = None) -> None:
    _configure_stdio()
    cli.main(args=args, prog_name="bgmi", standalone_mode=False)


@click.group(name="bgmi")
@click.version_option(__version__, package_name="bgmi", prog_name="bgmi", message=print_version())
@click.pass_context
def cli(ctx: click.Context) -> None:
    if ctx.invoked_subcommand != "completion":
        create_dir()
        init_db()

    if ctx.invoked_subcommand not in ["install", "upgrade", "completion"]:
        check_update()


@cli.command(help="Install BGmi and frontend")
def install() -> None:
    need_to_init = False
    if not os.path.exists(BGMI_PATH):
        need_to_init = True
        print_warning(f"BGMI_PATH {BGMI_PATH} does not exist, installing")

    create_dir()
    init_db()
    if need_to_init:
        install_crontab()

    write_default_config()
    update_database()
    get_web_admin(method="install")


@cli.command(help="upgrade from previous version")
def upgrade() -> None:
    create_dir()
    update_database()
    check_update()


@cli.command(
    help="Select date source bangumi_moe or mikan_project",
)
@click.argument("bangumi_source", required=True, type=click.Choice([x["id"] for x in SUPPORT_WEBSITE]))
def source(bangumi_source: str) -> None:
    result = ctl.source(data_source=bangumi_source)
    globals()["print_{}".format(result["status"])](result["message"])


@cli.group()
def config() -> None: ...


@config.command("print")
def config_print() -> None:
    if CONFIG_FILE_PATH.exists():
        print(CONFIG_FILE_PATH.read_text(encoding="utf-8"))
        return
    print("config file not exist")


@config.command("set")
@click.argument("keys", nargs=-1)
@click.option("--value", required=True)
def _config_set(keys: List[str], value: str) -> None:
    config_set(keys, value)


def config_set(keys: List[str], value: str) -> None:
    doc = tomlkit.loads(CONFIG_FILE_PATH.read_text(encoding="utf-8"))

    if keys[0] == "source":
        print_error("you can't change source with this command, use `bgmi source ...`", stop=True)

    if keys and keys[0] == "save_path_map":
        value = normalize_config_path_value(value)

    res = doc
    for key in keys[:-1]:
        res = res.setdefault(key, {})
        if not isinstance(res, Mapping):
            print_error(f"value of key '{key}' is not object, can't update its attribute")

    res[keys[-1]] = value

    try:
        Config.model_validate(doc)
    except pydantic.ValidationError as e:
        print(e)
        print("config is not valid after change, won't write to config file")
        return

    CONFIG_FILE_PATH.write_text(tomlkit.dumps(doc), encoding="utf-8")


@config.command("get")
@click.argument("keys", nargs=-1)
def config_get(keys: List[str]) -> None:
    doc = tomlkit.loads(CONFIG_FILE_PATH.read_text(encoding="utf-8"))
    res = doc

    for key in keys:
        res = doc.get(key, {})

    print("config", ".".join(keys), res)


@cli.command(help="Search torrents from data source by keyword")
@click.argument("keyword")
@click.option("--count", type=int, help="The max page count of search result.")
@click.option("--regex-filter", "regex", help="Regular expression filter of title.")
@click.option("--download", is_flag=True, show_default=True, default=False, type=bool, help="Download search result.")
@click.option("--dupe", is_flag=True, show_default=True, default=False, type=bool, help="Show duplicated episode")
@click.option("--min-episode", "min_episode", type=int, help="Minimum episode filter of title.")
@click.option("--max-episode", "max_episode", type=int, help="Maximum episode filter of title.")
@click.option(
    "--tag", is_flag=True, show_default=True, default=False, help="Use tag to search (if data source supported)."
)
@click.option("--subtitle", help="Subtitle group filter of title (Need --tag enabled)")
def search(
    keyword: str,
    count: int,
    regex: str,
    download: bool,
    dupe: bool,
    min_episode: int,
    max_episode: int,
    tag: bool,
    subtitle: str,
) -> None:
    result = ctl.search(
        keyword=keyword,
        count=count,
        regex=regex,
        dupe=dupe,
        min_episode=min_episode,
        max_episode=max_episode,
        tag=tag,
        subtitle=subtitle,
    )
    if result["status"] != "success":
        globals()["print_{}".format(result["status"])](result["message"])
    data = result["data"]
    for i in data:
        print(i.title)
    if download:
        download_prepare(data)


@cli.command("resolve-bangumi", help="Resolve bangumi metadata from Mikan bangumi pages")
@click.argument("name")
def resolve_bangumi_cli(name: str) -> None:
    chosen, candidates, queries = resolve_bangumi(name)

    print("Queries:")
    for query in queries:
        print(f"  - {query}")

    if chosen is None:
        if not candidates:
            print_warning(f"No bangumi matched on Mikan for keyword: {name}")
            return

        print_warning(f"Multiple or low-confidence matches for: {name}")
        for candidate in candidates:
            print(f"  - {candidate['name']} | keyword={candidate['keyword']} | cover={candidate.get('cover', '')}")
        return

    print_success("Resolved bangumi:")
    print(f"  name: {chosen['name']}")
    print(f"  keyword: {chosen['keyword']}")
    print(f"  cover: {chosen.get('cover', '')}")
    print(f"  query: {chosen.get('query', '')}")
    print(f"  match: {chosen.get('matchType', '')}")


@cli.command("rebuild-repository", help="Rebuild local repository bangumi records from local bangumi folders")
@click.option("--execute", "do_execute", is_flag=True, default=False, help="Execute rebuild instead of dry-run preview")
@click.option("--show-items", is_flag=True, default=False, help="Print per-folder preview/result items")
@click.option("--offset", type=int, default=0, show_default=True, help="Start folder offset for the current batch")
@click.option("--limit", type=int, default=None, help="Max folders to process in the current batch")
@click.option("--batch-size", type=int, default=None, help="Process all folders in repeated batches of this size")
def rebuild_repository_cli(
    do_execute: bool, show_items: bool, offset: int, limit: Optional[int], batch_size: Optional[int]
) -> None:
    if batch_size is not None and batch_size <= 0:
        print_error("--batch-size must be greater than 0")
        return

    if limit is not None and limit < 0:
        print_error("--limit must be greater than or equal to 0")
        return

    if batch_size is not None:
        current_offset = max(offset, 0)
        batch_index = 1
        total_success = 0
        total_failed = 0
        total_skipped = 0

        while True:
            if do_execute:
                result = execute_rebuild_repository(confirmText="REBUILD", offset=current_offset, limit=batch_size)
            else:
                result = preview_rebuild_repository(offset=current_offset, limit=batch_size)

            if result["status"] == "error":
                print_error(result["message"])
                return

            payload = result["data"]
            print_info(
                f"Batch {batch_index}: offset={payload.get('offset', current_offset)} "
                f"scanned={payload.get('foldersScanned', payload.get('affectedCount', 0))} "
                f"/ total={payload.get('totalFolders', payload.get('affectedCount', 0))}"
            )

            if do_execute:
                print(
                    f"  success={payload.get('successCount', 0)} "
                    f"skipped={payload.get('skippedCount', 0)} "
                    f"failed={payload.get('failedCount', 0)}"
                )
                total_success += payload.get("successCount", 0)
                total_failed += payload.get("failedCount", 0)
                total_skipped += payload.get("skippedCount", 0)
            else:
                print(
                    f"  matched={payload.get('matchedCount', 0)} "
                    f"unmatched={payload.get('unmatchedCount', 0)} "
                    f"multiple={payload.get('multiCandidateCount', 0)} "
                    f"failed={payload.get('failedCount', 0)}"
                )

            if show_items:
                for item in payload.get("items", []):
                    match_type = item.get("status") or item.get("matchType", "unknown")
                    action = item.get("action", "skip")
                    reason = item.get("reason", "")
                    folder_name = item.get("folderName", "")
                    matched_name = item.get("matchedName", "")
                    keyword = item.get("keyword", "")
                    if matched_name:
                        suffix = f" | action={action}"
                        if reason:
                            suffix += f" | reason={reason}"
                        print(f"  - [{match_type}] {folder_name} -> {matched_name} ({keyword}){suffix}")
                    else:
                        suffix = f" | action={action}"
                        if reason:
                            suffix += f" | reason={reason}"
                        print(f"  - [{match_type}] {folder_name}{suffix}")

            current_offset += payload.get("foldersScanned", payload.get("affectedCount", 0))
            batch_index += 1
            if not payload.get("hasMore") or payload.get("foldersScanned", payload.get("affectedCount", 0)) == 0:
                if do_execute:
                    print_success("Rebuild repository finished for all batches.")
                    print(f"Total success : {total_success}")
                    print(f"Total skipped : {total_skipped}")
                    print(f"Total failed  : {total_failed}")
                else:
                    print_success("Preview finished for all batches.")
                break
        return

    if do_execute:
        result = execute_rebuild_repository(confirmText="REBUILD", offset=offset, limit=limit)
        if result["status"] == "error":
            print_error(result["message"])
            return

        payload = result["data"]
        preview = payload.get("preview", {})
        print_success(result["message"])
        print(f"Folders scanned : {payload.get('affectedCount', 0)}")
        print(f"Total folders   : {payload.get('totalFolders', payload.get('affectedCount', 0))}")
        print(f"Offset/Limit    : {payload.get('offset', offset)} / {payload.get('limit')}")
        print(f"Has more        : {payload.get('hasMore', False)}")
        print(f"Success         : {payload.get('successCount', 0)}")
        print(f"Skipped         : {payload.get('skippedCount', 0)}")
        print(f"Failed          : {payload.get('failedCount', 0)}")
        print(f"Poster updated  : {payload.get('posterUpdatedCount', 0)}")
        print(f"Deleted empty   : {payload.get('deletedEmptyLocalCount', 0)}")
        print(f"Protected empty : {payload.get('skippedProtectedEmptyCount', 0)}")
        print(f"Delete failed   : {payload.get('failedDeleteCount', 0)}")
        print(
            "Matched/Unmatched/Multiple : "
            f"{preview.get('matchedCount', 0)} / {preview.get('unmatchedCount', 0)} / {preview.get('multiCandidateCount', 0)}"
        )

        errors = payload.get("errors", [])
        if errors:
            print_warning("Errors:")
            for error in errors[:50]:
                print(f"  - {error.get('folderName') or error.get('bangumi') or 'unknown'}: {error.get('error', '')}")
            if len(errors) > 50:
                print(f"  ... {len(errors) - 50} more errors omitted")
        return

    result = preview_rebuild_repository(offset=offset, limit=limit)
    if result["status"] == "error":
        print_error(result["message"])
        return

    payload = result["data"]
    print_success(result["message"])
    print(f"Folders scanned : {payload.get('foldersScanned', 0)}")
    print(f"Total folders   : {payload.get('totalFolders', payload.get('foldersScanned', 0))}")
    print(f"Offset/Limit    : {payload.get('offset', offset)} / {payload.get('limit')}")
    print(f"Has more        : {payload.get('hasMore', False)}")
    print(f"Matched         : {payload.get('matchedCount', 0)}")
    print(f"Unmatched       : {payload.get('unmatchedCount', 0)}")
    print(f"Multiple        : {payload.get('multiCandidateCount', 0)}")
    print(f"Create          : {payload.get('createCount', 0)}")
    print(f"Update          : {payload.get('updateCount', 0)}")
    print(f"Skip            : {payload.get('skipCount', 0)}")
    print(f"Failed          : {payload.get('failedCount', 0)}")
    print(f"Empty folders   : {payload.get('emptyFolderCount', 0)}")
    print(f"Delete empty    : {payload.get('willDeleteEmptyLocalCount', 0)}")
    print(f"Protected empty : {payload.get('willSkipProtectedEmptyCount', 0)}")

    if show_items:
        print_info("Items:")
        for item in payload.get("items", []):
            match_type = item.get("status") or item.get("matchType", "unknown")
            action = item.get("action", "skip")
            reason = item.get("reason", "")
            folder_name = item.get("folderName", "")
            matched_name = item.get("matchedName", "")
            keyword = item.get("keyword", "")
            if matched_name:
                suffix = f" | action={action}"
                if reason:
                    suffix += f" | reason={reason}"
                print(f"  - [{match_type}] {folder_name} -> {matched_name} ({keyword}){suffix}")
            else:
                suffix = f" | action={action}"
                if reason:
                    suffix += f" | reason={reason}"
                print(f"  - [{match_type}] {folder_name}{suffix}")

    errors = payload.get("errors", [])
    if errors:
        print_warning("Errors:")
        for error in errors[:50]:
            print(f"  - {error.get('folderName') or 'unknown'}: {error.get('error', '')}")
        if len(errors) > 50:
            print(f"  ... {len(errors) - 50} more errors omitted")


@cli.command("mark")
@click.argument("name", required=True)
@click.argument("episode", type=int, required=True)
def mark(name: str, episode: int) -> None:
    result = ctl.mark(name=name, episode=episode)
    globals()["print_{}".format(result["status"])](result["message"])


@cli.command()
@click.argument("names", nargs=-1)
@click.option(
    "--episode",
    type=int,
    help="add bangumi and mark it as specified episode",
)
@click.option(
    "--save-path",
    type=str,
    help="add config.save_path_map for bangumi, example: './{bangumi_name}/S1/' './名侦探柯南/S1/'",
)
def add(names: List[str], episode: Optional[int], save_path: Optional[str]) -> None:
    """
    subscribe bangumi

    names: list of bangumi names to subscribe

    --save-path 同时修改 config 中的 `save_path_map`。
    """
    for name in names:
        result = ctl.add(name=name, episode=episode)
        globals()["print_{}".format(result["status"])](result["message"])
        if save_path:
            if result["status"] in ["success", "warning"]:
                bangumi = Bangumi.fuzzy_get(name=name)
                config_set(["save_path_map", bangumi.name], value=save_path.format(bangumi_name=bangumi.name))


@cli.command()
@click.argument("name", nargs=-1)
@click.option(
    "--clear-all",
    "clear",
    is_flag=True,
    default=False,
    help="Clear all the subscriptions, name will be ignored If you provide this flag",
)
@click.option("--yes", is_flag=True, default=False, help="No confirmation")
def delete(name: List[str], clear: bool, yes: bool) -> None:
    """
    name: list of bangumi names to unsubscribe
    """
    if clear:
        ctl.delete("", clear_all=clear, batch=yes)
    else:
        for bangumi_name in name:
            result = ctl.delete(name=bangumi_name)
            globals()["print_{}".format(result["status"])](result["message"])


@cli.command("list", help="list subscribed bangumi")
def list_command() -> None:
    result = ctl.list_()
    print(result["message"])


@cli.group("database", help="Inspect and edit bangumi metadata stored in the database")
def database_cli() -> None: ...


@database_cli.command("list", help="List bangumi records in database")
@click.option("--id", "bangumi_id", type=int, help="Filter by bangumi database id.")
@click.option("--query", type=str, help="Filter by bangumi name or keyword.")
@click.option("--source", type=click.Choice(["remote", "local", "hybrid"]), help="Filter by bangumi source.")
@click.option(
    "--subscribed",
    type=click.Choice(["all", "yes", "no"]),
    default="all",
    show_default=True,
    help="Filter by whether bangumi has a subscription record.",
)
@click.option("--limit", type=int, default=20, show_default=True, help="Maximum number of rows to print.")
def database_list_command(bangumi_id: Optional[int], query: Optional[str], source: Optional[str], subscribed: str, limit: int) -> None:
    subscribed_filter = None if subscribed == "all" else subscribed == "yes"
    rows = list_database_bangumi(bangumi_id=bangumi_id, query=query, source=source, subscribed=subscribed_filter, limit=limit)
    if not rows:
        print_warning("No bangumi rows matched the current filters")
        return

    for row in rows:
        subscribed_label = "yes" if row["isSubscribed"] else "no"
        in_library_label = "yes" if row["inLibrary"] else "no"
        subtitle_label = ", ".join(row["subtitleGroups"]) if row["subtitleGroups"] else "None"
        print(
            f"[{row['id']}] {row['name']} | keyword={row['keyword']} | source={row['source']} | "
            f"status={row['status']} | subscribed={subscribed_label} | inLibrary={in_library_label} | "
            f"update={row['updateTime']} | subtitles={subtitle_label}"
        )


def _prompt_candidate_choice(candidates: List[dict]) -> Optional[dict]:
    if not candidates:
        return None

    print_info("Multiple candidates matched:")
    for index, candidate in enumerate(candidates, start=1):
        print(
            f"  {index}. {candidate.get('name', '')} | keyword={candidate.get('keyword', '')} | "
            f"match={candidate.get('matchType', '')} | cover={candidate.get('cover', '')}"
        )

    choice = click.prompt("Select candidate number or type skip", default="skip", show_default=True)
    if str(choice).strip().lower() == "skip":
        return None
    if not str(choice).strip().isdigit():
        print_error("invalid candidate selection", stop=False)
        return None
    selected_index = int(str(choice).strip()) - 1
    if selected_index < 0 or selected_index >= len(candidates):
        print_error("candidate selection out of range", stop=False)
        return None
    return candidates[selected_index]


def _choose_subtitle_groups(
    subtitle_groups: List[object],
    subtitle_selection: Optional[str],
    yes: bool,
) -> List[object]:
    if not subtitle_groups:
        return []

    if subtitle_selection is None and not yes:
        print_info("Available subtitle groups:")
        for index, group in enumerate(subtitle_groups, start=1):
            print(f"  {index}. {group.name} ({group.id})")
        subtitle_selection = click.prompt(
            "Select subtitles: all / skip / comma-separated indexes, ids, or names",
            default="all",
            show_default=True,
        )

    if subtitle_selection is None:
        subtitle_selection = "all"

    return parse_subtitle_selection(subtitle_selection, subtitle_groups)  # type: ignore[arg-type]


@database_cli.command("add", help="Add or update a bangumi metadata row without subscribing it")
@click.argument("name", required=True)
@click.option("--keyword", type=str, help="Use an explicit bangumi keyword instead of automatic resolve.")
@click.option(
    "--subtitle",
    "subtitle_selection",
    type=str,
    help='Subtitle selection: "all", "skip", or comma-separated indexes / ids / names.',
)
@click.option("--yes", is_flag=True, default=False, help="Do not ask interactive questions.")
@click.option("--download-cover/--no-download-cover", default=True, show_default=True, help="Cache cover after save.")
def database_add_command(
    name: str,
    keyword: Optional[str],
    subtitle_selection: Optional[str],
    yes: bool,
    download_cover: bool,
) -> None:
    prepared = prepare_database_bangumi(name=name, keyword=keyword)
    if prepared["status"] != "success":
        print_error(prepared["message"], stop=False)
        for query in prepared.get("data", {}).get("queries", []):
            print(f"  query: {query}")
        return

    data = prepared["data"]
    chosen = data.get("chosen")
    candidates = data.get("candidates", [])
    bangumi_info = data.get("bangumi")

    if chosen is None and candidates:
        if yes:
            print_error("multiple candidates matched, rerun without --yes or pass --keyword", stop=False)
            return
        chosen = _prompt_candidate_choice(candidates)
        if chosen is None:
            print_warning("database add canceled")
            return
        prepared = prepare_database_bangumi(name=str(chosen.get("name") or name), keyword=str(chosen.get("keyword") or ""))
        if prepared["status"] != "success":
            print_error(prepared["message"], stop=False)
            return
        data = prepared["data"]
        bangumi_info = data.get("bangumi")
        chosen = data.get("chosen")

    if bangumi_info is None:
        print_error("failed to fetch bangumi metadata", stop=False)
        return

    if data.get("fetchError"):
        print_warning(f"Fetch metadata warning: {data['fetchError']}")

    if chosen:
        print_info(
            f"Resolved bangumi: {bangumi_info.name} | keyword={bangumi_info.keyword} | "
            f"update={bangumi_info.update_time} | cover={bangumi_info.cover}"
        )

    try:
        selected_subtitles = _choose_subtitle_groups(
            subtitle_groups=list(bangumi_info.subtitle_group),
            subtitle_selection=subtitle_selection,
            yes=yes,
        )
    except ValueError as exc:
        print_error(str(exc), stop=False)
        return

    result = upsert_database_bangumi(
        bangumi_info=bangumi_info,
        subtitle_groups=selected_subtitles,
        download_cover_image=download_cover,
    )
    if result["status"] != "success":
        print_error(result["message"], stop=False)
        return

    payload = result["data"]
    subtitle_names = [item["name"] for item in payload.get("subtitleGroups", [])]
    print_success(result["message"])
    print(f"Name           : {payload.get('name')}")
    print(f"Keyword        : {payload.get('keyword')}")
    print(f"Source         : {payload.get('source')}")
    print(f"Status         : {payload.get('statusValue')}")
    print(f"Subtitle count : {payload.get('subtitleGroupCount')}")
    print(f"Subtitles      : {', '.join(subtitle_names) if subtitle_names else 'None'}")
    print(f"Cover          : {payload.get('cover')}")
    if payload.get("coverError"):
        print_warning(f"Cover cache warning: {payload['coverError']}")


@database_cli.command("delete", help="Delete a bangumi row and its related metadata from database")
@click.argument("name", required=False)
@click.option("--id", "bangumi_id", type=int, help="Delete by bangumi database id.")
@click.option("--yes", is_flag=True, default=False, help="Skip confirmation prompt.")
@click.option("--keep-downloads", is_flag=True, default=False, help="Do not delete related download rows.")
def database_delete_command(name: Optional[str], bangumi_id: Optional[int], yes: bool, keep_downloads: bool) -> None:
    if bangumi_id is None and not name:
        print_error("please provide a bangumi name or --id", stop=False)
        return

    if bangumi_id is not None:
        bangumi = Bangumi.select().where(Bangumi.id == bangumi_id).first()
        if bangumi is None:
            print_error(f"Bangumi id {bangumi_id} does not exist in database", stop=False)
            return
        target_label = f"#{bangumi.id} {bangumi.name}"
    else:
        try:
            bangumi = Bangumi.fuzzy_get(name=name or "")
        except Bangumi.DoesNotExist:
            print_error(f"Bangumi {name} does not exist in database", stop=False)
            return
        target_label = bangumi.name

    if not yes:
        confirmed = click.confirm(
            f"Delete bangumi '{target_label}' from database and related metadata?",
            default=False,
        )
        if not confirmed:
            print_warning("database delete canceled")
            return

    result = (
        delete_database_bangumi_by_id(bangumi_id=bangumi.id, delete_downloads=not keep_downloads)
        if bangumi_id is not None
        else delete_database_bangumi(name=bangumi.name, delete_downloads=not keep_downloads)
    )
    if result["status"] != "success":
        print_error(result["message"], stop=False)
        return

    payload = result["data"]
    print_success(result["message"])
    if payload.get("id") is not None:
        print(f"ID        : {payload.get('id')}")
    print(f"Name      : {payload.get('name')}")
    print(f"Keyword   : {payload.get('keyword')}")
    for key, value in payload.get("deleted", {}).items():
        print(f"{key:10}: {value}")


@cli.command("filter", help="set bangumi episode filters")
@click.argument("name", required=True)
@click.option("--subtitle", help='Subtitle group name, split by ",".')
@click.option(
    "--include",
    help='Filter by keywords which in the title, split by ",".',
)
@click.option("--exclude", help='Filter by keywords which not int the title, split by ",".')
@click.option("--regex", help="Filter by regular expression")
def filter_cmd(
    name: str,
    subtitle: Optional[str],
    regex: Optional[str],
    include: Optional[str],
    exclude: Optional[str],
) -> None:
    """
    name: bangumi name to update filter
    """
    result = ctl.filter_(
        name=name,
        subtitle=subtitle,
        include=include,
        exclude=exclude,
        regex=regex,
    )
    if "data" not in result:
        globals()["print_{}".format(result["status"])](result["message"])
    else:
        print_info("Usable subtitle group: {}".format(", ".join(result["data"]["subtitle_group"])))
        followed_filter_obj = Filter.get(bangumi_name=result["data"]["name"])
        print_filter(followed_filter_obj)


def print_filter(followed_filter_obj: Filter) -> None:
    print(
        "Followed subtitle group: {}".format(
            ", ".join(x["name"] for x in Subtitle.get_subtitle_by_id(followed_filter_obj.subtitle.split(", ")))
            if followed_filter_obj.subtitle
            else "None"
        )
    )
    print(f"Include keywords: {followed_filter_obj.include}")
    print(f"Exclude keywords: {followed_filter_obj.exclude}")
    print(f"Regular expression: {followed_filter_obj.regex}")


@cli.command("cal")
@click.option(
    "-f",
    "--force-update",
    "force_update",
    is_flag=True,
    show_default=True,
    default=False,
    type=bool,
    help="get latest bangumi calendar",
)
@click.option(
    "--today",
    "today",
    is_flag=True,
    show_default=True,
    default=False,
    type=bool,
    help="show bangumi calendar for today.",
)
@click.option(
    "--download-cover",
    "download_cover",
    is_flag=True,
    show_default=True,
    default=False,
    type=bool,
    help="download the cover to local",
)
def calendar(force_update: bool, today: bool, download_cover: bool) -> None:
    runner = ScriptRunner()
    cover: Optional[List[str]] = None

    if download_cover:
        cover = runner.get_download_cover()

    weekly_list = ctl.cal(force_update=force_update, cover=cover)

    def shift(seq: Tuple[str, ...], n: int) -> Tuple[str, ...]:
        n %= len(seq)
        return seq[n:] + seq[:n]

    order_without_unknown = BANGUMI_UPDATE_TIME[:-1]
    if today:
        weekday_order = (order_without_unknown[datetime.datetime.today().weekday()],)  # type: Tuple[str, ...]
    else:
        weekday_order = shift(order_without_unknown, datetime.datetime.today().weekday())

    col = max(wcwidth.wcswidth(bangumi["name"]) for value in weekly_list.values() for bangumi in value)
    env_columns = col if os.environ.get("TRAVIS_CI", False) else get_terminal_col()

    if env_columns < col:
        print_warning("terminal window is too small.")
        env_columns = col

    row = int(env_columns / col if env_columns / col <= 3 else 3)

    def print_line() -> None:
        num = col - 3
        split = "-" * num + "   "
        print(split * row)

    for weekday in weekday_order + ("Unknown",):
        if weekly_list[weekday.lower()]:
            print(
                "{}{}. {}".format(
                    GREEN,
                    weekday if not today else f"Bangumi Schedule for Today ({weekday})",
                    COLOR_END,
                ),
                end="",
            )
            print()
            print_line()
            for i, bangumi in enumerate(weekly_list[weekday.lower()]):
                if bangumi["status"] in (STATUS_UPDATED, STATUS_FOLLOWED) and "episode" in bangumi:
                    bangumi["name"] = "{}({:d})".format(bangumi["name"], bangumi["episode"])

                width = wcwidth.wcswidth(bangumi["name"])
                space_count = col - 2 - width

                for s in SPACIAL_APPEND_CHARS:
                    if s in bangumi["name"]:
                        space_count += bangumi["name"].count(s)

                for s in SPACIAL_REMOVE_CHARS:
                    if s in bangumi["name"]:
                        space_count -= bangumi["name"].count(s)

                if bangumi["status"] == STATUS_FOLLOWED:
                    bangumi["name"] = "{}{}{}".format(YELLOW, bangumi["name"], COLOR_END)

                if bangumi["status"] == STATUS_UPDATED:
                    bangumi["name"] = "{}{}{}".format(GREEN, bangumi["name"], COLOR_END)
                try:
                    print(" " + bangumi["name"], " " * space_count, end="")
                except UnicodeEncodeError:
                    continue

                if (i + 1) % row == 0 or i + 1 == len(weekly_list[weekday.lower()]):
                    print()
            print()


@cli.command("fetch")
@click.argument("name")
@click.option(
    "--not-ignore", "not_ignore", is_flag=True, help="Do not ignore the old bangumi detail rows (3 month ago)"
)
def fetch(name: str, not_ignore: bool) -> None:
    """
    name: bangumi name to fetch
    """

    try:
        bangumi_obj = Bangumi.get(name=name)
    except Bangumi.DoesNotExist:
        print_error(f"Bangumi {name} not exist", stop=True)
        return

    try:
        Followed.get(bangumi_name=bangumi_obj.name)
    except Followed.DoesNotExist:
        print_error(f"Bangumi {name} is not followed")
        return

    followed_filter_obj = Filter.get(bangumi_name=name)
    print_filter(followed_filter_obj)

    print_info(f"Fetch bangumi {bangumi_obj.name} ...")
    _, data = website.get_maximum_episode(bangumi_obj, ignore_old_row=not bool(not_ignore))

    if not data:
        print_warning("Nothing.")

    max_episode = max(i.episode for i in data)
    digest = len(str(max_episode))

    for i in data:
        episode = str(i.episode).rjust(digest)
        print(f"{episode} | {i.title}")


@cli.command("update", help="Update bangumi calendar and subscribed bangumi episode.")
@click.argument(
    "names",
    nargs=-1,
)
@click.option(
    "-d", "--download", is_flag=True, default=False, help="Download specified episode of the bangumi when updated"
)
@click.option(
    "--not-ignore", "not_ignore", is_flag=True, help="Do not ignore the old bangumi detail rows (3 month ago)"
)
def update(names: List[str], download: bool, not_ignore: bool) -> None:
    """
    name: optional bangumi name list you want to update
    """
    ctl.update(names, download=download, not_ignore=not_ignore)


@cli.command("gen")
@click.argument("tpl", type=click.Choice(["nginx.conf"]))
@click.option("--server-name", "server_name")
def generate_config(tpl: str, server_name: str) -> None:
    template_file_path = os.path.join(os.path.dirname(__file__), "others", "nginx.conf")

    with open(template_file_path, encoding="utf8") as template_file:
        shell_template = template.Template(template_file.read(), autoescape="")

    template_with_content = shell_template.generate(
        server_name=server_name,
        os_sep=os.sep,
        front_static_path=str(cfg.front_static_path.as_posix()),
        save_path=str(cfg.save_path.as_posix()),
    )

    print(template_with_content.decode("utf-8"))


@cli.command("history", help="list your history of following bangumi")
def history() -> None:
    m = (
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    )
    data = Followed.select(Followed).order_by(Followed.updated_time.asc())
    bangumi_data = Bangumi.get_updating_bangumi()
    year = None
    month = None

    updating_bangumi = list(map(itemgetter("name"), itertools.chain(*bangumi_data.values())))

    print("Bangumi Timeline")
    for i in data:
        if i.status == STATUS_DELETED:
            slogan = "ABANDON"
            color = RED
        else:
            if i.bangumi_name in updating_bangumi:
                slogan = "FOLLOWING"
                color = YELLOW
            else:
                slogan = "FINISHED"
                color = GREEN

        if not i.updated_time:
            date = datetime.datetime.fromtimestamp(0)
        else:
            date = datetime.datetime.fromtimestamp(int(i.updated_time))

        if date.year != 1970:
            if date.year != year:
                print(f"{GREEN}{str(date.year)}{COLOR_END}")
                year = date.year

            if date.year == year and date.month != month:
                print(f"  |\n  |--- {YELLOW}{m[date.month - 1]}{COLOR_END}\n  |      |")
                month = date.month

            print(f"  |      |--- [{color}{slogan:<9}{COLOR_END}] ({i.episode:<2}) {i.bangumi_name}")


@cli.group("debug")
def debug() -> None: ...


@debug.command("info")
def debug_info() -> None:
    print(f"bgmi version: `{__version__}`")
    print(f"python version: `{sys.version}`")
    print(f"os: `{platform.platform()}`")
    print(f"arch: `{platform.architecture()}`")


@cli.command("completion")
@click.argument("shell", required=True)
def completion(shell: str) -> None:
    completer = Completer(cli)
    print(completer.render(shell))
