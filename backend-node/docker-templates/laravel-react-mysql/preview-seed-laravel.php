<?php
/**
 * ScholarVerify Laravel preview login seeder.
 * Creates/updates previewadmin and resets common admin passwords.
 * Writes hashes via DB::table to avoid double-bcrypt from User model mutators.
 * Supports bcrypt / md5 / sha1 / plain (detected from Auth controllers).
 */
declare(strict_types=1);

function sv_log(string $msg): void
{
    echo '[preview-seed-laravel] ' . $msg . PHP_EOL;
}

function sv_seed_detect_password_mode(string $root): string
{
    $forced = strtolower(trim((string) getenv('PREVIEW_PASSWORD_MODE')));
    if (in_array($forced, ['bcrypt', 'md5', 'sha1', 'plain'], true)) {
        return $forced;
    }
    // 'auto' or empty → inspect Auth controllers

    $blob = '';
    foreach (['/app/Http/Controllers', '/app/Http/Controllers/Api', '/app/Http/Controllers/Auth', '/app/Http/Controllers/API'] as $rel) {
        $dir = $root . $rel;
        if (!is_dir($dir)) {
            continue;
        }
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
        foreach ($it as $file) {
            if ($file->isFile() && strtolower($file->getExtension()) === 'php') {
                $blob .= "\n" . (string) @file_get_contents($file->getPathname());
            }
        }
    }
    if ($blob === '') {
        return 'bcrypt';
    }
    if (preg_match('/Hash::check\s*\(|password_verify\s*\(|Auth::attempt\s*\(/i', $blob)) {
        return 'bcrypt';
    }
    if (preg_match('/\bmd5\s*\(/i', $blob) && !preg_match('/password_verify\s*\(|Hash::check\s*\(/i', $blob)) {
        return 'md5';
    }
    if (preg_match('/\bsha1\s*\(/i', $blob) && !preg_match('/password_verify\s*\(|Hash::check\s*\(/i', $blob)) {
        return 'sha1';
    }
    if (preg_match('/password\s*===?\s*\$|\$\w+->password\s*===?/i', $blob)) {
        return 'plain';
    }
    return 'bcrypt';
}

function sv_seed_encode_password(string $plain, string $mode): string
{
    switch ($mode) {
        case 'md5':
            return md5($plain);
        case 'sha1':
            return sha1($plain);
        case 'plain':
            return $plain;
        case 'bcrypt':
        default:
            return Illuminate\Support\Facades\Hash::make($plain);
    }
}

function sv_seed_password_ok(string $plain, string $stored, string $mode): bool
{
    if ($stored === '') {
        return false;
    }
    if ($mode === 'md5') {
        return strcasecmp($stored, md5($plain)) === 0;
    }
    if ($mode === 'sha1') {
        return strcasecmp($stored, sha1($plain)) === 0;
    }
    if ($mode === 'plain') {
        return hash_equals($stored, $plain);
    }
    try {
        return Illuminate\Support\Facades\Hash::check($plain, $stored);
    } catch (Throwable $e) {
        return password_verify($plain, $stored);
    }
}

try {
    $root = getenv('LARAVEL_ROOT') ?: getcwd();
    if (!is_file($root . '/vendor/autoload.php') || !is_file($root . '/bootstrap/app.php')) {
        sv_log('skip: not a Laravel root (' . $root . ')');
        exit(0);
    }

    require $root . '/vendor/autoload.php';
    $app = require $root . '/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

    $user = trim((string) (getenv('PREVIEW_SEED_USERNAME') ?: getenv('ADMIN_USERNAME') ?: 'previewadmin'));
    $pass = trim((string) (getenv('PREVIEW_SEED_PASSWORD') ?: getenv('ADMIN_PASSWORD') ?: 'Preview123!'));
    if ($pass === '' || $pass === 'preview-root') {
        $pass = 'Preview123!';
    }
    // Prefer typing the same value in the Username field: store email=previewadmin when no @.
    $email = str_contains($user, '@') ? $user : $user;
    $emailAlias = str_contains($user, '@') ? $user : ($user . '@preview.local');
    $credJson = json_encode(
        ['username' => $user, 'password' => $pass, 'email' => $emailAlias],
        JSON_UNESCAPED_SLASHES
    );
    @file_put_contents('/preview-laravel-credentials.json', $credJson);
    @file_put_contents('/tmp/preview-laravel-credentials.json', $credJson);
    $mode = sv_seed_detect_password_mode($root);
    sv_log("password mode → {$mode}");

    $table = null;
    foreach (['users', 'user', 'admins', 'admin_users', 'accounts'] as $t) {
        if (Illuminate\Support\Facades\Schema::hasTable($t)) {
            $table = $t;
            break;
        }
    }
    if (!$table) {
        sv_log('skip: no users table');
        exit(0);
    }

    $cols = Illuminate\Support\Facades\Schema::getColumnListing($table);
    $has = static fn(string $c): bool => in_array($c, $cols, true);
    $passCol = $has('password') ? 'password' : ($has('password_hash') ? 'password_hash' : null);
    if (!$passCol) {
        sv_log('skip: no password column on ' . $table);
        exit(0);
    }

    $hash = sv_seed_encode_password($pass, $mode);
    $now = now();

    $row = [$passCol => $hash];
    if ($has('name')) {
        $row['name'] = $user;
    }
    if ($has('username')) {
        $row['username'] = $user;
    }
    if ($has('email')) {
        $row['email'] = $email;
    }
    if ($has('email_verified_at')) {
        $row['email_verified_at'] = $now;
    }
    foreach (
        [
            'role' => 'admin',
            'user_role' => 'admin',
            'type' => 'admin',
            'user_type' => 'admin',
            'role_name' => 'admin',
        ] as $col => $val
    ) {
        if ($has($col)) {
            $row[$col] = $val;
        }
    }
    if ($has('role_id')) {
        $row['role_id'] = 1;
    }
    if ($has('is_admin')) {
        $row['is_admin'] = 1;
    }
    if ($has('is_active')) {
        $row['is_active'] = 1;
    }
    if ($has('active')) {
        $row['active'] = 1;
    }
    if ($has('status')) {
        // Prefer numeric 1 when column looks tinyint-ish; else 'active'
        $row['status'] = 'active';
    }
    if ($has('deleted_at')) {
        // ensure not soft-deleted on insert
    }
    if ($has('created_at')) {
        $row['created_at'] = $now;
    }
    if ($has('updated_at')) {
        $row['updated_at'] = $now;
    }

    $existing = null;
    if ($has('username')) {
        $existing = Illuminate\Support\Facades\DB::table($table)->where('username', $user)->first();
    }
    if (!$existing && $has('email')) {
        $existing = Illuminate\Support\Facades\DB::table($table)->where('email', $email)->first()
            ?: Illuminate\Support\Facades\DB::table($table)->where('email', $emailAlias)->first()
            ?: Illuminate\Support\Facades\DB::table($table)->where('email', $user)->first();
    }

    if ($existing && $has('id')) {
        $update = $row;
        unset($update['created_at']);
        if ($has('deleted_at')) {
            $update['deleted_at'] = null;
        }
        Illuminate\Support\Facades\DB::table($table)->where('id', $existing->id)->update($update);
        sv_log("updated existing user {$user} in {$table} id={$existing->id}");
    } else {
        try {
            Illuminate\Support\Facades\DB::table($table)->insert($row);
            sv_log("inserted user {$user} into {$table}");
        } catch (Throwable $e) {
            sv_log('insert failed: ' . $e->getMessage());
        }
    }

    // Also ensure @preview.local alias row for apps that require a real email format.
    if ($has('email') && !str_contains($user, '@') && $email !== $emailAlias) {
        $alias = Illuminate\Support\Facades\DB::table($table)->where('email', $emailAlias)->first();
        if ($alias && $has('id')) {
            Illuminate\Support\Facades\DB::table($table)->where('id', $alias->id)->update([
                $passCol => $hash,
            ] + ($has('updated_at') ? ['updated_at' => $now] : []) + ($has('deleted_at') ? ['deleted_at' => null] : []));
            sv_log("updated alias email={$emailAlias}");
        } elseif (!$alias) {
            $dup = $row;
            $dup['email'] = $emailAlias;
            if ($has('username') && $existing) {
                unset($dup['username']);
                if ($has('name')) {
                    $dup['name'] = $user . ' (email login)';
                }
            }
            try {
                Illuminate\Support\Facades\DB::table($table)->insert($dup);
                sv_log("inserted alias email={$emailAlias}");
            } catch (Throwable $e) {
                sv_log('alias insert skipped: ' . $e->getMessage());
            }
        }
    }

    // Reset passwords on common admin accounts + first rows (preview sandbox).
    if (getenv('PREVIEW_SEED_ALSO_RESET_ADMIN') !== '0') {
        $reset = 0;
        $passUpdate = [$passCol => $hash] + ($has('updated_at') ? ['updated_at' => $now] : []);
        if ($has('deleted_at')) {
            $passUpdate['deleted_at'] = null;
        }
        if ($has('username')) {
            $reset += Illuminate\Support\Facades\DB::table($table)
                ->whereIn('username', ['admin', 'administrator', 'root', 'Admin', 'previewadmin', $user])
                ->update($passUpdate);
        }
        if ($has('email')) {
            $reset += Illuminate\Support\Facades\DB::table($table)
                ->where(function ($q) use ($email, $emailAlias, $user) {
                    $q->where('email', $email)
                        ->orWhere('email', $emailAlias)
                        ->orWhere('email', $user)
                        ->orWhere('email', 'admin@admin.com')
                        ->orWhere('email', 'admin@example.com')
                        ->orWhere('email', 'like', 'admin@%');
                })
                ->update($passUpdate);
        }
        if ($has('id')) {
            $ids = Illuminate\Support\Facades\DB::table($table)->orderBy('id')->limit(8)->pluck('id');
            foreach ($ids as $id) {
                Illuminate\Support\Facades\DB::table($table)->where('id', $id)->update($passUpdate);
                $reset++;
            }
        }
        sv_log("reset password on {$reset} row(s) to {$pass} (mode={$mode})");
    }

    $check = null;
    if ($has('username')) {
        $check = Illuminate\Support\Facades\DB::table($table)->where('username', $user)->first();
    }
    if (!$check && $has('email')) {
        $check = Illuminate\Support\Facades\DB::table($table)->where('email', $email)->first()
            ?: Illuminate\Support\Facades\DB::table($table)->where('email', $emailAlias)->first();
    }
    $stored = $check ? ($check->{$passCol} ?? null) : null;
    $verified = $stored && sv_seed_password_ok($pass, (string) $stored, $mode);

    // Log lines parsed by parsePhpBootstrapCredentialsFromLog (must match "ScholarVerify admin seeded").
    if ($verified) {
        sv_log("SUCCESS username={$user} email={$email} password={$pass} (verified mode={$mode})");
        echo '[preview] ScholarVerify admin seeded: username=' . $user
            . ' email=' . $email . ' password=' . $pass . PHP_EOL;
        echo '[preview] ScholarVerify Laravel admin seeded: username=' . $user
            . ' email=' . $email . ' password=' . $pass . PHP_EOL;
    } else {
        sv_log('WARNING: password verify inconclusive — try password ' . $pass);
        echo '[preview] ScholarVerify admin seeded: username=' . $user
            . ' email=' . $email . ' password=' . $pass . PHP_EOL;
    }
} catch (Throwable $e) {
    fwrite(STDERR, '[preview-seed-laravel] FAILED: ' . $e->getMessage() . PHP_EOL);
    exit(0);
}
