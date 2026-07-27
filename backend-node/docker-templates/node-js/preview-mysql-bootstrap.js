#!/usr/bin/env node
/**
 * Preview MySQL schema bootstrap for React + Express + MySQL student projects.
 * Runs SQL dumps / npm migrate scripts before Express starts so apps that require
 * tables like `roles` (PayFlow) do not crash with "Table doesn't exist".
 *
 * Important: student SQL is often at /app/database/*.sql while Express cwd is
 * /app/backend — we must search parent folders, not only process.cwd().
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');

function loadEnvFileManual(envPath) {
  if (!fs.existsSync(envPath)) return;
  let text;
  try {
    text = fs.readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFileManual(path.join(process.cwd(), '.env'));

function requireMysql2Promise() {
  const candidates = [
    '/preview-tools/node_modules/mysql2/promise',
    path.join(__dirname, 'preview-tools', 'node_modules', 'mysql2', 'promise'),
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch {
      /* try next */
    }
  }
  try {
    return createRequire(path.join(process.cwd(), 'package.json'))('mysql2/promise');
  } catch {
    /* fall through */
  }
  try {
    return require('mysql2/promise');
  } catch {
    return null;
  }
}

function pickConn() {
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || '';
  const user =
    process.env.DB_USER ||
    process.env.DB_USERNAME ||
    process.env.MYSQL_USER ||
    'preview';
  const password =
    process.env.DB_PASS ||
    process.env.DB_PASSWORD ||
    process.env.MYSQL_PASSWORD ||
    '';
  const database =
    process.env.DB_NAME ||
    process.env.DB_DATABASE ||
    process.env.MYSQL_DATABASE ||
    'preview';
  const port = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
  return { host, user, password, database, port };
}

function collectSearchRoots(cwd) {
  const roots = [];
  const seen = new Set();
  const add = (p) => {
    const abs = path.resolve(p);
    if (!abs || seen.has(abs) || !fs.existsSync(abs)) return;
    seen.add(abs);
    roots.push(abs);
  };
  add(cwd);
  add(path.join(cwd, '..'));
  add(path.join(cwd, '..', '..'));
  add('/app');
  add('/workspace');
  add('/project');
  // Explicit database folders next to backend/
  add(path.join(cwd, '..', 'database'));
  add(path.join(cwd, '..', 'db'));
  add(path.join(cwd, '..', 'sql'));
  add(path.join(cwd, 'database'));
  add(path.join(cwd, 'db'));
  add(path.join(cwd, 'sql'));
  return roots;
}

function walkSqlFiles(root, depth = 0, out = []) {
  if (depth > 5 || !fs.existsSync(root)) return out;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const lower = entry.name.toLowerCase();
      if (
        /^(sql|db|database|databases|schema|schemas|migration|migrations|scripts|seed|seeds|install)$/i.test(
          lower
        ) ||
        depth === 0
      ) {
        walkSqlFiles(full, depth + 1, out);
      }
      continue;
    }
    if (!/\.sql$/i.test(entry.name)) continue;
    if (/drop[-_]?all|teardown|destroy|wipe/i.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

function rankSqlFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  let score = 50;
  if (/^(schema|init|install|setup|create|database|db|payroll)/i.test(base)) score -= 40;
  if (/payroll|schema|dump/i.test(base)) score -= 20;
  if (/migration|migrate/i.test(filePath)) score -= 10;
  if (/seed|demo|sample|dummy/i.test(base)) score += 40;
  if (/^\d+/.test(base)) score -= 5;
  return score;
}

function sanitizeSqlDump(sql) {
  return String(sql || '')
    .replace(/^\s*USE\s+[`'"]?\w+[`'"]?\s*;/gim, '')
    .replace(/DEFINER\s*=\s*`[^`]+`@`[^`]+`/gi, '')
    .replace(/DEFINER\s*=\s*'[^']+'@'[^']+'/gi, '');
}

async function tableColumns(connection, table) {
  try {
    const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
    return (rows || []).map((r) => String(r.Field || '').toLowerCase());
  } catch {
    return null;
  }
}

async function dropIncompatibleSafetyTables(connection) {
  // Our old minimal schema used roles.name / users.id — PayFlow needs roles.role_name / users.user_id.
  const roleCols = await tableColumns(connection, 'roles');
  const userCols = await tableColumns(connection, 'users');
  if (!roleCols && !userCols) return false;

  const rolesLooksMinimal =
    roleCols && roleCols.includes('name') && !roleCols.includes('role_name');
  const usersLooksMinimal =
    userCols &&
    userCols.includes('id') &&
    !userCols.includes('user_id') &&
    !userCols.includes('password_hash');

  if (!rolesLooksMinimal && !usersLooksMinimal) return false;

  console.log(
    '[preview-mysql-bootstrap] dropping incompatible safety-net roles/users so project SQL can load'
  );
  await connection.query('SET FOREIGN_KEY_CHECKS=0');
  try {
    await connection.query('DROP TABLE IF EXISTS users');
    await connection.query('DROP TABLE IF EXISTS roles');
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
  return true;
}

async function runSqlFiles(connection, roots) {
  const files = [];
  const seen = new Set();
  for (const root of roots) {
    for (const file of walkSqlFiles(root)) {
      const abs = path.resolve(file);
      if (seen.has(abs)) continue;
      seen.add(abs);
      files.push(abs);
    }
  }
  files.sort((a, b) => rankSqlFile(a) - rankSqlFile(b) || a.localeCompare(b));

  let ran = 0;
  for (const file of files.slice(0, 40)) {
    let sql;
    try {
      sql = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!sql || sql.trim().length < 12) continue;
    sql = sanitizeSqlDump(sql);
    try {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(sql);
      ran += 1;
      console.log('[preview-mysql-bootstrap] applied SQL', file);
    } catch (err) {
      console.log(
        '[preview-mysql-bootstrap] SQL soft-fail',
        path.basename(file),
        err && err.message ? err.message : err
      );
    }
  }
  return ran;
}

function runNpmMigrateScripts(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return 0;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return 0;
  }
  const scripts = pkg.scripts || {};
  const prefer = [
    'db:migrate',
    'migrate',
    'migrate:up',
    'migration:run',
    'migrations:run',
    'sequelize:migrate',
    'prisma:migrate',
    'prisma:push',
    'db:push',
    'db:setup',
    'setup:db',
    'init:db',
  ];
  const keys = [
    ...prefer.filter((k) => scripts[k]),
    ...Object.keys(scripts).filter(
      (k) => /migrate|prisma|sequelize|knex|db:push|db:setup|schema/i.test(k) && !prefer.includes(k)
    ),
  ];
  let ran = 0;
  const seen = new Set();
  for (const key of keys.slice(0, 6)) {
    if (seen.has(key)) continue;
    seen.add(key);
    console.log('[preview-mysql-bootstrap] npm run', key);
    const result = spawnSync('npm', ['run', key], {
      cwd: root,
      env: process.env,
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (result.status === 0) {
      ran += 1;
      console.log('[preview-mysql-bootstrap] npm run', key, 'OK');
    } else {
      console.log('[preview-mysql-bootstrap] npm run', key, 'exit', result.status);
    }
  }
  return ran;
}

async function ensureMinimalTables(connection) {
  const roleCols = await tableColumns(connection, 'roles');
  const userCols = await tableColumns(connection, 'users');

  // Real project schema already present (PayFlow / similar).
  if (roleCols && roleCols.includes('role_name') && userCols && userCols.includes('password_hash')) {
    console.log('[preview-mysql-bootstrap] project roles/users schema already present — skip safety-net');
    return;
  }
  if (roleCols && userCols && !roleCols.includes('name')) {
    // Unknown but complete-looking schema — do not overwrite.
    console.log('[preview-mysql-bootstrap] roles/users already exist — skip safety-net');
    return;
  }

  // PayFlow-compatible safety net (role_id / role_name / user_id / password_hash).
  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      role_id INT AUTO_INCREMENT PRIMARY KEY,
      role_name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      UNIQUE KEY uq_roles_role_name (role_name)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL DEFAULT 1,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      status VARCHAR(64) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email),
      UNIQUE KEY uq_users_username (username)
    )
  `);

  const [roles] = await connection.query('SELECT role_id FROM roles LIMIT 1');
  if (!roles || !roles.length) {
    // Avoid case-insensitive duplicate names (SUPER_ADMIN vs super_admin).
    await connection.query(
      `INSERT IGNORE INTO roles (role_id, role_name, description) VALUES
        (1, 'Admin', 'System administrator'),
        (2, 'HR Manager', 'Human resource manager'),
        (3, 'Accountant', 'Payroll accountant'),
        (4, 'Employee', 'Regular employee')`
    );
  }
  console.log('[preview-mysql-bootstrap] ensured PayFlow-compatible roles/users tables');
}

async function main() {
  if (
    String(process.env.PREVIEW_DB_ENGINE || '').toLowerCase() !== 'mysql' &&
    !process.env.DB_HOST &&
    !process.env.MYSQL_HOST
  ) {
    console.log('[preview-mysql-bootstrap] skipped: not MySQL preview');
    return;
  }

  const mysql = requireMysql2Promise();
  if (!mysql) {
    console.log('[preview-mysql-bootstrap] skipped: mysql2/promise unavailable');
    return;
  }

  const conn = pickConn();
  if (!conn.host) {
    console.log('[preview-mysql-bootstrap] skipped: missing DB_HOST');
    return;
  }

  const root = process.cwd();
  const roots = collectSearchRoots(root);
  console.log(
    '[preview-mysql-bootstrap] start',
    conn.host,
    conn.database,
    'cwd=',
    root,
    'searchRoots=',
    roots.join(',')
  );

  const npmRan = runNpmMigrateScripts(root);

  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    multipleStatements: true,
  });

  try {
    try {
      await dropIncompatibleSafetyTables(connection);
    } catch (err) {
      console.log(
        '[preview-mysql-bootstrap] drop incompatible soft-fail',
        err && err.message ? err.message : err
      );
    }

    const sqlRan = await runSqlFiles(connection, roots);
    try {
      await ensureMinimalTables(connection);
    } catch (err) {
      console.log(
        '[preview-mysql-bootstrap] minimal tables soft-fail',
        err && err.message ? err.message : err
      );
    }
    console.log(
      '[preview-mysql-bootstrap] done npmMigrate=',
      npmRan,
      'sqlFiles=',
      sqlRan
    );
  } finally {
    try {
      await connection.end();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error('[preview-mysql-bootstrap] failed:', err && err.message ? err.message : err);
  process.exitCode = 0;
});
