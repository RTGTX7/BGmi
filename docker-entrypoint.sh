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
            echo "[bgmi] Running scheduled update --download ..."
            bgmi update --download 2>&1 || echo "[bgmi] Update failed, will retry next cycle."
        done
    ) &
    # Refresh calendar & download covers every BGMI_CAL_INTERVAL (default 4 hours)
    (
        while true; do
            sleep "${BGMI_CAL_INTERVAL}"
            echo "[bgmi] Running scheduled cal --force-update --download-cover ..."
            bgmi cal --force-update --download-cover 2>&1 || echo "[bgmi] Cal failed, will retry next cycle."
        done
    ) &
    exec bgmi_http --port="${BGMI_HTTP_PORT}" --address="${BGMI_HTTP_ADDRESS}" "$@"
fi

exec "$@"
