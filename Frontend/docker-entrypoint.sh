#!/bin/sh
set -eu

API_URL="${PUBLIC_API_URL:-}"
cat > /app/dist/env-config.js <<EOF
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
window.__APP_CONFIG__.API_URL = "${API_URL}";
EOF

exec npm run preview -- --host 0.0.0.0 --port 4173
