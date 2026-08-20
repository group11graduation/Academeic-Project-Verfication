<?php
/**
 * ScholarVerify fallback DB config for PHP previews.
 * Used when the student ZIP is missing includes/config.php (common TMS layouts).
 * Defines the usual connection variables student apps expect.
 */
if (defined('SV_PREVIEW_GENERATED_CONFIG')) {
    return;
}
define('SV_PREVIEW_GENERATED_CONFIG', 1);

$__svHost = getenv('DB_HOST') ?: '127.0.0.1';
$__svName = getenv('DB_NAME') ?: (getenv('DB_DATABASE') ?: (getenv('MYSQL_DATABASE') ?: 'bbms'));
$__svUser = getenv('DB_USER') ?: (getenv('DB_USERNAME') ?: (getenv('MYSQL_USER') ?: 'root'));
$__svPass = getenv('DB_PASS');
if ($__svPass === false || $__svPass === null) {
    $__svPass = getenv('DB_PASSWORD');
}
if ($__svPass === false || $__svPass === null) {
    $__svPass = getenv('MYSQL_PASSWORD');
}
if ($__svPass === false || $__svPass === null) {
    $__svPass = 'preview-root';
}

if (!defined('DB_HOST')) {
    define('DB_HOST', $__svHost);
}
if (!defined('DB_NAME')) {
    define('DB_NAME', $__svName);
}
if (!defined('DB_USER')) {
    define('DB_USER', $__svUser);
}
if (!defined('DB_PASS')) {
    define('DB_PASS', $__svPass);
}

$dbh = null;
$conn = null;
$con = null;
$mysqli = null;
$pdo = null;

try {
    $dbh = new PDO(
        'mysql:host=' . $__svHost . ';dbname=' . $__svName . ';charset=utf8mb4',
        $__svUser,
        (string) $__svPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5,
        ]
    );
    $pdo = $dbh;
} catch (Throwable $e) {
    // Still try mysqli for apps that only use that.
    $dbh = null;
}

if (class_exists('mysqli')) {
    try {
        if (function_exists('mysqli_report')) {
            mysqli_report(MYSQLI_REPORT_OFF);
        }
        $mysqli = @new mysqli($__svHost, $__svUser, (string) $__svPass, $__svName);
        if ($mysqli instanceof mysqli && !$mysqli->connect_errno) {
            $con = $mysqli;
            $conn = $mysqli;
            if ($dbh === null) {
                // Some code uses $dbh as mysqli — keep a second alias via a thin note in globals.
                $GLOBALS['dbh'] = $mysqli;
            }
        } else {
            $mysqli = null;
        }
    } catch (Throwable $e) {
        $mysqli = null;
    }
}

// Export common aliases into the global scope for include() consumers.
$GLOBALS['dbh'] = $dbh !== null ? $dbh : ($mysqli ?: null);
$GLOBALS['pdo'] = $pdo !== null ? $pdo : $dbh;
$GLOBALS['conn'] = $conn !== null ? $conn : $mysqli;
$GLOBALS['con'] = $con !== null ? $con : $mysqli;
$GLOBALS['mysqli'] = $mysqli;
$GLOBALS['connection'] = $GLOBALS['conn'];

// Also set local vars when this file is included into another scope.
$dbh = $GLOBALS['dbh'];
$pdo = $GLOBALS['pdo'];
$conn = $GLOBALS['conn'];
$con = $GLOBALS['con'];
$mysqli = $GLOBALS['mysqli'];
