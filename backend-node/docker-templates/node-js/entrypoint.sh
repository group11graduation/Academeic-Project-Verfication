#!/bin/sh
set +e
PORT="${PORT:-3000}"
ROOT="/app"

export PORT
export HOST=0.0.0.0
export BIND_HOST=0.0.0.0
export BIND_ADDRESS=0.0.0.0
export WDS_SOCKET_HOST=0.0.0.0
export DANGEROUSLY_DISABLE_HOST_CHECK=true
export BROWSER=none
# CI=false so create-react-app warnings don't crash the build.
export CI=false
export DISABLE_ESLINT_PLUGIN=true
export GENERATE_SOURCEMAP=false

LISTEN="tcp://0.0.0.0:${PORT}"
HOLDER_PID=""
API_PORT="${API_PORT:-5000}"

# Browser-facing API base. With the same-origin gateway, the UI port proxies /api → :5000,
# so the SPA must NOT call the separate host API port (that caused "Please wait…" hangs).
preview_api_bundle_url() {
  if [ "$PREVIEW_MERN_MODE" = "1" ] || [ "$PREVIEW_FLUTTER_MODE" = "1" ]; then
    if [ -n "$PREVIEW_PUBLIC_UI_URL" ]; then
      printf '%s' "$PREVIEW_PUBLIC_UI_URL" | sed 's|/$||'
      return
    fi
  fi
  if [ -n "$PREVIEW_PUBLIC_API_URL" ]; then
    printf '%s' "$PREVIEW_PUBLIC_API_URL"
  elif [ -n "$PREVIEW_API_HOST_PORT" ]; then
    host="$(printf '%s' "${PREVIEW_PUBLIC_HOST:-127.0.0.1}" | sed -e 's|^https\?://||' -e 's|/.*$||' -e 's|:.*$||')"
    [ -n "$host" ] || host="127.0.0.1"
    printf 'http://%s:%s' "$host" "$PREVIEW_API_HOST_PORT"
  fi
}

start_serve_background() {
  dir="$1"
  listen="$2"
  if command -v serve >/dev/null 2>&1; then
    serve -s "$dir" --listen "$listen" >/tmp/preview-holder.log 2>&1 &
  else
    npx --yes serve@14.2.4 -s "$dir" --listen "$listen" >/tmp/preview-holder.log 2>&1 &
  fi
  HOLDER_PID=$!
}

run_serve() {
  dir="$1"
  listen="$2"
  cd "$dir" || exit 1
  # MERN / Flutter: same-origin gateway so browser never talks to localhost:5000.
  if [ -f /preview-gateway.cjs ] && [ -n "$API_PORT" ] && {
    [ "$PREVIEW_MERN_MODE" = "1" ] || [ "$PREVIEW_FLUTTER_MODE" = "1" ]
  }; then
    echo "[preview] starting same-origin gateway (UI :${PORT} → API :${API_PORT})"
    exec node /preview-gateway.cjs "$(pwd)"
  fi
  if command -v serve >/dev/null 2>&1; then
    exec serve -s . --listen "$listen"
  else
    exec npx --yes serve@14.2.4 -s . --listen "$listen"
  fi
}

hold_port_with_fallback() {
  echo "[preview] holding :${PORT} with placeholder page (install may take several minutes)"
  start_serve_background /preview-fallback "${LISTEN}"
  sleep 2
}

release_port_holder() {
  if [ -n "$HOLDER_PID" ]; then
    kill "$HOLDER_PID" 2>/dev/null || true
    wait "$HOLDER_PID" 2>/dev/null || true
    HOLDER_PID=""
    sleep 1
  fi
}

tcp_port_open() {
  node -e "
    const net=require('net');
    const port=+process.argv[1];
    const s=net.connect({port,host:'127.0.0.1'},()=>{s.end();process.exit(0)});
    s.on('error',()=>process.exit(1));
    setTimeout(()=>process.exit(1),2000);
  " "$1" 2>/dev/null
}

wait_for_tcp_port() {
  port="$1"
  label="$2"
  max="${3:-180}"
  n=0
  while [ "$n" -lt "$max" ]; do
    if tcp_port_open "$port"; then
      echo "[preview] ${label} listening on :${port}"
      return 0
    fi
    n=$((n + 1))
    if [ $((n % 15)) -eq 0 ]; then
      echo "[preview] still waiting for ${label} on :${port} (${n}/${max})…"
      tail -5 /tmp/preview-backend.log 2>/dev/null || true
    fi
    sleep 2
  done
  echo "[preview] ERROR: ${label} did not open port :${port}"
  tail -60 /tmp/preview-backend.log 2>/dev/null || true
  return 1
}

inject_login_fallback_into_index() {
  dir="$1"
  helper="/preview-login-fallback.js"
  [ -f "$helper" ] || return 0
  cp -f "$helper" "$dir/preview-login-fallback.js" 2>/dev/null || true

  API_BASE="$(preview_api_bundle_url)"
  LOGIN_PATH="${PREVIEW_LOGIN_API_PATH:-/api/users/login}"

  if [ -n "$API_BASE" ]; then
    # Minimal JSON (no node dependency) so the browser always knows the public API origin.
    esc_api=$(printf '%s' "$API_BASE" | sed 's/\\/\\\\/g; s/"/\\"/g')
    esc_path=$(printf '%s' "$LOGIN_PATH" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '{"apiBase":"%s","loginPath":"%s"}\n' "$esc_api" "$esc_path" > "$dir/preview-credentials.json" 2>/dev/null || true
    echo "[preview] wrote preview-credentials.json apiBase=${API_BASE}"
  fi

  find "$dir" -maxdepth 2 -type f -name 'index.html' 2>/dev/null | while read -r html; do
    # Drop previous ScholarVerify boot tags so a new API port always wins.
    sed -i '/name="sv-api-base"/d' "$html" 2>/dev/null || true
    sed -i '/__SV_API_BOOT__/d' "$html" 2>/dev/null || true

    tmp="${html}.svlogin"
    {
      if [ -n "$API_BASE" ]; then
        esc_api=$(printf '%s' "$API_BASE" | sed 's/\\/\\\\/g; s/"/\\"/g')
        esc_path=$(printf '%s' "$LOGIN_PATH" | sed 's/\\/\\\\/g; s/"/\\"/g')
        echo "<meta name=\"sv-api-base\" content=\"${esc_api}\" />"
        echo "<script>/*__SV_API_BOOT__*/window.__SV_API_BASE__=\"${esc_api}\";window.__SV_LOGIN_API_PATH__=\"${esc_path}\";</script>"
      fi
      if ! grep -q '__SV_LOGIN_FALLBACK__' "$html" 2>/dev/null; then
        echo '<script>'
        cat "$helper"
        echo '</script>'
      fi
      cat "$html"
    } > "$tmp" 2>/dev/null && mv -f "$tmp" "$html" 2>/dev/null || rm -f "$tmp" 2>/dev/null || true
  done
}

serve_dir() {
  dir="$1"
  inject_login_fallback_into_index "$dir"
  # Log BEFORE releasing the placeholder so readiness probes can wait on this line
  # and teachers are not sent to a dead port during the handoff.
  echo "[preview] serve static: $dir on ${LISTEN}"
  release_port_holder
  run_serve "$dir" "${LISTEN}"
}

serve_fallback_forever() {
  release_port_holder
  echo "[preview] serving built-in fallback page on ${LISTEN}"
  run_serve /preview-fallback "${LISTEN}"
}

node_modules_incomplete() {
  [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ] || [ ! -d node_modules/.bin ]
}

ensure_node_modules() {
  label="${1:-npm}"
  if node_modules_incomplete; then
    echo "[preview] ${label} install (may take several minutes)…"
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  elif [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    echo "[preview] cached workspace: reusing node_modules"
  else
    echo "[preview] reusing node_modules/"
  fi
}

is_vite_project() {
  [ -f vite.config.js ] || [ -f vite.config.ts ] || grep -q '"vite"' package.json 2>/dev/null
}

ensure_vite_binary() {
  if ! is_vite_project; then
    return 0
  fi
  if [ ! -x node_modules/.bin/vite ]; then
    echo "[preview] vite binary missing after install — forcing clean reinstall"
    rm -rf node_modules
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  fi
}

log_build_tail() {
  log="$1"
  lines="${2:-50}"
  echo "[preview] last ${lines} lines from ${log}:"
  tail -"${lines}" "$log" 2>/dev/null || true
}

write_preview_env_files() {
  if [ -z "$PREVIEW_ADMIN_EMAIL" ]; then
    return 0
  fi
  echo "[preview] Configuring demo admin login for teacher review"
  {
    echo ""
    echo "# ScholarVerify preview sandbox"
    echo "PREVIEW_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "PREVIEW_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    echo "SEED_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "SEED_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    echo "DEFAULT_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "DEFAULT_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
  } >> .env 2>/dev/null || {
    echo "PREVIEW_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL" > .env
    echo "PREVIEW_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD" >> .env
    echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL" >> .env
    echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD" >> .env
  }
}

write_mern_backend_env() {
  mongo="${MONGO_URI:-$MONGODB_URI}"
  if [ -z "$mongo" ]; then
    mongo="mongodb://host.docker.internal:27017/scholarverify_preview"
  fi
  # Base64 of a 64-byte key (HS512-safe). Legacy shorter default caused WeakKeyException on Spring HS512 apps.
  jwt="${JWT_SECRET:-cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtZm9yLUhTNTEyLW5lZWRzLTY0LWJ5dGUta2V5LW1pbmltdW0hIQ==}"
  cors="${CORS_ORIGIN:-}"
  if [ -z "$cors" ] && [ -n "$PREVIEW_PUBLIC_UI_URL" ]; then
    cors="$PREVIEW_PUBLIC_UI_URL"
  fi
  if [ -z "$cors" ] && [ -n "$PREVIEW_UI_HOST_PORT" ]; then
    cors="http://localhost:${PREVIEW_UI_HOST_PORT}"
  fi
  {
    echo "# ScholarVerify preview runtime"
    echo "PORT=$API_PORT"
    echo "HOST=0.0.0.0"
    echo "MONGO_URI=$mongo"
    echo "MONGODB_URI=$mongo"
    echo "JWT_SECRET=$jwt"
    echo "NODE_ENV=development"
    echo "PREVIEW_SANDBOX=1"
    if [ -n "$cors" ]; then
      echo "CORS_ORIGIN=$cors"
      echo "FRONTEND_URL=$cors"
      echo "CLIENT_URL=$cors"
      echo "CLIENT_ORIGIN=$cors"
      echo "ALLOWED_ORIGIN=$cors"
      echo "ALLOWED_ORIGINS=$cors"
      echo "APP_URL=$cors"
      echo "WEB_URL=$cors"
    fi
    if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
      echo "PREVIEW_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "PREVIEW_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
      echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
      echo "SEED_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "SEED_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    fi
  } > .env.preview-runtime
  cat .env.preview-runtime > .env
  if [ -f .env.project ]; then
    # Drop student localhost CORS/frontend URLs so they cannot override preview origins.
    grep -v -E '^(MONGO_URI|MONGODB_URI|DATABASE_URL|PORT|HOST|JWT_SECRET|NODE_ENV|PREVIEW_SANDBOX|CORS_ORIGIN|FRONTEND_URL|CLIENT_URL|CLIENT_ORIGIN|ALLOWED_ORIGIN|ALLOWED_ORIGINS|APP_URL|WEB_URL|PREVIEW_ADMIN_|ADMIN_EMAIL|ADMIN_PASSWORD|SEED_ADMIN_|DEMO_ADMIN_|DEFAULT_ADMIN_)=' .env.project >> .env 2>/dev/null || true
  fi
  rm -f .env.preview-runtime .env.preview-backup .env.student-original .env.student-filtered
  export PORT="$API_PORT"
  export HOST=0.0.0.0
  export MONGO_URI="$mongo"
  export MONGODB_URI="$mongo"
  export JWT_SECRET="$jwt"
  export PREVIEW_SANDBOX=1
  echo "[preview] MONGO_URI=$mongo"
}

wait_for_mongo_ready() {
  n=0
  while [ "$n" -lt 45 ]; do
    if node -e "
      const mongoose=require('mongoose');
      const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
      if(!uri) process.exit(1);
      mongoose.connect(uri,{serverSelectionTimeoutMS:2000}).then(()=>mongoose.disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1));
    " >> /tmp/preview-backend.log 2>&1; then
      echo "[preview] MongoDB ready for seed"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  echo "[preview] MongoDB not ready after wait — seed may fail"
  return 1
}

run_preview_admin_seed() {
  label="${1:-admin seed}"
  if [ -z "$PREVIEW_ADMIN_EMAIL" ] || [ ! -f package.json ]; then
    return 0
  fi
  echo "[preview] ${label}…"
  node /preview-seed-admin.js >> /tmp/preview-backend.log 2>&1 || {
    echo "[preview] ${label} failed — check /tmp/preview-backend.log"
    tail -25 /tmp/preview-backend.log 2>/dev/null || true
    return 1
  }
  grep '\[preview-seed\]' /tmp/preview-backend.log 2>/dev/null | tail -12 || true
  return 0
}

verify_preview_login() {
  if [ -z "$PREVIEW_ADMIN_EMAIL" ]; then
    return 0
  fi
  echo "[preview] verifying login against API on port ${API_PORT}…"
  if node /preview-verify-login.js >> /tmp/preview-backend.log 2>&1; then
    grep '\[preview-login\]' /tmp/preview-backend.log 2>/dev/null | tail -3 || true
    return 0
  fi
  grep '\[preview-login\]' /tmp/preview-backend.log 2>/dev/null | tail -3 || true
  return 1
}

start_mern_backend() {
  backend_rel="$1"
  cd "$ROOT/$backend_rel" || return 1
  echo "[preview] MERN backend in $(pwd)"
  write_mern_backend_env

  # Always install latest preview safety (CORS + universal login) from the image.
  if [ -f /preview-safety.cjs ]; then
    cp -f /preview-safety.cjs ./scholarverify-preview-cors.cjs
    echo "[preview] installed scholarverify-preview-cors.cjs from image"
  fi
  if [ -f /preview-ensure-inject.cjs ]; then
    node /preview-ensure-inject.cjs "$(pwd)" || true
  fi

  ensure_node_modules "backend npm"
  : > /tmp/preview-backend.log
  if grep -q '"seed"' package.json 2>/dev/null; then
    echo "[preview] backend npm run seed…"
    npm run seed >> /tmp/preview-backend.log 2>&1 || true
  fi

  if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
    wait_for_mongo_ready || true
    run_preview_admin_seed "pre-start admin seed" || true
  fi

  echo "[preview] starting backend on 0.0.0.0:${API_PORT}"
  if grep -q '"start"' package.json 2>/dev/null; then
    npm start >> /tmp/preview-backend.log 2>&1 &
  elif grep -q '"dev"' package.json 2>/dev/null; then
    npm run dev >> /tmp/preview-backend.log 2>&1 &
  elif [ -f server.js ]; then
    node server.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f index.js ]; then
    node index.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f src/index.js ]; then
    node src/index.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f src/server.js ]; then
    node src/server.js >> /tmp/preview-backend.log 2>&1 &
  else
    echo "[preview] no backend start script found" >> /tmp/preview-backend.log
    return 1
  fi

  wait_for_tcp_port "$API_PORT" "student API" 240

  # Many student apps seed or reset users on startup — seed again after API is listening.
  if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
    sleep 2
    run_preview_admin_seed "post-start admin seed" || true
    verify_preview_login || echo "[preview] login verify failed after post-start seed"
  fi
}

ensure_flutter_web_ready() {
  export PATH="/opt/flutter/bin:${PATH}"
  if ! command -v flutter >/dev/null 2>&1; then
    echo "[preview] Flutter SDK not found in image"
    return 1
  fi
  flutter config --no-analytics >/dev/null 2>&1 || true
  if [ ! -d /opt/flutter/bin/cache/flutter_web_sdk ]; then
    echo "[preview] flutter precache --web (first start, 2–5 min)…"
    flutter precache --web >> /tmp/preview-flutter.log 2>&1 || true
  fi
}

run_flutter_web_preview() {
  flutter_rel="$1"
  ensure_flutter_web_ready || return 1
  cd "$ROOT/$flutter_rel" || return 1
  echo "[preview] Flutter app in $(pwd)"

  if [ -d build/web ] && [ -f build/web/index.html ]; then
    echo "[preview] using pre-built Flutter web in build/web"
    serve_dir "$(pwd)/build/web"
  fi

  api_define=""
  if [ -n "$PREVIEW_API_HOST_PORT" ]; then
    api_define="--dart-define=API_URL=http://localhost:${PREVIEW_API_HOST_PORT} --dart-define=BASE_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
  fi

  echo "[preview] flutter pub get…"
  flutter pub get 2>&1 || true
  echo "[preview] flutter build web (first build may take 3–8 min)…"
  : > /tmp/preview-flutter.log
  # shellcheck disable=SC2086
  if flutter build web --release $api_define >> /tmp/preview-flutter.log 2>&1; then
    if [ -d build/web ] && [ -f build/web/index.html ]; then
      serve_dir "$(pwd)/build/web"
    fi
  fi

  echo "[preview] ERROR: Flutter web build failed or build/web/index.html missing"
  tail -40 /tmp/preview-flutter.log 2>/dev/null || true
  return 1
}

patch_built_bundle_urls() {
  API_URL="$(preview_api_bundle_url)"
  [ -n "$API_URL" ] || return 0
  PUBLIC_HOST_RAW="${PREVIEW_PUBLIC_HOST:-}"
  if [ -z "$PUBLIC_HOST_RAW" ] && [ -n "$PREVIEW_PUBLIC_API_URL" ]; then
    PUBLIC_HOST_RAW="$(printf '%s' "$PREVIEW_PUBLIC_API_URL" | sed 's|:[0-9][0-9]*$||')"
  fi
  PUBLIC_HOST=""
  if [ -n "$PUBLIC_HOST_RAW" ]; then
    PUBLIC_HOST="$(printf '%s' "$PUBLIC_HOST_RAW" | sed -e 's|^https\?://||' -e 's|/.*$||' -e 's|:.*$||')"
  fi
  PUBLIC_HOST_ESC=""
  if [ -n "$PUBLIC_HOST" ]; then
    PUBLIC_HOST_ESC="$(printf '%s' "$PUBLIC_HOST" | sed 's/[.]/\\./g')"
  fi
  echo "[preview] patching API URLs → relative / same-origin (${API_URL})"
  for dir in build dist build/web; do
    root="$(pwd)/$dir"
    [ -d "$root" ] || continue
    find "$root" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' \) \
      ! -name '*.map' 2>/dev/null | while read -r f; do
      # Strip absolute API origins so fetch('/api/...') hits the UI port gateway.
      sed -i "s|http://localhost:[0-9][0-9]*||g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:[0-9][0-9]*||g" "$f" 2>/dev/null || true
      sed -i "s|https://localhost:[0-9][0-9]*||g" "$f" 2>/dev/null || true
      if [ -n "$PREVIEW_PUBLIC_API_URL" ]; then
        sed -i "s|${PREVIEW_PUBLIC_API_URL}||g" "$f" 2>/dev/null || true
      fi
      if [ -n "$API_URL" ] && [ "$API_URL" != "$PREVIEW_PUBLIC_API_URL" ]; then
        sed -i "s|${API_URL}||g" "$f" 2>/dev/null || true
      fi
      if [ -n "$PUBLIC_HOST_ESC" ]; then
        sed -i "s|http://${PUBLIC_HOST_ESC}:[0-9][0-9]*||g" "$f" 2>/dev/null || true
        sed -i "s|https://${PUBLIC_HOST_ESC}:[0-9][0-9]*||g" "$f" 2>/dev/null || true
      fi
    done
  done
  echo "[preview] API URL patch complete (relative paths for same-origin gateway)"
}

patch_source_api_urls() {
  API_URL="$(preview_api_bundle_url)"
  [ -n "$API_URL" ] || return 0
  find . -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.env' -o -name '*.env.local' \) \
    ! -path './node_modules/*' ! -path './dist/*' ! -path './build/*' 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:[0-9][0-9]*|${API_URL}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:[0-9][0-9]*|${API_URL}|g" "$f" 2>/dev/null || true
    done
}

run_frontend_preview() {
  API_URL="$(preview_api_bundle_url)"
  if [ -n "$API_URL" ]; then
    export VITE_API_URL="$API_URL"
    export REACT_APP_API_URL="$API_URL"
    export VITE_API_BASE_URL="$API_URL"
    {
      echo "VITE_API_URL=$API_URL"
      echo "REACT_APP_API_URL=$API_URL"
      echo "VITE_API_BASE_URL=$API_URL"
      echo "GENERATE_SOURCEMAP=false"
    } > .env.local 2>/dev/null || true
  fi

  patch_source_api_urls

  if [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    echo "[preview] cached workspace — reusing node_modules / dist / build when available"
  fi

if [ -d dist ] && [ -f dist/index.html ]; then
    echo "[preview] reusing cached frontend dist/"
    patch_built_bundle_urls
    serve_dir "$(pwd)/dist"
fi
if [ -d build ] && [ -f build/index.html ]; then
    echo "[preview] reusing cached frontend build/"
    patch_built_bundle_urls
    serve_dir "$(pwd)/build"
  fi
  if [ -d build/web ] && [ -f build/web/index.html ]; then
    patch_built_bundle_urls
    serve_dir "$(pwd)/build/web"
  fi
if [ ! -f package.json ]; then
    if [ -f index.html ]; then
      serve_dir "$(pwd)"
    fi
    return 1
  fi
  ensure_node_modules "npm"
  ensure_vite_binary
  if grep -q '"seed"' package.json 2>/dev/null; then
    echo "[preview] npm run seed…"
    npm run seed 2>&1 || true
  fi
  if is_vite_project; then
    echo "[preview] Vite build + static serve (API=${VITE_API_URL:-n/a})"
    : > /tmp/preview-frontend-build.log
    build_ok=0
    if npm run build >> /tmp/preview-frontend-build.log 2>&1; then
      build_ok=1
    fi
    if [ "$build_ok" != "1" ] || [ ! -x node_modules/.bin/vite ]; then
      echo "[preview] ERROR: Vite build failed (vite binary missing or build error) — serving raw unbuilt source as last resort. Check /tmp/preview-frontend-build.log. This will likely produce a blank page / MIME-type errors in the browser."
      log_build_tail /tmp/preview-frontend-build.log 50
    else
      patch_built_bundle_urls
      if [ -d dist ] && [ -f dist/index.html ]; then
        serve_dir "$(pwd)/dist"
      fi
    fi
  fi
  if grep -q 'react-scripts' package.json 2>/dev/null; then
    echo "[preview] Create-React-App: npm run build (production bundle, faster 2nd start)…"
    if npm run build 2>&1; then
      patch_built_bundle_urls
      if [ -d build ] && [ -f build/index.html ]; then
        serve_dir "$(pwd)/build"
      fi
    fi
    echo "[preview] CRA build failed — falling back to react-scripts start"
    release_port_holder
    exec npm run start
  fi
  if npm run build 2>/dev/null; then
    patch_built_bundle_urls
    if [ -d dist ] && [ -f dist/index.html ]; then
      serve_dir "$(pwd)/dist"
    fi
    if [ -d build ] && [ -f build/index.html ]; then
      serve_dir "$(pwd)/build"
    fi
  fi
  if [ -f index.html ]; then
    serve_dir "$(pwd)"
  fi
  return 1
}

run_static_site_preview() {
  echo "[preview] static site mode: ${PREVIEW_STATIC_STACK:-static-html}"
  if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ]; then
    cd "$ROOT/$APP_SUBDIR" || return 1
  else
    cd "$ROOT" || return 1
  fi
  if [ ! -f index.html ]; then
    for d in */; do
      if [ -f "${d}index.html" ]; then
        cd "$d" || continue
        break
      fi
    done
  fi
  if [ ! -f index.html ]; then
    echo "[preview] ERROR: index.html not found — ZIP should contain index.html at the root or in one folder"
    return 1
  fi
  echo "[preview] serving HTML/CSS site from $(pwd)"
  serve_dir "$(pwd)"
}

hold_port_with_fallback

if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ]; then
  cd "$ROOT/$APP_SUBDIR" || serve_fallback_forever
else
  cd "$ROOT" || serve_fallback_forever
fi

echo "[preview] Node app directory: $(pwd)"
echo "[preview] PORT=${PORT}"

write_preview_env_files

if [ "$PREVIEW_STATIC_STACK" = "static-html" ] || [ "$PREVIEW_STATIC_STACK" = "static-html-js" ]; then
  run_static_site_preview || serve_fallback_forever
fi

if [ "$PREVIEW_FLUTTER_MODE" = "1" ] && [ -n "$BACKEND_SUBDIR" ] && [ -n "$FLUTTER_SUBDIR" ]; then
  echo "[preview] Flutter+Node mode flutter=$FLUTTER_SUBDIR backend=$BACKEND_SUBDIR host API port=$PREVIEW_API_HOST_PORT"
  start_mern_backend "$BACKEND_SUBDIR" || echo "[preview] backend start failed — API must be up for the Flutter app"
  run_flutter_web_preview "$FLUTTER_SUBDIR" || serve_fallback_forever
fi

if [ "$PREVIEW_MERN_MODE" = "1" ] && [ -n "$BACKEND_SUBDIR" ] && [ -n "$FRONTEND_SUBDIR" ]; then
  echo "[preview] MERN mode frontend=$FRONTEND_SUBDIR backend=$BACKEND_SUBDIR host API port=$PREVIEW_API_HOST_PORT"
  start_mern_backend "$BACKEND_SUBDIR" || echo "[preview] ERROR: backend start failed — login will not work until API is up"
  cd "$ROOT/$FRONTEND_SUBDIR" || serve_fallback_forever
  echo "[preview] MERN frontend in $(pwd)"
  API_URL="$(preview_api_bundle_url)"
  if [ -n "$API_URL" ]; then
    {
      echo "VITE_API_URL=$API_URL"
      echo "REACT_APP_API_URL=$API_URL"
      echo "VITE_API_BASE_URL=$API_URL"
    } > .env.local
  fi
  run_frontend_preview || serve_fallback_forever
fi

for rel in ../frontend/dist ../frontend/build ../client/dist ../client/build ../web/dist; do
  if [ -f "$rel/index.html" ]; then
    serve_dir "$(cd "$(dirname "$rel")" && pwd)/$(basename "$rel")"
  fi
done

run_frontend_preview

serve_fallback_forever
