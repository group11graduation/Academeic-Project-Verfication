#!/bin/sh
set -e

DOCROOT="/var/www/html"
APACHE_DOCROOT="$DOCROOT"

#
# Prefer Apache DocumentRoot over copying a subfolder into /var/www/html.
# Copying public/ into the mount breaks require __DIR__ . '/../src/...' paths.
#
configure_php_docroot() {
  target=""
  if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ] && [ -d "$DOCROOT/$APP_SUBDIR" ]; then
    # Only use DocumentRoot for nested apps — never flatten via cp.
    if [ -f "$DOCROOT/$APP_SUBDIR/index.php" ] || [ -f "$DOCROOT/$APP_SUBDIR/index.html" ]; then
      target="$DOCROOT/$APP_SUBDIR"
    fi
  fi
  if [ -z "$target" ] && [ -f "$DOCROOT/public/index.php" ]; then
    if [ -d "$DOCROOT/src" ] || [ -d "$DOCROOT/app" ] || [ -d "$DOCROOT/includes" ]; then
      target="$DOCROOT/public"
    fi
  fi
  if [ -z "$target" ]; then
    return 0
  fi
  APACHE_DOCROOT="$target"
  echo "[preview] Apache DocumentRoot → $APACHE_DOCROOT (APP_SUBDIR=${APP_SUBDIR:-.})"
  cat > /etc/apache2/sites-available/000-default.conf <<EOF
<VirtualHost *:80>
  ServerAdmin webmaster@localhost
  DocumentRoot ${APACHE_DOCROOT}
  <Directory ${APACHE_DOCROOT}>
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
  </Directory>
  ErrorLog \${APACHE_LOG_DIR}/error.log
  CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF
}

configure_php_docroot

# Force PHP to load preview env overrides before any student script (works even for unknown config layouts).
if [ -f /preview-bootstrap.php ]; then
  printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$DOCROOT/.user.ini"
  if [ "$APACHE_DOCROOT" != "$DOCROOT" ]; then
    printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$APACHE_DOCROOT/.user.ini"
  fi
  export PREVIEW_SANDBOX=1
fi

patch_config_define() {
  file="$1"
  key="$2"
  value="$3"
  [ -f "$file" ] || return 0
  sed -i "s|define(['\"]${key}['\"][^)]*)|define('${key}', '${value}')|g" "$file" 2>/dev/null || true
}

patch_config_var() {
  file="$1"
  var="$2"
  value="$3"
  [ -f "$file" ] || return 0
  sed -i "s|\$${var}[[:space:]]*=[[:space:]]*['\"][^'\"]*['\"]|\$${var} = '${value}'|g" "$file" 2>/dev/null || true
}

patch_pdo_localhost() {
  file="$1"
  [ -f "$file" ] || return 0
  [ -n "$DB_HOST" ] || return 0
  sed -i "s|mysql:host=localhost|mysql:host=${DB_HOST}|g" "$file" 2>/dev/null || true
  sed -i "s|mysql:host=127.0.0.1|mysql:host=${DB_HOST}|g" "$file" 2>/dev/null || true
  # Refresh stale sidecar hostnames baked by a previous preview run
  sed -i -E "s|mysql:host=preview-mysql-[A-Za-z0-9]+|mysql:host=${DB_HOST}|g" "$file" 2>/dev/null || true
  # Prefer getenv so later restarts never keep a dead sidecar DNS name
  sed -i -E "s|mysqli_connect\(\s*['\"][^'\"]+['\"]|mysqli_connect(getenv('DB_HOST') ?: 'localhost'|g" "$file" 2>/dev/null || true
  sed -i -E "s|new mysqli\(\s*['\"][^'\"]+['\"]|new mysqli(getenv('DB_HOST') ?: 'localhost'|g" "$file" 2>/dev/null || true
  sed -i -E "s|new \\\\mysqli\(\s*['\"][^'\"]+['\"]|new \\\\mysqli(getenv('DB_HOST') ?: 'localhost'|g" "$file" 2>/dev/null || true
}

# Rewrite empty MySQL password only in new mysqli(..., '', ...) forms.
patch_mysqli_empty_password() {
  file="$1"
  [ -f "$file" ] || return 0
  [ -n "$DB_PASS" ] || return 0
  # new mysqli(getenv('DB_HOST') ?: 'localhost', 'user', '', 'db')
  sed -i -E "s|(new[[:space:]]+mysqli\(getenv\('DB_HOST'\)[[:space:]]*\?:[[:space:]]*'localhost',[[:space:]]*'[^']*',[[:space:]]*)''|\1'${DB_PASS}'|g" "$file" 2>/dev/null || true
  sed -i -E "s|(new[[:space:]]+mysqli\(getenv\('DB_HOST'\)[[:space:]]*\?:[[:space:]]*'localhost',[[:space:]]*\"[^\"]*\",[[:space:]]*)\"\"|\1\"${DB_PASS}\"|g" "$file" 2>/dev/null || true
}

# Returns 0 when the file looks like a setup/seed/bootstrap script (may seed app admins).
is_bootstrap_php_file() {
  base=$(basename "$1")
  echo "$base" | grep -qiE '^(setup|install|migrate|migration|seed|reset|upgrade|init)' && return 0
  echo "$1" | grep -qiE '/(setup|install|seed|reset|upgrade|migrate)[^/]*\.php$' && return 0
  return 1
}

patch_one_php_file() {
  file="$1"
  [ -f "$file" ] || return 0
  if [ -n "$PREVIEW_BASE_URL" ]; then
    patch_config_define "$file" BASE_URL "$PREVIEW_BASE_URL"
  fi
  if [ -n "$DB_HOST" ]; then
    patch_config_define "$file" DB_HOST "$DB_HOST"
    patch_config_define "$file" DB_NAME "${DB_NAME:-bbms}"
    patch_config_define "$file" DB_USER "${DB_USER:-root}"
    patch_config_define "$file" DB_PASS "${DB_PASS:-preview-root}"
    patch_config_var "$file" host "$DB_HOST"
    patch_config_var "$file" dbhost "$DB_HOST"
    patch_config_var "$file" db_host "$DB_HOST"
    patch_config_var "$file" dbname "${DB_NAME:-bbms}"
    patch_config_var "$file" database "${DB_NAME:-bbms}"
    patch_config_var "$file" dbuser "${DB_USER:-root}"
    patch_config_var "$file" db_user "${DB_USER:-root}"
    patch_config_var "$file" dbpass "${DB_PASS:-preview-root}"
    patch_config_var "$file" db_pass "${DB_PASS:-preview-root}"
    # Config/connection files use $username/$password for MySQL.
    # Setup/seed/reset scripts often use the same names for the APP admin — do not rewrite those.
    if ! is_bootstrap_php_file "$file"; then
      patch_config_var "$file" username "${DB_USER:-root}"
      patch_config_var "$file" user "${DB_USER:-root}"
      patch_config_var "$file" password "${DB_PASS:-preview-root}"
      patch_config_var "$file" pass "${DB_PASS:-preview-root}"
    fi
    patch_pdo_localhost "$file"
    patch_mysqli_empty_password "$file"
  fi
}

patch_php_tree() {
  dir="$1"
  depth="$2"
  [ -d "$dir" ] || return 0
  [ "$depth" -gt 4 ] && return 0
  for entry in "$dir"/*; do
    [ -e "$entry" ] || continue
    case "$(basename "$entry")" in
      node_modules|vendor|.git|assets|uploads|cache|tmp|temp|images|img|css|js|fonts) continue ;;
    esac
    if [ -f "$entry" ] && echo "$entry" | grep -q '\.php$'; then
      case "$entry" in
        *config*|*database*|*db*|*connection*|*setup*|*install*|*upgrade*|*reset*|*seed*|*migrate*)
          patch_one_php_file "$entry"
          ;;
      esac
    elif [ -d "$entry" ]; then
      case "$(basename "$entry")" in
        config|includes|inc|app|application|database|scripts|sql|src|public)
          patch_php_tree "$entry" $((depth + 1))
          ;;
      esac
    fi
  done
}

# Fix config.php broken by an older ScholarVerify injector that prepended <?php before files
# that already had <?php (parse error: unexpected token "<" on line ~18).
repair_sv_php_injection() {
  php -r '
    function sv_repair_preview_php_injection($path) {
      $c = @file_get_contents($path);
      if ($c === false || strpos($c, "ScholarVerify preview sandbox") === false) return false;
      $fixed = preg_replace(
        "/(\/\/ ScholarVerify preview sandbox[\s\S]*?\n\})\s*\n\s*<\?php\s*\n/i",
        "$1\n",
        $c,
        1
      );
      if ($fixed === null || $fixed === $c) return false;
      file_put_contents($path, $fixed);
      return true;
    }
    $n = 0;
    $roots = ["/var/www/html"];
    foreach ($roots as $root) {
      if (!is_dir($root)) continue;
      $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
      );
      foreach ($it as $f) {
        if (!$f->isFile() || strtolower($f->getExtension()) !== "php") continue;
        $name = $f->getFilename();
        if (!preg_match("/config|database|db|connection/i", $f->getPathname() . $name)) continue;
        if (sv_repair_preview_php_injection($f->getPathname())) $n++;
      }
    }
    if ($n > 0) echo "[preview] repaired {$n} PHP config file(s) — removed duplicate <?php\n";
  ' 2>/dev/null || true
}

patch_php_config() {
  if [ -z "$PREVIEW_BASE_URL" ] && [ -z "$DB_HOST" ]; then
    return 0
  fi
  repair_sv_php_injection
  echo "[preview] patching PHP config (BASE_URL=${PREVIEW_BASE_URL:-n/a}, DB_HOST=${DB_HOST:-n/a}, DB_NAME=${DB_NAME:-bbms})"
  patch_php_tree "$DOCROOT" 0
  if [ -f "$DOCROOT/setup_db.php" ] && [ -n "$DB_NAME" ]; then
    sed -i "s|USE[[:space:]]\+[\`'\"]\?[A-Za-z0-9_]\+[\`'\"]\?[[:space:]]*;|USE ${DB_NAME};|g" "$DOCROOT/setup_db.php" 2>/dev/null || true
  fi
}

fix_setup_use_in_script() {
  script="$1"
  [ -f "$script" ] || return 0
  [ -n "$DB_NAME" ] || return 0

  # Literal USE dbname; inside SQL strings (legacy / simple typos)
  sed -i "s|exec(\"USE[^\"]*\"|exec(\"USE ${DB_NAME}\"|g" "$script" 2>/dev/null || true
  sed -i "s|exec('USE[^']*'|exec('USE ${DB_NAME}'|g" "$script" 2>/dev/null || true
  sed -i "s|USE[[:space:]]\+[\`'\"]\?[A-Za-z0-9_]\+[\`'\"]\?[[:space:]]*;|USE ${DB_NAME};|g" "$script" 2>/dev/null || true

  # Broken USE + DB_NAME / $dbname inside ->exec() / ->query() (concat / interpolation typos)
  fix_use_db_call() {
    method="$1"
    # "USE …" . DB_NAME . SOMETHING  →  "USE " . DB_NAME
    sed -i -E \
      "s|->${method}\\([[:space:]]*[\"']USE [^\"']*[\"'][[:space:]]*\\.[[:space:]]*DB_NAME[[:space:]]*\\.[[:space:]]*[^)]*\\)|->${method}(\"USE \" . DB_NAME)|g" \
      "$script" 2>/dev/null || true
    # "USE anything" . DB_NAME  →  "USE " . DB_NAME
    sed -i -E \
      "s|->${method}\\([[:space:]]*[\"']USE [^\"']*[\"'][[:space:]]*\\.[[:space:]]*DB_NAME[[:space:]]*\\)|->${method}(\"USE \" . DB_NAME)|g" \
      "$script" 2>/dev/null || true
    # "USE …" . $dbname . SOMETHING  →  "USE " . DB_NAME
    sed -i -E \
      "s|->${method}\\([[:space:]]*[\"']USE [^\"']*[\"'][[:space:]]*\\.[[:space:]]*\\\$dbname[[:space:]]*\\.[[:space:]]*[^)]*\\)|->${method}(\"USE \" . DB_NAME)|g" \
      "$script" 2>/dev/null || true
    # "USE anything" . $dbname  →  "USE " . DB_NAME
    sed -i -E \
      "s|->${method}\\([[:space:]]*[\"']USE [^\"']*[\"'][[:space:]]*\\.[[:space:]]*\\\$dbname[[:space:]]*\\)|->${method}(\"USE \" . DB_NAME)|g" \
      "$script" 2>/dev/null || true
    # "USE anything$dbname" / "USE anything$DB_NAME" (double-quoted interpolation)  →  "USE " . DB_NAME
    sed -i -E \
      "s|->${method}\\([[:space:]]*[\"']USE [^\"']*\\\$dbname[^\"']*[\"']\\)|->${method}(\"USE \" . DB_NAME)|g" \
      "$script" 2>/dev/null || true
    sed -i -E \
      "s|->${method}\\([[:space:]]*[\"']USE [^\"']*\\\$DB_NAME[^\"']*[\"']\\)|->${method}(\"USE \" . DB_NAME)|g" \
      "$script" 2>/dev/null || true
  }
  fix_use_db_call exec
  fix_use_db_call query
}

ensure_preview_database() {
  [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] || return 0
  php -r "
    try {
      \$host = getenv('DB_HOST');
      \$db = preg_replace('/[^a-zA-Z0-9_]/', '', getenv('DB_NAME') ?: '');
      if (!\$db) exit(0);
      \$user = getenv('DB_USER') ?: 'root';
      \$pass = getenv('DB_PASS') ?: '';
      \$pdo = new PDO('mysql:host=' . \$host, \$user, \$pass, [PDO::ATTR_TIMEOUT => 2]);
      \$pdo->exec('CREATE DATABASE IF NOT EXISTS ' . \$db);
      echo '[preview] ensured database ' . \$db . PHP_EOL;
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] ensure database failed: ' . \$e->getMessage() . PHP_EOL);
      exit(1);
    }
  " || true
}

# Import student SQL dumps when the target DB still has zero tables.
import_sql_dumps() {
  [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] || return 0
  php -r "
    try {
      \$host = getenv('DB_HOST');
      \$db = preg_replace('/[^a-zA-Z0-9_]/', '', getenv('DB_NAME') ?: '');
      if (!\$db) exit(0);
      \$user = getenv('DB_USER') ?: 'root';
      \$pass = getenv('DB_PASS') ?: '';
      \$pdo = new PDO('mysql:host=' . \$host . ';dbname=' . \$db, \$user, \$pass, [
        PDO::ATTR_TIMEOUT => 5,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      ]);
      \$tables = \$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
      if (count(\$tables) > 0) {
        echo '[preview] skip SQL import — ' . count(\$tables) . ' table(s) already present' . PHP_EOL;
        exit(0);
      }
      \$roots = ['/var/www/html', '/var/www/html/sql', '/var/www/html/database', '/var/www/html/db'];
      \$candidates = [];
      foreach (['database.sql', 'db.sql', 'schema.sql', 'dump.sql', 'data.sql'] as \$name) {
        foreach (\$roots as \$root) {
          \$p = \$root . '/' . \$name;
          if (is_file(\$p)) \$candidates[] = \$p;
        }
      }
      foreach (glob('/var/www/html/sql/*.sql') ?: [] as \$p) \$candidates[] = \$p;
      foreach (glob('/var/www/html/database/*.sql') ?: [] as \$p) \$candidates[] = \$p;
      \$candidates = array_values(array_unique(\$candidates));
      if (!\$candidates) {
        echo '[preview] no SQL dump files found to import' . PHP_EOL;
        exit(0);
      }
      foreach (\$candidates as \$file) {
        \$sql = file_get_contents(\$file);
        if (\$sql === false || trim(\$sql) === '') continue;
        \$sql = preg_replace('/DELIMITER\\s+\\S+/i', '', \$sql);
        \$sql = preg_replace('/CREATE\\s+DEFINER=[^\\s]+\\s+/i', 'CREATE ', \$sql);
        // Already connected to $db — drop CREATE DATABASE / USE so student dumps still apply.
        \$sql = preg_replace('/^\\s*CREATE\\s+DATABASE\\s+[^;]+;/im', '', \$sql);
        \$sql = preg_replace('/^\\s*USE\\s+[^;]+;/im', '', \$sql);
        // Simple split — student dumps rarely embed ; inside statements. (Do NOT use /…/\\*/…/
        // lookaheads; the /\\* terminates a /…/ regex and yields 0 statements.)
        \$parts = preg_split('/;\\s*/', \$sql);
        \$ok = 0; \$fail = 0;
        foreach (\$parts as \$stmt) {
          // Strip full-line SQL comments; do NOT skip just because a comment precedes CREATE TABLE.
          \$stmt = preg_replace('/^\\s*--[^\\n]*$/m', '', \$stmt);
          \$stmt = preg_replace('/\\/\\*.*?\\*\\//s', '', \$stmt);
          \$stmt = trim(\$stmt);
          if (\$stmt === '') continue;
          try { \$pdo->exec(\$stmt); \$ok++; } catch (Throwable \$e) {
            \$fail++;
            fwrite(STDERR, '[preview] SQL stmt fail: ' . substr(\$e->getMessage(), 0, 160) . PHP_EOL);
          }
        }
        echo '[preview] imported ' . basename(\$file) . \" (ok=\$ok fail=\$fail)\" . PHP_EOL;
      }
      \$tables = \$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
      echo '[preview] database ' . \$db . ' now has ' . count(\$tables) . ' table(s)' . PHP_EOL;
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] SQL import failed: ' . \$e->getMessage() . PHP_EOL);
    }
  " || true
}

# XAMPP-style absolute asset prefixes (/project-name/assets/...) break on preview root.
# Rewrite to /assets/... and add Apache Alias as a safety net.
patch_xampp_asset_prefixes() {
  prefixes=$(
    find "$DOCROOT" -maxdepth 4 -type f \( -name '*.php' -o -name '*.html' -o -name '*.css' -o -name '*.js' \) 2>/dev/null \
      | head -200 \
      | xargs grep -ohE '["'"'"']/[A-Za-z0-9_-]+/(assets|css|js|images|img|static|uploads)/' 2>/dev/null \
      | sed -E "s|^['\"]/||; s|/(assets|css|js|images|img|static|uploads)/.*||" \
      | sort -u || true
  )
  [ -n "$prefixes" ] || return 0
  for prefix in $prefixes; do
    case "$prefix" in
      var|usr|etc|tmp|home|root|app|api|auth|admin|user|users|public|src|vendor|node_modules) continue ;;
    esac
    echo "[preview] rewriting XAMPP asset prefix /$prefix/ → /"
    find "$DOCROOT" -maxdepth 5 -type f \( -name '*.php' -o -name '*.html' -o -name '*.css' -o -name '*.js' \) 2>/dev/null \
      | while read -r f; do
          sed -i "s|/$prefix/|/|g" "$f" 2>/dev/null || true
        done
    conf="/etc/apache2/conf-enabled/sv-preview-alias-${prefix}.conf"
    printf 'Alias /%s %s\n<Directory %s>\n  AllowOverride All\n  Require all granted\n</Directory>\n' \
      "$prefix" "$DOCROOT" "$DOCROOT" > "$conf"
  done
}

run_bootstrap_scripts() {
  [ -n "$DB_HOST" ] || return 0
  for pattern in setup_db.php upgrade_db.php reset_admin.php install.php database/setup.php scripts/setup.php; do
    script="$DOCROOT/$pattern"
    [ -f "$script" ] || continue
    fix_setup_use_in_script "$script"
    echo "[preview] running $(basename "$script")"
    php "$script" >> /tmp/preview-mysql.log 2>&1 || true
  done
  find "$DOCROOT" -maxdepth 3 -type f -name '*.php' 2>/dev/null | while read -r script; do
    base=$(basename "$script")
    case "$base" in
      setup*|install*|upgrade*|reset*|seed*|migrate*|init*)
        echo "$script" | grep -qiE 'setup|install|upgrade|reset|seed|migrate|init' || continue
        fix_setup_use_in_script "$script"
        echo "[preview] running bootstrap $base"
        php "$script" >> /tmp/preview-mysql.log 2>&1 || true
        ;;
    esac
  done
}

check_bootstrap_tables() {
  [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] || return 0
  php -r "
    try {
      \$host = getenv('DB_HOST');
      \$db = preg_replace('/[^a-zA-Z0-9_]/', '', getenv('DB_NAME') ?: '');
      if (!\$db) exit(0);
      \$user = getenv('DB_USER') ?: 'root';
      \$pass = getenv('DB_PASS') ?: '';
      \$pdo = new PDO(
        'mysql:host=' . \$host . ';dbname=' . \$db,
        \$user,
        \$pass,
        [PDO::ATTR_TIMEOUT => 3]
      );
      \$rows = \$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
      if (count(\$rows) === 0) {
        fwrite(
          STDERR,
          '[preview] WARNING: no tables found in database after bootstrap scripts ran — student'\''s setup script may have failed'
          . PHP_EOL
        );
        exit(0);
      }
      echo '[preview] database ' . \$db . ' has ' . count(\$rows) . ' table(s)' . PHP_EOL;
    } catch (Throwable \$e) {
      fwrite(
        STDERR,
        '[preview] WARNING: could not verify tables after bootstrap: ' . \$e->getMessage() . PHP_EOL
      );
    }
  " || true
}

wait_for_mysql_server() {
  [ -n "$DB_HOST" ] || return 0
  n=0
  while [ "$n" -lt 60 ]; do
    if php -r "
      try {
        new PDO(
          'mysql:host=${DB_HOST}',
          '${DB_USER:-root}',
          '${DB_PASS:-preview-root}',
          [PDO::ATTR_TIMEOUT => 2]
        );
        exit(0);
      } catch (Throwable \$e) {
        exit(1);
      }
    " 2>/dev/null; then
      echo "[preview] MySQL server ready at ${DB_HOST}"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  echo "[preview] MySQL server not reachable"
  return 1
}

wait_for_mysql() {
  [ -n "$DB_HOST" ] || return 0
  n=0
  while [ "$n" -lt 60 ]; do
    if php -r "
      try {
        new PDO(
          'mysql:host=${DB_HOST};dbname=${DB_NAME:-bbms}',
          '${DB_USER:-root}',
          '${DB_PASS:-preview-root}',
          [PDO::ATTR_TIMEOUT => 2]
        );
        exit(0);
      } catch (Throwable \$e) {
        exit(1);
      }
    " 2>/dev/null; then
      echo "[preview] MySQL ready at ${DB_HOST}"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  echo "[preview] MySQL not ready — app pages may fail until DB is up"
  return 1
}

patch_php_config
patch_xampp_asset_prefixes

if [ -f "$DOCROOT/composer.json" ]; then
  if command -v composer >/dev/null 2>&1; then
    echo "[preview] composer install"
    (cd "$DOCROOT" && composer install --no-interaction --no-dev 2>/dev/null) || true
  fi
fi

if [ -n "$DB_HOST" ]; then
  wait_for_mysql_server || true
  ensure_preview_database
  import_sql_dumps
  run_bootstrap_scripts
  # Import again if bootstrap created empty schema only / failed
  import_sql_dumps
  check_bootstrap_tables
  wait_for_mysql || true
  if [ -f /preview-seed-admin.php ]; then
    echo "[preview] running preview-seed-admin.php"
    # Retry: bootstrap may create tables a few seconds after scripts return.
    n=0
    while [ "$n" -lt 5 ]; do
      if php /preview-seed-admin.php >> /tmp/preview-mysql.log 2>&1; then
        echo "[preview] preview-seed-admin.php OK"
        break
      fi
      n=$((n + 1))
      echo "[preview] preview-seed-admin.php retry $n/5"
      sleep 3
    done
    # Surface seed result into Apache/container logs
    grep -E 'seed-admin:|ScholarVerify admin seeded' /tmp/preview-mysql.log 2>/dev/null | tail -20 || true
  fi
fi

chown -R www-data:www-data "$DOCROOT" 2>/dev/null || true
echo "[preview] Apache listening on :80 (DocumentRoot=${APACHE_DOCROOT})"
exec apache2-foreground
