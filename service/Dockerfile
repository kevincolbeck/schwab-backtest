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

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4)"

CMD ["python", "-m", "uvicorn", "service.main:app", "--host", "0.0.0.0", "--port", "8000"]
