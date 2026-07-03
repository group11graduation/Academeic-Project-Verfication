<?php
/**
 * ScholarVerify PHP preview sandbox bootstrap (auto_prepended in preview containers).
 * Overrides DB settings from container env so student localhost/XAMPP configs work in Docker.
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
$svUser = $svEnv(['DB_USER'], 'root');
$svPass = $svEnv(['DB_PASS'], '');
$svName = $svEnv(['DB_NAME']);
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
