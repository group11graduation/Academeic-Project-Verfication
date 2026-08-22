<?php
/**
 * ScholarVerify PHP preview admin seeder.
 * Runs after student setup scripts so PREVIEW_SEED_USERNAME / PREVIEW_SEED_PASSWORD always work.
 *
 * Detects how auth/login.php validates passwords (password_verify / md5 / sha1 / plain)
 * and upserts into the same table/columns the app queries.
 */
if (getenv('PREVIEW_SANDBOX') !== '1' && !getenv('DB_HOST')) {
    exit(0);
}

$host = getenv('DB_HOST');
$dbName = getenv('DB_NAME');
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$seedUser = trim((string) (getenv('PREVIEW_SEED_USERNAME') ?: getenv('ADMIN_USERNAME') ?: 'previewadmin'));
$seedPass = (string) (getenv('PREVIEW_SEED_PASSWORD') ?: getenv('ADMIN_PASSWORD') ?: 'Preview123!');
$seedEmail = trim((string) (getenv('PREVIEW_ADMIN_EMAIL') ?: getenv('ADMIN_EMAIL') ?: 'admin@preview.demo'));
if ($seedEmail === '' || strpos($seedEmail, '@') === false) {
    $seedEmail = (strpos($seedUser, '@') !== false) ? $seedUser : ($seedUser . '@preview.local');
}

function sv_preview_docroots(): array
{
    $roots = [];
    $push = static function ($p) use (&$roots) {
        $p = rtrim((string) $p, '/');
        if ($p !== '' && is_dir($p) && !in_array($p, $roots, true)) {
            $roots[] = $p;
        }
    };
    $push('/var/www/html');
    $push(getenv('APACHE_DOCROOT') ?: '');
    $push(getenv('APACHE_DOCUMENT_ROOT') ?: '');
    $sub = trim((string) (getenv('APP_SUBDIR') ?: ''));
    if ($sub !== '' && $sub !== '.') {
        $push('/var/www/html/' . $sub);
    }
    foreach (glob('/var/www/html/*', GLOB_ONLYDIR) ?: [] as $d) {
        $base = basename($d);
        if (preg_match('/^(vendor|node_modules|assets|uploads|cache|tmp|temp|images|img|css|js|fonts|\.git)$/i', $base)) {
            continue;
        }
        if (is_file($d . '/index.php') || is_file($d . '/login.php') || is_dir($d . '/includes')) {
            $push($d);
        }
    }
    return $roots ?: ['/var/www/html'];
}

$docroots = sv_preview_docroots();
$docroot = $docroots[0];
foreach ($docroots as $candidateRoot) {
    // Prefer nested apps with admin login (TMS: /tms/admin/index.php).
    if (is_file($candidateRoot . '/admin/index.php') || is_file($candidateRoot . '/admin/login.php')) {
        $docroot = $candidateRoot;
        break;
    }
}
if ($docroot === $docroots[0]) {
    foreach ($docroots as $candidateRoot) {
        if (
            is_file($candidateRoot . '/index.php') ||
            is_file($candidateRoot . '/login.php') ||
            is_file($candidateRoot . '/auth/login.php')
        ) {
            $docroot = $candidateRoot;
            break;
        }
    }
}

function sv_log($msg)
{
    $line = '[preview] seed-admin: ' . $msg . "\n";
    echo $line;
    fwrite(STDERR, $line);
}

if (!$host || !$dbName || $seedUser === '' || $seedPass === '') {
    sv_log('skip (missing DB or seed credentials)');
    exit(0);
}

$mysqlPass = getenv('DB_PASS') !== false ? (string) getenv('DB_PASS') : 'preview-root';
if ($seedPass === $mysqlPass || $seedPass === 'preview-root') {
    // Never seed the MySQL sidecar password as an app login — fall back to platform default.
    $seedPass = getenv('PREVIEW_DEFAULT_ADMIN_PASSWORD') ?: 'Preview123!';
    sv_log('replaced MySQL sidecar password with platform default Preview123!');
}

function sv_detect_password_mode(string $docroot): string
{
    $forced = strtolower(trim((string) getenv('PREVIEW_PASSWORD_MODE')));
    if (in_array($forced, ['bcrypt', 'md5', 'sha1', 'plain'], true)) {
        return $forced;
    }
    // 'auto' / empty → inspect login PHP below

    // Prefer real login endpoints first. Do NOT merge signup/register (often bcrypt) with
    // admin login (often md5) — that wrongly seeds bcrypt into TMS admin.Password.
    $candidates = [
        $docroot . '/admin/index.php',
        $docroot . '/admin/login.php',
        $docroot . '/auth/login.php',
        $docroot . '/login.php',
        $docroot . '/index.php',
        $docroot . '/user/login.php',
        $docroot . '/pages/login.php',
        $docroot . '/signin.php',
        $docroot . '/includes/login.php',
        $docroot . '/includes/signin.php',
    ];
    foreach (['auth', 'admin', 'user', 'pages', 'includes'] as $subdir) {
        foreach (['login.php', 'signin.php', 'authenticate.php', 'index.php'] as $file) {
            $extra = $docroot . '/' . $subdir . '/' . $file;
            if (is_file($extra)) {
                $candidates[] = $extra;
            }
        }
    }
    foreach (sv_preview_docroots() as $root) {
        $candidates[] = $root . '/admin/index.php';
        $candidates[] = $root . '/admin/login.php';
        $candidates[] = $root . '/login.php';
        $candidates[] = $root . '/auth/login.php';
        $candidates[] = $root . '/includes/signin.php';
    }

    $score_file = static function (string $src): ?string {
        if ($src === '') {
            return null;
        }
        // Same-file auth: md5($_POST['password']) / Password=md5(...) wins over password_verify
        // elsewhere in the project (e.g. modern signup pages).
        if (preg_match('/\bmd5\s*\(\s*\$_(POST|REQUEST|GET)\s*\[/i', $src)
            || preg_match('/Password\s*=\s*md5\s*\(/i', $src)
            || preg_match('/md5\s*\(\s*\$(password|pass|pwd)/i', $src)
        ) {
            return 'md5';
        }
        if (preg_match('/\bsha1\s*\(\s*\$_(POST|REQUEST|GET)\s*\[/i', $src)
            || preg_match('/sha1\s*\(\s*\$(password|pass|pwd)/i', $src)
        ) {
            return 'sha1';
        }
        if (preg_match('/password_verify\s*\(/i', $src)) {
            return 'bcrypt';
        }
        if (preg_match('/\bmd5\s*\(/i', $src) && preg_match('/Invalid Details|UserName|password/i', $src)) {
            return 'md5';
        }
        if (preg_match('/\bmd5\s*\(/i', $src)) {
            return 'md5';
        }
        if (preg_match('/\bsha1\s*\(/i', $src)) {
            return 'sha1';
        }
        if (preg_match('/\[[\'"]password[\'"]\]\s*===?\s*\$|\$\w+\s*===?\s*\$_POST\[[\'"]password[\'"]\]/i', $src)) {
            return 'plain';
        }
        if (preg_match('/Invalid Details/i', $src) && preg_match('/UserName|Password/i', $src)) {
            return 'md5';
        }
        return null;
    };

    foreach (array_unique($candidates) as $file) {
        if (!is_file($file)) {
            continue;
        }
        $mode = $score_file((string) @file_get_contents($file));
        if ($mode !== null) {
            return $mode;
        }
    }
    return 'bcrypt';
}

function sv_encode_password(string $plain, string $mode, ?string $sampleHash = null): string
{
    if ($mode === 'auto' || $mode === '') {
        $sample = trim((string) $sampleHash);
        if ($sample !== '') {
            if (preg_match('/^\$2[ayb]\$.+/', $sample)) {
                $mode = 'bcrypt';
            } elseif (preg_match('/^[a-f0-9]{32}$/i', $sample)) {
                $mode = 'md5';
            } elseif (preg_match('/^[a-f0-9]{40}$/i', $sample)) {
                $mode = 'sha1';
            } elseif (strlen($sample) < 60 && strpos($sample, '$') !== 0) {
                $mode = 'plain';
            } else {
                $mode = 'bcrypt';
            }
        } else {
            $mode = 'bcrypt';
        }
    }

    switch ($mode) {
        case 'md5':
            return md5($plain);
        case 'sha1':
            return sha1($plain);
        case 'plain':
            return $plain;
        case 'bcrypt':
        default:
            return password_hash($plain, PASSWORD_DEFAULT);
    }
}

function sv_wait_pdo(string $host, string $dbName, string $dbUser, string $dbPass): ?PDO
{
    $last = '';
    for ($i = 0; $i < 30; $i++) {
        try {
            $pdo = new PDO(
                'mysql:host=' . $host . ';dbname=' . $dbName . ';charset=utf8mb4',
                $dbUser,
                $dbPass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
            );
            $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
            if (count($tables) > 0) {
                return $pdo;
            }
            $last = 'database has 0 tables';
        } catch (Throwable $e) {
            $last = $e->getMessage();
        }
        sleep(2);
    }
    sv_log('DB not ready after retries: ' . $last);
    return null;
}

function sv_table_columns(PDO $pdo, string $table): array
{
    $cols = [];
    $safe = str_replace('`', '``', $table);
    $stmt = $pdo->query('SHOW COLUMNS FROM `' . $safe . '`');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $cols[strtolower($row['Field'])] = $row;
    }
    return $cols;
}

function sv_pick_column(array $cols, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        $key = strtolower($candidate);
        if (!array_key_exists($key, $cols)) {
            continue;
        }
        $val = $cols[$key];
        // Accept either SHOW COLUMNS row arrays or lowercase=>FieldName string maps.
        if (is_array($val) && isset($val['Field']) && is_string($val['Field']) && $val['Field'] !== '') {
            return $val['Field'];
        }
        if (is_string($val) && $val !== '') {
            return $val;
        }
    }
    return null;
}

/**
 * Leave/HR portals compare JSON user_type === "Admin". ENUM may be Admin/Employee.
 * Prefer the casing the schema (or frontend JS) actually uses.
 */
function sv_role_seed_value(array $colMeta, string $colName): string
{
    $type = strtolower((string) ($colMeta['Type'] ?? ''));
    $wanted = ['Admin', 'Administrator', 'admin', 'HR', 'Manager', 'Super Admin', 'superadmin'];
    if (preg_match('/enum\s*\((.+)\)/i', $type, $m)) {
        preg_match_all("/'([^']+)'/", $m[1], $opts);
        $options = $opts[1] ?? [];
        foreach ($wanted as $want) {
            foreach ($options as $opt) {
                if (strcasecmp((string) $opt, $want) === 0) {
                    return (string) $opt;
                }
            }
        }
        if ($options) {
            return (string) $options[0];
        }
    }
    $fromJs = sv_discover_frontend_user_type();
    return $fromJs !== '' ? $fromJs : 'Admin';
}

function sv_discover_frontend_user_type(): string
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = '';
    $roots = sv_preview_docroots();
    foreach ($roots as $root) {
        try {
            $it = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
            );
            $n = 0;
            foreach ($it as $f) {
                if ($n++ > 80) {
                    break;
                }
                if (!$f->isFile()) {
                    continue;
                }
                $ext = strtolower($f->getExtension());
                if (!in_array($ext, ['js', 'php', 'html', 'htm'], true)) {
                    continue;
                }
                $path = $f->getPathname();
                if (preg_match('#/(vendor|node_modules|\.git)/#', $path)) {
                    continue;
                }
                if (!preg_match('/login|auth|sign|ajax|script/i', $path . $f->getFilename())) {
                    continue;
                }
                $c = (string) @file_get_contents($path);
                if ($c === '') {
                    continue;
                }
                if (preg_match('/user_type\s*(?:==|===|:)\s*[\'"]([A-Za-z_ ]+)[\'"]/i', $c, $m)) {
                    $cached = trim($m[1]);
                    return $cached;
                }
            }
        } catch (Throwable $e) {
            /* ignore */
        }
    }
    return $cached;
}

function sv_default_for_column(array $colMeta, string $colName, string $seedUser, string $seedEmail, string $hash): ?string
{
    $name = strtolower($colName);
    $type = strtolower((string) ($colMeta['Type'] ?? ''));
    $nullable = strtoupper((string) ($colMeta['Null'] ?? '')) === 'YES';
    $default = $colMeta['Default'] ?? null;
    $extra = strtolower((string) ($colMeta['Extra'] ?? ''));

    if (strpos($extra, 'auto_increment') !== false) {
        return null;
    }
    if ($default !== null) {
        return null; // DB default is fine
    }
    if ($nullable) {
        return null;
    }

    if (in_array($name, ['username', 'user_name', 'user', 'login', 'admin_username', 'uname', 'name'], true)) {
        return $seedUser;
    }
    if (in_array($name, ['password', 'pass', 'pwd', 'user_password', 'passwd', 'user_pass'], true)) {
        return $hash;
    }
    if (in_array($name, ['email', 'user_email', 'mail'], true)) {
        return strpos($seedUser, '@') !== false ? $seedUser : $seedEmail;
    }
    if (preg_match('/^(reg(_?no|istration|istration_?number|number)|student_?id|enrollment)$/', $name)) {
        return preg_match('/@/', $seedUser) ? 'previewadmin' : $seedUser;
    }
    if (in_array($name, ['role', 'user_role', 'type', 'user_type', 'usertype', 'account_type'], true)) {
        return sv_role_seed_value($colMeta, $colName);
    }
    if (in_array($name, ['status', 'is_active', 'active', 'enabled'], true)) {
        if (strpos($type, 'int') !== false || strpos($type, 'tinyint') !== false || strpos($type, 'bit') !== false) {
            return '1';
        }
        return 'active';
    }
    if (preg_match('/^(full_?name|display_?name|first_?name|last_?name|fullname)$/', $name)) {
        return 'Preview Admin';
    }
    if (strpos($type, 'int') !== false || strpos($type, 'decimal') !== false || strpos($type, 'float') !== false) {
        return '0';
    }
    if (strpos($type, 'datetime') !== false || strpos($type, 'timestamp') !== false) {
        return date('Y-m-d H:i:s');
    }
    if (strpos($type, 'date') !== false) {
        return date('Y-m-d');
    }
    return '';
}

$mode = sv_detect_password_mode($docroot);
if ($mode === '') {
    $mode = 'bcrypt';
}
sv_log(
    'password mode=' . $mode . ' user=' . $seedUser . ' email=' . $seedEmail .
    ' db=' . $dbName . ' host=' . $host . ' docroot=' . $docroot
);

$pdo = sv_wait_pdo($host, $dbName, $dbUser, $dbPass);
if (!$pdo) {
    exit(0);
}

$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
$priority = [
    'admin',
    'admins',
    'tbl_admin',
    'admin_users',
    'userregistration',
    'user_registration',
    'registration',
    'users',
    'user',
    'tbl_users',
    'login',
    'accounts',
    'staff',
    'employee',
];
$candidates = [];
foreach ($priority as $name) {
    foreach ($tables as $t) {
        if (strcasecmp((string) $t, $name) === 0) {
            $candidates[] = $t;
        }
    }
}
foreach ($tables as $name) {
    if (in_array($name, $candidates, true)) {
        continue;
    }
    if (preg_match('/user|admin|staff|login|account|regist/i', (string) $name)) {
        $candidates[] = $name;
    }
}

if (!$candidates) {
    sv_log('no suitable user/admin table found in: ' . implode(',', $tables));
    exit(0);
}

$seeded = false;
foreach ($candidates as $table) {
    $colMeta = sv_table_columns($pdo, $table);
    $cols = [];
    foreach ($colMeta as $k => $meta) {
        $cols[$k] = $meta['Field'];
    }

    $userCol = sv_pick_column($cols, [
        'username',
        'UserName',
        'user_name',
        'user',
        'login',
        'admin_username',
        'email',
        'reg_no',
        'regno',
        'registration_number',
        'registrationno',
        'reg_number',
        'name',
    ]);
    $passCol = sv_pick_column($cols, [
        'password_hash',
        'password',
        'Password',
        'pass',
        'pwd',
        'user_password',
        'passwd',
        'user_pass',
        'hashed_password',
        'pass_hash',
    ]);
    if (!$userCol || !$passCol) {
        sv_log('skip table ' . $table . ' (no username/password columns)');
        continue;
    }

    $roleCol = sv_pick_column($cols, ['role', 'user_role', 'type', 'user_type', 'usertype', 'account_type', 'userlevel', 'level']);
    $emailCol = sv_pick_column($cols, ['email', 'user_email', 'mail']);
    $regCol = sv_pick_column($cols, [
        'registration_number',
        'registrationno',
        'reg_no',
        'regno',
        'reg_number',
        'regnumber',
        'student_id',
        'studentid',
        'enrollment',
        'enrolment',
    ]);
    $statusCol = sv_pick_column($cols, ['status', 'is_active', 'active', 'enabled']);
    $safeTable = str_replace('`', '``', $table);

    // Hostel-style login by email / registration number: identity must be email-shaped when
    // the primary login column is email.
    $identityValue = $seedUser;
    if (preg_match('/email/i', $userCol) && strpos($seedUser, '@') === false) {
        $identityValue = $seedEmail;
    }
    if (preg_match('/reg|student/i', $userCol) && strpos($seedUser, '@') !== false) {
        $identityValue = preg_replace('/@.*/', '', $seedUser) ?: 'previewadmin';
    }
    // TMS / CodeCanyon admin tables almost always log in as UserName=admin (not previewadmin).
    if (preg_match('/^admin/i', (string) $table) && preg_match('/previewadmin|admin@preview/i', $seedUser)) {
        $identityValue = 'admin';
        sv_log('admin-table detected — seeding identity as admin (TMS-style)');
    }

    // Sample existing hash to refine mode when auto.
    $sampleHash = null;
    try {
        $sampleStmt = $pdo->query(
            'SELECT `' . $passCol . '` FROM `' . $safeTable . '` WHERE `' . $passCol . '` IS NOT NULL AND `' . $passCol . '` <> \'\' LIMIT 1'
        );
        $sampleRow = $sampleStmt ? $sampleStmt->fetch(PDO::FETCH_ASSOC) : false;
        if ($sampleRow) {
            $sampleHash = $sampleRow[$passCol];
        }
    } catch (Throwable $_e) {
        /* ignore */
    }

    $encodeMode = $mode;
    // If login.php says bcrypt, always bcrypt (ignore misleading plaintext samples).
    if ($mode !== 'bcrypt' && $mode !== 'md5' && $mode !== 'sha1' && $mode !== 'plain') {
        $encodeMode = 'auto';
    }
    $hash = sv_encode_password($seedPass, $encodeMode === 'bcrypt' ? 'bcrypt' : ($encodeMode ?: 'auto'), is_string($sampleHash) ? $sampleHash : null);

    $roleValue = $roleCol ? sv_role_seed_value($colMeta[strtolower($roleCol)] ?? ['Type' => ''], $roleCol) : 'Admin';

    // Prefer upserting the exact seed identity; also refresh legacy admin rows' passwords
    // without renaming them away (keeps project default admin working).
    $lookupValues = array_values(
        array_unique(
            array_filter([
                $identityValue,
                $seedUser,
                $seedEmail,
                'admin',
                'superadmin',
                'administrator',
                'Admin',
                'previewadmin',
            ])
        )
    );
    $existing = null;
    foreach ($lookupValues as $lookup) {
        $stmt = $pdo->prepare('SELECT * FROM `' . $safeTable . '` WHERE `' . $userCol . '` = ? LIMIT 1');
        $stmt->execute([$lookup]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            if (strcasecmp((string) ($row[$userCol] ?? ''), $identityValue) === 0) {
                $existing = $row;
                break;
            }
            if ($emailCol && strcasecmp((string) ($row[$emailCol] ?? ''), $seedEmail) === 0) {
                $existing = $row;
                break;
            }
            if ($existing === null) {
                $existing = $row;
            }
        }
    }
    // Also find by email / registration number columns when login form uses those fields.
    if ($existing === null && $emailCol) {
        $stmt = $pdo->prepare('SELECT * FROM `' . $safeTable . '` WHERE `' . $emailCol . '` = ? LIMIT 1');
        $stmt->execute([$seedEmail]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }
    if ($existing === null && $regCol) {
        foreach ([$seedUser, 'previewadmin', 'PREVIEW001', '001'] as $regTry) {
            $stmt = $pdo->prepare('SELECT * FROM `' . $safeTable . '` WHERE `' . $regCol . '` = ? LIMIT 1');
            $stmt->execute([$regTry]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $existing = $row;
                break;
            }
        }
    }

    try {
        $matchIdentity =
            $existing &&
            (strcasecmp((string) ($existing[$userCol] ?? ''), $identityValue) === 0 ||
                ($emailCol && strcasecmp((string) ($existing[$emailCol] ?? ''), $seedEmail) === 0) ||
                ($regCol && strcasecmp((string) ($existing[$regCol] ?? ''), $seedUser) === 0));

        if ($matchIdentity) {
            // Exact seed user exists — update password (+ role/status/email/reg).
            $sets = ['`' . $passCol . '` = ?'];
            $params = [$hash];
            if ($roleCol) {
                $sets[] = '`' . $roleCol . '` = ?';
                $params[] = $roleValue;
            }
            if ($statusCol) {
                $sets[] = '`' . $statusCol . '` = ?';
                $params[] = is_numeric($existing[$statusCol] ?? '') ? 1 : 'active';
            }
            if ($emailCol) {
                $sets[] = '`' . $emailCol . '` = ?';
                $params[] = $seedEmail;
            }
            if ($regCol) {
                $sets[] = '`' . $regCol . '` = ?';
                $params[] = preg_match('/@/', $seedUser) ? 'previewadmin' : $seedUser;
            }
            $idCol = sv_pick_column($cols, ['id', 'user_id', 'uid', 'admin_id']);
            if ($idCol && isset($existing[$idCol])) {
                $params[] = $existing[$idCol];
                $pdo->prepare(
                    'UPDATE `' . $safeTable . '` SET ' . implode(', ', $sets) . ' WHERE `' . $idCol . '` = ?'
                )->execute($params);
            } else {
                $params[] = $existing[$userCol];
                $pdo->prepare(
                    'UPDATE `' . $safeTable . '` SET ' . implode(', ', $sets) . ' WHERE `' . $userCol . '` = ?'
                )->execute($params);
            }
            sv_log('updated existing user in ' . $table . ' where ' . $userCol . '=' . $identityValue);
        } else {
            // Insert seed user as a new row (do not rename project admin).
            $fields = [];
            foreach ($colMeta as $meta) {
                $field = $meta['Field'];
                $val = sv_default_for_column($meta, $field, $seedUser, $seedEmail, $hash);
                if ($val === null) {
                    continue;
                }
                $fields[$field] = $val;
            }
            // Force identity columns even if nullable defaults were skipped.
            $fields[$userCol] = $identityValue;
            $fields[$passCol] = $hash;
            if ($roleCol) {
                $fields[$roleCol] = $roleValue;
            }
            if ($emailCol) {
                $fields[$emailCol] = $seedEmail;
            }
            if ($regCol) {
                $fields[$regCol] = preg_match('/@/', $seedUser) ? 'previewadmin' : $seedUser;
            }
            if ($statusCol) {
                $fields[$statusCol] = isset($colMeta[strtolower($statusCol)]['Type']) &&
                    preg_match('/int|bit/i', $colMeta[strtolower($statusCol)]['Type'])
                    ? '1'
                    : 'active';
            }

            $colNames = array_keys($fields);
            $placeholders = implode(',', array_fill(0, count($colNames), '?'));
            $sql =
                'INSERT INTO `' .
                $safeTable .
                '` (`' .
                implode('`,`', $colNames) .
                '`) VALUES (' .
                $placeholders .
                ')';
            $pdo->prepare($sql)->execute(array_values($fields));
            sv_log('inserted user into ' . $table . ' columns=' . implode(',', $colNames));
        }

        // Also ensure classic admin row exists + password matches seed (TMS login is UserName=admin).
        if (strcasecmp((string) $identityValue, 'admin') !== 0 && getenv('PREVIEW_SEED_ALSO_RESET_ADMIN') === '1') {
            foreach (['admin', 'Admin', 'administrator'] as $adminName) {
                $stmt = $pdo->prepare(
                    'SELECT `' . $userCol . '` FROM `' . $safeTable . '` WHERE `' . $userCol . '` = ? LIMIT 1'
                );
                $stmt->execute([$adminName]);
                if ($stmt->fetchColumn()) {
                    $pdo->prepare(
                        'UPDATE `' . $safeTable . '` SET `' . $passCol . '` = ? WHERE `' . $userCol . '` = ?'
                    )->execute([$hash, $adminName]);
                    sv_log('also reset password for ' . $adminName . ' row');
                } elseif (preg_match('/^admin/i', (string) $table)) {
                    try {
                        $adminFields = [$userCol => $adminName, $passCol => $hash];
                        if ($emailCol) {
                            $adminFields[$emailCol] = 'admin@preview.local';
                        }
                        if ($roleCol) {
                            $adminFields[$roleCol] = $roleValue;
                        }
                        if ($statusCol) {
                            $adminFields[$statusCol] = isset($colMeta[strtolower($statusCol)]['Type']) &&
                                preg_match('/int|bit/i', $colMeta[strtolower($statusCol)]['Type'])
                                ? '1'
                                : 'active';
                        }
                        $cols = array_keys($adminFields);
                        $pdo->prepare(
                            'INSERT INTO `' . $safeTable . '` (`' . implode('`,`', $cols) . '`) VALUES (' .
                            implode(',', array_fill(0, count($cols), '?')) . ')'
                        )->execute(array_values($adminFields));
                        sv_log('also inserted ' . $adminName . ' into ' . $table);
                        break;
                    } catch (Throwable $e) {
                        sv_log('admin insert skipped: ' . $e->getMessage());
                    }
                }
            }
            if ($emailCol) {
                $pdo->prepare(
                    'UPDATE `' . $safeTable . '` SET `' . $passCol . '` = ? WHERE `' . $emailCol . '` LIKE ?'
                )->execute([$hash, '%admin%']);
            }
        }
    } catch (Throwable $e) {
        sv_log('failed on table ' . $table . ': ' . $e->getMessage());
        continue;
    }

    // Verify the row can be found with the seeded identity (username or email).
    $check = $pdo->prepare(
        'SELECT `' . $passCol . '`' .
        ($emailCol ? ', `' . $emailCol . '` AS __sv_email' : '') .
        ' FROM `' . $safeTable . '` WHERE `' . $userCol . '` = ? LIMIT 1'
    );
    $check->execute([$identityValue]);
    $verifyRow = $check->fetch(PDO::FETCH_ASSOC);
    if (!$verifyRow && $emailCol) {
        $check = $pdo->prepare(
            'SELECT `' . $passCol . '`, `' . $emailCol . '` AS __sv_email FROM `' . $safeTable .
            '` WHERE `' . $emailCol . '` = ? LIMIT 1'
        );
        $check->execute([$seedEmail]);
        $verifyRow = $check->fetch(PDO::FETCH_ASSOC);
    }
    $stored = $verifyRow ? ($verifyRow[$passCol] ?? false) : false;
    if ($stored === false || $stored === null || $stored === '') {
        sv_log('verify failed: no row with ' . $userCol . '=' . $identityValue . ' in ' . $table);
        continue;
    }

    $ok = false;
    if ($mode === 'bcrypt' || (is_string($stored) && preg_match('/^\$2[ayb]\$/', $stored))) {
        $ok = password_verify($seedPass, (string) $stored);
    } elseif ($mode === 'md5') {
        $ok = hash_equals(strtolower((string) $stored), md5($seedPass));
    } elseif ($mode === 'sha1') {
        $ok = hash_equals(strtolower((string) $stored), sha1($seedPass));
    } else {
        $ok = hash_equals((string) $stored, $seedPass) || password_verify($seedPass, (string) $stored);
    }

    if (!$ok) {
        sv_log('verify failed for ' . $identityValue . ' in ' . $table . ' (stored hash does not match seed password / mode=' . $mode . ')');
        continue;
    }

    $rowEmail = '';
    if ($emailCol && is_array($verifyRow) && !empty($verifyRow['__sv_email'])) {
        $rowEmail = (string) $verifyRow['__sv_email'];
    } elseif ($emailCol && is_array($verifyRow) && !empty($verifyRow[$emailCol])) {
        $rowEmail = (string) $verifyRow[$emailCol];
    } elseif (strpos($identityValue, '@') !== false) {
        $rowEmail = $identityValue;
    } else {
        $rowEmail = $seedEmail;
    }

    $emailPart = $rowEmail !== '' ? ' email=' . $rowEmail : '';
    echo '[preview] ScholarVerify admin seeded in ' . $table . ': username=' . $identityValue . $emailPart . ' password=' . $seedPass . "\n";
    sv_log('SUCCESS table=' . $table . ' username=' . $identityValue . ($rowEmail !== '' ? ' email=' . $rowEmail : '') . ' mode=' . $mode);
    $seeded = true;
    break;
}

if (!$seeded) {
    sv_log('FAILED — no user row could be inserted/updated');
    exit(1);
}
