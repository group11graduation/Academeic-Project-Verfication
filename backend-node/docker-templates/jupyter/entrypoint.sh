#!/bin/sh
set -e

cd /workspace
PORT="${JUPYTER_PORT:-8888}"

echo "[preview] Jupyter notebook on 0.0.0.0:${PORT}"

exec jupyter notebook \
  --ip=0.0.0.0 \
  --port="$PORT" \
  --no-browser \
  --allow-root \
  --ServerApp.token='' \
  --ServerApp.password='' \
  --NotebookApp.token='' \
  --NotebookApp.password=''
