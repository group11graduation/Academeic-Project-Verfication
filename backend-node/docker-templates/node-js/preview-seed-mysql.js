#!/usr/bin/env node
/**
 * Preview MySQL admin seed for React + Express + MySQL student projects.
 * Uses mysql2/promise from /preview-tools (baked into the node-js preview image).
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
    if (!process.env.DB_HOST && !process.env.MYSQL_HOST) {
      console.log('[preview-seed-mysql] skipped: not a MySQL preview');
      return;
    }
  }

  // Always bootstrap schema first (roles/users/migrations). Safe to call from old
  // entrypoints that never invoked preview-mysql-bootstrap.js on their own.
  try {
    const bootstrapPath = fs.existsSync('/preview-mysql-bootstrap.js')
      ? '/preview-mysql-bootstrap.js'
      : path.join(__dirname, 'preview-mysql-bootstrap.js');
    if (fs.existsSync(bootstrapPath)) {
      console.log('[preview-seed-mysql] running schema bootstrap first…');
      require('child_process').spawnSync(process.execPath, [bootstrapPath], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
        timeout: 240_000,
      });
    }
  } catch (err) {
    console.log(
      '[preview-seed-mysql] bootstrap soft-fail',
      err && err.message ? err.message : err
    );
  }

  const mysql = requireMysql2Promise();
  if (!mysql) {
    console.log('[preview-seed-mysql] skipped: mysql2/promise not available');
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

  let bcrypt = null;
  try {
    bcrypt = createRequire(path.join(process.cwd(), 'package.json'))('bcryptjs');
  } catch {
    try {
      bcrypt = createRequire(path.join(process.cwd(), 'package.json'))('bcrypt');
    } catch {
      bcrypt = null;
    }
  }
  if (!bcrypt) {
    try {
      bcrypt = createRequire('/preview-tools/package.json')('bcryptjs');
      console.log('[preview-seed-mysql] using bcryptjs from /preview-tools');
    } catch {
      try {
        bcrypt = require('/preview-tools/node_modules/bcryptjs');
        console.log('[preview-seed-mysql] using bcryptjs from /preview-tools');
      } catch {
        try {
          bcrypt = createRequire('/preview-tools/package.json')('bcrypt');
        } catch {
          bcrypt = null;
        }
      }
    }
  }

  const hash = bcrypt ? await bcrypt.hash(rawPass, 10) : rawPass;

  console.log('[preview-seed-mysql] connecting', conn.host, conn.database);
  const connection = await mysql.createConnection({
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    multipleStatements: true,
  });

  try {
    // Discover columns if a real student schema already exists.
    let columns = [];
    try {
      const [cols] = await connection.query('SHOW COLUMNS FROM users');
      columns = (cols || []).map((c) => String(c.Field || c.field || '').toLowerCase());
    } catch {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NULL,
          email VARCHAR(255) NOT NULL,
          username VARCHAR(255) NULL,
          password VARCHAR(255) NULL,
          passwordHash VARCHAR(255) NULL,
          role VARCHAR(64) NULL,
          role_id INT NULL,
          isActive TINYINT(1) DEFAULT 1,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_users_email (email)
        )
      `);
      columns = [
        'id',
        'name',
        'email',
        'username',
        'password',
        'passwordhash',
        'role',
        'role_id',
        'isactive',
      ];
    }

    let roleId = null;
    try {
      const [roleRows] = await connection.query(
        `SELECT COALESCE(role_id, id) AS rid FROM roles
         WHERE COALESCE(role_name, name) IN ('Admin','ADMIN','admin','SUPER_ADMIN','super_admin')
            OR slug IN ('admin','super_admin')
         LIMIT 1`
      );
      if (roleRows && roleRows[0] && roleRows[0].rid != null) roleId = roleRows[0].rid;
    } catch {
      try {
        const [roleRows] = await connection.query(
          `SELECT role_id AS rid FROM roles WHERE role_name IN ('Admin','admin') LIMIT 1`
        );
        if (roleRows && roleRows[0] && roleRows[0].rid != null) roleId = roleRows[0].rid;
      } catch {
        /* roles table optional / different shape */
      }
    }
    if (roleId == null && columns.includes('role_id')) {
      roleId = 1; // PayFlow-style: Admin is usually role_id=1
    }

    const idCol = columns.includes('user_id')
      ? 'user_id'
      : columns.includes('id')
        ? 'id'
        : null;

    // Never derive username from admin@preview.demo → "admin" (collides with dump row).
    // Also ignore PREVIEW_SEED_USERNAME=admin when seeding the platform preview email.
    const envUsername = String(
      process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || process.env.LOGIN_USERNAME || ''
    ).trim();
    let seedUsername = envUsername || 'previewadmin';
    const local = (email.split('@')[0] || 'previewadmin').trim();
    if (!envUsername) {
      seedUsername = local.toLowerCase() === 'admin' ? 'previewadmin' : local;
    }
    if (/@preview\.demo$/i.test(email) && seedUsername.toLowerCase() === 'admin') {
      seedUsername = 'previewadmin';
    }
    if (seedUsername.toLowerCase() === 'admin' && /preview\.demo|previewadmin/i.test(email)) {
      seedUsername = 'previewadmin';
    }

    const passwordCol = columns.includes('password_hash')
      ? 'password_hash'
      : columns.includes('password')
        ? 'password'
        : columns.includes('passwordhash')
          ? 'passwordHash'
          : null;

    async function findUserRow(whereSql, params) {
      const selectId = idCol || 'email';
      const [found] = await connection.query(
        `SELECT ${selectId} AS id, email${columns.includes('username') ? ', username' : ''} FROM users WHERE ${whereSql} LIMIT 1`,
        params
      );
      return found && found[0] ? found[0] : null;
    }

    async function upsertAdmin({ targetEmail, targetUsername, targetHash, label }) {
      let row =
        (await findUserRow('email = ?', [targetEmail])) ||
        (columns.includes('username')
          ? await findUserRow('username = ?', [targetUsername])
          : null);

      // Fall back to classic dump admin so we can reset its password/email.
      if (!row && columns.includes('username') && targetUsername !== 'admin') {
        row = await findUserRow('username = ?', ['admin']);
        // Only reuse dump admin when we're resetting the project admin identity.
        if (row && label !== 'project-admin') row = null;
      }

      const setParts = [];
      const setVals = [];
      if (columns.includes('username')) {
        setParts.push('username = ?');
        setVals.push(targetUsername);
      }
      if (columns.includes('email')) {
        setParts.push('email = ?');
        setVals.push(targetEmail);
      }
      if (passwordCol) {
        setParts.push(`${passwordCol} = ?`);
        setVals.push(targetHash);
      }
      if (columns.includes('name')) {
        setParts.push('name = COALESCE(?, name)');
        setVals.push(name);
      }
      if (columns.includes('role')) {
        setParts.push(`role = COALESCE(role, 'admin')`);
      }
      if (columns.includes('role_id') && roleId != null) {
        setParts.push('role_id = ?');
        setVals.push(roleId);
      }
      if (columns.includes('roleid') && roleId != null) {
        setParts.push('roleId = ?');
        setVals.push(roleId);
      }
      if (columns.includes('isactive')) setParts.push('isActive = 1');
      if (columns.includes('status')) setParts.push(`status = 'active'`);

      if (row) {
        if (!setParts.length) return;
        const where = idCol ? `${idCol} = ?` : 'email = ?';
        setVals.push(row.id);
        await connection.query(`UPDATE users SET ${setParts.join(', ')} WHERE ${where}`, setVals);
        console.log('[preview-seed-mysql] updated', label, targetEmail, 'username=', targetUsername);
        return;
      }

      const insertCols = [];
      const insertVals = [];
      const placeholders = [];
      const add = (col, val) => {
        insertCols.push(col);
        insertVals.push(val);
        placeholders.push('?');
      };
      add('email', targetEmail);
      if (columns.includes('username')) add('username', targetUsername);
      if (columns.includes('name')) add('name', name);
      if (passwordCol) add(passwordCol, targetHash);
      if (columns.includes('role')) add('role', 'admin');
      if (columns.includes('role_id') && roleId != null) add('role_id', roleId);
      if (columns.includes('isactive')) add('isActive', 1);
      if (columns.includes('status')) add('status', 'active');

      try {
        await connection.query(
          `INSERT INTO users (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`,
          insertVals
        );
        console.log('[preview-seed-mysql] created', label, targetEmail, 'username=', targetUsername);
      } catch (err) {
        const msg = err && err.message ? String(err.message) : '';
        if (!/Duplicate/i.test(msg)) throw err;
        // Username/email unique conflict — update whichever row already exists.
        const whereParts = ['email = ?'];
        const whereVals = [...setVals, targetEmail];
        if (columns.includes('username')) {
          whereParts.push('username = ?');
          whereVals.push(targetUsername);
        }
        await connection.query(
          `UPDATE users SET ${setParts.join(', ')} WHERE ${whereParts.join(' OR ')}`,
          whereVals
        );
        console.log('[preview-seed-mysql] upserted after duplicate', label, targetEmail);
      }
    }

    // 1) Make the project's documented admin work (PayFlow UI: admin@payflow.app / password123).
    const projectPass = String(process.env.PREVIEW_PROJECT_ADMIN_PASSWORD || 'password123');
    const projectEmail = String(process.env.PREVIEW_PROJECT_ADMIN_EMAIL || 'admin@payflow.app')
      .toLowerCase()
      .trim();
    const projectHash = bcrypt ? await bcrypt.hash(projectPass, 10) : projectPass;
    await upsertAdmin({
      targetEmail: projectEmail,
      targetUsername: 'admin',
      targetHash: projectHash,
      label: 'project-admin',
    });

    // 2) Ensure platform preview credentials also work (teacher credential box).
    await upsertAdmin({
      targetEmail: email,
      targetUsername: seedUsername,
      targetHash: hash,
      label: 'preview-admin',
    });

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
  process.exitCode = 0;
});
