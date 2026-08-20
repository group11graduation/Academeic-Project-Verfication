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
        '/CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`\'"]?(\w+)/i',
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
                if ($nFiles > 80) {
                    break;
                }
                if (!$f->isFile()) {
                    continue;
                }
                $path = $f->getPathname();
                $base = $f->getFilename();
                if (!preg_match('/\.php$/i', $base)) {
                    continue;
                }
                if (!preg_match('/config|database|db|connection|setup|install|connect/i', $path . $base)) {
                    continue;
                }
                if (preg_match('#/(vendor|node_modules|\.git)/#', $path)) {
                    continue;
                }
                $nFiles++;
                $c = @file_get_contents($path);
                if ($c === false || $c === '') {
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

    $list = array_keys($names);
    @file_put_contents($cache, implode("\n", $list));
    return $list;
}

if ($svHost && (class_exists('mysqli') || extension_loaded('mysqli'))) {
    foreach (__sv_preview_discover_database_names() as $__svDb) {
        __sv_preview_ensure_database($__svDb);
    }
    if ($svName) {
        __sv_preview_ensure_database($svName);
    }
}
