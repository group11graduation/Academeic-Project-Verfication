<?php
/**
 * ScholarVerify Laravel preview login seeder.
 * Creates/updates previewadmin and resets common admin passwords.
 * Writes hashes via DB::table to avoid double-bcrypt from User model mutators.
 */
declare(strict_types=1);

function sv_log(string $msg): void
{
    echo '[preview-seed-laravel] ' . $msg . PHP_EOL;
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
    $email = str_contains($user, '@') ? $user : ($user . '@preview.local');

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

    $hash = Illuminate\Support\Facades\Hash::make($pass);
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
    foreach (['role' => 'admin', 'user_role' => 'admin', 'type' => 'admin', 'user_type' => 'admin'] as $col => $val) {
        if ($has($col)) {
            $row[$col] = $val;
        }
    }
    if ($has('is_admin')) {
        $row['is_admin'] = 1;
    }
    if ($has('is_active')) {
        $row['is_active'] = 1;
    }
    if ($has('status')) {
        $row['status'] = 'active';
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
            ?: Illuminate\Support\Facades\DB::table($table)->where('email', $user)->first();
    }

    if ($existing && $has('id')) {
        $update = $row;
        unset($update['created_at']);
        Illuminate\Support\Facades\DB::table($table)->where('id', $existing->id)->update($update);
        sv_log("updated existing user {$user} in {$table} id={$existing->id}");
    } else {
        try {
            Illuminate\Support\Facades\DB::table($table)->insert($row);
            sv_log("inserted user {$user} into {$table}");
        } catch (Throwable $e) {
            sv_log('insert failed: ' . $e->getMessage());
            // Fall through — still try password resets
        }
    }

    // Alias: email column equals the typed username (some login controllers use email lookup only)
    if ($has('email') && !str_contains($user, '@')) {
        $alias = Illuminate\Support\Facades\DB::table($table)->where('email', $user)->first();
        if ($alias && $has('id')) {
            Illuminate\Support\Facades\DB::table($table)->where('id', $alias->id)->update([
                $passCol => $hash,
            ] + ($has('updated_at') ? ['updated_at' => $now] : []));
            sv_log("updated alias email={$user}");
        } elseif (!$alias) {
            $dup = $row;
            $dup['email'] = $user;
            if ($has('username')) {
                // Keep unique username if needed
                $dup['username'] = $user;
                // If username unique and already used, skip username on alias
                if ($existing) {
                    unset($dup['username']);
                    if ($has('name')) {
                        $dup['name'] = $user . ' (email login)';
                    }
                }
            }
            try {
                Illuminate\Support\Facades\DB::table($table)->insert($dup);
                sv_log("inserted alias email={$user}");
            } catch (Throwable $e) {
                sv_log('alias insert skipped: ' . $e->getMessage());
            }
        }
    }

    // Reset passwords on common admin accounts + first few rows
    if (getenv('PREVIEW_SEED_ALSO_RESET_ADMIN') !== '0') {
        $reset = 0;
        if ($has('username')) {
            $reset += Illuminate\Support\Facades\DB::table($table)
                ->whereIn('username', ['admin', 'administrator', 'root', 'Admin', 'previewadmin'])
                ->update([$passCol => $hash] + ($has('updated_at') ? ['updated_at' => $now] : []));
        }
        if ($has('email')) {
            $reset += Illuminate\Support\Facades\DB::table($table)
                ->where(function ($q) use ($email, $user) {
                    $q->where('email', $email)
                        ->orWhere('email', $user)
                        ->orWhere('email', 'admin@admin.com')
                        ->orWhere('email', 'admin@example.com')
                        ->orWhere('email', 'like', 'admin@%');
                })
                ->update([$passCol => $hash] + ($has('updated_at') ? ['updated_at' => $now] : []));
        }
        if ($has('id')) {
            $ids = Illuminate\Support\Facades\DB::table($table)->orderBy('id')->limit(5)->pluck('id');
            foreach ($ids as $id) {
                Illuminate\Support\Facades\DB::table($table)->where('id', $id)->update([
                    $passCol => $hash,
                ] + ($has('updated_at') ? ['updated_at' => $now] : []));
                $reset++;
            }
        }
        sv_log("reset password on {$reset} row(s) to {$pass}");
    }

    $check = null;
    if ($has('username')) {
        $check = Illuminate\Support\Facades\DB::table($table)->where('username', $user)->first();
    }
    if (!$check && $has('email')) {
        $check = Illuminate\Support\Facades\DB::table($table)->where('email', $email)->first()
            ?: Illuminate\Support\Facades\DB::table($table)->where('email', $user)->first();
    }
    $stored = $check ? ($check->{$passCol} ?? null) : null;
    if ($stored && Illuminate\Support\Facades\Hash::check($pass, (string) $stored)) {
        sv_log("SUCCESS username={$user} email={$email} password={$pass} (verified)");
        echo '[preview] ScholarVerify Laravel admin seeded: username=' . $user
            . ' email=' . $email . ' password=' . $pass . PHP_EOL;
    } else {
        sv_log('WARNING: password verify inconclusive — try project seeder accounts with password ' . $pass);
        echo '[preview] ScholarVerify Laravel admin seeded: username=' . $user . ' password=' . $pass . PHP_EOL;
    }
} catch (Throwable $e) {
    fwrite(STDERR, '[preview-seed-laravel] FAILED: ' . $e->getMessage() . PHP_EOL);
    exit(0);
}
