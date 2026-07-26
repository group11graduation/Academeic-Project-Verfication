#!/usr/bin/env node
/**
 * Preview MySQL schema bootstrap for React + Express + MySQL student projects.
 * Runs SQL dumps / npm migrate scripts before Express starts so apps that require
 * tables like `roles` (PayFlow) do not crash with "Table doesn't exist".
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
    // Skip destructive dumps
    if (/drop[-_]?all|teardown|destroy|wipe/i.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

function rankSqlFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  let score = 50;
  if (/^(schema|init|install|setup|create|database|db)/i.test(base)) score -= 30;
  if (/migration|migrate/i.test(filePath)) score -= 10;
  if (/seed|demo|sample|dummy/i.test(base)) score += 40;
  if (/^\d+/.test(base)) score -= 5;
  return score;
}

async function runSqlFiles(connection, root) {
  const files = walkSqlFiles(root)
    .sort((a, b) => rankSqlFile(a) - rankSqlFile(b) || a.localeCompare(b))
    .slice(0, 40);
  let ran = 0;
  for (const file of files) {
    let sql;
    try {
      sql = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!sql || sql.trim().length < 12) continue;
    // Strip USE statements that point at other DB names
    sql = sql.replace(/^\s*USE\s+[`'"]?\w+[`'"]?\s*;/gim, '');
    try {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(sql);
      ran += 1;
      console.log('[preview-mysql-bootstrap] applied SQL', path.relative(root, file));
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
      timeout: 180_000,
      shell: false,
    });
    if (result.stdout) process.stdout.write(result.stdout.slice(-1500));
    if (result.stderr) process.stderr.write(result.stderr.slice(-1500));
    if (result.status === 0) {
      ran += 1;
      console.log('[preview-mysql-bootstrap] npm run', key, 'OK');
    } else {
      console.log('[preview-mysql-bootstrap] npm run', key, 'exit', result.status);
    }
  }

  // Direct CLI fallbacks when scripts are missing
  const cliTries = [
    {
      kind: 'sequelize',
      cmd: 'npx',
      args: ['--yes', 'sequelize-cli', 'db:migrate'],
      hint: () =>
        fs.existsSync(path.join(root, '.sequelizerc')) ||
        fs.existsSync(path.join(root, 'config', 'config.json')) ||
        Boolean(scripts.sequelize),
    },
    {
      kind: 'prisma',
      cmd: 'npx',
      args: ['--yes', 'prisma', 'db', 'push', '--accept-data-loss'],
      hint: () => fs.existsSync(path.join(root, 'prisma')),
    },
    {
      kind: 'knex',
      cmd: 'npx',
      args: ['--yes', 'knex', 'migrate:latest'],
      hint: () =>
        fs.existsSync(path.join(root, 'knexfile.js')) || fs.existsSync(path.join(root, 'knexfile.ts')),
    },
  ];
  for (const tryCli of cliTries) {
    if (!tryCli.hint()) continue;
    console.log('[preview-mysql-bootstrap]', tryCli.cmd, tryCli.args.join(' '));
    const result = spawnSync(tryCli.cmd, tryCli.args, {
      cwd: root,
      env: process.env,
      encoding: 'utf8',
      timeout: 180_000,
      shell: false,
    });
    if (result.status === 0) {
      ran += 1;
      console.log('[preview-mysql-bootstrap] CLI OK', tryCli.kind);
    } else {
      console.log('[preview-mysql-bootstrap] CLI soft-fail', tryCli.kind, result.status);
    }
  }
  return ran;
}

async function ensureMinimalTables(connection) {
  // Best-effort safety net for payroll / RBAC apps that crash if roles is missing.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NULL,
      description VARCHAR(255) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_roles_name (name)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NULL,
      fullName VARCHAR(255) NULL,
      email VARCHAR(255) NOT NULL,
      username VARCHAR(255) NULL,
      password VARCHAR(255) NULL,
      passwordHash VARCHAR(255) NULL,
      role VARCHAR(64) NULL,
      role_id INT NULL,
      roleId INT NULL,
      isActive TINYINT(1) DEFAULT 1,
      status VARCHAR(64) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email)
    )
  `);
  const [roles] = await connection.query('SELECT id FROM roles LIMIT 1');
  if (!roles || !roles.length) {
    await connection.query(
      `INSERT INTO roles (name, slug, description) VALUES
        ('Admin', 'admin', 'Preview admin'),
        ('SUPER_ADMIN', 'super_admin', 'Preview super admin'),
        ('super_admin', 'super_admin', 'Preview super admin')`
    );
  }
  console.log('[preview-mysql-bootstrap] ensured minimal roles/users tables');
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
  console.log('[preview-mysql-bootstrap] start', conn.host, conn.database, 'cwd=', root);

  // Prefer project migrate scripts first (creates real schema), then SQL files, then safety tables.
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
    const sqlRan = await runSqlFiles(connection, root);
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
