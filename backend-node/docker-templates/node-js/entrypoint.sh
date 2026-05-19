#!/bin/sh
PORT="${PORT:-3000}"
ROOT="/app"

if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ]; then
  cd "$ROOT/$APP_SUBDIR" || exit 1
else
  cd "$ROOT" || exit 1
fi

echo "[preview] Node app directory: $(pwd)"
echo "[preview] PORT=${PORT}"

export PORT
export HOST=0.0.0.0
export WDS_SOCKET_HOST=0.0.0.0
export DANGEROUSLY_DISABLE_HOST_CHECK=true

# Pre-built static assets (fast path for React build output)
if [ -d dist ] && [ -f dist/index.html ]; then
  echo "[preview] Serving existing dist/"
  exec npx --yes serve -s dist -l "$PORT"
fi
if [ -d build ] && [ -f build/index.html ]; then
  echo "[preview] Serving existing build/"
  exec npx --yes serve -s build -l "$PORT"
fi

if [ ! -f package.json ]; then
  echo "[preview] No package.json; serving directory"
  exec npx --yes serve -s . -l "$PORT"
fi

if [ ! -d node_modules ]; then
  echo "[preview] npm install"
  npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
fi

# Vite (default port 5173 — must bind 0.0.0.0 and our mapped PORT)
if [ -f vite.config.js ] || [ -f vite.config.ts ] || grep -q '"vite"' package.json 2>/dev/null; then
  echo "[preview] Starting Vite on 0.0.0.0:${PORT}"
  exec npx vite --host 0.0.0.0 --port "$PORT"
fi

# Create React App / react-scripts
if grep -q 'react-scripts' package.json 2>/dev/null; then
  echo "[preview] Starting react-scripts (HOST=0.0.0.0 PORT=${PORT})"
  exec npm run start
fi

# npm scripts (pass host/port for dev servers)
echo "[preview] Trying npm scripts on port ${PORT}"
if npm run dev -- --host 0.0.0.0 --port "$PORT" 2>/dev/null; then exit 0; fi
if npm run preview -- --host 0.0.0.0 --port "$PORT" 2>/dev/null; then exit 0; fi
if npm run start -- --host 0.0.0.0 --port "$PORT" 2>/dev/null; then exit 0; fi

# Production build then serve (works for many React assignments)
if npm run build 2>/dev/null; then
  if [ -d dist ]; then exec npx --yes serve -s dist -l "$PORT"; fi
  if [ -d build ]; then exec npx --yes serve -s build -l "$PORT"; fi
fi

echo "[preview] Fallback static server"
exec npx --yes serve -s . -l "$PORT"
