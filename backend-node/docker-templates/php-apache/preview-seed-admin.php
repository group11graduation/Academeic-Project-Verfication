<?php
/**
 * ScholarVerify PHP preview admin seeder.
 * Runs after student setup scripts so PREVIEW_SEED_USERNAME / PREVIEW_SEED_PASSWORD always work.
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

if (!$host || !$dbName || $seedUser === '' || $seedPass === '') {
    fwrite(STDERR, "[preview] seed-admin: skip (missing DB or seed credentials)\n");
    exit(0);
}

$mysqlPass = getenv('DB_PASS') ?: 'preview-root';
if ($seedPass === $mysqlPass || $seedPass === 'preview-root') {
    fwrite(STDERR, "[preview] seed-admin: skip (seed password looks like MySQL sidecar password)\n");
    exit(0);
}

try {
    $pdo = new PDO(
        'mysql:host=' . $host . ';dbname=' . $dbName . ';charset=utf8mb4',
        $dbUser,
        $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 8]
    );
} catch (Throwable $e) {
    fwrite(STDERR, '[preview] seed-admin: DB connect failed: ' . $e->getMessage() . "\n");
    exit(0);
}

function sv_table_columns(PDO $pdo, string $table): array
{
    $cols = [];
    $safe = str_replace('`', '``', $table);
    $stmt = $pdo->query('SHOW COLUMNS FROM `' . $safe . '`');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $cols[strtolower($row['Field'])] = $row['Field'];
    }
    return $cols;
}

function sv_pick_column(array $cols, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        $key = strtolower($candidate);
        if (isset($cols[$key])) {
            return $cols[$key];
        }
    }
    return null;
}

function sv_role_values(): array
{
    return ['superadmin', 'super_admin', 'admin', 'Admin', 'ADMIN', 'administrator', '1', '0'];
}

function sv_hash_for_table(?string $sampleHash, string $plain): string
{
    $sample = trim((string) $sampleHash);
    if ($sample !== '') {
        if (preg_match('/^\$2[ayb]\$.+/', $sample)) {
            return password_hash($plain, PASSWORD_DEFAULT);
        }
        if (preg_match('/^[a-f0-9]{32}$/i', $sample)) {
            return md5($plain);
        }
        if (preg_match('/^[a-f0-9]{40}$/i', $sample)) {
            return sha1($plain);
        }
        if (strlen($sample) < 60 && strpos($sample, '$') !== 0) {
            return $plain;
        }
    }
    return password_hash($plain, PASSWORD_DEFAULT);
}
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
$priority = ['users', 'user', 'admins', 'admin', 'tbl_users', 'tbl_admin', 'admin_users', 'login', 'accounts', 'staff', 'employee'];
$candidates = [];
foreach ($priority as $name) {
    if (in_array($name, $tables, true)) {
        $candidates[] = $name;
    }
}
foreach ($tables as $name) {
    if (in_array($name, $candidates, true)) {
        continue;
    }
    if (preg_match('/user|admin|staff|login|account/i', (string) $name)) {
        $candidates[] = $name;
    }
}

$seeded = false;
foreach ($candidates as $table) {
    $cols = sv_table_columns($pdo, $table);
    $userCol = sv_pick_column($cols, ['username', 'user_name', 'user', 'login', 'admin_username', 'name', 'email']);
    $passCol = sv_pick_column($cols, ['password', 'pass', 'pwd', 'user_password', 'passwd', 'user_pass']);
    if (!$userCol || !$passCol) {
        continue;
    }

    $roleCol = sv_pick_column($cols, ['role', 'user_role', 'type', 'user_type', 'usertype', 'account_type', 'userlevel', 'level']);
    $emailCol = sv_pick_column($cols, ['email', 'user_email', 'mail']);
    $statusCol = sv_pick_column($cols, ['status', 'is_active', 'active', 'enabled']);

    $targetRow = null;
    $lookupValues = array_values(array_unique(array_filter([$seedUser, 'admin', 'superadmin', 'administrator'])));

    foreach ($lookupValues as $lookup) {
        $stmt = $pdo->prepare('SELECT * FROM `' . str_replace('`', '``', $table) . '` WHERE `' . $userCol . '` = ? LIMIT 1');
        $stmt->execute([$lookup]);
        $targetRow = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($targetRow) {
            break;
        }
    }

    if (!$targetRow && $roleCol) {
        foreach (sv_role_values() as $role) {
            $stmt = $pdo->prepare(
                'SELECT * FROM `' . str_replace('`', '``', $table) . '` WHERE LOWER(CAST(`' . $roleCol . '` AS CHAR)) = LOWER(?) LIMIT 1'
            );
            $stmt->execute([$role]);
            $targetRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($targetRow) {
                break;
            }
        }
    }

    if (!$targetRow) {
        $stmt = $pdo->query('SELECT * FROM `' . str_replace('`', '``', $table) . '` ORDER BY 1 ASC LIMIT 1');
        $targetRow = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    $safeTable = str_replace('`', '``', $table);
    $sampleHash = $targetRow[$passCol] ?? null;
    if (!$sampleHash) {
        try {
            $sampleStmt = $pdo->query(
                'SELECT `' . $passCol . '` FROM `' . $safeTable . '` WHERE `' . $passCol . '` IS NOT NULL AND `' . $passCol . '` <> \'\' LIMIT 1'
            );
            $sampleRow = $sampleStmt ? $sampleStmt->fetch(PDO::FETCH_ASSOC) : false;
            if ($sampleRow) {
                $sampleHash = $sampleRow[$passCol];
            }
        } catch (Throwable $_sample) {
            $sampleHash = null;
        }
    }
    $hash = sv_hash_for_table(is_string($sampleHash) ? $sampleHash : null, $seedPass);

    if ($targetRow) {
        $whereCol = $userCol;
        $whereVal = $targetRow[$userCol] ?? $seedUser;
        if ($whereVal === '' || $whereVal === null) {
            $idCol = sv_pick_column($cols, ['id', 'user_id', 'uid', 'admin_id']);
            if ($idCol && isset($targetRow[$idCol])) {
                $whereCol = $idCol;
                $whereVal = $targetRow[$idCol];
            }
        }

        $sets = ['`' . $passCol . '` = ?'];
        $params = [$hash];
        if ($userCol && ($targetRow[$userCol] ?? '') !== $seedUser) {
            $sets[] = '`' . $userCol . '` = ?';
            $params[] = $seedUser;
        }
        if ($roleCol) {
            $sets[] = '`' . $roleCol . '` = ?';
            $params[] = 'admin';
        }
        if ($statusCol) {
            $sets[] = '`' . $statusCol . '` = ?';
            $params[] = is_numeric($targetRow[$statusCol] ?? '') ? 1 : 'active';
        }
        $params[] = $whereVal;
        $pdo->prepare(
            'UPDATE `' . $safeTable . '` SET ' . implode(', ', $sets) . ' WHERE `' . $whereCol . '` = ?'
        )->execute($params);
    } else {
        $fields = [$userCol => $seedUser, $passCol => $hash];
        if ($roleCol) {
            $fields[$roleCol] = 'admin';
        }
        if ($emailCol && strpos($seedUser, '@') !== false) {
            $fields[$emailCol] = $seedUser;
        }
        if ($statusCol) {
            $fields[$statusCol] = 'active';
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
        try {
            $pdo->prepare($sql)->execute(array_values($fields));
        } catch (Throwable $insertErr) {
            fwrite(STDERR, '[preview] seed-admin: insert into ' . $table . ' failed: ' . $insertErr->getMessage() . "\n");
            continue;
        }
    }

    echo '[preview] ScholarVerify admin seeded in ' . $table . ': username=' . $seedUser . ' password=' . $seedPass . "\n";
    $seeded = true;
    break;
}

if (!$seeded) {
    fwrite(STDERR, "[preview] seed-admin: no suitable user/admin table found\n");
}
