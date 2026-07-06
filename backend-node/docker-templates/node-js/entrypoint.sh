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

serve_dir() {
  dir="$1"
  release_port_holder
  echo "[preview] serve static: $dir on ${LISTEN}"
  run_serve "$dir" "${LISTEN}"
}

serve_fallback_forever() {
  release_port_holder
  echo "[preview] serving built-in fallback page on ${LISTEN}"
  run_serve /preview-fallback "${LISTEN}"
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
  jwt="${JWT_SECRET:-preview-sandbox-jwt-secret-change-me}"
  cors="${CORS_ORIGIN:-}"
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
    if [ -n "$cors" ]; then echo "CORS_ORIGIN=$cors"; fi
    if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
      echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
      echo "SEED_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "SEED_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    fi
  } > .env
  export PORT="$API_PORT"
  export HOST=0.0.0.0
  export MONGO_URI="$mongo"
  export MONGODB_URI="$mongo"
  export JWT_SECRET="$jwt"
  export PREVIEW_SANDBOX=1
  echo "[preview] MONGO_URI=$mongo"
}

start_mern_backend() {
  backend_rel="$1"
  cd "$ROOT/$backend_rel" || return 1
  echo "[preview] MERN backend in $(pwd)"
  write_mern_backend_env

  if [ -d node_modules ]; then
    if [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
      echo "[preview] cached workspace: reusing backend node_modules"
    fi
  else
    echo "[preview] backend npm install…"
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  fi
  : > /tmp/preview-backend.log
  if grep -q '"seed"' package.json 2>/dev/null; then
    echo "[preview] backend npm run seed…"
    npm run seed >> /tmp/preview-backend.log 2>&1 || true
  fi

  if [ -n "$PREVIEW_ADMIN_EMAIL" ] && [ -f src/models/User.js ]; then
    echo "[preview] ensuring preview admin account exists…"
    node -e "
      (async () => {
        try {
          require('dotenv').config({ path: '.env' });
          const mongoose = require('mongoose');
          const bcrypt = require('bcrypt');
          const User = require('./src/models/User');
          const tryRequire = (p) => {
            try {
              return require(p);
            } catch {
              return null;
            }
          };
          const Building = tryRequire('./src/models/Building');
          const Floor = tryRequire('./src/models/Floor');
          const Room = tryRequire('./src/models/Room');
          const Person = tryRequire('./src/models/Person');
          const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
          if (!uri) {
            console.log('[preview-seed] skipped: missing mongo uri');
            return;
          }
          await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
          const email = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo')
            .toLowerCase()
            .trim();
          const rawPass = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!');
          let existing = await User.findOne({ email });
          if (!existing) {
            const hash = await bcrypt.hash(rawPass, 10);
            existing = await User.create({
              name: 'Preview Admin',
              email,
              password: hash,
              role: 'MANAGER',
            });
            console.log('[preview-seed] created preview admin', email);
          } else if (existing.password) {
            const ok = await bcrypt.compare(rawPass, existing.password);
            if (!ok) {
              existing.password = await bcrypt.hash(rawPass, 10);
              await existing.save();
              console.log('[preview-seed] reset preview admin password', email);
            } else {
              console.log('[preview-seed] preview admin already valid', email);
            }
          } else {
            existing.password = await bcrypt.hash(rawPass, 10);
            await existing.save();
            console.log('[preview-seed] set missing preview admin password', email);
          }

          if (Building && existing && existing.role === 'MANAGER') {
            let building = await Building.findOne({ manager: existing._id });
            if (!building) {
              building = await Building.create({
                name: 'Preview Tower',
                brandingName: 'Preview Tower',
                location: 'Preview City',
                manager: existing._id,
                floorLimit: 10,
                allowedRoomTypes: ['STANDARD', 'DELUXE', 'APARTMENT'],
              });
              console.log('[preview-seed] created preview building', building.name);
            }

            if (Floor) {
              let floor = await Floor.findOne({ building: building._id, floorNumber: 1 });
              if (!floor) {
                floor = await Floor.create({ building: building._id, floorNumber: 1 });
                console.log('[preview-seed] created floor 1');
              }

              if (Room) {
                let room = await Room.findOne({ floor: floor._id, roomNumber: '101' });
                if (!room) {
                  room = await Room.create({
                    roomNumber: '101',
                    type: 'STANDARD',
                    capacity: 2,
                    status: 'AVAILABLE',
                    payment: { amount: 500, frequency: 'MONTHLY', currency: 'USD' },
                    floor: floor._id,
                    building: building._id,
                  });
                  console.log('[preview-seed] created room 101');
                }

                if (Person) {
                  const tenant = await Person.findOne({ building: building._id, room: room._id, type: 'TENANT' });
                  if (!tenant) {
                    await Person.create({
                      name: 'Preview Tenant',
                      phone: '0000000000',
                      type: 'TENANT',
                      room: room._id,
                      building: building._id,
                    });
                    console.log('[preview-seed] created preview tenant');
                  }
                }
              }
            }
          }

          await mongoose.disconnect();
        } catch (err) {
          console.error('[preview-seed] failed:', err.message || err);
          process.exit(0);
        }
      })();
    " >> /tmp/preview-backend.log 2>&1 || true
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
  [ -n "$PREVIEW_API_HOST_PORT" ] || return 0
  echo "[preview] patching API URLs → localhost:${PREVIEW_API_HOST_PORT}"
  for dir in build dist build/web; do
    root="$(pwd)/$dir"
    [ -d "$root" ] || continue
    find "$root" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.map' \) 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|https://localhost:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
    done
  done
}

patch_source_api_urls() {
  [ -n "$PREVIEW_API_HOST_PORT" ] || return 0
  find . -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.env' -o -name '*.env.local' \) \
    ! -path './node_modules/*' ! -path './dist/*' ! -path './build/*' 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
    done
}

run_frontend_preview() {
  if [ -n "$PREVIEW_API_HOST_PORT" ]; then
    export VITE_API_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    export REACT_APP_API_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    export VITE_API_BASE_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    {
      echo "VITE_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
      echo "REACT_APP_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
      echo "VITE_API_BASE_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
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
if [ ! -d node_modules ]; then
    echo "[preview] npm install (may take several minutes)…"
  npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  else
    echo "[preview] reusing cached node_modules/"
  fi
  if grep -q '"seed"' package.json 2>/dev/null; then
    echo "[preview] npm run seed…"
    npm run seed 2>&1 || true
  fi
  if [ -f vite.config.js ] || [ -f vite.config.ts ] || grep -q '"vite"' package.json 2>/dev/null; then
    echo "[preview] Vite build + static serve (API=${VITE_API_URL:-n/a})"
    if npm run build 2>&1; then
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
  {
    echo "VITE_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
    echo "REACT_APP_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
    echo "VITE_API_BASE_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
  } > .env.local
  run_frontend_preview || serve_fallback_forever
fi

for rel in ../frontend/dist ../frontend/build ../client/dist ../client/build ../web/dist; do
  if [ -f "$rel/index.html" ]; then
    serve_dir "$(cd "$(dirname "$rel")" && pwd)/$(basename "$rel")"
  fi
done

run_frontend_preview

serve_fallback_forever
