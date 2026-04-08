#!/bin/sh
set -eu

mkdir -p "${BGMI_PATH}"

if [ ! -f "${BGMI_PATH}/config.toml" ]; then
    bgmi install >/tmp/bgmi-install.log 2>&1 || {
        cat /tmp/bgmi-install.log
        exit 1
    }
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

exec "$@"
