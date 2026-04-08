FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /build/frontend

RUN corepack enable

COPY BGmi-frontend/package.json BGmi-frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY BGmi-frontend/ ./
RUN pnpm build


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BGMI_PATH=/data/.bgmi \
    BGMI_SAVE_PATH=/data/bangumi \
    BGMI_TMP_PATH=/data/tmp \
    BGMI_HTTP_PORT=8899 \
    BGMI_HTTP_ADDRESS=0.0.0.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY BGmi /app/BGmi
WORKDIR /app/BGmi

RUN python -m pip install --upgrade pip \
    && python -m pip install .

COPY --from=frontend-builder /build/frontend/dist /opt/bgmi-frontend-dist
COPY --from=frontend-builder /build/frontend/package.json /opt/bgmi-frontend-package.json
COPY docker-entrypoint.sh /usr/local/bin/bgmi-entrypoint.sh

RUN chmod +x /usr/local/bin/bgmi-entrypoint.sh

EXPOSE 8899

ENTRYPOINT ["/usr/local/bin/bgmi-entrypoint.sh"]
CMD ["bgmi_http"]
