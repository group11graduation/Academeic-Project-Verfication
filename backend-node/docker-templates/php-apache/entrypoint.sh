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
    if [ -f "$DOCROOT/$APP_SUBDIR/index.php" ] || [ -f "$DOCROOT/$APP_SUBDIR/index.html" ] \
      || [ -f "$DOCROOT/$APP_SUBDIR/admin/index.php" ] || [ -d "$DOCROOT/$APP_SUBDIR/includes" ]; then
      target="$DOCROOT/$APP_SUBDIR"
    fi
  fi
  if [ -z "$target" ] && [ -f "$DOCROOT/public/index.php" ]; then
    if [ -d "$DOCROOT/src" ] || [ -d "$DOCROOT/app" ] || [ -d "$DOCROOT/includes" ]; then
      target="$DOCROOT/public"
    fi
  fi
  # ZIP with a single nested app folder (tms/, hostel/, …) and no APP_SUBDIR.
  if [ -z "$target" ]; then
    count=0
    pick=""
    for d in "$DOCROOT"/*; do
      [ -d "$d" ] || continue
      base=$(basename "$d")
      case "$base" in
        vendor|node_modules|assets|uploads|cache|tmp|temp|images|img|css|js|fonts|.git) continue ;;
      esac
      if [ -f "$d/includes/config.php" ] || [ -d "$d/includes" ] || [ -f "$d/admin/index.php" ]; then
        if [ -f "$d/index.php" ] || [ -f "$d/admin/index.php" ] || [ -f "$d/includes/config.php" ]; then
          count=$((count + 1))
          pick="$d"
        fi
      fi
    done
    if [ "$count" -eq 1 ] && [ -n "$pick" ]; then
      target="$pick"
      echo "[preview] auto-detected nested PHP app → $target"
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
  # Force sandbox bootstrap for every PHP request (more reliable than .user.ini alone).
  <IfModule mod_php.c>
    php_admin_value auto_prepend_file /preview-bootstrap.php
  </IfModule>
  <IfModule mod_php8.c>
    php_admin_value auto_prepend_file /preview-bootstrap.php
  </IfModule>
  ErrorLog \${APACHE_LOG_DIR}/error.log
  CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF
}

# Always ensure Apache loads the sandbox bootstrap (even when DocumentRoot stays /var/www/html).
ensure_apache_auto_prepend() {
  # Most reliable on official php:*-apache images — applies to every request.
  if [ -d /usr/local/etc/php/conf.d ]; then
    printf 'auto_prepend_file=/preview-bootstrap.php\n' > /usr/local/etc/php/conf.d/zz-sv-preview-prepend.ini
    # Hide PHP 8 undefined-key warnings that break CSS in student ZIPs (TMS header.php).
    cat > /usr/local/etc/php/conf.d/zz-sv-preview-quiet.ini <<'EOF'
display_errors=Off
display_startup_errors=Off
error_reporting=E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED & ~E_STRICT
EOF
    echo "[preview] php.ini auto_prepend_file → /preview-bootstrap.php"
  fi
  conf="/etc/apache2/conf-enabled/sv-preview-prepend.conf"
  cat > "$conf" <<'EOF'
<IfModule mod_php.c>
  php_admin_value auto_prepend_file /preview-bootstrap.php
</IfModule>
<IfModule mod_php8.c>
  php_admin_value auto_prepend_file /preview-bootstrap.php
</IfModule>
EOF
}

# Locate the real DB config and ensure includes/config.php exists where admin/index.php expects it.
# Fixes TMS: include(__DIR__.'/../includes/config.php') when the ZIP uses another path/name.
ensure_config_include_shims() {
  root="${1:-$APACHE_DOCROOT}"
  [ -d "$root" ] || return 0
  php -r "
    \$roots = array_values(array_unique(array_filter([
      getenv('APACHE_DOCROOT') ?: '',
      '$root',
      '/var/www/html',
      (getenv('APP_SUBDIR') && getenv('APP_SUBDIR') !== '.') ? ('/var/www/html/' . getenv('APP_SUBDIR')) : '',
    ])));
    foreach (glob('/var/www/html/*', GLOB_ONLYDIR) ?: [] as \$d) \$roots[] = \$d;

    \$preferredNames = [
      'config.php', 'dbconnection.php', 'db.php', 'connection.php', 'connect.php',
      'database.php', 'conn.php', 'dbh.php', 'pdo.php',
    ];
    \$preferredDirs = ['includes', 'include', 'config', 'inc', 'lib', 'admin/includes', 'admin/include'];

    \$candidates = [];
    foreach (array_unique(\$roots) as \$base) {
      if (!\$base || !is_dir(\$base)) continue;
      foreach (\$preferredDirs as \$dir) {
        foreach (\$preferredNames as \$name) {
          \$p = \$base . '/' . \$dir . '/' . \$name;
          if (is_file(\$p)) \$candidates[] = \$p;
        }
        \$p = \$base . '/' . \$dir . '/config.php';
        if (is_file(\$p)) \$candidates[] = \$p;
      }
      foreach (\$preferredNames as \$name) {
        \$p = \$base . '/' . \$name;
        if (is_file(\$p)) \$candidates[] = \$p;
      }
      // Light recursive search for *config*.php / *connection*.php
      try {
        \$it = new RecursiveIteratorIterator(
          new RecursiveDirectoryIterator(\$base, FilesystemIterator::SKIP_DOTS)
        );
        \$n = 0;
        foreach (\$it as \$f) {
          if (\$n > 120) break;
          if (!\$f->isFile() || strtolower(\$f->getExtension()) !== 'php') continue;
          \$path = \$f->getPathname();
          \$baseName = strtolower(\$f->getFilename());
          if (preg_match('#/(vendor|node_modules|\\.git)/#', \$path)) continue;
          if (!preg_match('/config|connection|connect|database|dbconnection|dbh|pdo/i', \$baseName . \$path)) continue;
          // Prefer files that look like DB bootstrap
          \$c = @file_get_contents(\$path);
          if (\$c === false) continue;
          if (!preg_match('/mysqli|PDO|mysql:host|DB_HOST|new PDO|mysqli_connect/i', \$c)) continue;
          \$candidates[] = \$path;
          \$n++;
        }
      } catch (Throwable \$e) { /* ignore */ }
    }
    \$candidates = array_values(array_unique(\$candidates));
    \$generated = '/preview-generated-config.php';
    if (!\$candidates && is_file(\$generated)) {
      \$candidates[] = \$generated;
    }
    if (!\$candidates) {
      fwrite(STDERR, '[preview] WARN: no DB config.php candidate found under project' . PHP_EOL);
      exit(0);
    }

    // Prefer classic includes/config.php if present; else generated; else first candidate.
    \$best = \$candidates[0];
    foreach (\$candidates as \$p) {
      if (preg_match('#/includes/config\\.php\$#i', \$p)) { \$best = \$p; break; }
      if (preg_match('#/include/config\\.php\$#i', \$p)) { \$best = \$p; }
    }
    if (\$best !== \$generated && is_file(\$generated)) {
      // Keep generated as ultimate fallback inside shim.
    }
    echo '[preview] DB config source → ' . \$best . PHP_EOL;

    \$shimTargets = [];
    foreach (array_unique(\$roots) as \$base) {
      if (!\$base || !is_dir(\$base)) continue;
      \$shimTargets[] = \$base . '/includes/config.php';
      \$shimTargets[] = \$base . '/include/config.php';
      if (is_dir(\$base . '/admin')) {
        \$shimTargets[] = \$base . '/admin/includes/config.php';
      }
    }

    foreach (array_unique(\$shimTargets) as \$shim) {
      if (is_file(\$shim) && filesize(\$shim) > 40 && strpos((string)@file_get_contents(\$shim), 'ScholarVerify preview config shim') === false) {
        // Real student config — leave alone.
        continue;
      }
      \$dir = dirname(\$shim);
      if (!is_dir(\$dir)) {
        @mkdir(\$dir, 0755, true);
      }
      \$code = \"<?php\\n/* ScholarVerify preview config shim */\\n\"
        . \"if (is_file(\" . var_export(\$best, true) . \")) { require_once \" . var_export(\$best, true) . \"; }\\n\"
        . \"elseif (is_file('/preview-generated-config.php')) { require_once '/preview-generated-config.php'; }\\n\";
      if (@file_put_contents(\$shim, \$code) !== false) {
        echo '[preview] wrote config shim → ' . \$shim . PHP_EOL;
      }
    }

    // Rewrite broken admin includes that point at missing ../includes/config.php
    foreach (array_unique(\$roots) as \$base) {
      if (!\$base || !is_dir(\$base . '/admin')) continue;
      foreach (glob(\$base . '/admin/*.php') ?: [] as \$f) {
        \$body = @file_get_contents(\$f);
        if (!is_string(\$body) || \$body === '') continue;
        if (strpos(\$body, '/preview-generated-config.php') !== false) continue;
        if (!preg_match('/includes\\/config\\.php/', \$body)) continue;
        \$next = preg_replace(
          '/(include_once|require_once|include|require)\\s*\\(\\s*__DIR__\\s*\\.\\s*[\'\"]\\/\\.\\.\\/includes\\/config\\.php[\'\"]\\s*\\)\\s*;/i',
          \"require_once '/preview-generated-config.php';\",
          \$body,
          1
        );
        \$next = preg_replace(
          '/(include_once|require_once|include|require)\\s*\\(\\s*[\'\"]includes\\/config\\.php[\'\"]\\s*\\)\\s*;/i',
          \"require_once '/preview-generated-config.php';\",
          \$next,
          1
        );
        if (is_string(\$next) && \$next !== \$body) {
          if (@file_put_contents(\$f, \$next) !== false) {
            echo '[preview] rewrote config include in ' . basename(\$f) . PHP_EOL;
          }
        }
      }
    }
  " || true
}

# Do NOT rewrite student includes to __DIR__/../… unless that path already exists.
# Earlier rewrites broke TMS when includes/config.php was missing / named differently.
patch_relative_includes() {
  root="${1:-$APACHE_DOCROOT}"
  [ -d "$root" ] || return 0
  # Ensure shims first so both CWD-relative and __DIR__/../ forms work.
  ensure_config_include_shims "$root"
  if [ ! -f "$root/includes/config.php" ]; then
    echo "[preview] skip include rewrite — $root/includes/config.php still missing"
    return 0
  fi
  for sub in admin user student teacher staff dashboard modules; do
    [ -d "$root/$sub" ] || continue
    find "$root/$sub" -maxdepth 2 -type f -name '*.php' 2>/dev/null | while read -r f; do
      if grep -qE "include(_once)?\s*\(\s*['\"]includes/" "$f" 2>/dev/null \
        || grep -qE "require(_once)?\s*\(\s*['\"]includes/" "$f" 2>/dev/null; then
        if grep -q "__DIR__" "$f" 2>/dev/null; then
          continue
        fi
        sed -i -E \
          -e "s/(include_once|require_once|include|require)[[:space:]]*\([[:space:]]*['\"]includes\//\\1(__DIR__ . '\/..\/includes\//g" \
          "$f" 2>/dev/null || true
        echo "[preview] patched relative includes in ${f#$root/}"
      fi
    done
  done
}

configure_php_docroot
ensure_apache_auto_prepend

# Exported for SQL import / bootstrap (nested apps like /var/www/html/hostel).
export APACHE_DOCROOT
export APP_SUBDIR

# Force PHP to load preview env overrides before any student script (works even for unknown config layouts).
if [ -f /preview-bootstrap.php ]; then
  printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$DOCROOT/.user.ini"
  if [ "$APACHE_DOCROOT" != "$DOCROOT" ]; then
    printf 'auto_prepend_file=/preview-bootstrap.php\n' > "$APACHE_DOCROOT/.user.ini"
  fi
  export PREVIEW_SANDBOX=1
fi

ensure_config_include_shims "$APACHE_DOCROOT"
ensure_config_include_shims "$DOCROOT"
patch_relative_includes "$APACHE_DOCROOT"
if [ "$APACHE_DOCROOT" != "$DOCROOT" ]; then
  patch_relative_includes "$DOCROOT"
fi

# Roots that contain the real PHP app + SQL dumps (handles APP_SUBDIR=hostel).
preview_app_roots() {
  echo "$DOCROOT"
  if [ -n "$APACHE_DOCROOT" ] && [ "$APACHE_DOCROOT" != "$DOCROOT" ]; then
    echo "$APACHE_DOCROOT"
  fi
  if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ] && [ -d "$DOCROOT/$APP_SUBDIR" ]; then
    echo "$DOCROOT/$APP_SUBDIR"
  fi
  # One-level nested project folders (ZIP with a single app dir).
  for d in "$DOCROOT"/*; do
    [ -d "$d" ] || continue
    case "$(basename "$d")" in
      vendor|node_modules|assets|uploads|cache|tmp|temp|images|img|css|js|fonts|.git) continue ;;
    esac
    if [ -f "$d/index.php" ] || [ -f "$d/includes/config.php" ] || [ -d "$d/sql" ] || [ -d "$d/database" ]; then
      echo "$d"
    fi
  done
}

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
  # Student PDO DSN often keeps dbname=blogdb while sidecar DB is bbms → Unknown database
  if [ -n "${DB_NAME:-}" ]; then
    sed -i -E "s|dbname=[A-Za-z0-9_]+|dbname=${DB_NAME}|g" "$file" 2>/dev/null || true
    sed -i -E "s|DB_NAME=[A-Za-z0-9_]+|DB_NAME=${DB_NAME}|g" "$file" 2>/dev/null || true
    # new mysqli(host, user, pass, 'blogdb') → use preview DB_NAME
    sed -i -E \
      "s|(new[[:space:]]+mysqli\(getenv\('DB_HOST'\)[[:space:]]*\?:[[:space:]]*'localhost',[[:space:]]*'[^']*',[[:space:]]*'[^']*',[[:space:]]*)'[^']+'|\1'${DB_NAME}'|g" \
      "$file" 2>/dev/null || true
    sed -i -E \
      "s|(new[[:space:]]+mysqli\(getenv\('DB_HOST'\)[[:space:]]*\?:[[:space:]]*'localhost',[[:space:]]*\"[^\"]*\",[[:space:]]*\"[^\"]*\",[[:space:]]*)\"[^\"]+\"|\1\"${DB_NAME}\"|g" \
      "$file" 2>/dev/null || true
    sed -i -E \
      "s|(mysqli_connect\(getenv\('DB_HOST'\)[[:space:]]*\?:[[:space:]]*'localhost',[[:space:]]*'[^']*',[[:space:]]*'[^']*',[[:space:]]*)'[^']+'|\1'${DB_NAME}'|g" \
      "$file" 2>/dev/null || true
  fi
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
  [ -n "$DB_HOST" ] || return 0
  php -r "
    try {
      \$host = getenv('DB_HOST');
      if (!\$host) exit(0);
      \$user = getenv('DB_USER') ?: 'root';
      \$pass = getenv('DB_PASS') ?: '';
      \$names = [];
      \$push = function (\$n) use (&\$names) {
        \$safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string)\$n);
        if (\$safe === '' || strlen(\$safe) > 64) return;
        if (preg_match('/^(mysql|information_schema|performance_schema|sys)\$/i', \$safe)) return;
        \$names[\$safe] = true;
      };
      \$push(getenv('DB_NAME') ?: '');
      \$push(getenv('DB_DATABASE') ?: '');
      \$push(getenv('MYSQL_DATABASE') ?: '');
      foreach (preg_split('/[,\s]+/', getenv('PREVIEW_CREATE_DATABASES') ?: '') ?: [] as \$n) {
        if (\$n !== '') \$push(\$n);
      }
      // Scan student PHP / SQL / env for literal DB names (blogdb, hostel, bbms, …).
      \$roots = ['/var/www/html'];
      \$patterns = [
        '/new\s+mysqli\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[\'\"](\w+)[\'\"]/i',
        '/mysqli_connect\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[\'\"](\w+)[\'\"]/i',
        '/\\\$(?:dbname|database|db_name)\s*=\s*[\'\"](\w+)[\'\"]/i',
        '/define\s*\(\s*[\'\"]DB_NAME[\'\"]\s*,\s*[\'\"](\w+)[\'\"]\s*\)/i',
        '/dbname=(\w+)/i',
        '/DB_DATABASE\s*=\s*[\'\"]?(\w+)/i',
        '/MYSQL_DATABASE\s*=\s*[\'\"]?(\w+)/i',
        '/CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?\s+[\\\`\'\"]?(\w+)/i',
        '/USE\s+[\\\`\'\"]?(\w+)/i',
      ];
      foreach (\$roots as \$root) {
        if (!is_dir(\$root)) continue;
        \$push(basename(\$root));
        foreach (glob(\$root . '/*', GLOB_ONLYDIR) ?: [] as \$dir) {
          \$push(basename(\$dir));
        }
        try {
          \$it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(\$root, FilesystemIterator::SKIP_DOTS)
          );
          \$nFiles = 0;
          foreach (\$it as \$f) {
            if (\$nFiles > 160) break;
            if (!\$f->isFile()) continue;
            \$path = \$f->getPathname();
            \$ext = strtolower(\$f->getExtension());
            \$base = \$f->getFilename();
            if (preg_match('#/(vendor|node_modules|\.git)/#', \$path)) continue;
            \$looksDb =
              preg_match('/config|database|db|connection|setup|install|connect|schema|dump|sql|\.env/i', \$path . \$base)
              || in_array(\$ext, ['sql', 'env'], true);
            if (!\$looksDb && \$ext !== 'php') continue;
            // Always scan PHP for dbname= / mysqli 4th arg (Blog Management ZIPs).
            if (\$ext === 'php' && !\$looksDb) {
              // still allow — cheap string check below
            }
            \$nFiles++;
            \$c = @file_get_contents(\$path);
            if (\$c === false) continue;
            if (\$ext === 'php' && !\$looksDb && !preg_match('/dbname|mysqli|PDO|DB_NAME|CREATE\s+DATABASE/i', \$c)) {
              continue;
            }
            foreach (\$patterns as \$re) {
              if (preg_match_all(\$re, \$c, \$mm)) {
                foreach (\$mm[1] as \$hit) \$push(\$hit);
              }
            }
          }
        } catch (Throwable \$e) { /* ignore */ }
      }
      // Always keep a few common student names so Unknown database 'blogdb' cannot slip through.
      foreach (['bbms', 'blogdb', 'blog', 'blog_management', 'phpblog'] as \$common) {
        \$push(\$common);
      }
      if (!\$names) {
        \$push('bbms');
      }
      \$pdo = new PDO('mysql:host=' . \$host, \$user, \$pass, [PDO::ATTR_TIMEOUT => 5]);
      foreach (array_keys(\$names) as \$db) {
        \$pdo->exec('CREATE DATABASE IF NOT EXISTS ' . \$db . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        echo '[preview] ensured database ' . \$db . PHP_EOL;
      }
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
      \$primary = preg_replace('/[^a-zA-Z0-9_]/', '', getenv('DB_NAME') ?: '');
      if (!\$primary) exit(0);
      \$user = getenv('DB_USER') ?: 'root';
      \$pass = getenv('DB_PASS') ?: '';
      \$targets = [\$primary => true, 'blogdb' => true, 'blog' => true, 'bbms' => true];
      foreach (preg_split('/[,\s]+/', getenv('PREVIEW_CREATE_DATABASES') ?: '') ?: [] as \$n) {
        \$safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string)\$n);
        if (\$safe !== '') \$targets[\$safe] = true;
      }
      \$roots = array_values(array_unique(array_filter([
        '/var/www/html',
        getenv('APACHE_DOCROOT') ?: '',
        (getenv('APP_SUBDIR') && getenv('APP_SUBDIR') !== '.') ? ('/var/www/html/' . getenv('APP_SUBDIR')) : '',
      ])));
      foreach (glob('/var/www/html/*', GLOB_ONLYDIR) ?: [] as \$d) {
        \$base = basename(\$d);
        if (preg_match('/^(vendor|node_modules|assets|uploads|cache|tmp|temp|images|img|css|js|fonts|\\.git)\$/i', \$base)) continue;
        \$roots[] = \$d;
      }
      \$candidates = [];
      \$preferred = ['database.sql','db.sql','schema.sql','dump.sql','data.sql','install.sql','setup.sql','tables.sql','structure.sql'];
      foreach (\$roots as \$root) {
        if (!\$root || !is_dir(\$root)) continue;
        foreach (\$preferred as \$name) {
          foreach ([\$root, \$root.'/sql', \$root.'/database', \$root.'/db'] as \$dir) {
            \$p = \$dir . '/' . \$name;
            if (is_file(\$p)) \$candidates[] = \$p;
          }
        }
        try {
          \$it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(\$root, FilesystemIterator::SKIP_DOTS)
          );
          \$n = 0;
          foreach (\$it as \$f) {
            if (\$n > 80) break;
            if (!\$f->isFile() || strtolower(\$f->getExtension()) !== 'sql') continue;
            \$path = \$f->getPathname();
            if (preg_match('#/(vendor|node_modules|\\.git)/#', \$path)) continue;
            \$candidates[] = \$path;
            \$n++;
          }
        } catch (Throwable \$e) { /* ignore */ }
      }
      \$candidates = array_values(array_unique(\$candidates));
      usort(\$candidates, function (\$a, \$b) use (\$preferred) {
        \$ba = strtolower(basename(\$a));
        \$bb = strtolower(basename(\$b));
        \$sa = in_array(\$ba, \$preferred, true) ? 100 : ((preg_match('/schema|structure|install|setup|database|dump|tables|hostel|blog/i', \$ba)) ? 80 : 10);
        \$sb = in_array(\$bb, \$preferred, true) ? 100 : ((preg_match('/schema|structure|install|setup|database|dump|tables|hostel|blog/i', \$bb)) ? 80 : 10);
        return \$sb <=> \$sa;
      });

      foreach (array_keys(\$targets) as \$db) {
        \$admin = new PDO('mysql:host=' . \$host, \$user, \$pass, [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        \$admin->exec('CREATE DATABASE IF NOT EXISTS `' . \$db . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        \$pdo = new PDO('mysql:host=' . \$host . ';dbname=' . \$db, \$user, \$pass, [
          PDO::ATTR_TIMEOUT => 5,
          PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        \$tables = \$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        \$lower = array_map('strtolower', \$tables);
        \$hasAuth = false;
        foreach (['userregistration','users','user','admin','admins','registration','login','posts','blog'] as \$t) {
          if (in_array(\$t, \$lower, true)) { \$hasAuth = true; break; }
        }
        if (count(\$tables) > 0 && \$hasAuth) {
          echo '[preview] skip SQL import for ' . \$db . ' — ' . count(\$tables) . ' table(s) already present' . PHP_EOL;
          continue;
        }
        if (!\$candidates) {
          if (\$db === \$primary) echo '[preview] no SQL dump files found to import' . PHP_EOL;
          continue;
        }
        if (\$db === \$primary) {
          echo '[preview] SQL candidates: ' . implode(', ', array_map('basename', \$candidates)) . PHP_EOL;
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
              if (\$db === \$primary) {
                fwrite(STDERR, '[preview] SQL stmt fail: ' . substr(\$e->getMessage(), 0, 160) . PHP_EOL);
              }
            }
          }
          echo '[preview] imported ' . basename(\$file) . ' → ' . \$db . \" (ok=\$ok fail=\$fail)\" . PHP_EOL;
        }
        \$tables = \$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        echo '[preview] database ' . \$db . ' now has ' . count(\$tables) . ' table(s)' . PHP_EOL;
      }
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] SQL import failed: ' . \$e->getMessage() . PHP_EOL);
    }
  " || true
}

# If still no tables, pull CREATE TABLE statements out of setup/install PHP files.
ensure_schema_from_php_sources() {
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
        echo '[preview] schema OK — ' . count(\$tables) . ' table(s)' . PHP_EOL;
        exit(0);
      }
      \$roots = array_values(array_unique(array_filter([
        '/var/www/html',
        getenv('APACHE_DOCROOT') ?: '',
        (getenv('APP_SUBDIR') && getenv('APP_SUBDIR') !== '.') ? ('/var/www/html/' . getenv('APP_SUBDIR')) : '',
      ])));
      foreach (glob('/var/www/html/*', GLOB_ONLYDIR) ?: [] as \$d) \$roots[] = \$d;
      \$ok = 0; \$fail = 0; \$scanned = 0;
      foreach (array_unique(\$roots) as \$root) {
        if (!\$root || !is_dir(\$root)) continue;
        try {
          \$it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(\$root, FilesystemIterator::SKIP_DOTS)
          );
          foreach (\$it as \$f) {
            if (\$scanned > 120) break 2;
            if (!\$f->isFile() || strtolower(\$f->getExtension()) !== 'php') continue;
            \$path = \$f->getPathname();
            \$base = \$f->getFilename();
            if (!preg_match('/setup|install|upgrade|seed|migrate|init|database|schema|sql|create/i', \$path . \$base)
              && !preg_match('/CREATE\\s+TABLE/i', @file_get_contents(\$path) ?: '')) {
              continue;
            }
            if (preg_match('#/(vendor|node_modules|\\.git)/#', \$path)) continue;
            \$c = @file_get_contents(\$path);
            if (\$c === false || stripos(\$c, 'CREATE TABLE') === false) continue;
            \$scanned++;
            // Match CREATE TABLE … ; even inside PHP double/single quoted strings.
            if (!preg_match_all('/CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?[\\s\\S]*?;/i', \$c, \$mm)) continue;
            foreach (\$mm[0] as \$rawStmt) {
              \$stmt = \$rawStmt;
              // Undo common PHP string concatenation leftovers.
              \$stmt = preg_replace('/\"\\s*\\.\\s*\"/', '', \$stmt);
              \$stmt = preg_replace('/\'\\s*\\.\\s*\'/', '', \$stmt);
              \$stmt = str_replace(['\\\\n', '\\\\r', '\\\\t'], [\"\\n\", \"\\r\", \"\\t\"], \$stmt);
              \$stmt = trim(\$stmt);
              if (\$stmt === '' || !preg_match('/^CREATE\\s+TABLE/i', \$stmt)) continue;
              try {
                \$pdo->exec(\$stmt);
                \$ok++;
                echo '[preview] CREATE TABLE from ' . basename(\$path) . PHP_EOL;
              } catch (Throwable \$e) {
                \$fail++;
                fwrite(STDERR, '[preview] CREATE TABLE fail: ' . substr(\$e->getMessage(), 0, 140) . PHP_EOL);
              }
            }
          }
        } catch (Throwable \$e) { /* ignore */ }
      }
      \$tables = \$pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
      echo '[preview] PHP-source schema: ok=' . \$ok . ' fail=' . \$fail . ' tables=' . count(\$tables) . PHP_EOL;
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] PHP-source schema failed: ' . \$e->getMessage() . PHP_EOL);
    }
  " || true
}

# Blog Management ZIPs often ship no SQL dump — create posts tables so add_post.php works.
ensure_blog_post_tables() {
  [ -n "$DB_HOST" ] || return 0
  php -r "
    try {
      \$host = getenv('DB_HOST');
      if (!\$host) exit(0);
      \$user = getenv('DB_USER') ?: 'root';
      \$pass = getenv('DB_PASS') ?: '';
      \$dbs = [];
      \$push = function (\$n) use (&\$dbs) {
        \$safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string)\$n);
        if (\$safe !== '') \$dbs[\$safe] = true;
      };
      \$push(getenv('DB_NAME') ?: 'bbms');
      \$push('blogdb');
      \$push('blog');
      \$push('bbms');
      \$ddl = [
        'CREATE TABLE IF NOT EXISTS \`posts\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`title\` VARCHAR(255) NOT NULL DEFAULT \"\",
          \`content\` MEDIUMTEXT NULL,
          \`category\` VARCHAR(120) NULL DEFAULT \"\",
          \`author\` VARCHAR(120) NULL DEFAULT \"\",
          \`image\` VARCHAR(255) NULL DEFAULT \"\",
          \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        'CREATE TABLE IF NOT EXISTS \`blog\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`title\` VARCHAR(255) NOT NULL DEFAULT \"\",
          \`content\` MEDIUMTEXT NULL,
          \`category\` VARCHAR(120) NULL DEFAULT \"\",
          \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        'CREATE TABLE IF NOT EXISTS \`blog_posts\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`title\` VARCHAR(255) NOT NULL DEFAULT \"\",
          \`content\` MEDIUMTEXT NULL,
          \`category\` VARCHAR(120) NULL DEFAULT \"\",
          \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
      ];
      // Infer INSERT INTO table(cols) from add_post.php etc.
      \$inferred = [];
      try {
        \$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('/var/www/html', FilesystemIterator::SKIP_DOTS));
        \$n = 0;
        foreach (\$it as \$f) {
          if (\$n++ > 80) break;
          if (!\$f->isFile() || strtolower(\$f->getExtension()) !== 'php') continue;
          \$path = \$f->getPathname();
          if (!preg_match('/add_post|create_post|new_post|post|blog/i', \$path)) continue;
          \$c = @file_get_contents(\$path);
          if (\$c && preg_match_all('/INSERT\s+INTO\s+[\`]?(\w+)[\`]?\s*\(([^)]+)\)/i', \$c, \$mm, PREG_SET_ORDER)) {
            foreach (\$mm as \$m) {
              \$t = preg_replace('/[^a-zA-Z0-9_]/', '', \$m[1]);
              if (!\$t) continue;
              \$cols = [];
              foreach (preg_split('/\s*,\s*/', \$m[2]) ?: [] as \$col) {
                \$col = preg_replace('/[^a-zA-Z0-9_]/', '', \$col);
                if (\$col) \$cols[] = \$col;
              }
              if (\$cols) \$inferred[\$t] = array_values(array_unique(array_merge(\$inferred[\$t] ?? [], \$cols)));
            }
          }
        }
      } catch (Throwable \$e) { /* ignore */ }
      foreach (\$inferred as \$t => \$cols) {
        \$parts = ['\`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT'];
        foreach (\$cols as \$col) {
          if (strtolower(\$col) === 'id') continue;
          if (preg_match('/content|body|description|text/i', \$col)) {
            \$parts[] = '\`' . \$col . '\` MEDIUMTEXT NULL';
          } else {
            \$parts[] = '\`' . \$col . '\` VARCHAR(255) NULL DEFAULT \"\"';
          }
        }
        \$parts[] = '\`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP';
        \$parts[] = 'PRIMARY KEY (\`id\`)';
        \$ddl[] = 'CREATE TABLE IF NOT EXISTS \`' . \$t . '\` (' . implode(', ', \$parts) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
      }
      foreach (array_keys(\$dbs) as \$db) {
        \$pdo = new PDO('mysql:host=' . \$host . ';dbname=' . \$db, \$user, \$pass, [
          PDO::ATTR_TIMEOUT => 5,
          PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        foreach (\$ddl as \$sql) {
          try { \$pdo->exec(\$sql); } catch (Throwable \$e) { /* ignore */ }
        }
        echo '[preview] ensured blog/post tables in ' . \$db . PHP_EOL;
      }
    } catch (Throwable \$e) {
      fwrite(STDERR, '[preview] blog table ensure failed: ' . \$e->getMessage() . PHP_EOL);
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
  roots=$(preview_app_roots | sort -u)
  for root in $roots; do
    [ -d "$root" ] || continue
    for pattern in setup_db.php upgrade_db.php reset_admin.php install.php database/setup.php scripts/setup.php sql/setup.php; do
      script="$root/$pattern"
      [ -f "$script" ] || continue
      fix_setup_use_in_script "$script"
      echo "[preview] running $(basename "$script") from $root"
      php "$script" >> /tmp/preview-mysql.log 2>&1 || true
    done
    find "$root" -maxdepth 4 -type f -name '*.php' 2>/dev/null | while read -r script; do
      base=$(basename "$script")
      case "$base" in
        setup*|install*|upgrade*|reset*|seed*|migrate*|init*)
          echo "$script" | grep -qiE 'setup|install|upgrade|reset|seed|migrate|init' || continue
          fix_setup_use_in_script "$script"
          echo "[preview] running bootstrap $base ($script)"
          php "$script" >> /tmp/preview-mysql.log 2>&1 || true
          ;;
      esac
    done
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

# Student ZIPs often load SweetAlert CSS with <script src="...min.css"> → browser MIME refuse.
patch_css_loaded_as_script() {
  php <<'PHP' || true
$roots = array_values(array_unique(array_filter([
  '/var/www/html',
  getenv('APACHE_DOCROOT') ?: '',
])));
foreach ($roots as $root) {
  if (!$root || !is_dir($root)) continue;
  try {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    $n = 0;
    foreach ($it as $f) {
      if ($n > 120) break;
      if (!$f->isFile()) continue;
      $ext = strtolower($f->getExtension());
      if (!in_array($ext, ['php', 'html', 'htm'], true)) continue;
      $path = $f->getPathname();
      if (preg_match('#/(vendor|node_modules|\.git)/#', $path)) continue;
      $c = @file_get_contents($path);
      if ($c === false || stripos($c, '.css') === false) continue;
      $n++;
      $fixed = preg_replace(
        '/<script([^>]*\ssrc=["\'][^"\']+\.css["\'][^>]*)>\s*<\/script>/i',
        '<link rel="stylesheet"$1>',
        $c
      );
      if (is_string($fixed) && $fixed !== $c) {
        @file_put_contents($path, $fixed);
        echo '[preview] rewrote CSS-as-script in ' . basename($path) . PHP_EOL;
      }
    }
  } catch (Throwable $e) { /* ignore */ }
}
PHP
}

patch_php_config
patch_xampp_asset_prefixes
patch_css_loaded_as_script

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
  ensure_schema_from_php_sources
  ensure_blog_post_tables
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
