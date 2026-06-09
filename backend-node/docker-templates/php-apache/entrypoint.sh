#!/bin/sh
set -e

DOCROOT="/var/www/html"

if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ] && [ -d "$DOCROOT/$APP_SUBDIR" ]; then
  echo "[preview] Promoting PHP files from $APP_SUBDIR into Apache docroot"
  cp -a "$DOCROOT/$APP_SUBDIR/." "$DOCROOT/" 2>/dev/null || true
fi

patch_config_define() {
  file="$1"
  key="$2"
  value="$3"
  [ -f "$file" ] || return 0
  sed -i "s|define(['\"]${key}['\"][^)]*)|define('${key}', '${value}')|g" "$file" 2>/dev/null || true
}

patch_php_config() {
  if [ -z "$PREVIEW_BASE_URL" ] && [ -z "$DB_HOST" ]; then
    return 0
  fi
  echo "[preview] patching PHP config (BASE_URL=${PREVIEW_BASE_URL:-n/a})"
  for cfg in "$DOCROOT/includes/config.php" "$DOCROOT/config.php" "$DOCROOT/inc/config.php"; do
    [ -f "$cfg" ] || continue
    if [ -n "$PREVIEW_BASE_URL" ]; then
      patch_config_define "$cfg" BASE_URL "$PREVIEW_BASE_URL"
    fi
    if [ -n "$DB_HOST" ]; then
      patch_config_define "$cfg" DB_HOST "$DB_HOST"
      patch_config_define "$cfg" DB_NAME "${DB_NAME:-bbms}"
      patch_config_define "$cfg" DB_USER "${DB_USER:-preview}"
      patch_config_define "$cfg" DB_PASS "${DB_PASS:-preview}"
    fi
  done
}

wait_for_mysql() {
  [ -n "$DB_HOST" ] || return 0
  n=0
  while [ "$n" -lt 60 ]; do
    if php -r "
      try {
        new PDO(
          'mysql:host=${DB_HOST};dbname=${DB_NAME:-bbms}',
          '${DB_USER:-preview}',
          '${DB_PASS:-preview}',
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
  wait_for_mysql || true
  if [ -f "$DOCROOT/setup_db.php" ]; then
    echo "[preview] running setup_db.php"
    php "$DOCROOT/setup_db.php" >> /tmp/preview-mysql.log 2>&1 || true
  fi
  if [ -f "$DOCROOT/upgrade_db.php" ]; then
    echo "[preview] running upgrade_db.php"
    php "$DOCROOT/upgrade_db.php" >> /tmp/preview-mysql.log 2>&1 || true
  fi
  if [ -f "$DOCROOT/reset_admin.php" ]; then
    echo "[preview] running reset_admin.php"
    php "$DOCROOT/reset_admin.php" >> /tmp/preview-mysql.log 2>&1 || true
  fi
fi

chown -R www-data:www-data "$DOCROOT" 2>/dev/null || true
echo "[preview] Apache listening on :80"
exec apache2-foreground
