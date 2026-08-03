# FastAPI backtest service — deploys to Railway (build context = repo root).
#   railway: root directory ".", dockerfile "service/Dockerfile"
#   volume: mount at /data (OHLCV cache + run store live there)
FROM python:3.12-slim

WORKDIR /app

# Layer-cached dependency install
COPY engine/requirements.txt /app/engine/requirements.txt
COPY service/requirements.txt /app/service/requirements.txt
RUN pip install --no-cache-dir -r /app/engine/requirements.txt -r /app/service/requirements.txt

COPY engine /app/engine
COPY service /app/service
COPY templates /app/templates

ENV PYTHONPATH=/app:/app/engine \
    PYTHONUNBUFFERED=1 \
    BACKTEST_CACHE_DB=/data/backtest_data.db \
    SERVICE_DATA_DIR=/data \
    TEMPLATES_DIR=/app/templates

EXPOSE 8000

# Railway injects PORT and routes/healthchecks against it — always honor it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT','8000'), timeout=4)"

CMD ["sh", "-c", "python -m uvicorn service.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
