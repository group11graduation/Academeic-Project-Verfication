#!/bin/sh
set -e

DOCROOT="/var/www/html"
LARAVEL_ROOT="$DOCROOT"
APACHE_DOCROOT="$DOCROOT"

find_laravel_root() {
  # Prefer APP_SUBDIR when it contains artisan / public/index.php
  if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ]; then
    if [ -f "$DOCROOT/$APP_SUBDIR/artisan" ] || [ -f "$DOCROOT/$APP_SUBDIR/public/index.php" ]; then
      echo "$DOCROOT/$APP_SUBDIR"
      return 0
    fi
  fi
  if [ -f "$DOCROOT/artisan" ] || [ -f "$DOCROOT/public/index.php" ]; then
    echo "$DOCROOT"
    return 0
  fi
  # Nested backend/api/laravel folders (common React + Laravel ZIPs)
  for cand in backend api laravel server app; do
    if [ -f "$DOCROOT/$cand/artisan" ] || [ -f "$DOCROOT/$cand/public/index.php" ]; then
      echo "$DOCROOT/$cand"
      return 0
    fi
  done
  # One-level scan for artisan
  for d in "$DOCROOT"/*; do
    [ -d "$d" ] || continue
    if [ -f "$d/artisan" ]; then
      echo "$d"
      return 0
    fi
  done
  echo "$DOCROOT"
}

configure_laravel_docroot() {
  LARAVEL_ROOT="$(find_laravel_root)"
  if [ -f "$LARAVEL_ROOT/public/index.php" ]; then
    APACHE_DOCROOT="$LARAVEL_ROOT/public"
  elif [ -f "$LARAVEL_ROOT/index.php" ]; then
    APACHE_DOCROOT="$LARAVEL_ROOT"
  else
    # Last resort: avoid empty ZIP root 403 — prefer any public/index.php
    if [ -f "$DOCROOT/public/index.php" ]; then
      APACHE_DOCROOT="$DOCROOT/public"
      LARAVEL_ROOT="$DOCROOT"
    fi
  fi

  echo "[preview] Laravel root → $LARAVEL_ROOT"
  echo "[preview] Apache DocumentRoot → $APACHE_DOCROOT"

  cat > /etc/apache2/sites-available/000-default.conf <<EOF
<VirtualHost *:80>
  ServerAdmin webmaster@localhost
  DocumentRoot ${APACHE_DOCROOT}
  <Directory ${APACHE_DOCROOT}>
    Options FollowSymLinks
    AllowOverride All
    Require all granted
  </Directory>
  # Allow reading project files outside public/ (vendor, storage, etc.)
  <Directory ${LARAVEL_ROOT}>
    Options FollowSymLinks
    AllowOverride All
    Require all granted
  </Directory>
  ErrorLog \${APACHE_LOG_DIR}/error.log
  CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF

  # Ensure Front Controller rewrite works even without .htaccess
  if [ ! -f "$APACHE_DOCROOT/.htaccess" ] && [ -f "$LARAVEL_ROOT/public/index.php" ]; then
    cat > "$APACHE_DOCROOT/.htaccess" <<'HTACCESS'
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
HTACCESS
  fi
}

write_laravel_env() {
  envfile="$LARAVEL_ROOT/.env"
  example="$LARAVEL_ROOT/.env.example"
  if [ ! -f "$envfile" ] && [ -f "$example" ]; then
    cp "$example" "$envfile"
    echo "[preview] created .env from .env.example"
  fi
  if [ ! -f "$envfile" ]; then
    cat > "$envfile" <<EOF
APP_NAME=ScholarVerifyPreview
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=${PREVIEW_BASE_URL:-http://localhost}
LOG_CHANNEL=stack
DB_CONNECTION=mysql
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=3306
DB_DATABASE=${DB_NAME:-laravel}
DB_USERNAME=${DB_USER:-root}
DB_PASSWORD=${DB_PASS:-preview-root}
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
EOF
    echo "[preview] wrote fresh Laravel .env"
  fi

  # Patch common Laravel DB / URL keys in place
  set_env_key() {
    key="$1"
    val="$2"
    if grep -qE "^${key}=" "$envfile" 2>/dev/null; then
      sed -i -E "s|^${key}=.*|${key}=${val}|" "$envfile"
    else
      printf '\n%s=%s\n' "$key" "$val" >> "$envfile"
    fi
  }

  [ -n "$DB_HOST" ] && set_env_key DB_HOST "$DB_HOST"
  [ -n "$DB_NAME" ] && set_env_key DB_DATABASE "$DB_NAME"
  [ -n "$DB_USER" ] && set_env_key DB_USERNAME "$DB_USER"
  [ -n "$DB_PASS" ] && set_env_key DB_PASSWORD "$DB_PASS"
  set_env_key DB_CONNECTION mysql
  set_env_key DB_PORT 3306
  if [ -n "$PREVIEW_BASE_URL" ]; then
    # Strip trailing slash for APP_URL
    app_url=$(echo "$PREVIEW_BASE_URL" | sed 's|/$||')
    set_env_key APP_URL "$app_url"
  fi
  set_env_key APP_ENV local
  set_env_key APP_DEBUG true
  set_env_key SESSION_DRIVER file
  set_env_key CACHE_STORE file
  set_env_key QUEUE_CONNECTION sync
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
      \$pdo->exec('CREATE DATABASE IF NOT EXISTS \`'.\$db.'\`');
      echo '[preview] ensured database ' . \$db . PHP_EOL;
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] ensure database failed: ' . \$e->getMessage() . PHP_EOL);
    }
  " || true
}

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
      \$roots = ['$LARAVEL_ROOT', '$LARAVEL_ROOT/database', '$LARAVEL_ROOT/sql', '$DOCROOT', '$DOCROOT/sql'];
      \$candidates = [];
      foreach (['database.sql', 'db.sql', 'schema.sql', 'dump.sql', 'data.sql'] as \$name) {
        foreach (\$roots as \$root) {
          \$p = \$root . '/' . \$name;
          if (is_file(\$p)) \$candidates[] = \$p;
        }
      }
      foreach (glob('$LARAVEL_ROOT/database/*.sql') ?: [] as \$p) \$candidates[] = \$p;
      foreach (glob('$DOCROOT/sql/*.sql') ?: [] as \$p) \$candidates[] = \$p;
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
        \$sql = preg_replace('/^\\s*CREATE\\s+DATABASE\\s+[^;]+;/im', '', \$sql);
        \$sql = preg_replace('/^\\s*USE\\s+[^;]+;/im', '', \$sql);
        \$parts = preg_split('/;\\s*/', \$sql);
        \$ok = 0; \$fail = 0;
        foreach (\$parts as \$stmt) {
          \$stmt = preg_replace('/^\\s*--[^\\n]*\$/m', '', \$stmt);
          \$stmt = preg_replace('/\\/\\*.*?\\*\\//s', '', \$stmt);
          \$stmt = trim(\$stmt);
          if (\$stmt === '') continue;
          try { \$pdo->exec(\$stmt); \$ok++; } catch (Throwable \$e) {
            \$fail++;
          }
        }
        echo '[preview] imported ' . basename(\$file) . \" (ok=\$ok fail=\$fail)\" . PHP_EOL;
      }
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] SQL import failed: ' . \$e->getMessage() . PHP_EOL);
    }
  " || true
}

run_composer_install() {
  if [ ! -f "$LARAVEL_ROOT/composer.json" ]; then
    return 0
  fi
  if [ -d "$LARAVEL_ROOT/vendor/laravel/framework" ]; then
    echo "[preview] vendor already present — skip composer install"
    return 0
  fi
  echo "[preview] composer install (Laravel)"
  (cd "$LARAVEL_ROOT" && composer install --no-interaction --prefer-dist --optimize-autoloader 2>&1) || \
    (cd "$LARAVEL_ROOT" && composer install --no-interaction --ignore-platform-reqs 2>&1) || true
}

build_frontend_assets() {
  # 1) Vite/React inside Laravel (resources/js + package.json)
  if [ -f "$LARAVEL_ROOT/package.json" ]; then
    echo "[preview] npm install + build (Laravel Vite assets)"
    (cd "$LARAVEL_ROOT" && npm install --no-audit --no-fund 2>&1) || true
    (cd "$LARAVEL_ROOT" && (npm run build || npm run production || true) 2>&1) || true
  fi

  # 2) Sibling React frontend (FRONTEND_SUBDIR or common folder names)
  fe=""
  if [ -n "$FRONTEND_SUBDIR" ] && [ -f "$DOCROOT/$FRONTEND_SUBDIR/package.json" ]; then
    fe="$DOCROOT/$FRONTEND_SUBDIR"
  else
    for cand in frontend client web ui react-app; do
      if [ -f "$DOCROOT/$cand/package.json" ] && [ "$DOCROOT/$cand" != "$LARAVEL_ROOT" ]; then
        fe="$DOCROOT/$cand"
        break
      fi
    done
  fi

  if [ -n "$fe" ] && [ -f "$fe/package.json" ]; then
    echo "[preview] npm install + build (React frontend: $fe)"
    (cd "$fe" && npm install --no-audit --no-fund 2>&1) || true
    (cd "$fe" && (npm run build || npm run production || true) 2>&1) || true
    # Copy built SPA into Laravel public so Apache serves it
    for out in dist build out; do
      if [ -d "$fe/$out" ] && [ -d "$APACHE_DOCROOT" ]; then
        echo "[preview] copying $fe/$out → $APACHE_DOCROOT/"
        cp -a "$fe/$out/." "$APACHE_DOCROOT/" 2>/dev/null || true
        break
      fi
    done
  fi
}

run_artisan_bootstrap() {
  [ -f "$LARAVEL_ROOT/artisan" ] || return 0
  cd "$LARAVEL_ROOT"
  mkdir -p storage/framework/{sessions,views,cache} storage/logs bootstrap/cache 2>/dev/null || true
  chmod -R 775 storage bootstrap/cache 2>/dev/null || true

  if ! grep -qE '^APP_KEY=base64:' .env 2>/dev/null; then
    echo "[preview] php artisan key:generate"
    php artisan key:generate --force 2>&1 || true
  fi

  echo "[preview] php artisan storage:link"
  php artisan storage:link 2>&1 || true

  if [ -n "$DB_HOST" ]; then
    echo "[preview] php artisan migrate --force"
    php artisan migrate --force 2>&1 || true
    echo "[preview] php artisan db:seed --force"
    php artisan db:seed --force 2>&1 || true
  fi
}

# --- main ---
configure_laravel_docroot

if [ -f /preview-bootstrap.php ]; then
  printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$DOCROOT/.user.ini"
  printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$APACHE_DOCROOT/.user.ini" 2>/dev/null || true
  export PREVIEW_SANDBOX=1
fi

write_laravel_env
run_composer_install

if [ -n "$DB_HOST" ]; then
  wait_for_mysql_server || true
  ensure_preview_database
  import_sql_dumps
fi

build_frontend_assets
run_artisan_bootstrap

if [ -n "$DB_HOST" ] && [ -f /preview-seed-admin.php ]; then
  echo "[preview] running preview-seed-admin.php (best-effort)"
  php /preview-seed-admin.php >> /tmp/preview-mysql.log 2>&1 || true
fi

chown -R www-data:www-data "$LARAVEL_ROOT" 2>/dev/null || true
echo "[preview] Apache listening on :80 (DocumentRoot=${APACHE_DOCROOT})"
exec apache2-foreground
