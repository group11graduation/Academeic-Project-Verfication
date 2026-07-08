# =============================================================================
# FastAPI AI service — proposal / code / screenshot similarity
# Build: docker build -t scholarverify-ai ./backend-python
# =============================================================================

FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# -----------------------------------------------------------------------------
# Build wheels (torch, tree-sitter, faiss may need compilers at install time)
# -----------------------------------------------------------------------------
FROM base AS deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# Slim runtime (keep libgomp for numpy/torch/faiss)
# -----------------------------------------------------------------------------
FROM base AS release
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Persistent model + SQLite caches (mount a volume at /app/data in compose)
ENV DATA_DIR=/app/data
ENV MODELS_CACHE_DIR=/app/data/models-cache
ENV HOST=0.0.0.0
ENV PORT=8000

RUN mkdir -p /app/data/models-cache

COPY app ./app
COPY main.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
