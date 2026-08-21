<?php
/**
 * ScholarVerify PHP preview sandbox bootstrap (auto_prepended in preview containers).
 * Overrides DB settings from container env so student localhost/XAMPP configs work in Docker.
 *
 * Also CREATE DATABASE IF NOT EXISTS for every name the student app might use
 * (fixes "Unknown database 'hostel'" when the sidecar was initialized as bbms).
 *
 * chdir() to the app root so admin/index.php can include('includes/config.php')
 * the XAMPP way (TMS and most nested-folder PHP ZIPs).
 */
if (getenv('PREVIEW_SANDBOX') !== '1' && !getenv('DB_HOST')) {
    return;
}

// Student ZIPs (PHP 8+) dump "Undefined array key" warnings into HTML and break CSS.
// Keep fatals/parse errors visible via Apache logs; hide notice/warning noise in the browser.
if (getenv('PREVIEW_DISPLAY_ERRORS') !== '1') {
    @ini_set('display_errors', '0');
    @ini_set('display_startup_errors', '0');
    @error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED & ~E_STRICT & ~E_USER_NOTICE & ~E_USER_WARNING);
}

// Soft-start session so includes/header.php can read $_SESSION without fatals.
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}
// TMS admin uses $_SESSION['alogin']; public header.php checks $_SESSION['login'].
if (!empty($_SESSION['alogin']) && !isset($_SESSION['login'])) {
    $_SESSION['login'] = (string) $_SESSION['alogin'];
}
if (!isset($_SESSION['login'])) {
    $_SESSION['login'] = '';
}

/**
 * Find the real project root (folder that contains includes/config.php or similar).
 * Critical for /admin/index.php → include('includes/config.php').
 */
function __sv_preview_resolve_app_root()
{
    $looksLikeRoot = static function ($dir) {
        $dir = rtrim((string) $dir, '/');
        if ($dir === '' || !is_dir($dir)) {
            return false;
        }
        return is_file($dir . '/includes/config.php')
            || is_file($dir . '/include/config.php')
            || is_file($dir . '/config/config.php')
            || is_file($dir . '/config/database.php')
            || is_file($dir . '/includes/dbconnection.php')
            || is_file($dir . '/includes/connection.php')
            || (is_file($dir . '/index.php') && is_dir($dir . '/includes'));
    };

    $candidates = [];
    foreach (
        [
            getenv('APACHE_DOCROOT') ?: '',
            getenv('APACHE_DOCUMENT_ROOT') ?: '',
            (getenv('APP_SUBDIR') && getenv('APP_SUBDIR') !== '.')
                ? ('/var/www/html/' . getenv('APP_SUBDIR'))
                : '',
            '/var/www/html',
        ] as $c
    ) {
        if ($c) {
            $candidates[] = $c;
        }
    }

    $script = isset($_SERVER['SCRIPT_FILENAME']) ? (string) $_SERVER['SCRIPT_FILENAME'] : '';
    if ($script !== '' && is_file($script)) {
        $dir = dirname($script);
        for ($i = 0; $i < 8; $i++) {
            $candidates[] = $dir;
            $parent = dirname($dir);
            if ($parent === $dir) {
                break;
            }
            $dir = $parent;
        }
    }

    foreach (glob('/var/www/html/*', GLOB_ONLYDIR) ?: [] as $d) {
        $candidates[] = $d;
    }

    foreach (array_unique($candidates) as $dir) {
        if ($looksLikeRoot($dir)) {
            return rtrim($dir, '/');
        }
    }

    $envDoc = getenv('APACHE_DOCROOT') ?: getenv('APACHE_DOCUMENT_ROOT') ?: '';
    if ($envDoc && is_dir($envDoc)) {
        return rtrim($envDoc, '/');
    }
    return '/var/www/html';
}

$__svAppRoot = __sv_preview_resolve_app_root();
if ($__svAppRoot && is_dir($__svAppRoot)) {
    @chdir($__svAppRoot);
    $inc = $__svAppRoot . PATH_SEPARATOR . get_include_path();
    @set_include_path($inc);
    if (!getenv('APACHE_DOCROOT')) {
        putenv('APACHE_DOCROOT=' . $__svAppRoot);
    }
    $GLOBALS['__sv_preview_app_root'] = $__svAppRoot;
}

/**
 * If admin expects includes/config.php but the ZIP stores DB config elsewhere,
 * write a tiny shim once (TMS and similar CodeCanyon layouts).
 * Always falls back to /preview-generated-config.php so $dbh exists.
 */
function __sv_preview_ensure_config_shim($appRoot)
{
    static $done = false;
    if ($done || !$appRoot) {
        return;
    }
    $done = true;
    $generated = '/preview-generated-config.php';
    $shim = rtrim($appRoot, '/') . '/includes/config.php';

    $best = null;
    if (is_file($shim) && filesize($shim) > 20) {
        // Student file exists — still ensure generated is loadable as backup via include_path.
        if (is_file($generated)) {
            @set_include_path(dirname($generated) . PATH_SEPARATOR . get_include_path());
        }
        return;
    }

    $names = [
        'config.php',
        'dbconnection.php',
        'db.php',
        'connection.php',
        'connect.php',
        'database.php',
        'conn.php',
    ];
    $dirs = ['includes', 'include', 'config', 'inc', 'lib', 'admin/includes', ''];
    foreach ($dirs as $dir) {
        foreach ($names as $name) {
            $p = rtrim($appRoot, '/') . ($dir !== '' ? '/' . $dir : '') . '/' . $name;
            if (!is_file($p)) {
                continue;
            }
            $c = @file_get_contents($p);
            if ($c === false) {
                continue;
            }
            if (!preg_match('/mysqli|PDO|mysql:host|DB_HOST|mysqli_connect|new PDO/i', $c)) {
                continue;
            }
            $best = $p;
            break 2;
        }
    }
    if (!$best) {
        try {
            $it = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($appRoot, FilesystemIterator::SKIP_DOTS)
            );
            $n = 0;
            foreach ($it as $f) {
                if ($n++ > 80) {
                    break;
                }
                if (!$f->isFile() || strtolower($f->getExtension()) !== 'php') {
                    continue;
                }
                $path = $f->getPathname();
                if (preg_match('#/(vendor|node_modules|\.git)/#', $path)) {
                    continue;
                }
                if (!preg_match('/config|connection|database|dbconnection|connect/i', $path)) {
                    continue;
                }
                $c = @file_get_contents($path);
                if ($c && preg_match('/mysqli|PDO|mysql:host|DB_HOST/i', $c)) {
                    $best = $path;
                    break;
                }
            }
        } catch (Throwable $e) {
            /* ignore */
        }
    }

    if (!$best && is_file($generated)) {
        $best = $generated;
    }
    if (!$best) {
        return;
    }

    $dir = dirname($shim);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $code =
        "<?php\n/* ScholarVerify preview config shim */\n" .
        "if (is_file(" . var_export($best, true) . ")) {\n" .
        "  require_once " . var_export($best, true) . ";\n" .
        "} elseif (is_file('/preview-generated-config.php')) {\n" .
        "  require_once '/preview-generated-config.php';\n" .
        "}\n";
    $written = @file_put_contents($shim, $code);
    if ($written === false && is_file($generated)) {
        // Mount may be read-only — rewrite the current script's include to the generated config.
        $script = isset($_SERVER['SCRIPT_FILENAME']) ? (string) $_SERVER['SCRIPT_FILENAME'] : '';
        if ($script !== '' && is_file($script) && is_writable($script)) {
            $body = @file_get_contents($script);
            if (is_string($body) && preg_match('/includes\/config\.php/', $body) && strpos($body, '/preview-generated-config.php') === false) {
                $body2 = preg_replace(
                    '/(include_once|require_once|include|require)\s*\(\s*__DIR__\s*\.\s*[\'"]\/\.\.\/includes\/config\.php[\'"]\s*\)\s*;/i',
                    "require_once '/preview-generated-config.php';",
                    $body,
                    1
                );
                $body2 = preg_replace(
                    '/(include_once|require_once|include|require)\s*\(\s*[\'"]includes\/config\.php[\'"]\s*\)\s*;/i',
                    "require_once '/preview-generated-config.php';",
                    $body2,
                    1
                );
                if ($body2 && $body2 !== $body) {
                    @file_put_contents($script, $body2);
                }
            }
        }
    }
}

if (!empty($__svAppRoot)) {
    __sv_preview_ensure_config_shim($__svAppRoot);
}

$svEnv = static function (array $keys, $default = null) {
    foreach ($keys as $key) {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }
    }
    return $default;
};

$svHost = $svEnv(['DB_HOST']);
$svUser = $svEnv(['DB_USER', 'DB_USERNAME', 'MYSQL_USER'], 'root');
$svPass = $svEnv(['DB_PASS', 'DB_PASSWORD', 'MYSQL_PASSWORD'], '');
$svName = $svEnv(['DB_NAME', 'DB_DATABASE', 'MYSQL_DATABASE']);
$svBase = $svEnv(['PREVIEW_BASE_URL']);

foreach (
    [
        'DB_HOST' => $svHost,
        'DB_USER' => $svUser,
        'DB_PASS' => $svPass,
        'DB_NAME' => $svName,
        'BASE_URL' => $svBase,
    ] as $const => $value
) {
    if ($value !== null && $value !== '' && !defined($const)) {
        define($const, $value);
    }
}

if ($svHost) {
    $GLOBALS['__sv_preview_db'] = [
        'host' => $svHost,
        'user' => $svUser,
        'pass' => $svPass,
        'name' => $svName,
    ];
}

/**
 * Create a MySQL/MariaDB database if missing. Safe to call repeatedly.
 */
function __sv_preview_ensure_database($name)
{
    static $done = [];
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $name);
    if ($safe === '' || isset($done[$safe])) {
        return false;
    }
    if (preg_match('/^(mysql|information_schema|performance_schema|sys)$/i', $safe)) {
        return false;
    }
    $host = getenv('DB_HOST') ?: '';
    if ($host === '') {
        return false;
    }
    $user = getenv('DB_USER') ?: (getenv('DB_USERNAME') ?: 'root');
    $pass = getenv('DB_PASS');
    if ($pass === false || $pass === null || $pass === '') {
        $pass = getenv('DB_PASSWORD');
    }
    if ($pass === false || $pass === null) {
        $pass = '';
    }
    try {
        if (function_exists('mysqli_report')) {
            mysqli_report(MYSQLI_REPORT_OFF);
        }
        $m = @new mysqli($host, $user, $pass);
        if ($m instanceof mysqli && !$m->connect_errno) {
            $m->query(
                'CREATE DATABASE IF NOT EXISTS `' . $safe . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
            );
            $m->close();
            $done[$safe] = true;
            return true;
        }
    } catch (Throwable $e) {
        /* ignore — student page may still fail; entrypoint also ensures DBs */
    }
    return false;
}

/**
 * Discover literal DB names from student config files (cached under /tmp).
 */
function __sv_preview_discover_database_names()
{
    $cache = '/tmp/sv-preview-db-names.cache';
    if (is_file($cache) && (time() - (int) filemtime($cache)) < 120) {
        $raw = @file_get_contents($cache);
        if ($raw !== false && $raw !== '') {
            return array_values(array_filter(array_map('trim', explode("\n", $raw))));
        }
    }
    $names = [];
    $push = static function ($n) use (&$names) {
        $safe = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $n);
        if ($safe === '' || strlen($safe) > 64) {
            return;
        }
        if (preg_match('/^(mysql|information_schema|performance_schema|sys|test)$/i', $safe)) {
            return;
        }
        $names[$safe] = true;
    };

    $envName = getenv('DB_NAME') ?: getenv('DB_DATABASE') ?: getenv('MYSQL_DATABASE');
    if ($envName) {
        $push($envName);
    }
    $extra = getenv('PREVIEW_CREATE_DATABASES') ?: '';
    foreach (preg_split('/[,\s]+/', $extra) ?: [] as $n) {
        if ($n !== '') {
            $push($n);
        }
    }

    $roots = ['/var/www/html'];
    $doc = getenv('APACHE_DOCUMENT_ROOT') ?: '';
    if ($doc !== '' && is_dir($doc)) {
        $roots[] = $doc;
    }
    $patterns = [
        '/new\s+mysqli\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[\'"](\w+)[\'"]/i',
        '/mysqli_connect\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[\'"](\w+)[\'"]/i',
        '/\$(?:dbname|database|db_name)\s*=\s*[\'"](\w+)[\'"]/i',
        '/define\s*\(\s*[\'"]DB_NAME[\'"]\s*,\s*[\'"](\w+)[\'"]\s*\)/i',
        '/dbname=(\w+)/i',
        '/DB_DATABASE\s*=\s*[\'"]?(\w+)/i',
        '/CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`\'"]?(\w+)/i',
        '/USE\s+[`\'"]?(\w+)/i',
    ];

    foreach (array_unique($roots) as $root) {
        if (!is_dir($root)) {
            continue;
        }
        try {
            $it = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
            );
            $nFiles = 0;
            foreach ($it as $f) {
                if ($nFiles > 120) {
                    break;
                }
                if (!$f->isFile()) {
                    continue;
                }
                $path = $f->getPathname();
                $base = $f->getFilename();
                $ext = strtolower($f->getExtension());
                if (preg_match('#/(vendor|node_modules|\.git)/#', $path)) {
                    continue;
                }
                $looksDb = preg_match(
                    '/config|database|db|connection|setup|install|connect|schema|dump|sql|\.env/i',
                    $path . $base
                ) || in_array($ext, ['sql', 'env'], true);
                if ($ext !== 'php' && !$looksDb) {
                    continue;
                }
                $nFiles++;
                $c = @file_get_contents($path);
                if ($c === false || $c === '') {
                    continue;
                }
                if ($ext === 'php' && !$looksDb && !preg_match('/dbname|mysqli|PDO|DB_NAME|CREATE\s+DATABASE/i', $c)) {
                    continue;
                }
                foreach ($patterns as $re) {
                    if (preg_match_all($re, $c, $mm)) {
                        foreach ($mm[1] as $hit) {
                            $push($hit);
                        }
                    }
                }
            }
        } catch (Throwable $e) {
            /* ignore */
        }
        // Parent folder name (e.g. /var/www/html/hostel → hostel)
        $push(basename($root));
        foreach (glob($root . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $push(basename($dir));
        }
    }

    foreach (['bbms', 'blogdb', 'blog', 'blog_management', 'phpblog'] as $common) {
        $push($common);
    }

    $list = array_keys($names);
    @file_put_contents($cache, implode("\n", $list));
    return $list;
}

if ($svHost && (class_exists('mysqli') || extension_loaded('mysqli'))) {
    if (function_exists('mysqli_report')) {
        // PHP 8.1+ throws mysqli_sql_exception by default → empty HTTP 500 on INSERT
        // into a missing table. Keep warnings in Apache logs instead.
        @mysqli_report(MYSQLI_REPORT_OFF);
    }
    foreach (__sv_preview_discover_database_names() as $__svDb) {
        __sv_preview_ensure_database($__svDb);
    }
    if ($svName) {
        __sv_preview_ensure_database($svName);
    }
    __sv_preview_ensure_blog_tables();
}

/**
 * Create minimal blog/post tables so add_post.php INSERT does not 500
 * when the student ZIP has no SQL dump / CREATE TABLE.
 */
function __sv_preview_ensure_blog_tables()
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    $host = getenv('DB_HOST') ?: '';
    if ($host === '') {
        return;
    }
    $user = getenv('DB_USER') ?: (getenv('DB_USERNAME') ?: 'root');
    $pass = getenv('DB_PASS');
    if ($pass === false || $pass === null || $pass === '') {
        $pass = getenv('DB_PASSWORD');
    }
    if ($pass === false || $pass === null) {
        $pass = '';
    }
    $dbs = __sv_preview_discover_database_names();
    if (!$dbs) {
        $env = getenv('DB_NAME') ?: getenv('DB_DATABASE') ?: getenv('MYSQL_DATABASE') ?: 'bbms';
        $dbs = [$env];
    }

    $ddl = [
        'posts' =>
            'CREATE TABLE IF NOT EXISTS `posts` (
              `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
              `title` VARCHAR(255) NOT NULL DEFAULT \'\',
              `content` MEDIUMTEXT NULL,
              `category` VARCHAR(120) NULL DEFAULT \'\',
              `author` VARCHAR(120) NULL DEFAULT \'\',
              `image` VARCHAR(255) NULL DEFAULT \'\',
              `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        'blog' =>
            'CREATE TABLE IF NOT EXISTS `blog` (
              `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
              `title` VARCHAR(255) NOT NULL DEFAULT \'\',
              `content` MEDIUMTEXT NULL,
              `category` VARCHAR(120) NULL DEFAULT \'\',
              `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        'blog_posts' =>
            'CREATE TABLE IF NOT EXISTS `blog_posts` (
              `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
              `title` VARCHAR(255) NOT NULL DEFAULT \'\',
              `content` MEDIUMTEXT NULL,
              `category` VARCHAR(120) NULL DEFAULT \'\',
              `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
    ];

    // Infer extra tables/columns from INSERT INTO … in student PHP (esp. add_post.php).
    $inferred = __sv_preview_infer_insert_schemas();
    foreach ($inferred as $table => $cols) {
        if (isset($ddl[$table])) {
            continue;
        }
        $parts = ['`id` INT UNSIGNED NOT NULL AUTO_INCREMENT'];
        foreach ($cols as $col) {
            $c = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
            if ($c === '' || strtolower($c) === 'id') {
                continue;
            }
            if (preg_match('/content|body|description|text/i', $c)) {
                $parts[] = '`' . $c . '` MEDIUMTEXT NULL';
            } else {
                $parts[] = '`' . $c . '` VARCHAR(255) NULL DEFAULT \'\'';
            }
        }
        $parts[] = '`created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP';
        $parts[] = 'PRIMARY KEY (`id`)';
        $ddl[$table] = 'CREATE TABLE IF NOT EXISTS `' . $table . '` (' . implode(', ', $parts) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    }

    try {
        if (function_exists('mysqli_report')) {
            mysqli_report(MYSQLI_REPORT_OFF);
        }
        foreach ($dbs as $db) {
            $safeDb = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $db);
            if ($safeDb === '') {
                continue;
            }
            $m = @new mysqli($host, $user, $pass, $safeDb);
            if (!($m instanceof mysqli) || $m->connect_errno) {
                continue;
            }
            foreach ($ddl as $sql) {
                @$m->query($sql);
            }
            // Add missing columns onto existing posts-like tables (student dump may omit category).
            foreach (['posts', 'blog', 'blog_posts'] as $t) {
                $res = @$m->query('SHOW TABLES LIKE \'' . $m->real_escape_string($t) . '\'');
                if (!$res || $res->num_rows < 1) {
                    continue;
                }
                $colsRes = @$m->query('SHOW COLUMNS FROM `' . $t . '`');
                $have = [];
                if ($colsRes) {
                    while ($row = $colsRes->fetch_assoc()) {
                        $have[strtolower($row['Field'])] = true;
                    }
                }
                foreach (['title' => 'VARCHAR(255) NULL DEFAULT \'\'', 'content' => 'MEDIUMTEXT NULL', 'category' => 'VARCHAR(120) NULL DEFAULT \'\'', 'author' => 'VARCHAR(120) NULL DEFAULT \'\'', 'image' => 'VARCHAR(255) NULL DEFAULT \'\'', 'created_at' => 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'] as $col => $def) {
                    if (!isset($have[$col])) {
                        @$m->query('ALTER TABLE `' . $t . '` ADD COLUMN `' . $col . '` ' . $def);
                    }
                }
            }
            $m->close();
        }
    } catch (Throwable $e) {
        /* ignore */
    }
}

/** @return array<string, string[]> table => column names from INSERT INTO statements */
function __sv_preview_infer_insert_schemas()
{
    $out = [];
    $roots = ['/var/www/html'];
    $doc = getenv('APACHE_DOCROOT') ?: getenv('APACHE_DOCUMENT_ROOT') ?: '';
    if ($doc !== '' && is_dir($doc)) {
        $roots[] = $doc;
    }
    foreach (array_unique($roots) as $root) {
        if (!is_dir($root)) {
            continue;
        }
        try {
            $it = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
            );
            $n = 0;
            foreach ($it as $f) {
                if ($n++ > 100) {
                    break;
                }
                if (!$f->isFile() || strtolower($f->getExtension()) !== 'php') {
                    continue;
                }
                $path = $f->getPathname();
                if (preg_match('#/(vendor|node_modules|\.git)/#', $path)) {
                    continue;
                }
                if (!preg_match('/add_post|create_post|new_post|post|blog|insert|admin/i', $path . $f->getFilename())) {
                    continue;
                }
                $c = @file_get_contents($path);
                if ($c === false) {
                    continue;
                }
                if (preg_match_all(
                    '/INSERT\s+INTO\s+[`]?(\w+)[`]?\s*\(([^)]+)\)/i',
                    $c,
                    $mm,
                    PREG_SET_ORDER
                )) {
                    foreach ($mm as $m) {
                        $table = preg_replace('/[^a-zA-Z0-9_]/', '', $m[1]);
                        if ($table === '') {
                            continue;
                        }
                        $cols = preg_split('/\s*,\s*/', $m[2]) ?: [];
                        $clean = [];
                        foreach ($cols as $col) {
                            $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
                            if ($col !== '') {
                                $clean[] = $col;
                            }
                        }
                        if ($clean) {
                            $out[$table] = array_values(array_unique(array_merge($out[$table] ?? [], $clean)));
                        }
                    }
                }
            }
        } catch (Throwable $e) {
            /* ignore */
        }
    }
    return $out;
}

// Surface fatal/uncaught errors in preview so "Add Post" is not a blank HTTP 500.
if (getenv('PREVIEW_SANDBOX') === '1' || getenv('DB_HOST')) {
    @set_exception_handler(static function ($e) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: text/html; charset=UTF-8');
        }
        $msg = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
        $file = htmlspecialchars(basename((string) $e->getFile()), ENT_QUOTES, 'UTF-8');
        $line = (int) $e->getLine();
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview error</title></head><body style="font-family:system-ui;padding:1.5rem;background:#fff7ed;color:#7c2d12">';
        echo '<h1 style="margin:0 0 .5rem">Preview PHP error</h1>';
        echo '<p style="margin:0 0 1rem">The student app crashed while handling this request (often a missing DB table/column).</p>';
        echo '<pre style="white-space:pre-wrap;background:#fff;border:1px solid #fdba74;padding:1rem;border-radius:8px">' . $msg . "\n\nin {$file}:{$line}</pre>";
        echo '<p style="opacity:.8;font-size:.9rem">ScholarVerify preview — this detail is hidden in production student hosting.</p>';
        echo '</body></html>';
    });
    @register_shutdown_function(static function () {
        $err = error_get_last();
        if (!$err) {
            return;
        }
        $type = (int) ($err['type'] ?? 0);
        if (!in_array($type, [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
            return;
        }
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: text/html; charset=UTF-8');
        }
        $msg = htmlspecialchars((string) ($err['message'] ?? 'fatal'), ENT_QUOTES, 'UTF-8');
        $file = htmlspecialchars(basename((string) ($err['file'] ?? '')), ENT_QUOTES, 'UTF-8');
        $line = (int) ($err['line'] ?? 0);
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview error</title></head><body style="font-family:system-ui;padding:1.5rem;background:#fff7ed;color:#7c2d12">';
        echo '<h1 style="margin:0 0 .5rem">Preview PHP fatal error</h1>';
        echo '<pre style="white-space:pre-wrap;background:#fff;border:1px solid #fdba74;padding:1rem;border-radius:8px">' . $msg . "\n\nin {$file}:{$line}</pre>";
        echo '</body></html>';
    });
}
