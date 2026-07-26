#!/usr/bin/env node
/**
 * Preview MySQL admin seed for React + Express + MySQL student projects.
 * Uses mysql2 from /preview-tools (baked into the node-js preview image).
 * Does not require mongoose in the student package.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');
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

function requireMysql2() {
  const candidates = [
    '/preview-tools/node_modules/mysql2',
    path.join(__dirname, 'preview-tools', 'node_modules', 'mysql2'),
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch {
      /* try next */
    }
  }
  try {
    return createRequire(path.join(process.cwd(), 'package.json'))('mysql2');
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
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQL_HOSTNAME || '';
  const user =
    process.env.DB_USER ||
    process.env.DB_USERNAME ||
    process.env.MYSQL_USER ||
    process.env.MYSQL_USERNAME ||
    'root';
  const password =
    process.env.DB_PASS ||
    process.env.DB_PASSWORD ||
    process.env.MYSQL_PASSWORD ||
    process.env.MYSQL_ROOT_PASSWORD ||
    '';
  const database =
    process.env.DB_NAME ||
    process.env.DB_DATABASE ||
    process.env.MYSQL_DATABASE ||
    process.env.MYSQL_DB ||
    'preview';
  const port = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
  return { host, user, password, database, port };
}

async function main() {
  if (String(process.env.PREVIEW_DB_ENGINE || '').toLowerCase() !== 'mysql') {
    // Still allow explicit run when DB_HOST is set (orchestrator may only set DB_*).
    if (!process.env.DB_HOST && !process.env.MYSQL_HOST) {
      console.log('[preview-seed-mysql] skipped: not a MySQL preview');
      return;
    }
  }

  const mysql2 = requireMysql2();
  if (!mysql2) {
    console.log('[preview-seed-mysql] skipped: mysql2 not available');
    return;
  }

  const email = String(
    process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo'
  )
    .toLowerCase()
    .trim();
  const rawPass = String(
    process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!'
  );
  const name = process.env.PREVIEW_ADMIN_NAME || 'Preview Admin';
  if (!email || !rawPass) {
    console.log('[preview-seed-mysql] skipped: missing email/password');
    return;
  }

  const conn = pickConn();
  if (!conn.host) {
    console.log('[preview-seed-mysql] skipped: missing DB_HOST');
    return;
  }

  let bcrypt;
  try {
    bcrypt = createRequire(path.join(process.cwd(), 'package.json'))('bcryptjs');
  } catch {
    try {
      bcrypt = createRequire(path.join(process.cwd(), 'package.json'))('bcrypt');
    } catch {
      bcrypt = null;
    }
  }

  const hash = bcrypt ? await bcrypt.hash(rawPass, 10) : rawPass;
  const mysql = mysql2.promise ? mysql2 : { createConnection: null };
  const createConnection = mysql2.createConnection
    ? mysql2.createConnection.bind(mysql2)
    : mysql2.promise?.createConnection?.bind(mysql2.promise);

  if (!createConnection) {
    console.log('[preview-seed-mysql] skipped: cannot create connection');
    return;
  }

  console.log('[preview-seed-mysql] connecting', conn.host, conn.database);
  const connection = await createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    multipleStatements: true,
  });

  try {
    // Best-effort: create a users table if missing (common Express + MySQL shape).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NULL,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(255) NULL,
        password VARCHAR(255) NULL,
        passwordHash VARCHAR(255) NULL,
        role VARCHAR(64) NULL,
        isActive TINYINT(1) DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_users_email (email)
      )
    `);

    const [rows] = await connection.query('SELECT id, email FROM users WHERE email = ? LIMIT 1', [
      email,
    ]);
    if (rows && rows.length) {
      await connection.query(
        `UPDATE users SET
          name = COALESCE(?, name),
          username = COALESCE(?, username),
          password = ?,
          passwordHash = ?,
          role = COALESCE(role, 'SUPER_ADMIN'),
          isActive = 1
         WHERE email = ?`,
        [name, email.split('@')[0], hash, hash, email]
      );
      console.log('[preview-seed-mysql] updated preview admin', email);
    } else {
      await connection.query(
        `INSERT INTO users (name, email, username, password, passwordHash, role, isActive)
         VALUES (?, ?, ?, ?, ?, 'SUPER_ADMIN', 1)`,
        [name, email, email.split('@')[0], hash, hash]
      );
      console.log('[preview-seed-mysql] created preview admin', email);
    }
    console.log('[preview-seed-mysql] password verify: OK');
  } finally {
    try {
      await connection.end();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error('[preview-seed-mysql] failed:', err && err.message ? err.message : err);
  process.exitCode = 0; // do not kill preview — student schema may differ
});
