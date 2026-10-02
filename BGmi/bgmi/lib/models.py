import os
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar

import peewee
from peewee import BooleanField, FixedCharField, IntegerField, TextField
from playhouse.shortcuts import model_to_dict

from bgmi.config import cfg
from bgmi.lib.constants import BANGUMI_UPDATE_TIME
from bgmi.utils import episode_filter_regex
from bgmi.website.model import Episode

# bangumi status
STATUS_UPDATING = 0
STATUS_END = 1
BANGUMI_STATUS = (STATUS_UPDATING, STATUS_END)

# subscription status
STATUS_DELETED = 0
STATUS_FOLLOWED = 1
STATUS_UPDATED = 2
FOLLOWED_STATUS = (STATUS_DELETED, STATUS_FOLLOWED, STATUS_UPDATED)

# download status
STATUS_NOT_DOWNLOAD = 0
STATUS_DOWNLOADING = 1
STATUS_DOWNLOADED = 2
DOWNLOAD_STATUS = (STATUS_NOT_DOWNLOAD, STATUS_DOWNLOADING, STATUS_DOWNLOADED)

ISSUE_MISSING_EPISODES = "missing_episodes"
ISSUE_MISSING_PLAYABLE_SOURCE = "missing_playable_source"
ISSUE_EMPTY_LOCAL_FOLDER = "empty_local_folder"
ISSUE_MISSING_FOLDER = "missing_folder"
ISSUE_PERMISSION_DENIED = "permission_denied"

DoesNotExist = peewee.DoesNotExist

db = peewee.SqliteDatabase(cfg.db_path)

if os.environ.get("DEV"):
    print(f"using database {cfg.db_path}")

_Cls = TypeVar("_Cls")


class NeoDB(peewee.Model):
    DoesNotExist: Type[peewee.DoesNotExist]

    class Meta:
        database = db

    @classmethod
    def get(cls: Type[_Cls], *query: Any, **filters: Any) -> _Cls:
        return super().get(*query, **filters)  # type: ignore

    @classmethod
    def get_or_create(cls: Type[_Cls], **kwargs: Any) -> Tuple[_Cls, bool]:
        return super().get_or_create(**kwargs)  # type: ignore


class Bangumi(NeoDB):
    id = IntegerField(primary_key=True)
    name = TextField(unique=True, null=False)
    subtitle_group = TextField(null=False)
    keyword = TextField()
    update_time = FixedCharField(5, null=False)
    cover = TextField()
    status = IntegerField(default=0)
    source = TextField(default="remote")
    in_library = BooleanField(default=False)
    library_path = TextField(default="")

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

        update_time = kwargs.get("update_time", "").title()
        if update_time and update_time not in BANGUMI_UPDATE_TIME:
            raise ValueError(f"unexpected update time {update_time}")
        self.update_time = update_time
        if isinstance(kwargs.get("subtitle_group"), list):
            s = []
            for sub in kwargs["subtitle_group"]:
                if isinstance(sub, str):
                    s.append(sub)
                elif isinstance(sub, dict):
                    s.append(sub["id"])
                else:
                    s.append(sub.id)
            self.subtitle_group = ", ".join(sorted(s))

    @classmethod
    def delete_all(cls) -> None:
        un_updated_bangumi: List[Followed] = Followed.select().where(
            Followed.updated_time > (int(time.time()) - 2 * 7 * 24 * 3600)
        )
        if os.getenv("DEBUG"):  # pragma: no cover
            print("ignore updating bangumi", [x.bangumi_name for x in un_updated_bangumi])

        cls.update(status=STATUS_END).where(
            cls.name.not_in([x.bangumi_name for x in un_updated_bangumi])
        ).execute()  # do not mark updating bangumi as STATUS_END

    @classmethod
    def get_updating_bangumi(cls, status: Optional[int] = None, order: bool = True) -> Any:
        if status is None:
            data = (
                cls.select(Followed.status, Followed.episode, cls)
                .join(
                    Followed,
                    peewee.JOIN["LEFT_OUTER"],
                    on=(cls.name == Followed.bangumi_name),
                )
                .where(cls.status == STATUS_UPDATING)
                .dicts()
            )
        else:
            data = (
                cls.select(Followed.status, Followed.episode, cls)
                .join(
                    Followed,
                    peewee.JOIN["LEFT_OUTER"],
                    on=(cls.name == Followed.bangumi_name),
                )
                .where((cls.status == STATUS_UPDATING) & (Followed.status == status))
                .dicts()
            )

        if order:
            weekly_list = defaultdict(list)
            for bangumi_item in data:
                weekly_list[bangumi_item["update_time"].lower()].append(dict(bangumi_item))
        else:
            weekly_list = list(data)  # type: ignore

        return weekly_list

    @classmethod
    def fuzzy_get(cls, **filters: Any) -> "Bangumi":
        fuzzy_q = []
        raw_q = []
        for key, value in filters.items():
            raw_q.append(getattr(cls, key) == value)
            fuzzy_q.append(getattr(cls, key).contains(value))

        raw = list(cls.select().where(*raw_q))  # type: List[Bangumi]
        if raw:
            return raw[0]

        fuzzy = list(cls.select().where(*fuzzy_q))  # type: List[Bangumi]
        if fuzzy:
            return fuzzy[0]

        raise cls.DoesNotExist


class Followed(NeoDB):
    bangumi_name = TextField(unique=True)
    episode = IntegerField(null=True, default=0)
    status = IntegerField(null=True)
    updated_time = IntegerField(null=True)

    class Meta:
        database = db
        table_name = "followed"

    @classmethod
    def delete_followed(cls, batch: bool = True) -> bool:
        q = cls.delete()
        if not batch:
            if not input("[+] are you sure want to CLEAR ALL THE BANGUMI? (y/N): ") == "y":
                return False

        q.execute(None)
        return True

    @classmethod
    def get_all_followed(cls, status: int = STATUS_DELETED, bangumi_status: int = STATUS_UPDATING) -> List[dict]:
        join_cond = Bangumi.name == cls.bangumi_name
        d = (
            cls.select(Bangumi.name, Bangumi.update_time, Bangumi.cover, cls)
            .join(Bangumi, peewee.JOIN["LEFT_OUTER"], on=join_cond)
            .where((cls.status != status) & (Bangumi.status == bangumi_status))
            .order_by(cls.updated_time.desc())
            .dicts()
        )

        return list(d)


class Download(NeoDB):
    name = TextField(null=False)
    title = TextField(null=False)
    episode = IntegerField(default=0)
    download = TextField()
    status = IntegerField(default=0)
    created_time = IntegerField(default=0)

    @classmethod
    def get_all_downloads(cls, status: Optional[int] = None) -> List[dict]:
        if status is None:
            data = list(cls.select().order_by(cls.status))
        else:
            data = list(cls.select().where(cls.status == status).order_by(cls.status))

        for index, x in enumerate(data):
            data[index] = model_to_dict(x)
        return data

    def downloaded(self) -> None:
        self.status = STATUS_DOWNLOADED
        self.save()


class Filter(NeoDB):
    bangumi_name = TextField(unique=True)  # type: Optional[str]
    subtitle = TextField(null=True)  # type: Optional[str]
    include = TextField(null=True)  # type: Optional[str]
    exclude = TextField(null=True)  # type: Optional[str]
    regex = TextField(null=True)  # type: Optional[str]

    @property
    def subtitle_group_split(self) -> List[str]:
        if self.subtitle:
            # pylint:disable=no-member
            return [x.strip() for x in self.subtitle.split(",")]
        else:
            return []

    def apply_on_episodes(self, result: List[Episode]) -> List[Episode]:
        if self.include:
            # pylint:disable=no-member
            include_list = [s.strip().lower() for s in self.include.split(",")]
            result = [e for e in result if e.contains_any_words(include_list)]

        if cfg.enable_global_include_keywords:
            include_list = [s.strip().lower() for s in cfg.global_include_keywords]
            result = [e for e in result if e.contains_any_words(include_list)]

        if self.exclude:
            # pylint:disable=no-member
            exclude_list = [s.strip().lower() for s in self.exclude.split(",")]
            result = [e for e in result if not e.contains_any_words(exclude_list)]

        return episode_filter_regex(data=result, regex=self.regex)


class Subtitle(NeoDB):
    id = TextField(primary_key=True, unique=True)
    name = TextField()

    @classmethod
    def get_subtitle_by_id(cls, id_list: List[str]) -> List[Dict[str, str]]:
        data = list(cls.select().where(cls.id.in_(id_list)))
        for index, subtitle in enumerate(data):
            data[index] = model_to_dict(subtitle)
        return data

    @classmethod
    def get_subtitle_by_name(cls, name_list: List[str]) -> List[Dict[str, str]]:
        data = list(cls.select().where(cls.name.in_(name_list)))
        for index, subtitle in enumerate(data):
            data[index] = model_to_dict(subtitle)
        return data


class Scripts(NeoDB):
    bangumi_name = TextField(null=False, unique=True)
    episode = IntegerField(default=0)
    status = IntegerField(default=0)
    updated_time = IntegerField(default=0)


class BangumiIssue(NeoDB):
    bangumi_name = TextField(null=False, index=True)
    issue_type = TextField(null=False, index=True)
    episode = TextField(null=True)
    file_path = TextField(null=True)
    note = TextField(null=True)
    marked_at = IntegerField(default=0)
    metadata = TextField(null=True)

    class Meta:
        database = db
        table_name = "bangumi_issue"
        indexes = ((("bangumi_name", "issue_type"), True),)

    @classmethod
    def set_issue(
        cls,
        bangumi_name: str,
        issue_type: str,
        episode: Optional[str] = None,
        file_path: Optional[str] = None,
        note: Optional[str] = None,
        marked_at: Optional[int] = None,
        metadata: Optional[str] = None,
    ) -> "BangumiIssue":
        defaults = {
            "episode": episode,
            "file_path": file_path,
            "note": note,
            "marked_at": marked_at or int(time.time()),
            "metadata": metadata,
        }
        issue, created = cls.get_or_create(
            bangumi_name=bangumi_name,
            issue_type=issue_type,
            defaults=defaults,
        )
        if not created:
            issue.episode = episode
            issue.file_path = file_path
            issue.note = note
            issue.marked_at = marked_at or int(time.time())
            issue.metadata = metadata
            issue.save()
        return issue

    @classmethod
    def clear_issue(cls, bangumi_name: str, issue_type: str) -> int:
        return cls.delete().where((cls.bangumi_name == bangumi_name) & (cls.issue_type == issue_type)).execute()


def ensure_tables_exist(tables: Optional[List[Type[NeoDB]]] = None) -> None:
    target_tables = tables or [Bangumi, Followed, Subtitle, Filter, Download, Scripts, BangumiIssue]
    db.create_tables(target_tables, safe=True)


def _table_columns(table_name: str) -> set[str]:
    cursor = db.execute_sql(f"PRAGMA table_info({table_name});")
    rows = cursor.fetchall()
    return {str(row[1]) for row in rows}


def ensure_schema_columns() -> None:
    bangumi_columns = _table_columns("bangumi")
    if "source" not in bangumi_columns:
        db.execute_sql("ALTER TABLE bangumi ADD COLUMN source TEXT DEFAULT 'remote';")
    if "in_library" not in bangumi_columns:
        db.execute_sql("ALTER TABLE bangumi ADD COLUMN in_library INTEGER DEFAULT 0;")
    if "library_path" not in bangumi_columns:
        db.execute_sql("ALTER TABLE bangumi ADD COLUMN library_path TEXT DEFAULT '';")

    issue_columns = _table_columns("bangumi_issue") if "bangumi_issue" in db.get_tables() else set()
    if issue_columns and "metadata" not in issue_columns:
        db.execute_sql("ALTER TABLE bangumi_issue ADD COLUMN metadata TEXT;")


def ensure_runtime_schema() -> None:
    ensure_tables_exist()
    ensure_schema_columns()


def recreate_source_relatively_table() -> None:
    table_to_drop = [
        Bangumi,
        Followed,
        Subtitle,
        Filter,
        Download,
    ]  # type: List[Type[NeoDB]]
    ensure_tables_exist(table_to_drop)
    for table in table_to_drop:
        table.delete().execute()  # pylint: disable=no-value-for-parameter


def recreate_scripts_table() -> None:
    table_to_drop = [
        Scripts,
    ]  # type: List[Type[NeoDB]]
    ensure_tables_exist(table_to_drop)
    for table in table_to_drop:
        table.delete().execute()  # pylint: disable=no-value-for-parameter
