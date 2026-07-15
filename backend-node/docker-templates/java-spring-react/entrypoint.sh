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
  no_exec="${3:-}"
  cd "$dir" || exit 1
  if command -v serve >/dev/null 2>&1; then
    if [ "$no_exec" = "1" ]; then
      serve -s . --listen "$listen"
      return $?
    fi
    exec serve -s . --listen "$listen"
  else
    if [ "$no_exec" = "1" ]; then
      npx --yes serve@14.2.4 -s . --listen "$listen"
      return $?
    fi
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

# Fat jars must include H2 when we force SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.h2.Driver.
jar_includes_h2() {
  jar_file="$1"
  [ -f "$jar_file" ] || return 1
  if command -v jar >/dev/null 2>&1; then
    jar tf "$jar_file" 2>/dev/null | grep -qiE 'BOOT-INF/lib/h2-|org/h2/Driver\.class' && return 0
  fi
  if command -v unzip >/dev/null 2>&1; then
    unzip -l "$jar_file" 2>/dev/null | grep -qiE 'BOOT-INF/lib/h2-|org/h2/Driver' && return 0
  fi
  return 1
}

maven_h2_in_local_repo() {
  [ -d "$HOME/.m2/repository/com/h2database/h2" ]
}

# Prefer online Maven when H2 was just injected or is missing from the local cache.
maven_offline_flag() {
  if [ "${PREVIEW_FORCE_MAVEN_ONLINE:-}" = "1" ]; then
    echo ""
    return 0
  fi
  if [ -d "$HOME/.m2/repository" ] && [ "$PREVIEW_WORKSPACE_CACHED" = "1" ] && maven_h2_in_local_repo; then
    echo "-o"
    return 0
  fi
  echo ""
}

# Insert a Maven dependency if missing. Inserts before the LAST </dependencies>
# (project deps usually follow <dependencyManagement>), or adds a fresh
# <dependencies> block before </project> when none exist.
# Usage: ensure_pom_dependency <groupId> <artifactId> [scope] [pom.xml]
# Returns 0 if already present, 2 if injected, 1 on failure.
ensure_pom_dependency() {
  group_id="$1"
  artifact_id="$2"
  scope="${3:-}"
  pom="${4:-./pom.xml}"

  if [ -z "$group_id" ] || [ -z "$artifact_id" ]; then
    echo "[preview] WARN: ensure_pom_dependency requires groupId and artifactId"
    return 1
  fi
  if [ ! -f "$pom" ]; then
    return 0
  fi

  # Match either groupId near this artifact, or a bare artifactId tag.
  if grep -qF "<groupId>${group_id}</groupId>" "$pom" 2>/dev/null && \
     grep -qE "<artifactId>[[:space:]]*${artifact_id}[[:space:]]*</artifactId>" "$pom"; then
    echo "[preview] dependency ${group_id}:${artifact_id} already present in pom.xml"
    return 0
  fi
  if grep -qE "<artifactId>[[:space:]]*${artifact_id}[[:space:]]*</artifactId>" "$pom" && \
     grep -qF "$group_id" "$pom"; then
    echo "[preview] dependency ${group_id}:${artifact_id} already present in pom.xml"
    return 0
  fi

  echo "[preview] dependency ${group_id}:${artifact_id} missing — injecting into pom.xml for preview compatibility"

  scope_xml=""
  if [ -n "$scope" ]; then
    scope_xml="      <scope>${scope}</scope>"
  fi

  if ! GROUP_ID="$group_id" ARTIFACT_ID="$artifact_id" SCOPE_XML="$scope_xml" node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const groupId = process.env.GROUP_ID;
    const artifactId = process.env.ARTIFACT_ID;
    const scopeXml = process.env.SCOPE_XML || "";
    let xml = fs.readFileSync(path, "utf8");
    const scopeLine = scopeXml ? `\n${scopeXml}` : "";
    const dep = `    <dependency>
      <groupId>${groupId}</groupId>
      <artifactId>${artifactId}</artifactId>${scopeLine}
    </dependency>
`;
    const closeDeps = "</dependencies>";
    const lastIdx = xml.lastIndexOf(closeDeps);
    if (lastIdx !== -1) {
      xml = xml.slice(0, lastIdx) + dep + xml.slice(lastIdx);
    } else {
      const closeProj = xml.lastIndexOf("</project>");
      if (closeProj === -1) {
        console.error("[preview] ERROR: no </project> in pom.xml — cannot inject dependency");
        process.exit(1);
      }
      xml =
        xml.slice(0, closeProj) +
        "  <dependencies>\n" +
        dep +
        "  </dependencies>\n" +
        xml.slice(closeProj);
    }
    fs.writeFileSync(path, xml);
  ' "$pom"; then
    echo "[preview] WARN: failed to inject ${group_id}:${artifact_id} into pom.xml"
    return 1
  fi
  return 2
}

# Preview forces H2 via SPRING_DATASOURCE_* — ensure the driver is on the classpath.
ensure_h2_dependency_in_pom() {
  ensure_pom_dependency "com.h2database" "h2" "runtime" "${1:-./pom.xml}"
}

# Spring Externalized Config: command-line args beat env beat application.properties.
# Still pass -Dserver.port as a JVM system property for belt-and-suspenders reliability
# (covers spring-boot:run / nested JVM launches where args can be dropped).
spring_java_port_flags() {
  printf '%s' "-Dserver.port=${API_PORT}"
}

spring_boot_args() {
  printf '%s' "--spring.profiles.active=preview --server.port=${API_PORT}"
}

# Grep /tmp/preview-spring.log for common student-project failure signatures.
# Logs plain-English DIAGNOSIS lines only — does not attempt auto-fixes.
diagnose_spring_startup_failures() {
  log="${1:-/tmp/preview-spring.log}"
  if [ ! -f "$log" ]; then
    echo "[preview] DIAGNOSIS: No Spring log at ${log} — backend may not have started."
    return 0
  fi

  found=0

  if grep -qF 'Cannot load driver class' "$log" 2>/dev/null; then
    echo "[preview] DIAGNOSIS: Missing JDBC driver class on the classpath (often H2/MySQL/PostgreSQL). Preview injects H2 when it can — if this persists, the student pom.xml may block or exclude the driver. See full log above for details."
    found=1
  fi

  if grep -qiE 'Address already in use|BindException|port.*(in use|already)' "$log" 2>/dev/null; then
    echo "[preview] DIAGNOSIS: Port already in use — the app likely hardcodes server.port (or another process holds the port). Preview forces SERVER_PORT / -Dserver.port / --server.port=${API_PORT}; a hardcoded bind in code can still conflict. See full log above for details."
    found=1
  fi

  if grep -qF 'UnsatisfiedDependencyException' "$log" 2>/dev/null && \
     grep -qF 'Could not resolve placeholder' "$log" 2>/dev/null; then
    echo "[preview] DIAGNOSIS: Missing required application property/env var (e.g. JWT secret, API keys via \${...} placeholders). This is a student project config issue — preview does not invent secret values. See full log above for details."
    found=1
  elif grep -qF 'Could not resolve placeholder' "$log" 2>/dev/null; then
    echo "[preview] DIAGNOSIS: Unresolved \${placeholder} in Spring config (missing env/property). Likely a student code/config issue. See full log above for details."
    found=1
  fi

  if grep -qF 'Failed to configure a DataSource' "$log" 2>/dev/null; then
    echo "[preview] DIAGNOSIS: DataSource configuration failed (URL/driver/credentials). Preview overlays H2 for sandbox use; student MySQL/Postgres settings or missing drivers may still break startup. See full log above for details."
    found=1
  fi

  if grep -qE 'COMPILATION ERROR|cannot find symbol|error: package .* does not exist|Failed to execute goal org\.apache\.maven\.plugins:maven-compiler-plugin' "$log" 2>/dev/null; then
    echo "[preview] DIAGNOSIS: Maven compile failed (e.g. missing types/packages or compiler errors in student Java sources). Fix the project code/build, then re-preview. See full log above for details."
    found=1
  fi

  if [ "$found" -eq 0 ]; then
    if grep -qiE 'APPLICATION FAILED TO START|Error starting ApplicationContext|BUILD FAILURE' "$log" 2>/dev/null; then
      echo "[preview] DIAGNOSIS: Spring/Maven reported a startup or build failure, but no specific known signature matched. Tail of log follows — likely a student project issue, not the preview platform."
      found=1
    fi
  fi

  if [ "$found" -eq 1 ]; then
    echo "[preview] --- last 30 lines of ${log} ---"
    tail -n 30 "$log" 2>/dev/null || true
    echo "[preview] --- end spring diagnosis ---"
  fi
  return 0
}

package_spring_jar() {
  ensure_h2_dependency_in_pom ./pom.xml
  case $? in
    2)
      rm -f target/*.jar 2>/dev/null || true
      export PREVIEW_FORCE_MAVEN_ONLINE=1
      ;;
  esac

  build_flags="-q -DskipTests -Dmaven.test.skip=true -Dmaven.compiler.source=17 -Dmaven.compiler.target=17 -Dmaven.compiler.release=17"
  offline="$(maven_offline_flag)"
  if [ -n "$offline" ]; then
    echo "[preview] Maven offline mode (using cached repo)…"
  else
    echo "[preview] Maven online mode (ensure H2 and deps can download)…"
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
  # Relaxed binding → server.port; CLI --server.port and -Dserver.port also set below.
  export SERVER_PORT="$API_PORT"
  export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:h2:mem:scholarverify;DB_CLOSE_DELAY=-1}"
  export SPRING_DATASOURCE_DRIVER_CLASS_NAME="${SPRING_DATASOURCE_DRIVER_CLASS_NAME:-org.h2.Driver}"
  export SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-sa}"
  export SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-}"
  export MAVEN_OPTS="${MAVEN_OPTS:--Xmx768m -XX:+TieredCompilation -XX:TieredStopAtLevel=1}"
  # jjwt Decoders.BASE64.decode rejects '-' (illegal in standard Base64). Use a Base64-safe default
  # ("preview-sandbox-jwt-secret-change-me-please"). Also replace the legacy hyphenated placeholder
  # if the host still injects it.
  _jwt_default='cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtY2hhbmdlLW1lLXBsZWFzZQ=='
  if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "preview-sandbox-jwt-secret-change-me" ]; then
    export JWT_SECRET="$_jwt_default"
  fi
  unset _jwt_default

  # Ensure H2 is on the classpath before we reuse or build a jar.
  ensure_h2_dependency_in_pom ./pom.xml
  case $? in
    2)
      rm -f target/*.jar 2>/dev/null || true
      export PREVIEW_FORCE_MAVEN_ONLINE=1
      echo "[preview] cleared target/*.jar so Maven rebuilds with H2" >> /tmp/preview-spring.log
      ;;
  esac

  jar_path="$(find_bootable_jar)"
  if [ -n "$jar_path" ] && ! jar_includes_h2 "$jar_path"; then
    echo "[preview] cached jar $jar_path is missing H2 driver — discarding (would crash with Cannot load driver class)" | tee -a /tmp/preview-spring.log
    rm -f target/*.jar 2>/dev/null || true
    jar_path=""
    export PREVIEW_FORCE_MAVEN_ONLINE=1
  fi

  port_sys="$(spring_java_port_flags)"
  boot_args="$(spring_boot_args)"

  # Keep Spring in background (UI server no longer uses exec, so this process group stays alive).
  if [ -n "$jar_path" ]; then
    echo "[preview] reusing pre-built Spring jar: $jar_path (fast start, ${port_sys} ${boot_args})"
    # shellcheck disable=SC2086
    nohup java ${port_sys} -jar "$jar_path" ${boot_args} >> /tmp/preview-spring.log 2>&1 &
    SPRING_BG_PID=$!
    echo "[preview] Spring PID ${SPRING_BG_PID}; tail /tmp/preview-spring.log for output"
    sleep 6
    if ! kill -0 "$SPRING_BG_PID" 2>/dev/null && ! tcp_port_open "$API_PORT"; then
      echo "[preview] reused jar exited quickly — will rebuild with Maven" | tee -a /tmp/preview-spring.log
      diagnose_spring_startup_failures /tmp/preview-spring.log | tee -a /tmp/preview-spring.log
      rm -f target/*.jar 2>/dev/null || true
      jar_path=""
      export PREVIEW_FORCE_MAVEN_ONLINE=1
    else
      return 0
    fi
  fi

  if [ -f ./gradlew ]; then
    chmod +x ./gradlew
    echo "[preview] ./gradlew bootRun (no packaged jar found)…"
    nohup ./gradlew bootRun "-Dserver.port=${API_PORT}" --args="${boot_args}" >> /tmp/preview-spring.log 2>&1 &
    SPRING_BG_PID=$!
    echo "[preview] Spring PID ${SPRING_BG_PID}"
    return 0
  fi

  if [ ! -f pom.xml ] && [ ! -f ./mvnw ]; then
    echo "[preview] ERROR: no pom.xml / mvnw / gradlew in Spring folder" >> /tmp/preview-spring.log
    return 1
  fi

  # Package first, then run the JAR — only reuse jars that include H2.
  nohup sh -c '
    set +e
    cd "'"$ROOT/$spring_rel"'" || exit 1
    API_PORT="'"$API_PORT"'"
    PREVIEW_WORKSPACE_CACHED="'"$PREVIEW_WORKSPACE_CACHED"'"
    PREVIEW_FORCE_MAVEN_ONLINE="'"${PREVIEW_FORCE_MAVEN_ONLINE:-}"'"

    jar_includes_h2() {
      jar_file="$1"
      [ -f "$jar_file" ] || return 1
      if command -v jar >/dev/null 2>&1; then
        jar tf "$jar_file" 2>/dev/null | grep -qiE "BOOT-INF/lib/h2-|org/h2/Driver\\.class" && return 0
      fi
      if command -v unzip >/dev/null 2>&1; then
        unzip -l "$jar_file" 2>/dev/null | grep -qiE "BOOT-INF/lib/h2-|org/h2/Driver" && return 0
      fi
      return 1
    }

    ensure_pom_dependency() {
      group_id="$1"
      artifact_id="$2"
      scope="${3:-}"
      pom="${4:-./pom.xml}"
      [ -f "$pom" ] || return 0
      if grep -qF "<groupId>${group_id}</groupId>" "$pom" 2>/dev/null && \
         grep -qE "<artifactId>[[:space:]]*${artifact_id}[[:space:]]*</artifactId>" "$pom"; then
        echo "[preview] dependency ${group_id}:${artifact_id} already present in pom.xml" >> /tmp/preview-spring.log
        return 0
      fi
      echo "[preview] dependency ${group_id}:${artifact_id} missing — injecting into pom.xml for preview compatibility" >> /tmp/preview-spring.log
      scope_xml=""
      if [ -n "$scope" ]; then scope_xml="      <scope>${scope}</scope>"; fi
      if ! GROUP_ID="$group_id" ARTIFACT_ID="$artifact_id" SCOPE_XML="$scope_xml" node -e "
        const fs = require(\"fs\");
        const path = process.argv[1];
        const groupId = process.env.GROUP_ID;
        const artifactId = process.env.ARTIFACT_ID;
        const scopeXml = process.env.SCOPE_XML || \"\";
        let xml = fs.readFileSync(path, \"utf8\");
        const scopeLine = scopeXml ? \"\\n\" + scopeXml : \"\";
        const dep = \"    <dependency>\\n\" +
          \"      <groupId>\" + groupId + \"</groupId>\\n\" +
          \"      <artifactId>\" + artifactId + \"</artifactId>\" + scopeLine + \"\\n\" +
          \"    </dependency>\\n\";
        const closeDeps = \"</dependencies>\";
        const lastIdx = xml.lastIndexOf(closeDeps);
        if (lastIdx !== -1) {
          xml = xml.slice(0, lastIdx) + dep + xml.slice(lastIdx);
        } else {
          const closeProj = xml.lastIndexOf(\"</project>\");
          if (closeProj === -1) process.exit(1);
          xml = xml.slice(0, closeProj) + \"  <dependencies>\\n\" + dep + \"  </dependencies>\\n\" + xml.slice(closeProj);
        }
        fs.writeFileSync(path, xml);
      " "$pom"; then
        echo "[preview] WARN: failed to inject ${group_id}:${artifact_id} into pom.xml" >> /tmp/preview-spring.log
        return 1
      fi
      return 2
    }

    ensure_pom_dependency "com.h2database" "h2" "runtime" ./pom.xml
    h2_rc=$?
    if [ "$h2_rc" -eq 2 ]; then
      rm -f target/*.jar 2>/dev/null || true
      PREVIEW_FORCE_MAVEN_ONLINE=1
    fi

    offline=""
    if [ "$PREVIEW_FORCE_MAVEN_ONLINE" != "1" ] && [ -d "$HOME/.m2/repository" ] && [ "$PREVIEW_WORKSPACE_CACHED" = "1" ] && [ -d "$HOME/.m2/repository/com/h2database/h2" ]; then
      offline="-o"
      echo "[preview] Maven offline mode (H2 already cached)" >> /tmp/preview-spring.log
    else
      echo "[preview] Maven online mode (download H2 if needed)" >> /tmp/preview-spring.log
    fi

    if [ -f ./mvnw ]; then
      chmod +x ./mvnw
      echo "[preview] ./mvnw package…" >> /tmp/preview-spring.log
      ./mvnw $offline -q -DskipTests -Dmaven.test.skip=true -Dmaven.compiler.source=17 -Dmaven.compiler.target=17 -Dmaven.compiler.release=17 package >> /tmp/preview-spring.log 2>&1
      rc=$?
    elif [ -f pom.xml ]; then
      echo "[preview] mvn package…" >> /tmp/preview-spring.log
      mvn $offline -q -DskipTests -Dmaven.test.skip=true -Dmaven.compiler.source=17 -Dmaven.compiler.target=17 -Dmaven.compiler.release=17 package >> /tmp/preview-spring.log 2>&1
      rc=$?
    else
      exit 1
    fi
    jar=""
    for candidate in target/*.jar; do
      case "$candidate" in
        *-sources.jar|*-javadoc.jar|*-original.jar|*-plain.jar) continue ;;
      esac
      if [ -f "$candidate" ]; then jar="$candidate"; break; fi
    done
    if [ "$rc" -eq 0 ] && [ -n "$jar" ]; then
      if ! jar_includes_h2 "$jar"; then
        echo "[preview] ERROR: packaged jar still missing H2 — falling back to spring-boot:run" >> /tmp/preview-spring.log
      else
        echo "[preview] Spring jar built: $jar — starting with -Dserver.port=${API_PORT}" >> /tmp/preview-spring.log
        exec java -Dserver.port="$API_PORT" -jar "$jar" --spring.profiles.active=preview --server.port="$API_PORT"
      fi
    fi
    echo "[preview] mvn package failed or no H2 jar — falling back to spring-boot:run" >> /tmp/preview-spring.log
    jvm_args="-Dserver.port=${API_PORT}"
    run_args="--spring.profiles.active=preview --server.port=${API_PORT}"
    if [ -f ./mvnw ]; then
      exec ./mvnw -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=preview -Dspring-boot.run.jvmArguments="${jvm_args}" -Dspring-boot.run.arguments="${run_args}"
    else
      exec mvn -q -DskipTests spring-boot:run -Dspring-boot.run.profiles=preview -Dspring-boot.run.jvmArguments="${jvm_args}" -Dspring-boot.run.arguments="${run_args}"
    fi
  ' >> /tmp/preview-spring.log 2>&1 &
  SPRING_BG_PID=$!
  echo "[preview] Spring PID ${SPRING_BG_PID} (packaging in background with nohup)"
}

serve_dir() {
  dir="$1"
  release_port_holder
  echo "[preview] serve static: $dir on ${LISTEN}"
  # Do not exec — keep this shell as PID 1 so Maven/Spring (started in background) stay alive.
  run_serve "$dir" "${LISTEN}" 1
}

serve_fallback_forever() {
  release_port_holder
  diagnose_spring_startup_failures /tmp/preview-spring.log
  run_serve /preview-fallback "${LISTEN}" 1
}

patch_frontend_api_urls() {
  api_url="${PREVIEW_PUBLIC_API_URL:-}"
  if [ -z "$api_url" ] && [ -n "$PREVIEW_API_HOST_PORT" ]; then
    api_url="http://localhost:${PREVIEW_API_HOST_PORT}"
  fi
  [ -n "$api_url" ] || return 0
  fe_rel="${FRONTEND_SUBDIR:-.}"
  echo "[preview] patching frontend source API base -> ${api_url}"
  find "$ROOT/$fe_rel" -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.env*' \) \
    ! -path '*/node_modules/*' ! -path '*/build/*' ! -path '*/dist/*' 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:8000|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:8000|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|http://localhost:8080|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:8080|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|http://localhost:5000|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:5000|${api_url}|g" "$f" 2>/dev/null || true
    done
}

patch_built_bundle_urls() {
  api_url="${PREVIEW_PUBLIC_API_URL:-}"
  if [ -z "$api_url" ] && [ -n "$PREVIEW_API_HOST_PORT" ]; then
    api_url="http://localhost:${PREVIEW_API_HOST_PORT}"
  fi
  [ -n "$api_url" ] || return 0
  fe_rel="${FRONTEND_SUBDIR:-.}"
  echo "[preview] patching built frontend API base -> ${api_url}"
  for dir in build dist; do
    root="$ROOT/$fe_rel/$dir"
    [ -d "$root" ] || continue
    find "$root" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.map' \) 2>/dev/null | while read -r f; do
      sed -i "s|http://localhost:[0-9][0-9]*|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|http://127.0.0.1:[0-9][0-9]*|${api_url}|g" "$f" 2>/dev/null || true
      sed -i "s|https://localhost:[0-9][0-9]*|${api_url}|g" "$f" 2>/dev/null || true
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
  api_url="${PREVIEW_PUBLIC_API_URL:-}"
  if [ -z "$api_url" ] && [ -n "$PREVIEW_API_HOST_PORT" ]; then
    api_url="http://localhost:${PREVIEW_API_HOST_PORT}"
  fi
  patch_frontend_api_urls
  patch_built_bundle_urls
  if [ -n "$api_url" ]; then
    export VITE_API_URL="$api_url"
    export REACT_APP_API_URL="$api_url"
    export VITE_API_BASE_URL="$api_url"
    {
      echo "VITE_API_URL=${api_url}"
      echo "REACT_APP_API_URL=${api_url}"
      echo "VITE_API_BASE_URL=${api_url}"
      echo "GENERATE_SOURCEMAP=false"
    } > .env.local
    echo "[preview] wrote .env.local with API ${api_url}"
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

wait_for_spring_briefly() {
  max_wait="${PREVIEW_SPRING_WAIT_SECONDS:-90}"
  i=0
  echo "[preview] waiting up to ${max_wait}s for Spring API on :${API_PORT}…"
  while [ "$i" -lt "$max_wait" ]; do
    if tcp_port_open "$API_PORT"; then
      echo "[preview] Spring API is listening on :${API_PORT}"
      return 0
    fi
    # If the background Spring/Maven process already exited, diagnose immediately.
    if [ -n "${SPRING_BG_PID:-}" ] && ! kill -0 "$SPRING_BG_PID" 2>/dev/null; then
      echo "[preview] Spring/Maven process (PID ${SPRING_BG_PID}) exited before API port opened"
      diagnose_spring_startup_failures /tmp/preview-spring.log
      return 1
    fi
    i=$((i + 3))
    sleep 3
  done
  echo "[preview] WARN: Spring API not listening yet after ${max_wait}s — UI will start; API may still be compiling. Check /tmp/preview-spring.log"
  diagnose_spring_startup_failures /tmp/preview-spring.log
  return 1
}

hold_port_with_fallback

if [ "$PREVIEW_SPRING_MODE" = "1" ] && [ -n "$SPRING_SUBDIR" ] && [ -n "$FRONTEND_SUBDIR" ]; then
  echo "[preview] Spring+React mode spring=$SPRING_SUBDIR frontend=$FRONTEND_SUBDIR API=$API_PORT UI=$PORT public_api=${PREVIEW_PUBLIC_API_URL:-}"
  start_spring_backend_async || {
    echo "[preview] Spring start skipped — check /tmp/preview-spring.log"
    diagnose_spring_startup_failures /tmp/preview-spring.log
  }
  wait_for_spring_briefly || true
  run_react_frontend || serve_fallback_forever
fi

serve_fallback_forever
