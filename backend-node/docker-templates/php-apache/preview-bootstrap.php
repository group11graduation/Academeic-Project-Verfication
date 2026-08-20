<?php
/**
 * ScholarVerify PHP preview sandbox bootstrap (auto_prepended in preview containers).
 * Overrides DB settings from container env so student localhost/XAMPP configs work in Docker.
 *
 * Also CREATE DATABASE IF NOT EXISTS for every name the student app might use
 * (fixes "Unknown database 'hostel'" when the sidecar was initialized as bbms).
 */
if (getenv('PREVIEW_SANDBOX') !== '1' && !getenv('DB_HOST')) {
    return;
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
