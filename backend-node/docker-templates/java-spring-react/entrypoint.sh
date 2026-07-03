#!/bin/sh
set +e
PORT="${PORT:-3000}"
ROOT="/app"
API_PORT="${API_PORT:-8080}"

export PORT HOST=0.0.0.0 BIND_HOST=0.0.0.0 BIND_ADDRESS=0.0.0.0
export WDS_SOCKET_HOST=0.0.0.0 DANGEROUSLY_DISABLE_HOST_CHECK=true BROWSER=none
export GENERATE_SOURCEMAP=false CI=false DISABLE_ESLINT_PLUGIN=true

LISTEN="tcp://0.0.0.0:${PORT}"
HOLDER_PID=""

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
  if [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    echo "[preview] holding :${PORT} with placeholder (cached workspace — usually 1–3 min)"
  else
    echo "[preview] holding :${PORT} with placeholder (Spring + React may take 5–15 min first start)"
  fi
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
  pkill -f "serve.*0.0.0.0:${PORT}" 2>/dev/null || true
  pkill -f "serve.*:${PORT}" 2>/dev/null || true
  sleep 1
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

find_bootable_jar() {
  jar=""
  for candidate in target/*.jar; do
    case "$candidate" in
      *-sources.jar|*-javadoc.jar|*-original.jar|*-plain.jar) continue ;;
    esac
    if [ -f "$candidate" ]; then
      jar="$candidate"
      break
    fi
  done
  echo "$jar"
}

package_spring_jar() {
  build_flags="-q -DskipTests -Dmaven.test.skip=true -Dmaven.compiler.source=17 -Dmaven.compiler.target=17 -Dmaven.compiler.release=17"
  offline=""
  if [ -d "$HOME/.m2/repository" ] && [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    offline="-o"
    echo "[preview] Maven offline mode (using cached repo)…"
  fi

  if [ -f ./mvnw ]; then
    chmod +x ./mvnw
    echo "[preview] ./mvnw package (first-time Maven build)…"
    ./mvnw $offline $build_flags package >> /tmp/preview-spring.log 2>&1
    return $?
  elif [ -f pom.xml ]; then
    echo "[preview] mvn package (first-time Maven build)…"
    mvn $offline $build_flags package >> /tmp/preview-spring.log 2>&1
    return $?
  fi
  return 1
}

start_spring_backend_async() {
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
  export MAVEN_OPTS="${MAVEN_OPTS:--Xmx768m -XX:+TieredCompilation -XX:TieredStopAtLevel=1}"

  jar_path="$(find_bootable_jar)"

  if [ -n "$jar_path" ]; then
    echo "[preview] reusing pre-built Spring jar: $jar_path (fast start)"
    java -jar "$jar_path" --spring.profiles.active=preview --server.port="$API_PORT" >> /tmp/preview-spring.log 2>&1 &
    SPRING_BG_PID=$!
    echo "[preview] Spring PID ${SPRING_BG_PID}; tail /tmp/preview-spring.log for output"
    return 0
  fi

  if [ -f ./gradlew ]; then
    chmod +x ./gradlew
    echo "[preview] ./gradlew bootRun (no packaged jar found)…"
    ./gradlew bootRun --args="--spring.profiles.active=preview --server.port=${API_PORT}" >> /tmp/preview-spring.log 2>&1 &
    SPRING_BG_PID=$!
    echo "[preview] Spring PID ${SPRING_BG_PID}"
    return 0
  fi

  if [ ! -f pom.xml ] && [ ! -f ./mvnw ]; then
    echo "[preview] ERROR: no pom.xml / mvnw / gradlew in Spring folder" >> /tmp/preview-spring.log
    return 1
  fi

  # Package first, then run the JAR — fast subsequent starts (target/*.jar reused).
  (
    if package_spring_jar; then
      jar_path="$(find_bootable_jar)"
      if [ -n "$jar_path" ]; then
        echo "[preview] Spring jar built: $jar_path — starting"
        java -jar "$jar_path" --spring.profiles.active=preview --server.port="$API_PORT" >> /tmp/preview-spring.log 2>&1
      else
        echo "[preview] ERROR: mvn package succeeded but no bootable jar in target/" >> /tmp/preview-spring.log
      fi
    else
      echo "[preview] mvn package failed — falling back to spring-boot:run" >> /tmp/preview-spring.log
      if [ -f ./mvnw ]; then
        ./mvnw -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=preview -Dspring-boot.run.jvmArguments="-Dserver.port=${API_PORT}" >> /tmp/preview-spring.log 2>&1
      else
        mvn -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=preview -Dspring-boot.run.jvmArguments="-Dserver.port=${API_PORT}" >> /tmp/preview-spring.log 2>&1
      fi
    fi
  ) &
  SPRING_BG_PID=$!
  echo "[preview] Spring PID ${SPRING_BG_PID} (packaging in background)"
}

serve_dir() {
  dir="$1"
  release_port_holder
  echo "[preview] serve static: $dir on ${LISTEN}"
  run_serve "$dir" "${LISTEN}"
}

serve_fallback_forever() {
  release_port_holder
  run_serve /preview-fallback "${LISTEN}"
}

patch_frontend_api_urls() {
  [ -n "$PREVIEW_API_HOST_PORT" ] || return 0
  fe_rel="${FRONTEND_SUBDIR:-.}"
  find "$ROOT/$fe_rel" -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) \
    ! -path '*/node_modules/*' ! -path '*/build/*' ! -path '*/dist/*' 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:8000|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:8000|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://localhost:8080|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:8080|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://localhost:5000|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:5000|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
    done
}

patch_built_bundle_urls() {
  [ -n "$PREVIEW_API_HOST_PORT" ] || return 0
  fe_rel="${FRONTEND_SUBDIR:-.}"
  for dir in build dist; do
    root="$ROOT/$fe_rel/$dir"
    [ -d "$root" ] || continue
    find "$root" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.map' \) 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
      sed -i "s|https://localhost:[0-9][0-9]*|http://localhost:${PREVIEW_API_HOST_PORT}|g" "$f" 2>/dev/null || true
    done
  done
}

try_build_and_serve() {
  build_dir="$1"
  if [ ! -f package.json ]; then
    return 1
  fi
  patch_frontend_api_urls
  patch_built_bundle_urls

  if [ -d build ] && [ -f build/index.html ]; then
    echo "[preview] reusing cached React build/"
    serve_dir "$(pwd)/build"
  fi
  if [ -d dist ] && [ -f dist/index.html ]; then
    echo "[preview] reusing cached frontend dist/"
    serve_dir "$(pwd)/dist"
  fi

  if [ ! -d node_modules ]; then
    echo "[preview] frontend npm install…"
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  elif [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    echo "[preview] reusing cached node_modules/"
  fi
  echo "[preview] npm run build (production bundle for preview)…"
  if npm run build 2>&1; then
    if [ -d "$build_dir" ] && [ -f "$build_dir/index.html" ]; then
      serve_dir "$(pwd)/$build_dir"
    fi
  fi
  return 1
}

run_react_frontend() {
  fe_rel="${FRONTEND_SUBDIR:-.}"
  cd "$ROOT/$fe_rel" || return 1
  echo "[preview] React frontend in $(pwd)"
  patch_frontend_api_urls
  patch_built_bundle_urls
  if [ -n "$PREVIEW_API_HOST_PORT" ]; then
    export VITE_API_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    export REACT_APP_API_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    export VITE_API_BASE_URL="http://localhost:${PREVIEW_API_HOST_PORT}"
    {
      echo "VITE_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
      echo "REACT_APP_API_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
      echo "GENERATE_SOURCEMAP=false"
    } > .env.local
  fi

  if [ -d dist ] && [ -f dist/index.html ]; then
    serve_dir "$(pwd)/dist"
  fi
  if [ -d build ] && [ -f build/index.html ]; then
    serve_dir "$(pwd)/build"
  fi
  if [ -f index.html ] && [ ! -f package.json ]; then
    serve_dir "$(pwd)"
  fi
  if [ ! -f package.json ]; then
    return 1
  fi

  if grep -q '"vite"' package.json 2>/dev/null || [ -f vite.config.js ] || [ -f vite.config.ts ]; then
    try_build_and_serve dist && return 0
  fi
  if grep -q 'react-scripts' package.json 2>/dev/null; then
    try_build_and_serve build && return 0
  fi
  try_build_and_serve dist && return 0
  try_build_and_serve build && return 0
  [ -f index.html ] && serve_dir "$(pwd)"
  return 1
}

hold_port_with_fallback

if [ "$PREVIEW_SPRING_MODE" = "1" ] && [ -n "$SPRING_SUBDIR" ] && [ -n "$FRONTEND_SUBDIR" ]; then
  echo "[preview] Spring+React mode spring=$SPRING_SUBDIR frontend=$FRONTEND_SUBDIR API=$API_PORT UI=$PORT"
  start_spring_backend_async || echo "[preview] Spring start skipped — check /tmp/preview-spring.log"
  run_react_frontend || serve_fallback_forever
fi

serve_fallback_forever
