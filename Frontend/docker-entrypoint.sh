#!/bin/sh
set -eu

# Prefer an explicit public API URL when set (Coolify often uses http://HOST:5000).
# If unset, use same-origin "" so Vite preview can proxy /api → INTERNAL_API_URL
# (requires vite.config.js in the image — see Dockerfile).
if [ -n "${FORCE_PUBLIC_API_URL:-}" ]; then
  API_URL="${FORCE_PUBLIC_API_URL}"
elif [ -n "${PUBLIC_API_URL:-}" ]; then
  API_URL="${PUBLIC_API_URL}"
else
  API_URL=""
fi

cat > /app/dist/env-config.js <<EOF
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
window.__APP_CONFIG__.API_URL = "${API_URL}";
EOF

echo "[frontend] API_URL='${API_URL}' INTERNAL_API_URL='${INTERNAL_API_URL:-http://node-backend:5000}'"

exec npm run preview -- --host 0.0.0.0 --port 4173
