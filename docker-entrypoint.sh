#!/bin/sh
set -eu

mkdir -p "${BGMI_PATH}" "${BGMI_SAVE_PATH}" "${BGMI_TMP_PATH}"

if ls /dev/nvidia* >/dev/null 2>&1 || [ -e /dev/dxg ]; then
    echo "[bgmi] GPU device nodes detected in container."
else
    echo "[bgmi] GPU device nodes not found; ffmpeg will fall back to CPU if GPU runtime is unavailable."
fi

if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q 'h264_nvenc'; then
    echo "[bgmi] ffmpeg NVENC encoder is available."
else
    echo "[bgmi] ffmpeg NVENC encoder is not available."
fi

NVENC_ERR=$(ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=640x480:rate=1 -frames:v 1 -c:v h264_nvenc -f null - 2>&1) || true
if [ -z "$NVENC_ERR" ]; then
    echo "[bgmi] ffmpeg NVENC runtime test passed."
else
    echo "[bgmi] ffmpeg NVENC runtime test failed; GPU may still be unavailable to the container."
    echo "[bgmi] NVENC error: $NVENC_ERR"
fi

if [ ! -f "${BGMI_PATH}/config.toml" ]; then
    python - <<'PY'
from bgmi.setup import create_dir
from bgmi.config import write_default_config

create_dir()
write_default_config()
PY
fi

python - <<'PY'
import os
from pathlib import Path
from tomlkit import parse, dumps

bgmi_path = Path(os.environ.get("BGMI_PATH", "/data/.bgmi"))
config_path = bgmi_path / "config.toml"
doc = parse(config_path.read_text(encoding="utf-8"))

http = doc.setdefault("http", {})
http["serve_static_files"] = True

admin_token = os.environ.get("BGMI_ADMIN_TOKEN")
if admin_token:
    http["admin_token"] = admin_token

save_path = os.environ.get("BGMI_SAVE_PATH")
if save_path:
    doc["save_path"] = save_path

tmp_path = os.environ.get("BGMI_TMP_PATH")
if tmp_path:
    doc["tmp_path"] = tmp_path

config_path.write_text(dumps(doc), encoding="utf-8")
PY

python - <<'PY'
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from bgmi.config import cfg
from bgmi.lib.update import _ensure_custom_columns, update_database
from bgmi.setup import create_dir, init_db

create_dir()
db_path = Path(cfg.db_path)
if db_path.exists():
    with sqlite3.connect(db_path) as source:
        bangumi_columns = {row[1] for row in source.execute("PRAGMA table_info(bangumi)")}
        followed_columns = {row[1] for row in source.execute("PRAGMA table_info(followed)")}
        is_v4 = bool({"keyword", "update_time"} & bangumi_columns) or (
            "episode" in followed_columns and "episodes" not in followed_columns
        )
        if is_v4:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup_path = db_path.with_name(f"{db_path.stem}.v4-backup-{stamp}{db_path.suffix}")
            with sqlite3.connect(backup_path) as backup:
                source.backup(backup)
            print(f"[bgmi] Saved v4 database backup: {backup_path}")

init_db()
_ensure_custom_columns(db_path)
if os.environ.get("BGMI_SIMULATOR") != "1":
    update_database()
else:
    print("[bgmi] Simulator mode enabled; skipping remote data update.")
PY

rm -rf "${BGMI_PATH}/front_static"
mkdir -p "${BGMI_PATH}/front_static/assets" "${BGMI_PATH}/front_static/package"
cp -R /opt/bgmi-frontend-dist/. "${BGMI_PATH}/front_static/"
cp /opt/bgmi-frontend-package.json "${BGMI_PATH}/front_static/package.json"
cp /opt/bgmi-frontend-package.json "${BGMI_PATH}/front_static/package/package.json"

BGMI_UPDATE_INTERVAL="${BGMI_UPDATE_INTERVAL:-1800}"
BGMI_CAL_INTERVAL="${BGMI_CAL_INTERVAL:-14400}"

if [ "${1:-}" = "bgmi_http" ]; then
    shift
    # Update subscribed bangumi every BGMI_UPDATE_INTERVAL (default 30 min)
    (
        while true; do
            sleep "${BGMI_UPDATE_INTERVAL}"
            echo "[bgmi] Running scheduled update ..."
            bgmi update 2>&1 || echo "[bgmi] Update failed, will retry next cycle."
        done
    ) &
    # Refresh calendar & download covers every BGMI_CAL_INTERVAL (default 4 hours)
    (
        while true; do
            sleep "${BGMI_CAL_INTERVAL}"
            echo "[bgmi] Running scheduled cal --force-update --cover ..."
            bgmi cal --force-update --cover 2>&1 || echo "[bgmi] Cal failed, will retry next cycle."
        done
    ) &
    exec bgmi_http --port="${BGMI_HTTP_PORT}" --address="${BGMI_HTTP_ADDRESS}" "$@"
fi

exec "$@"
