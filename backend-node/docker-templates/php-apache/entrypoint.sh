#!/bin/sh
set -e

DOCROOT="/var/www/html"

if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ] && [ -d "$DOCROOT/$APP_SUBDIR" ]; then
  echo "[preview] Promoting PHP files from $APP_SUBDIR into Apache docroot"
  cp -a "$DOCROOT/$APP_SUBDIR/." "$DOCROOT/" 2>/dev/null || true
fi

# Force PHP to load preview env overrides before any student script (works even for unknown config layouts).
if [ -f /preview-bootstrap.php ]; then
  printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$DOCROOT/.user.ini"
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
  sed -i "s|mysqli_connect('localhost'|mysqli_connect('${DB_HOST}'|g" "$file" 2>/dev/null || true
  sed -i "s|mysqli_connect(\"localhost\"|mysqli_connect(\"${DB_HOST}\"|g" "$file" 2>/dev/null || true
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
    patch_config_var "$file" username "${DB_USER:-root}"
    patch_config_var "$file" user "${DB_USER:-root}"
    patch_config_var "$file" password "${DB_PASS:-preview-root}"
    patch_config_var "$file" pass "${DB_PASS:-preview-root}"
    patch_config_var "$file" dbname "${DB_NAME:-bbms}"
    patch_config_var "$file" database "${DB_NAME:-bbms}"
    patch_pdo_localhost "$file"
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
        config|includes|inc|app|application|database|scripts|sql)
          patch_php_tree "$entry" $((depth + 1))
          ;;
      esac
    fi
  done
}

patch_php_config() {
  if [ -z "$PREVIEW_BASE_URL" ] && [ -z "$DB_HOST" ]; then
    return 0
  fi
  echo "[preview] patching PHP config (BASE_URL=${PREVIEW_BASE_URL:-n/a}, DB_HOST=${DB_HOST:-n/a}, DB_NAME=${DB_NAME:-bbms})"
  patch_php_tree "$DOCROOT" 0
  if [ -f "$DOCROOT/setup_db.php" ] && [ -n "$DB_NAME" ]; then
    sed -i "s|USE[[:space:]]\+[`'\"]\?[A-Za-z0-9_]\+[`'\"]\?[[:space:]]*;|USE ${DB_NAME};|g" "$DOCROOT/setup_db.php" 2>/dev/null || true
  fi
}

fix_setup_use_in_script() {
  script="$1"
  [ -f "$script" ] || return 0
  [ -n "$DB_NAME" ] || return 0
  sed -i "s|exec(\"USE[^\"]*\"|exec(\"USE ${DB_NAME}\"|g" "$script" 2>/dev/null || true
  sed -i "s|exec('USE[^']*'|exec('USE ${DB_NAME}'|g" "$script" 2>/dev/null || true
  sed -i "s|USE[[:space:]]\+[`'\"]\?[A-Za-z0-9_]\+[`'\"]\?[[:space:]]*;|USE ${DB_NAME};|g" "$script" 2>/dev/null || true
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

if [ -f "$DOCROOT/composer.json" ]; then
  if command -v composer >/dev/null 2>&1; then
    echo "[preview] composer install"
    (cd "$DOCROOT" && composer install --no-interaction --no-dev 2>/dev/null) || true
  fi
fi

if [ -n "$DB_HOST" ]; then
  wait_for_mysql_server || true
  ensure_preview_database
  run_bootstrap_scripts
  wait_for_mysql || true
fi

chown -R www-data:www-data "$DOCROOT" 2>/dev/null || true
echo "[preview] Apache listening on :80"
exec apache2-foreground
