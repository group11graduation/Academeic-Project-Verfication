/* scholarverify-preview-cors-v5 — ScholarVerify preview safety (CORS + universal login) */
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

/** Student ZIPs often omit bcryptjs/jsonwebtoken — use image-baked /preview-tools. */
function requireOptional(name) {
  const fromCwd = requireFromCwd(name);
  if (fromCwd) return fromCwd;
  try {
    return createRequire('/preview-tools/package.json')(name);
  } catch (_e) {
    /* continue */
  }
  try {
    return require(`/preview-tools/node_modules/${name}`);
  } catch (_e2) {
    return null;
  }
}

function isLoginPath(reqPath) {
  const p = String(reqPath || '').split('?')[0];
  return /\/(api\/)?(auth|users|user|v1\/auth)?\/?login\/?$/i.test(p) || LOGIN_PATHS.includes(p);
}

/**
 * Many student UIs do `if (res.data.success)` then store token / clear spinner.
 * Preview login historically returned token+user+message without `success`, which
 * left the button stuck spinning. Normalize so token/user presence implies success.
 */
function normalizeLoginResponseBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (body.success === false) return body;
  const nested =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? { ...body.data } : {};
  const token =
    body.token ||
    body.accessToken ||
    body.access_token ||
    nested.token ||
    nested.accessToken ||
    nested.access_token ||
    null;
  const user = body.user || nested.user || null;
  if (!token && !user) return body;
  const out = { ...body };
  if (token) {
    out.token = token;
    out.accessToken = out.accessToken || token;
    out.access_token = out.access_token || token;
  }
  if (user) out.user = user;
  out.success = true;
  out.message = out.message || 'Login successful';
  out.data = {
    ...nested,
    ...(token ? { token } : {}),
    ...(user ? { user } : {}),
    success: true,
  };
  return out;
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

  // Prefer preview Mongo URI when student code calls mongoose.connect(undefined / empty env).
  try {
    const mongoose = requireFromCwd('mongoose');
    if (mongoose && typeof mongoose.connect === 'function' && !mongoose.__svPatchedConnect) {
      const origConnect = mongoose.connect.bind(mongoose);
      mongoose.connect = function safeConnect(uri, options, callback) {
        const fixed =
          (uri && String(uri).trim()) ||
          process.env.MONGO_URI ||
          process.env.MONGODB_URI ||
          process.env.MONGO_URL ||
          process.env.DB_URI ||
          process.env.DATABASE_URI ||
          process.env.CONNECTION_URL ||
          process.env.CONNECTION_STRING ||
          process.env.DATABASE_URL ||
          '';
        if (!fixed) {
          console.error(
            '[preview] mongoose.connect() got empty URI — set MONGO_URI / MONGODB_URI in preview env'
          );
        } else if (!uri || String(uri).trim() === '') {
          console.warn('[preview] mongoose.connect() URI was empty — using preview MONGO_URI');
        }
        return origConnect(fixed, options, callback);
      };
      mongoose.__svPatchedConnect = true;
    }
  } catch (_e) {
    /* optional */
  }

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
  // Preserve schema casing from DB/seed. Client login shim maps to SPA-specific
  // values (SYADA → super_admin, Sky Property → SUPER_ADMIN). Forcing one casing
  // here emptied Sky's sidebar when ADMIN/super_admin did not match SUPER_ADMIN.
  let role = obj.role || 'user';
  const originalRole = String(role);
  const roleKey = originalRole.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (roleKey === 'SUBMANAGER') {
    role = 'SUB_MANAGER';
  } else if (roleKey === 'SUPERADMIN') {
    role = originalRole === originalRole.toUpperCase() ? 'SUPER_ADMIN' : 'super_admin';
  }
  return {
    id: obj._id || obj.id,
    _id: obj._id || obj.id,
    fullName: obj.fullName || obj.name || obj.username || '',
    name: obj.name || obj.fullName || '',
    email: obj.email || '',
    username: obj.username || '',
    phone: obj.phone || '',
    role,
    isActive: obj.isActive !== false,
    ...obj,
    role,
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
      root.Email ||
      root.username ||
      root.Username ||
      root.identifier ||
      root.login ||
      root.userEmail ||
      root.mail ||
      nested.email ||
      nested.Email ||
      nested.username ||
      ''
  )
    .trim()
    .toLowerCase();
  const password = String(
    root.password ||
      root.Password ||
      root.passcode ||
      root.pwd ||
      root.pass ||
      nested.password ||
      nested.Password ||
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
    const bcrypt = requireOptional('bcryptjs') || requireOptional('bcrypt');
    if (!bcrypt || !hash) return false;
    // Plain-text seed (rare) or already matching
    if (hash === password) return true;
    if (hash.length < 10) return false;
    try {
      ok = !!(await bcrypt.compare(password, hash));
    } catch (_e) {
      ok = false;
    }
  }
  return ok;
}

async function previewUniversalLogin(req, res, next, options = {}) {
  const softFail = Boolean(options.softFail);
  const { email, password } = pickCredentials(req.body);
  // Do not return 400 here — empty body usually means our route ran before a parser
  // the client expects; fall through so the student handler can respond.
  if (!email || !password) return next();

  const mongoose = requireOptional('mongoose') || requireFromCwd('mongoose');
  if (!mongoose) return next();
  if (mongoose.connection.readyState !== 1) {
    if (softFail) return next();
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
      if (softFail) return next();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await verifyPassword(user, password);
    if (!ok) {
      if (softFail) return next();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const jwt = requireOptional('jsonwebtoken');
    if (!jwt) {
      console.log('[preview] universal login: jsonwebtoken missing — fall through');
      return next();
    }
    const safe = sanitizeUser(user);
    const token = jwt.sign(
      { id: user._id, _id: user._id, role: safe.role, email: user.email },
      longJwtSecret(),
      { expiresIn: '7d' }
    );
    console.log('[preview] universal login OK for', email, 'role=', safe.role);
    return res.json(
      normalizeLoginResponseBody({
        success: true,
        token,
        accessToken: token,
        access_token: token,
        user: safe,
        data: { token, user: safe, success: true },
        message: 'Login successful',
      })
    );
  } catch (err) {
    console.error('[preview] universal login failed:', err && err.message ? err.message : err);
    if (softFail) return next();
    return res.status(500).json({
      message: 'Server error during login',
      detail: String((err && err.message) || err),
      error: 'preview_universal_login',
    });
  }
}

function isPreviewAdminAttempt(email, password) {
  const pe = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo')
    .toLowerCase()
    .trim();
  const pp = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!');
  const e = String(email || '')
    .toLowerCase()
    .trim();
  const p = String(password || '');
  if (!e || !p) return false;
  if (p !== pp) return false;
  if (e === pe) return true;
  if (pe.includes('@') && e === pe.split('@')[0]) return true;
  if (e === 'admin@preview.demo' || e === 'previewadmin') return true;
  return false;
}

function wrapLoginResponseForRecovery(req, res) {
  if (!req || !res || typeof res.json !== 'function') return;
  if (String(req.method || '').toUpperCase() !== 'POST') return;
  const p = String(req.path || req.url || '').split('?')[0];
  if (!isLoginPath(p)) return;
  if (res.__svLoginWrapped) return;
  res.__svLoginWrapped = true;

  let statusCode = 200;
  const origStatus = res.status.bind(res);
  const origJson = res.json.bind(res);
  res.status = function patchedStatus(code) {
    statusCode = Number(code) || statusCode;
    return origStatus(code);
  };
  res.json = function patchedJson(body) {
    // Only recover preview-admin sandbox logins — never rewrite other users' 401s.
    const creds = pickCredentials(req.body);
    if (
      (statusCode === 401 || statusCode === 403) &&
      !res.__svLoginRecovered &&
      isPreviewAdminAttempt(creds.email, creds.password)
    ) {
      res.__svLoginRecovered = true;
      const recoverRes = {
        statusCode: 200,
        status(code) {
          this.statusCode = Number(code) || 200;
          return this;
        },
        json(okBody) {
          try {
            origStatus(200);
          } catch (_e) {
            /* ignore */
          }
          return origJson(okBody);
        },
      };
      return Promise.resolve(
        previewUniversalLogin(req, recoverRes, function softNext() {
          return origJson(body);
        }, { softFail: false })
      ).catch(function () {
        return origJson(body);
      });
    }
    return origJson(body);
  };
}

function installPreviewCorsFix(app) {
  if (!app || typeof app.use !== 'function') return;
  installPreviewRuntimeGuards();

  // Catch student login 401s regardless of route registration order.
  if (!app.__svHandlePatch && typeof app.handle === 'function') {
    app.__svHandlePatch = true;
    const origHandle = app.handle.bind(app);
    app.handle = function svHandle(req, res, out) {
      try {
        wrapLoginResponseForRecovery(req, res);
      } catch (_e) {
        /* ignore */
      }
      return origHandle(req, res, out);
    };
  }

  // Ensure every login 200 body includes success+flattened token/user so student
  // frontends that check `res.data.success` leave the spinner and store the JWT.
  // Install even if CORS was already wired (upgrade path from v4 → v5).
  if (!app.__scholarVerifyLoginNormalize) {
    app.__scholarVerifyLoginNormalize = true;
    app.use(function previewNormalizeLoginResponse(req, res, next) {
      try {
        if (String(req.method || '').toUpperCase() !== 'POST') return next();
        const p = String(req.path || req.url || '').split('?')[0];
        if (!isLoginPath(p)) return next();

        const origJson = res.json.bind(res);
        res.json = function svLoginJson(body) {
          try {
            return origJson(normalizeLoginResponseBody(body));
          } catch (_e) {
            return origJson(body);
          }
        };

        const origSend = res.send.bind(res);
        res.send = function svLoginSend(body) {
          try {
            if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !Array.isArray(body)) {
              return origSend(normalizeLoginResponseBody(body));
            }
            if (typeof body === 'string' && body.length > 1 && body.charAt(0) === '{') {
              const parsed = JSON.parse(body);
              return origSend(JSON.stringify(normalizeLoginResponseBody(parsed)));
            }
          } catch (_e2) {
            /* fall through */
          }
          return origSend(body);
        };
      } catch (_e3) {
        /* ignore */
      }
      return next();
    });
  }

  if (app.__scholarVerifyCorsFix) return;
  app.__scholarVerifyCorsFix = true;

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
    const express = requireOptional('express') || requireFromCwd('express');
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
    Promise.resolve(previewUniversalLogin(req, res, next, { softFail: true })).catch(next);
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

module.exports = {
  installPreviewCorsFix,
  installPreviewRuntimeGuards,
  normalizeLoginResponseBody,
};
