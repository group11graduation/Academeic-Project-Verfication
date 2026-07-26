#!/bin/sh
set +e
# UI / gateway listen port (published as the teacher preview URL).
PORT="${PORT:-3000}"
UI_PORT="${PORT}"
ROOT="/app"

# Student Express listens on an INTERNAL port only. The gateway is the only process
# that binds UI_PORT and reverse-proxies /api → API_PORT.
API_PORT="${API_PORT:-5050}"

export PORT
export UI_PORT
export API_PORT
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

LISTEN="tcp://0.0.0.0:${UI_PORT}"
HOLDER_PID=""

# Browser-facing API base. With the same-origin gateway, the UI port proxies /api → internal API_PORT,
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

ensure_preview_gateway_file() {
  # Refresh gateway from the image-baked copy (single source of truth).
  # Do not embed a second copy here — it went stale and broke SPA routing for
  # apps that return HTTP 200 text on GET / (e.g. SYADA "API is running...").
  dest="${1:-/preview-gateway.cjs}"
  src="/usr/local/share/sv-preview-gateway.cjs"
  if [ -f "$src" ]; then
    cp -f "$src" "$dest" 2>/dev/null || cat "$src" > "$dest"
    echo "[preview] wrote gateway script to $dest"
    return 0
  fi
  if [ -f "/preview-gateway.cjs" ] && [ "$dest" != "/preview-gateway.cjs" ]; then
    cp -f /preview-gateway.cjs "$dest" 2>/dev/null || cat /preview-gateway.cjs > "$dest"
    echo "[preview] wrote gateway script to $dest (from /preview-gateway.cjs)"
    return 0
  fi
  if [ -f "$dest" ]; then
    echo "[preview] using existing gateway $dest"
    return 0
  fi
  echo "[preview] ERROR: gateway missing (expected $src)"
  return 1
}

run_serve() {
  dir="$1"
  listen="$2"
  cd "$dir" || exit 1
  # Never let a prior backend export leave PORT=API_PORT — gateway must own UI_PORT only.
  export PORT="$UI_PORT"
  if [ -n "$API_PORT" ]; then
    # Always refresh gateway (image may be stale; writes stay on container rootfs).
    ensure_preview_gateway_file /preview-gateway.cjs
    if [ -f /preview-gateway.cjs ]; then
      if tcp_port_open "$UI_PORT"; then
        echo "[preview] ERROR: UI port ${UI_PORT} already in use before gateway start — skipping duplicate listen (backend should be on :${API_PORT})"
        echo "[preview] holding process alive without rebinding :${UI_PORT}"
        while true; do sleep 3600; done
      fi
      echo "[preview] starting same-origin gateway (UI :${UI_PORT} → API :${API_PORT})"
      exec node /preview-gateway.cjs "$(pwd)"
    fi
  fi
  echo "[preview] WARN: gateway unavailable — using static serve (browser login may hang)"
  if command -v serve >/dev/null 2>&1; then
    exec serve -s . --listen "$listen"
  else
    exec npx --yes serve@14.2.4 -s . --listen "$listen"
  fi
}

hold_port_with_fallback() {
  echo "[preview] holding :${UI_PORT} with placeholder page (install may take several minutes)"
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
  # Do not write into the bind-mounted student dist/ — sed/mv on Coolify volumes
  # can hang indefinitely. The gateway injects API boot + login fallback when
  # serving index.html from memory instead.
  echo "[preview] index inject deferred to gateway (avoid bind-mount writes)"
  return 0
}

serve_dir() {
  dir="$1"
  inject_login_fallback_into_index "$dir"
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

preview_cache_dir() {
  mkdir -p .preview-cache 2>/dev/null || true
  printf '%s' ".preview-cache"
}

# Deterministic sha256 of package manifests (deps layer).
compute_deps_hash() {
  node -e '
    const fs = require("fs");
    const crypto = require("crypto");
    const h = crypto.createHash("sha256");
    for (const f of ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]) {
      if (!fs.existsSync(f)) continue;
      h.update(f + "\0");
      h.update(fs.readFileSync(f));
      h.update("\0");
    }
    process.stdout.write(h.digest("hex"));
  ' 2>/dev/null || printf ''
}

# Deterministic sha256 of all files under src/ (sorted paths). Empty/missing src → empty string (always miss).
compute_frontend_src_hash() {
  node -e '
    const fs = require("fs");
    const path = require("path");
    const crypto = require("crypto");
    function walk(dir, out) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.isFile()) out.push(p);
      }
    }
    if (!fs.existsSync("src") || !fs.statSync("src").isDirectory()) {
      process.stdout.write("");
      process.exit(0);
    }
    const files = [];
    walk("src", files);
    files.sort();
    const h = crypto.createHash("sha256");
    for (const f of files) {
      h.update(f.split(path.sep).join("/") + "\0");
      h.update(fs.readFileSync(f));
      h.update("\0");
    }
    process.stdout.write(h.digest("hex"));
  ' 2>/dev/null || printf ''
}

read_cache_hash() {
  # $1 = marker name (node_modules | dist)
  f="$(preview_cache_dir)/$1.hash"
  if [ -f "$f" ]; then
    tr -d '[:space:]' < "$f"
  else
    printf ''
  fi
}

write_cache_hash() {
  # $1 = marker name, $2 = hash
  name="$1"
  hash="$2"
  [ -n "$hash" ] || return 0
  dir="$(preview_cache_dir)"
  printf '%s\n' "$hash" > "$dir/$name.hash"
}

deps_cache_hit() {
  current="$(compute_deps_hash)"
  stored="$(read_cache_hash node_modules)"
  [ -n "$current" ] && [ -n "$stored" ] && [ "$current" = "$stored" ]
}

frontend_build_cache_hit() {
  # Requires existing dist or build output AND matching src hash marker.
  current="$(compute_frontend_src_hash)"
  stored="$(read_cache_hash dist)"
  [ -n "$current" ] && [ -n "$stored" ] && [ "$current" = "$stored" ]
}

ensure_node_modules() {
  label="${1:-npm}"
  deps_hash="$(compute_deps_hash)"
  if node_modules_incomplete || ! deps_cache_hit; then
    if node_modules_incomplete; then
      echo "[preview] cache miss, rebuilding node_modules (${label} install — may take several minutes)…"
    else
      echo "[preview] cache miss, rebuilding node_modules (package manifests changed)"
    fi
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
    write_cache_hash node_modules "$deps_hash"
  else
    echo "[preview] cache hit, reusing node_modules"
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
    write_cache_hash node_modules "$(compute_deps_hash)"
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
  db_engine="${PREVIEW_DB_ENGINE:-}"
  if [ -z "$db_engine" ] && [ -n "${DB_HOST:-}" ]; then
    db_engine="mysql"
  fi
  if [ -z "$db_engine" ]; then
    db_engine="mongo"
  fi
  if [ "$db_engine" != "mysql" ] && [ -z "$mongo" ]; then
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
  db_host="${DB_HOST:-}"
  db_name="${DB_NAME:-${MYSQL_DATABASE:-preview}}"
  db_user="${DB_USER:-${MYSQL_USER:-root}}"
  db_pass="${DB_PASS:-${DB_PASSWORD:-${MYSQL_PASSWORD:-}}}"
  db_port="${DB_PORT:-${MYSQL_PORT:-3306}}"
  {
    echo "# ScholarVerify preview runtime"
    echo "PORT=$API_PORT"
    echo "HOST=0.0.0.0"
    echo "JWT_SECRET=$jwt"
    echo "NODE_ENV=development"
    echo "PREVIEW_SANDBOX=1"
    echo "PREVIEW_DB_ENGINE=$db_engine"
    if [ "$db_engine" = "mysql" ]; then
      echo "DB_HOST=$db_host"
      echo "DB_PORT=$db_port"
      echo "DB_NAME=$db_name"
      echo "DB_DATABASE=$db_name"
      echo "DB_USER=$db_user"
      echo "DB_USERNAME=$db_user"
      echo "DB_PASS=$db_pass"
      echo "DB_PASSWORD=$db_pass"
      echo "MYSQL_HOST=$db_host"
      echo "MYSQL_PORT=$db_port"
      echo "MYSQL_DATABASE=$db_name"
      echo "MYSQL_USER=$db_user"
      echo "MYSQL_PASSWORD=$db_pass"
      echo "DATABASE_URL=mysql://${db_user}:${db_pass}@${db_host}:${db_port}/${db_name}"
    else
      echo "MONGO_URI=$mongo"
      echo "MONGODB_URI=$mongo"
      echo "DATABASE_URL=$mongo"
    fi
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
    grep -v -E '^(MONGO_URI|MONGODB_URI|DATABASE_URL|DB_HOST|DB_PORT|DB_NAME|DB_DATABASE|DB_USER|DB_USERNAME|DB_PASS|DB_PASSWORD|MYSQL_HOST|MYSQL_PORT|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD|PORT|HOST|JWT_SECRET|NODE_ENV|PREVIEW_SANDBOX|PREVIEW_DB_ENGINE|CORS_ORIGIN|FRONTEND_URL|CLIENT_URL|CLIENT_ORIGIN|ALLOWED_ORIGIN|ALLOWED_ORIGINS|APP_URL|WEB_URL|PREVIEW_ADMIN_|ADMIN_EMAIL|ADMIN_PASSWORD|SEED_ADMIN_|DEMO_ADMIN_|DEFAULT_ADMIN_)=' .env.project >> .env 2>/dev/null || true
  fi
  rm -f .env.preview-runtime .env.preview-backup .env.student-original .env.student-filtered
  # Critical: do NOT export PORT=$API_PORT into this shell — that made the gateway
  # collide with Express (EADDRINUSE on :5000). Keep shell PORT = UI_PORT for gateway.
  export PORT="$UI_PORT"
  export HOST=0.0.0.0
  export JWT_SECRET="$jwt"
  export PREVIEW_SANDBOX=1
  export PREVIEW_DB_ENGINE="$db_engine"
  if [ "$db_engine" = "mysql" ]; then
    export DB_HOST="$db_host"
    export DB_NAME="$db_name"
    export DB_USER="$db_user"
    export DB_PASS="$db_pass"
    echo "[preview] MySQL DB_HOST=$db_host DB_NAME=$db_name"
  else
    export MONGO_URI="$mongo"
    export MONGODB_URI="$mongo"
    echo "[preview] MONGO_URI=$mongo"
  fi
}

wait_for_mongo_ready() {
  if [ "${PREVIEW_DB_ENGINE:-}" = "mysql" ] || [ -n "${DB_HOST:-}" ]; then
    echo "[preview] skipping Mongo wait (MySQL preview)"
    return 0
  fi
  n=0
  while [ "$n" -lt 45 ]; do
    if node -e "
      try { require('mongoose'); } catch (e) { process.exit(2); }
      const mongoose=require('mongoose');
      const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
      if(!uri) process.exit(1);
      mongoose.connect(uri,{serverSelectionTimeoutMS:2000}).then(()=>mongoose.disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1));
    " >> /tmp/preview-backend.log 2>&1; then
      echo "[preview] MongoDB ready for seed"
      return 0
    fi
    rc=$?
    if [ "$rc" = "2" ]; then
      echo "[preview] mongoose not in student project — skip Mongo wait"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  echo "[preview] MongoDB not ready after wait — seed may fail"
  return 1
}

wait_for_mysql_ready() {
  if [ "${PREVIEW_DB_ENGINE:-}" != "mysql" ] && [ -z "${DB_HOST:-}" ]; then
    return 0
  fi
  n=0
  while [ "$n" -lt 45 ]; do
    if node -e "
      const m=require('/preview-tools/node_modules/mysql2/promise');
      const host=process.env.DB_HOST||process.env.MYSQL_HOST;
      if(!host) process.exit(1);
      m.createConnection({
        host,
        user: process.env.DB_USER||process.env.MYSQL_USER||'root',
        password: process.env.DB_PASS||process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD||'',
        database: process.env.DB_NAME||process.env.MYSQL_DATABASE||'preview',
        port: Number(process.env.DB_PORT||3306)
      }).then(c=>c.query('SELECT 1').then(()=>c.end())).then(()=>process.exit(0)).catch(()=>process.exit(1));
    " >> /tmp/preview-backend.log 2>&1; then
      echo "[preview] MySQL ready for seed"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  echo "[preview] MySQL not ready after wait — seed may fail"
  return 1
}

run_preview_admin_seed() {
  label="${1:-admin seed}"
  if [ -z "$PREVIEW_ADMIN_EMAIL" ] || [ ! -f package.json ]; then
    return 0
  fi
  echo "[preview] ${label}…"
  if [ "${PREVIEW_DB_ENGINE:-}" = "mysql" ] || [ -n "${DB_HOST:-}" ]; then
    node /preview-seed-mysql.js >> /tmp/preview-backend.log 2>&1 || {
      echo "[preview] ${label} (mysql) soft-failed — check /tmp/preview-backend.log"
      tail -25 /tmp/preview-backend.log 2>/dev/null || true
      return 0
    }
    grep '\[preview-seed-mysql\]' /tmp/preview-backend.log 2>/dev/null | tail -12 || true
    return 0
  fi
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
    if [ "${PREVIEW_DB_ENGINE:-}" = "mysql" ] || [ -n "${DB_HOST:-}" ]; then
      wait_for_mysql_ready || true
    else
      wait_for_mongo_ready || true
    fi
    run_preview_admin_seed "pre-start admin seed" || true
  fi

  echo "[preview] starting backend on 0.0.0.0:${API_PORT} (internal; gateway owns :${UI_PORT})"
  # Force API_PORT into the child only — shell PORT stays UI_PORT for the gateway.
  if grep -q '"start"' package.json 2>/dev/null; then
    env PORT="$API_PORT" HOST=0.0.0.0 npm start >> /tmp/preview-backend.log 2>&1 &
  elif grep -q '"dev"' package.json 2>/dev/null; then
    env PORT="$API_PORT" HOST=0.0.0.0 npm run dev >> /tmp/preview-backend.log 2>&1 &
  elif [ -f server.js ]; then
    env PORT="$API_PORT" HOST=0.0.0.0 node server.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f index.js ]; then
    env PORT="$API_PORT" HOST=0.0.0.0 node index.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f src/index.js ]; then
    env PORT="$API_PORT" HOST=0.0.0.0 node src/index.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f src/server.js ]; then
    env PORT="$API_PORT" HOST=0.0.0.0 node src/server.js >> /tmp/preview-backend.log 2>&1 &
  else
    echo "[preview] no backend start script found" >> /tmp/preview-backend.log
    return 1
  fi

  export PORT="$UI_PORT"
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
  # IMPORTANT: never sed -i the bind-mounted workspace. On Coolify/Docker volume
  # mounts this hung for 60+ minutes and blocked serve/gateway forever.
  # Same-origin gateway + preview-login-fallback rewrite localhost at runtime.
  echo "[preview] skipping bundle URL patch (gateway + login-fallback handle API)"
  return 0
}

patch_source_api_urls() {
  echo "[preview] skipping source URL rewrite (gateway handles API)"
  return 0
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

  src_hash="$(compute_frontend_src_hash)"
  build_cache_ok=0
  if frontend_build_cache_hit; then
    build_cache_ok=1
  fi

  if [ "$build_cache_ok" = "1" ] && [ -d dist ] && [ -f dist/index.html ]; then
    echo "[preview] cache hit, reusing dist/"
    patch_built_bundle_urls
    echo "[preview] launching UI…"
    serve_dir "$(pwd)/dist"
  fi
  if [ "$build_cache_ok" = "1" ] && [ -d build ] && [ -f build/index.html ]; then
    echo "[preview] cache hit, reusing build/"
    patch_built_bundle_urls
    echo "[preview] launching UI…"
    serve_dir "$(pwd)/build"
  fi
  if [ -d dist ] && [ -f dist/index.html ] && [ "$build_cache_ok" != "1" ]; then
    echo "[preview] cache miss, rebuilding dist/"
  elif [ -d build ] && [ -f build/index.html ] && [ "$build_cache_ok" != "1" ]; then
    echo "[preview] cache miss, rebuilding build/"
  fi

  if [ -d build/web ] && [ -f build/web/index.html ] && [ "$build_cache_ok" = "1" ]; then
    patch_built_bundle_urls
    echo "[preview] launching UI…"
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
      src_hash="$(compute_frontend_src_hash)"
      write_cache_hash dist "$src_hash"
      if [ -d dist ] && [ -f dist/index.html ]; then
        serve_dir "$(pwd)/dist"
      fi
    fi
  fi
  if grep -q 'react-scripts' package.json 2>/dev/null; then
    echo "[preview] Create-React-App: npm run build (production bundle, faster 2nd start)…"
    if npm run build 2>&1; then
      patch_built_bundle_urls
      src_hash="$(compute_frontend_src_hash)"
      write_cache_hash dist "$src_hash"
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
    src_hash="$(compute_frontend_src_hash)"
    write_cache_hash dist "$src_hash"
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
echo "[preview] PORT=${UI_PORT} (UI/gateway) API_PORT=${API_PORT} (internal Express)"

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
