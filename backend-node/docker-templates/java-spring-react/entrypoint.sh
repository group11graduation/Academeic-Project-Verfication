#!/bin/sh
set -e
PORT="${PORT:-3000}"
ROOT="/app"
API_PORT="${API_PORT:-8080}"

export PORT HOST=0.0.0.0 BIND_HOST=0.0.0.0 BIND_ADDRESS=0.0.0.0
export WDS_SOCKET_HOST=0.0.0.0 DANGEROUSLY_DISABLE_HOST_CHECK=true BROWSER=none CI=true

LISTEN="tcp://0.0.0.0:${PORT}"
HOLDER_PID=""

hold_port_with_fallback() {
  echo "[preview] holding :${PORT} with placeholder (Spring + React may take 5–15 min first start)"
  npx --yes serve@14.2.4 -s /preview-fallback --listen "${LISTEN}" >/tmp/preview-holder.log 2>&1 &
  HOLDER_PID=$!
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
  max="${3:-300}"
  n=0
  while [ "$n" -lt "$max" ]; do
    if tcp_port_open "$port"; then
      echo "[preview] ${label} listening on :${port}"
      return 0
    fi
    n=$((n + 1))
    if [ $((n % 20)) -eq 0 ]; then
      echo "[preview] waiting for ${label} :${port} (${n}/${max})…"
      tail -8 /tmp/preview-spring.log 2>/dev/null || true
    fi
    sleep 3
  done
  echo "[preview] ERROR: ${label} not ready on :${port}"
  tail -80 /tmp/preview-spring.log 2>/dev/null || true
  return 1
}

serve_dir() {
  dir="$1"
  release_port_holder
  echo "[preview] serve static: $dir on ${LISTEN}"
  cd "$dir" || exit 1
  exec npx --yes serve@14.2.4 -s . --listen "${LISTEN}"
}

serve_fallback_forever() {
  release_port_holder
  exec npx --yes serve@14.2.4 -s /preview-fallback --listen "${LISTEN}"
}

start_spring_backend() {
  spring_rel="${SPRING_SUBDIR:-.}"
  cd "$ROOT/$spring_rel" || return 1
  echo "[preview] Spring Boot backend in $(pwd)"
  : > /tmp/preview-spring.log
  export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-preview}"
  export SERVER_PORT="$API_PORT"
  export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:h2:mem:scholarverify;DB_CLOSE_DELAY=-1}"
  export SPRING_DATASOURCE_DRIVER_CLASS_NAME="${SPRING_DATASOURCE_DRIVER_CLASS_NAME:-org.h2.Driver}"
  export SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-sa}"
  export SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"

  if [ -f ./mvnw ]; then
    chmod +x ./mvnw
    echo "[preview] ./mvnw spring-boot:run (first run downloads dependencies)…"
    ./mvnw -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=preview -Dspring-boot.run.jvmArguments="-Dserver.port=${API_PORT}" >> /tmp/preview-spring.log 2>&1 &
  elif [ -f pom.xml ]; then
    echo "[preview] mvn spring-boot:run…"
    mvn -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=preview -Dspring-boot.run.jvmArguments="-Dserver.port=${API_PORT}" >> /tmp/preview-spring.log 2>&1 &
  elif [ -f ./gradlew ]; then
    chmod +x ./gradlew
    echo "[preview] ./gradlew bootRun…"
    ./gradlew bootRun --args="--spring.profiles.active=preview --server.port=${API_PORT}" >> /tmp/preview-spring.log 2>&1 &
  else
    echo "[preview] ERROR: no pom.xml / mvnw / gradlew in Spring folder" >> /tmp/preview-spring.log
    return 1
  fi
  wait_for_tcp_port "$API_PORT" "Spring API" 360
}

run_react_frontend() {
  fe_rel="${FRONTEND_SUBDIR:-.}"
  cd "$ROOT/$fe_rel" || return 1
  echo "[preview] React frontend in $(pwd)"
  if [ -n "$PREVIEW_API_HOST_PORT" ]; then
    export VITE_API_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    export REACT_APP_API_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    export VITE_API_BASE_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    {
      echo "VITE_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
      echo "REACT_APP_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
    } > .env.local
  fi
  if [ -d dist ] && [ -f dist/index.html ]; then
    serve_dir "$(pwd)/dist"
  fi
  if [ -d build ] && [ -f build/index.html ]; then
    serve_dir "$(pwd)/build"
  fi
  if [ ! -f package.json ]; then
    [ -f index.html ] && serve_dir "$(pwd)"
    return 1
  fi
  if [ ! -d node_modules ]; then
    echo "[preview] frontend npm install…"
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  fi
  if grep -q '"vite"' package.json 2>/dev/null || [ -f vite.config.js ] || [ -f vite.config.ts ]; then
    echo "[preview] Vite build for preview…"
    if npm run build 2>&1 && [ -d dist ] && [ -f dist/index.html ]; then
      serve_dir "$(pwd)/dist"
    fi
  fi
  if grep -q 'react-scripts' package.json 2>/dev/null; then
    release_port_holder
    exec npm run start
  fi
  if npm run build 2>/dev/null; then
    [ -d dist ] && [ -f dist/index.html ] && serve_dir "$(pwd)/dist"
    [ -d build ] && [ -f build/index.html ] && serve_dir "$(pwd)/build"
  fi
  [ -f index.html ] && serve_dir "$(pwd)"
  return 1
}

hold_port_with_fallback

if [ "$PREVIEW_SPRING_MODE" = "1" ] && [ -n "$SPRING_SUBDIR" ] && [ -n "$FRONTEND_SUBDIR" ]; then
  echo "[preview] Spring+React mode spring=$SPRING_SUBDIR frontend=$FRONTEND_SUBDIR API=$API_PORT UI=$PORT"
  start_spring_backend || echo "[preview] Spring start failed — check /tmp/preview-spring.log"
  run_react_frontend || serve_fallback_forever
fi

serve_fallback_forever
