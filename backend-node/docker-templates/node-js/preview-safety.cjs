/* scholarverify-preview-cors-v4 — ScholarVerify preview safety (CORS + universal login) */
'use strict';
const path = require('path');
const { createRequire } = require('module');

const LOGIN_PATHS = [
  '/api/auth/login',
  '/auth/login',
  '/api/users/login',
  '/api/user/login',
  '/users/login',
  '/api/login',
  '/api/v1/auth/login',
];

function requireFromCwd(name) {
  try {
    return createRequire(path.join(process.cwd(), 'package.json'))(name);
  } catch (_e) {
    try {
      return require(name);
    } catch (_e2) {
      return null;
    }
  }
}

function isLoginPath(reqPath) {
  const p = String(reqPath || '').split('?')[0];
  return /\/(api\/)?(auth|users|user|v1\/auth)?\/?login\/?$/i.test(p);
}

function longJwtSecret() {
  const cur = String(process.env.JWT_SECRET || '');
  if (cur.length >= 32) return cur;
  const fallback =
    'cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtZm9yLUhTNTEyLW5lZWRzLTY0LWJ5dGUta2V5LW1pbmltdW0hIQ==';
  process.env.JWT_SECRET = fallback;
  return fallback;
}

function installPreviewRuntimeGuards() {
  if (global.__scholarVerifyRuntimeGuards) return;
  global.__scholarVerifyRuntimeGuards = true;
  longJwtSecret();

  for (const pkg of ['bcryptjs', 'bcrypt']) {
    try {
      const bcrypt = requireFromCwd(pkg);
      if (!bcrypt || typeof bcrypt.compare !== 'function' || bcrypt.__svPatchedCompare) continue;
      const origCompare = bcrypt.compare.bind(bcrypt);
      bcrypt.compare = function safeCompare(data, encrypted, cb) {
        if (!encrypted || typeof encrypted !== 'string' || encrypted.length < 10) {
          if (typeof cb === 'function') return cb(null, false);
          return Promise.resolve(false);
        }
        try {
          const result = origCompare(data, encrypted, cb);
          if (result && typeof result.then === 'function') return result.catch(() => false);
          return result;
        } catch (_e) {
          if (typeof cb === 'function') return cb(null, false);
          return Promise.resolve(false);
        }
      };
      bcrypt.__svPatchedCompare = true;
    } catch (_e) {
      /* optional */
    }
  }

  try {
    const jwt = requireFromCwd('jsonwebtoken');
    if (jwt && typeof jwt.sign === 'function' && !jwt.__svPatchedSign) {
      const origSign = jwt.sign.bind(jwt);
      jwt.sign = function safeSign(payload, secret, options, callback) {
        const useSecret = secret && String(secret).length >= 32 ? secret : longJwtSecret();
        try {
          return origSign(payload, useSecret, options, callback);
        } catch (err) {
          try {
            return origSign(payload, longJwtSecret(), options, callback);
          } catch (_e2) {
            throw err;
          }
        }
      };
      jwt.__svPatchedSign = true;
    }
  } catch (_e) {
    /* optional */
  }
}

function pickUserModel(mongoose) {
  if (!mongoose || !mongoose.models) return null;
  return (
    mongoose.models.User ||
    mongoose.models.user ||
    mongoose.models.Admin ||
    mongoose.models.admin ||
    mongoose.models.Staff ||
    mongoose.models.staff ||
    null
  );
}

function pickPasswordHash(user) {
  if (!user) return '';
  return (
    user.passwordHash ||
    user.password ||
    user.passcode ||
    (typeof user.get === 'function' ? user.get('passwordHash') || user.get('password') : '') ||
    ''
  );
}

function sanitizeUser(user) {
  const obj = user && typeof user.toObject === 'function' ? user.toObject() : { ...(user || {}) };
  delete obj.password;
  delete obj.passwordHash;
  delete obj.passcode;
  delete obj.__v;
  return {
    id: obj._id || obj.id,
    _id: obj._id || obj.id,
    fullName: obj.fullName || obj.name || obj.username || '',
    name: obj.name || obj.fullName || '',
    email: obj.email || '',
    username: obj.username || '',
    phone: obj.phone || '',
    role: obj.role || 'user',
    isActive: obj.isActive !== false,
    ...obj,
    password: undefined,
    passwordHash: undefined,
  };
}

function pickCredentials(body) {
  const root = body && typeof body === 'object' ? body : {};
  const nested =
    (root.data && typeof root.data === 'object' && root.data) ||
    (root.user && typeof root.user === 'object' && root.user) ||
    (root.credentials && typeof root.credentials === 'object' && root.credentials) ||
    {};
  const email = String(
    root.email ||
      root.username ||
      root.identifier ||
      root.login ||
      root.userEmail ||
      root.mail ||
      nested.email ||
      nested.username ||
      ''
  )
    .trim()
    .toLowerCase();
  const password = String(
    root.password ||
      root.passcode ||
      root.pwd ||
      root.pass ||
      nested.password ||
      nested.passcode ||
      ''
  );
  return { email, password };
}

async function findUserRawMongo(mongoose, email) {
  const db = mongoose.connection && mongoose.connection.db;
  if (!db) return null;
  const username = email.includes('@') ? email.split('@')[0] : email;
  const query = {
    $or: [
      { email },
      { email: email },
      { username: email },
      { username },
    ],
  };
  for (const collName of ['users', 'user', 'admins', 'admin', 'staffs', 'staff']) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const doc = await db.collection(collName).findOne(query);
      if (doc) return doc;
    } catch (_e) {
      /* try next collection */
    }
  }
  return null;
}

async function verifyPassword(user, password) {
  let ok = false;
  if (typeof user.comparePassword === 'function') {
    try {
      ok = !!(await user.comparePassword(password));
    } catch (_e) {
      ok = false;
    }
  }
  if (!ok && typeof user.matchPassword === 'function') {
    try {
      ok = !!(await user.matchPassword(password));
    } catch (_e) {
      ok = false;
    }
  }
  if (!ok) {
    const hash = String(pickPasswordHash(user) || '');
    const bcrypt = requireFromCwd('bcryptjs') || requireFromCwd('bcrypt');
    if (!bcrypt || !hash || hash.length < 10) return false;
    try {
      ok = !!(await bcrypt.compare(password, hash));
    } catch (_e) {
      ok = false;
    }
  }
  return ok;
}

async function previewUniversalLogin(req, res, next) {
  const { email, password } = pickCredentials(req.body);
  // Do not return 400 here — empty body usually means our route ran before a parser
  // the client expects; fall through so the student handler can respond.
  if (!email || !password) return next();

  const mongoose = requireFromCwd('mongoose');
  if (!mongoose) return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database is still starting — wait a few seconds and try again',
      error: 'mongo_not_ready',
    });
  }

  try {
    let user = null;
    const User = pickUserModel(mongoose);
    if (User) {
      try {
        user = await User.findOne({
          $or: [{ email }, { username: email }, { username: email.split('@')[0] }],
        }).select('+passwordHash +password +passcode');
      } catch (_e) {
        user = await User.findOne({
          $or: [{ email }, { username: email }, { username: email.split('@')[0] }],
        });
      }
    }
    if (!user) {
      user = await findUserRawMongo(mongoose, email);
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await verifyPassword(user, password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const jwt = requireFromCwd('jsonwebtoken');
    if (!jwt) return next();
    const token = jwt.sign(
      { id: user._id, _id: user._id, role: user.role, email: user.email },
      longJwtSecret(),
      { expiresIn: '7d' }
    );
    const safe = sanitizeUser(user);
    console.log('[preview] universal login OK for', email);
    return res.json({
      token,
      accessToken: token,
      access_token: token,
      user: safe,
      data: { token, user: safe },
      message: 'Login successful',
    });
  } catch (err) {
    console.error('[preview] universal login failed:', err && err.message ? err.message : err);
    return res.status(500).json({
      message: 'Server error during login',
      detail: String((err && err.message) || err),
      error: 'preview_universal_login',
    });
  }
}

function installPreviewCorsFix(app) {
  if (!app || typeof app.use !== 'function' || app.__scholarVerifyCorsFix) return;
  app.__scholarVerifyCorsFix = true;
  installPreviewRuntimeGuards();

  app.use(function previewCorsFix(req, res, next) {
    const requestOrigin =
      req.headers.origin || process.env.CORS_ORIGIN || process.env.PREVIEW_PUBLIC_UI_URL || '*';
    const allowHeaders =
      req.headers['access-control-request-headers'] ||
      'Content-Type, Authorization, X-Requested-With, Accept, Origin';

    const origSetHeader = res.setHeader.bind(res);
    res.setHeader = function patchedSetHeader(name, value) {
      if (String(name).toLowerCase() === 'access-control-allow-origin') {
        return origSetHeader(name, requestOrigin === '*' ? '*' : requestOrigin);
      }
      return origSetHeader(name, value);
    };
    if (typeof res.appendHeader === 'function') {
      const origAppend = res.appendHeader.bind(res);
      res.appendHeader = function patchedAppend(name, value) {
        if (String(name).toLowerCase() === 'access-control-allow-origin') {
          return origSetHeader(name, requestOrigin === '*' ? '*' : requestOrigin);
        }
        return origAppend(name, value);
      };
    }

    origSetHeader('Access-Control-Allow-Origin', requestOrigin === '*' ? '*' : requestOrigin);
    origSetHeader('Access-Control-Allow-Credentials', 'true');
    origSetHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    origSetHeader('Access-Control-Allow-Headers', allowHeaders);
    origSetHeader('Vary', 'Origin');

    if (String(req.method || '').toUpperCase() === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  });

  const handlers = [];
  try {
    const express = requireFromCwd('express');
    if (express && typeof express.json === 'function') {
      handlers.push(express.json({ limit: '2mb' }));
    }
    if (express && typeof express.urlencoded === 'function') {
      handlers.push(express.urlencoded({ extended: true }));
    }
  } catch (_e) {
    /* optional */
  }
  handlers.push(function (req, res, next) {
    Promise.resolve(previewUniversalLogin(req, res, next)).catch(next);
  });

  for (const loginPath of LOGIN_PATHS) {
    try {
      app.post(loginPath, ...handlers);
    } catch (_e) {
      /* ignore */
    }
  }

  console.log('[preview] CORS + universal login installed');
}

module.exports = { installPreviewCorsFix, installPreviewRuntimeGuards };
