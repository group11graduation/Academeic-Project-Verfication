<?php
/**
 * ScholarVerify Laravel preview auth patcher.
 * Makes student AuthControllers accept username OR email, and registers a
 * high-priority /api/auth/login fallback that authenticates the seeded preview user.
 */
declare(strict_types=1);

function sv_auth_log(string $msg): void
{
    echo '[preview-patch-laravel-auth] ' . $msg . PHP_EOL;
}

function sv_auth_find_controllers(string $root): array
{
    $dirs = [
        $root . '/app/Http/Controllers',
        $root . '/app/Http/Controllers/Api',
        $root . '/app/Http/Controllers/Auth',
        $root . '/app/Http/Controllers/API',
    ];
    $out = [];
    foreach ($dirs as $dir) {
        if (!is_dir($dir)) {
            continue;
        }
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
        foreach ($it as $file) {
            if (!$file->isFile() || strtolower($file->getExtension()) !== 'php') {
                continue;
            }
            $path = $file->getPathname();
            $base = strtolower($file->getBasename('.php'));
            if (
                str_contains($base, 'auth')
                || str_contains($base, 'login')
                || str_contains($base, 'user')
                || str_contains($base, 'account')
            ) {
                $out[] = $path;
            }
        }
    }
    return array_values(array_unique($out));
}

function sv_auth_detect_password_mode(string $root): string
{
    $forced = strtolower(trim((string) getenv('PREVIEW_PASSWORD_MODE')));
    if (in_array($forced, ['bcrypt', 'md5', 'sha1', 'plain'], true)) {
        return $forced;
    }
    // 'auto' or empty → inspect Auth controllers

    $blob = '';
    foreach (sv_auth_find_controllers($root) as $path) {
        $blob .= "\n" . (string) @file_get_contents($path);
    }
    if ($blob === '') {
        return 'bcrypt';
    }
    if (preg_match('/Hash::check\s*\(|password_verify\s*\(|Auth::attempt\s*\(/i', $blob)) {
        return 'bcrypt';
    }
    if (preg_match('/\bmd5\s*\(\s*\$/', $blob) && !preg_match('/password_verify\s*\(/i', $blob)) {
        return 'md5';
    }
    if (preg_match('/\bsha1\s*\(\s*\$/', $blob) && !preg_match('/password_verify\s*\(/i', $blob)) {
        return 'sha1';
    }
    if (preg_match('/\$\w+->password\s*===?\s*\$|password\s*===?\s*\$_(?:POST|REQUEST)/i', $blob)) {
        return 'plain';
    }
    return 'bcrypt';
}

function sv_auth_patch_controller(string $path): bool
{
    $src = @file_get_contents($path);
    if ($src === false || $src === '') {
        return false;
    }
    if (str_contains($src, 'SV_PREVIEW_AUTH_PATCH')) {
        return false;
    }
    // Only touch files that look like login handlers.
    if (!preg_match('/function\s+login\s*\(|Auth::attempt\s*\(|Invalid username or password|invalid_credentials|Invalid credentials/i', $src)) {
        return false;
    }

    $helper = <<<'PHP'

    /** SV_PREVIEW_AUTH_PATCH */
    private function svPreviewLoginId(\Illuminate\Http\Request $request): string
    {
        foreach (['username', 'email', 'login', 'identifier', 'user', 'name'] as $key) {
            $v = trim((string) $request->input($key, ''));
            if ($v !== '') {
                return $v;
            }
        }
        return '';
    }

    private function svPreviewFindUser(string $login)
    {
        if ($login === '' || !class_exists(\App\Models\User::class)) {
            return null;
        }
        $q = \App\Models\User::query();
        $cols = [];
        try {
            $cols = \Illuminate\Support\Facades\Schema::getColumnListing((new \App\Models\User())->getTable());
        } catch (\Throwable $e) {
            $cols = ['email', 'username'];
        }
        $q->where(function ($inner) use ($login, $cols) {
            if (in_array('username', $cols, true)) {
                $inner->orWhere('username', $login);
            }
            if (in_array('email', $cols, true)) {
                $inner->orWhere('email', $login);
            }
            if (in_array('name', $cols, true)) {
                $inner->orWhere('name', $login);
            }
        });
        return $q->first();
    }

PHP;

    // Inject helpers before the last closing brace of the class.
    if (!preg_match('/\}\s*$/', $src)) {
        return false;
    }
    $patched = preg_replace('/\}\s*$/', $helper . "\n}\n", $src, 1);
    if (!is_string($patched) || $patched === $src) {
        return false;
    }

    // Soft-rewrite Auth::attempt($request->only('email','password')) — do NOT
    // pass email+username together (AND). Prefer merging username→email instead.
    $patched = preg_replace(
        '/Auth::attempt\(\s*\$request->only\(\s*[\'"]email[\'"]\s*,\s*[\'"]password[\'"]\s*\)\s*\)/',
        'Auth::attempt([\'email\' => $request->input(\'email\') ?: $request->input(\'username\'), \'password\' => $request->input(\'password\')]) /* SV_PREVIEW_AUTH_PATCH */',
        $patched,
        1
    );
    $patched = preg_replace(
        '/Auth::attempt\(\s*\$request->only\(\s*[\'"]username[\'"]\s*,\s*[\'"]password[\'"]\s*\)\s*\)/',
        'Auth::attempt([\'username\' => $request->input(\'username\') ?: $request->input(\'email\'), \'password\' => $request->input(\'password\')]) /* SV_PREVIEW_AUTH_PATCH */',
        $patched,
        1
    );

    // Normalize: before Auth::attempt, merge username into email when email empty.
    if (preg_match('/function\s+login\s*\(\s*(?:Request\s+)?\$request/', $patched)) {
        $patched = preg_replace(
            '/(function\s+login\s*\([^{]*\{)/',
            '$1' . "\n        /* SV_PREVIEW_AUTH_PATCH */\n        if (!\$request->filled('email') && \$request->filled('username')) {\n            \$request->merge(['email' => \$request->input('username')]);\n        }\n        if (!\$request->filled('username') && \$request->filled('email')) {\n            \$request->merge(['username' => \$request->input('email')]);\n        }\n",
            $patched,
            1
        );
    }

    if (@file_put_contents($path, $patched) === false) {
        return false;
    }
    sv_auth_log('patched controller ' . $path);
    return true;
}

function sv_auth_strip_shim_requires(string $src): string
{
    $cleaned = preg_replace(
        '/\n?\/\/\s*SV_PREVIEW_AUTH_SHIM\s*\n(?:if\s*\(\s*file_exists\s*\(\s*__DIR__\s*\.\s*\'\/preview_sv_auth\.php\'\s*\)\s*\)\s*\{\s*)?require\s+__DIR__\s*\.\s*\'\/preview_sv_auth\.php\'\s*;\s*\}?\s*/i',
        "\n",
        $src
    );
    return is_string($cleaned) ? $cleaned : $src;
}

function sv_auth_restore_routes_file(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $bak = $path . '.sv-original';
    $src = (string) file_get_contents($path);

    // First-run backup of the pristine student file (before any of our injects).
    if (!is_file($bak) && !str_contains($src, 'preview_sv_auth.php') && !str_contains($src, 'SV_PREVIEW_AUTH_SHIM')) {
        @copy($path, $bak);
        sv_auth_log('backed up ' . $path);
    }

    // Prefer restoring the pristine copy — earlier injects before declare(strict_types)
    // could leave routes/api.php in a permanently fatal state.
    if (is_file($bak)) {
        $original = (string) file_get_contents($bak);
        if ($original !== '' && $original !== $src) {
            file_put_contents($path, $original);
            sv_auth_log('restored pristine ' . $path);
            return;
        }
    }

    if (str_contains($src, 'preview_sv_auth.php') || str_contains($src, 'SV_PREVIEW_AUTH_SHIM')) {
        $cleaned = sv_auth_strip_shim_requires($src);
        if ($cleaned !== $src) {
            file_put_contents($path, $cleaned);
            sv_auth_log('stripped shim requires from ' . $path);
        }
    }
}

function sv_auth_write_route_shim(string $root): void
{
    $routesDir = $root . '/routes';
    if (!is_dir($routesDir)) {
        return;
    }

    $shim = <<<'PHP'
<?php
/**
 * ScholarVerify preview auth shim (optional).
 * Login is primarily handled by Apache front-door preview-sv-login.php.
 * This file is kept for manual require / debugging only — do NOT inject into api.php.
 * SV_PREVIEW_AUTH_SHIM
 */
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('sv_preview_auth_login_handler')) {
    function sv_preview_auth_creds(): array
    {
        foreach (['/preview-laravel-credentials.json', '/tmp/preview-laravel-credentials.json'] as $p) {
            if (is_file($p)) {
                $j = json_decode((string) file_get_contents($p), true);
                if (is_array($j) && !empty($j['username'])) {
                    return $j;
                }
            }
        }
        return [];
    }

    function sv_preview_auth_login_handler(Request $request)
    {
        $creds = sv_preview_auth_creds();
        $seedUser = trim((string) ($creds['username'] ?? (getenv('PREVIEW_SEED_USERNAME') ?: getenv('ADMIN_USERNAME') ?: 'previewadmin')));
        $seedPass = trim((string) ($creds['password'] ?? (getenv('PREVIEW_SEED_PASSWORD') ?: getenv('ADMIN_PASSWORD') ?: 'Preview123!')));
        $seedEmail = trim((string) ($creds['email'] ?? ($seedUser . (str_contains($seedUser, '@') ? '' : '@preview.local'))));
        if ($seedPass === '' || $seedPass === 'preview-root') {
            $seedPass = 'Preview123!';
        }
        $acceptedPasswords = array_values(array_unique(array_filter([
            $seedPass,
            'Preview123!',
            trim((string) (getenv('PREVIEW_ADMIN_PASSWORD') ?: '')),
            trim((string) (getenv('ADMIN_PASSWORD') ?: '')),
        ])));

        $login = '';
        foreach (['username', 'email', 'login', 'identifier', 'user', 'name'] as $key) {
            $v = trim((string) $request->input($key, ''));
            if ($v !== '') {
                $login = $v;
                break;
            }
        }
        $password = (string) $request->input('password', '');

        $userModel = class_exists(\App\Models\User::class) ? \App\Models\User::class : null;
        $user = null;
        if ($userModel && $login !== '') {
            try {
                $table = (new $userModel())->getTable();
                $cols = Schema::getColumnListing($table);
                $q = $userModel::query();
                $q->where(function ($inner) use ($login, $cols) {
                    if (in_array('username', $cols, true)) {
                        $inner->orWhere('username', $login);
                    }
                    if (in_array('email', $cols, true)) {
                        $inner->orWhere('email', $login);
                    }
                    if (in_array('name', $cols, true)) {
                        $inner->orWhere('name', $login);
                    }
                });
                $user = $q->first();
            } catch (\Throwable $e) {
                $user = null;
            }
        }

        $ok = false;
        if ($user) {
            $hash = (string) ($user->getAuthPassword() ?? $user->password ?? '');
            if ($hash !== '' && Hash::check($password, $hash)) {
                $ok = true;
            } elseif ($hash !== '' && strlen($hash) === 32 && strcasecmp($hash, md5($password)) === 0) {
                $ok = true;
            } elseif ($hash !== '' && strlen($hash) === 40 && strcasecmp($hash, sha1($password)) === 0) {
                $ok = true;
            } elseif ($hash !== '' && hash_equals($hash, $password)) {
                $ok = true;
            }
        }

        $loginMatchesSeed =
            $login !== ''
            && (
                strcasecmp($login, $seedUser) === 0
                || strcasecmp($login, $seedEmail) === 0
                || strcasecmp($login, 'previewadmin') === 0
                || strcasecmp($login, 'admin') === 0
            );
        $passwordMatchesSeed = $password !== '' && in_array($password, $acceptedPasswords, true);
        if (!$ok && $loginMatchesSeed && $passwordMatchesSeed) {
            if ($user) {
                $ok = true;
            } else {
                $token = base64_encode('sv-preview|' . $seedUser . '|' . time());
                $fake = [
                    'id' => 1,
                    'name' => $seedUser,
                    'username' => $seedUser,
                    'email' => $seedEmail,
                    'role' => 'admin',
                    'isAdmin' => true,
                ];
                return response()->json([
                    'message' => 'Login successful',
                    'success' => true,
                    'token' => $token,
                    'access_token' => $token,
                    'role' => 'admin',
                    'user' => $fake,
                    'data' => ['token' => $token, 'user' => $fake, 'role' => 'admin'],
                ]);
            }
        }

        if (!$ok || !$user) {
            return response()->json(['message' => 'Invalid username or password.'], 401);
        }

        try {
            Auth::login($user);
        } catch (\Throwable $e) {
        }

        $token = base64_encode('sv-preview|' . $user->getAuthIdentifier() . '|' . time());
        try {
            if (method_exists($user, 'createToken')) {
                $token = $user->createToken('preview')->plainTextToken;
            }
        } catch (\Throwable $e) {
        }

        return response()->json([
            'message' => 'Login successful',
            'success' => true,
            'token' => $token,
            'access_token' => $token,
            'role' => 'admin',
            'user' => $user,
            'data' => ['token' => $token, 'user' => $user, 'role' => 'admin'],
        ]);
    }
}

PHP;

    $shimPath = $routesDir . '/preview_sv_auth.php';
    file_put_contents($shimPath, $shim);
    sv_auth_log('wrote ' . $shimPath . ' (not injected — Apache front-door handles login)');

    // CRITICAL: restore routes files and DO NOT inject.
    // Prior injects before declare(strict_types=1) caused fatal 500 on every /api/* route.
    foreach (['api.php', 'web.php'] as $routesFile) {
        sv_auth_restore_routes_file($routesDir . '/' . $routesFile);
    }
}

try {
    $root = getenv('LARAVEL_ROOT') ?: getcwd();
    if (!is_file($root . '/artisan')) {
        sv_auth_log('skip: not a Laravel root');
        exit(0);
    }

    $mode = sv_auth_detect_password_mode($root);
    putenv('PREVIEW_PASSWORD_MODE=' . $mode);
    $_ENV['PREVIEW_PASSWORD_MODE'] = $mode;
    sv_auth_log('password mode → ' . $mode);

    $patched = 0;
    foreach (sv_auth_find_controllers($root) as $path) {
        if (sv_auth_patch_controller($path)) {
            $patched++;
        }
    }
    sv_auth_log("controllers patched: {$patched}");

    sv_auth_write_route_shim($root);
    sv_auth_log('done');
} catch (Throwable $e) {
    fwrite(STDERR, '[preview-patch-laravel-auth] FAILED: ' . $e->getMessage() . PHP_EOL);
    exit(0);
}
