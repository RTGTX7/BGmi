FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BGMI_PATH=/data/.bgmi

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

RUN python -m pip install --upgrade pip \
    && python -m pip install .

COPY docker-entrypoint.sh /usr/local/bin/bgmi-entrypoint.sh
RUN chmod +x /usr/local/bin/bgmi-entrypoint.sh

EXPOSE 8899

ENTRYPOINT ["/usr/local/bin/bgmi-entrypoint.sh"]
CMD ["bgmi_http", "--port=8899", "--address=0.0.0.0"]
