#!/bin/sh
set -e

DOCROOT="/var/www/html"

if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ] && [ -d "$DOCROOT/$APP_SUBDIR" ]; then
  echo "[preview] Promoting PHP files from $APP_SUBDIR into Apache docroot"
  cp -a "$DOCROOT/$APP_SUBDIR/." "$DOCROOT/" 2>/dev/null || true
fi

if [ -f "$DOCROOT/composer.json" ]; then
  if command -v composer >/dev/null 2>&1; then
    echo "[preview] composer install"
    (cd "$DOCROOT" && composer install --no-interaction --no-dev 2>/dev/null) || true
  fi
fi

chown -R www-data:www-data "$DOCROOT" 2>/dev/null || true
echo "[preview] Apache listening on :80"
exec apache2-foreground
