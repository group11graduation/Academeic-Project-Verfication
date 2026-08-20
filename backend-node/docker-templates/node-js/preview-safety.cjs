/* scholarverify-preview-cors-v9 — api path /api↔bare retry + universal login */
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
  let user = body.user || nested.user || null;
  if (!token && !user) return body;

  // Preview teacher logins must be admin — never return role:"user" for seeded accounts.
  const forceAdminEmail = String(
    (user && (user.email || user.username)) || body.email || body.username || ''
  )
    .toLowerCase()
    .trim();
  const looksPreviewAdmin =
    /previewadmin|admin@preview\.demo|preview\.demo/i.test(forceAdminEmail) ||
    String(process.env.PREVIEW_SEED_USERNAME || '')
      .toLowerCase()
      .trim() === forceAdminEmail ||
    String(process.env.PREVIEW_ADMIN_EMAIL || '')
      .toLowerCase()
      .trim() === forceAdminEmail;

  if (user && typeof user === 'object' && looksPreviewAdmin) {
    const adminRole =
      String(
        process.env.PREVIEW_FORCE_ADMIN_ROLE ||
          process.env.PREVIEW_MAIN_ROLE ||
          process.env.PREVIEW_ADMIN_ROLE ||
          ''
      ).trim() ||
      (String(user.role || '').toUpperCase().includes('SUPER') ? user.role : 'admin');
    user = {
      ...user,
      role: adminRole,
      Role: adminRole,
      isAdmin: true,
      is_admin: true,
    };
  }

  const out = { ...body };
  if (token) {
    out.token = token;
    out.accessToken = out.accessToken || token;
    out.access_token = out.access_token || token;
  }
  if (user) {
    out.user = user;
    out.role = user.role || out.role;
    out.Role = user.role || out.Role;
    out.isAdmin = user.isAdmin != null ? user.isAdmin : out.isAdmin;
    out.email = out.email || user.email;
    out.username = out.username || user.username;
    out.name = out.name || user.name || user.fullName;
  }
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

/** Preview sandbox Mongo URI (sidecar), never Atlas. */
function previewMongoUri() {
  return (
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DB_URI ||
    process.env.DATABASE_URI ||
    process.env.CONNECTION_URL ||
    process.env.CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    ''
  );
}

/**
 * True for Atlas / any non-sandbox host. Student ZIPs often hardcode
 * mongodb+srv://….mongodb.net — that DNS fails inside preview Docker.
 */
function isExternalMongoUri(uri) {
  const s = String(uri || '').trim();
  if (!s) return false;
  if (/mongodb\+srv:/i.test(s)) return true;
  if (/\.mongodb\.net\b/i.test(s)) return true;
  try {
    const m = s.match(/mongodb(?:\+srv)?:\/\/(?:[^/@]+@)?([^/?]+)/i);
    if (!m) return false;
    const hostPort = String(m[1] || '').toLowerCase();
    const host = hostPort.split(':')[0];
    if (!host) return false;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'mongo' ||
      host === 'mongodb' ||
      host === 'host.docker.internal'
    ) {
      return false;
    }
    if (/^preview-mongo/i.test(host)) return false;
    // Docker Compose service names for our sidecar
    if (/mongo/i.test(host) && !/\./.test(host)) return false;
    return true;
  } catch (_e) {
    return /mongodb\+srv:|\.mongodb\.net\b/i.test(s);
  }
}

function resolveSandboxMongoUri(requested) {
  const preview = String(previewMongoUri() || '').trim();
  const raw = requested != null ? String(requested).trim() : '';
  const sandbox =
    String(process.env.PREVIEW_SANDBOX || '') === '1' ||
    String(process.env.PREVIEW_FORCE_MONGO || '') === '1';

  // Preview sandbox: never dial Atlas / external Mongo — student ZIPs hardcode it often.
  if (sandbox && preview) {
    if (raw && raw !== preview) {
      try {
        console.warn(
          '[preview] forcing Mongo URI to sandbox (blocked Atlas/external)',
          String(raw).replace(/\/\/([^@/]+)@/, '//***@').slice(0, 96)
        );
      } catch (_w) {}
    }
    return preview;
  }
  return raw || preview || '';
}

function installPreviewRuntimeGuards() {
  if (global.__scholarVerifyRuntimeGuards) return;
  global.__scholarVerifyRuntimeGuards = true;
  longJwtSecret();

  // Always force sandbox Mongo in preview — student code often hardcodes Atlas SRV.
  try {
    const mongoose = requireFromCwd('mongoose');
    if (mongoose && typeof mongoose.connect === 'function' && !mongoose.__svPatchedConnect) {
      const origConnect = mongoose.connect.bind(mongoose);
      mongoose.connect = function safeConnect(uri, options, callback) {
        const fixed = resolveSandboxMongoUri(uri);
        if (!fixed) {
          console.error(
            '[preview] mongoose.connect() got empty URI — set MONGO_URI / MONGODB_URI in preview env'
          );
        } else if (!uri || String(uri).trim() === '' || isExternalMongoUri(uri)) {
          console.warn('[preview] mongoose.connect() → sandbox MONGO_URI');
        }
        // Fail fast in preview — Atlas/hanging connects caused POST /categories timeouts.
        const opts =
          typeof options === 'function'
            ? {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
                socketTimeoutMS: 15000,
              }
            : {
                ...(options && typeof options === 'object' ? options : {}),
                serverSelectionTimeoutMS:
                  (options && options.serverSelectionTimeoutMS) || 5000,
                connectTimeoutMS: (options && options.connectTimeoutMS) || 5000,
                socketTimeoutMS: (options && options.socketTimeoutMS) || 15000,
              };
        if (typeof options === 'function') {
          return origConnect(fixed, opts, options);
        }
        return origConnect(fixed, opts, callback);
      };
      mongoose.__svPatchedConnect = true;
    }
    if (mongoose && typeof mongoose.createConnection === 'function' && !mongoose.__svPatchedCreateConnection) {
      const origCreate = mongoose.createConnection.bind(mongoose);
      mongoose.createConnection = function safeCreateConnection(uri, options) {
        const fixed = resolveSandboxMongoUri(uri);
        return origCreate(fixed, options);
      };
      mongoose.__svPatchedCreateConnection = true;
    }
  } catch (_e) {
    /* optional */
  }

  try {
    const mongodb = requireFromCwd('mongodb');
    const MongoClient = mongodb && mongodb.MongoClient;
    if (MongoClient && typeof MongoClient.connect === 'function' && !MongoClient.__svPatchedConnect) {
      const orig = MongoClient.connect.bind(MongoClient);
      MongoClient.connect = function safeMongoClientConnect(uri, options, callback) {
        const fixed = resolveSandboxMongoUri(uri);
        return orig(fixed, options, callback);
      };
      MongoClient.__svPatchedConnect = true;
    }
  } catch (_e2) {
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
    // Student middleware often verifies with a short/wrong JWT_SECRET from the ZIP .env
    // while login (or universal login) signed with the preview long secret → 401 on /me
    // → axios interceptor clears storage → bounce back to login after a "successful" login.
    if (jwt && typeof jwt.verify === 'function' && !jwt.__svPatchedVerify) {
      const origVerify = jwt.verify.bind(jwt);
      jwt.verify = function safeVerify(token, secret, options, callback) {
        const args = [token, secret, options, callback];
        const hasCb = typeof options === 'function' || typeof callback === 'function';
        const cb = typeof options === 'function' ? options : callback;
        const opts = typeof options === 'function' ? undefined : options;
        const trySecrets = [];
        const pushSecret = (s) => {
          const v = s != null ? String(s) : '';
          if (v && !trySecrets.includes(v)) trySecrets.push(v);
        };
        pushSecret(secret);
        pushSecret(process.env.JWT_SECRET);
        pushSecret(longJwtSecret());
        pushSecret(process.env.PREVIEW_JWT_SECRET);

        if (hasCb && typeof cb === 'function') {
          let i = 0;
          const next = () => {
            if (i >= trySecrets.length) {
              return origVerify(token, secret, opts, cb);
            }
            const s = trySecrets[i++];
            try {
              return origVerify(token, s, opts, (err, decoded) => {
                if (!err) return cb(null, decoded);
                return next();
              });
            } catch (_e) {
              return next();
            }
          };
          return next();
        }

        let lastErr = null;
        for (const s of trySecrets) {
          try {
            return origVerify(token, s, opts);
          } catch (err) {
            lastErr = err;
          }
        }
        throw lastErr || new Error('jwt verify failed');
      };
      jwt.__svPatchedVerify = true;
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

  const email = String(obj.email || obj.username || '')
    .toLowerCase()
    .trim();
  const seedUser = String(process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || 'previewadmin')
    .toLowerCase()
    .trim();
  const seedEmail = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .trim();
  const isPreviewAccount =
    email === 'previewadmin' ||
    email === 'admin@preview.demo' ||
    email === seedUser ||
    (seedEmail && email === seedEmail) ||
    (seedUser && email === `${seedUser}@preview.demo`) ||
    /preview\.demo/i.test(email);

  // Seeded teacher preview account must never leave the API as a customer "user".
  if (isPreviewAccount) {
    const forced = String(
      process.env.PREVIEW_FORCE_ADMIN_ROLE ||
        process.env.PREVIEW_MAIN_ROLE ||
        process.env.PREVIEW_ADMIN_ROLE ||
        ''
    ).trim();
    if (forced) {
      role = forced;
    } else if (!role || /^(user|customer|client|member|buyer)$/i.test(String(role))) {
      role = 'admin';
    }
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
    isAdmin: isPreviewAccount ? true : obj.isAdmin !== false,
    is_admin: isPreviewAccount ? true : obj.is_admin,
    isActive: obj.isActive !== false,
    ...obj,
    role,
    isAdmin: isPreviewAccount || obj.isAdmin === true || /admin/i.test(String(role)),
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

async function hashPassword(password) {
  const bcrypt = requireOptional('bcryptjs') || requireOptional('bcrypt');
  if (!bcrypt) return String(password || '');
  try {
    if (typeof bcrypt.hash === 'function') return await bcrypt.hash(String(password || ''), 10);
  } catch (_e) {
    /* ignore */
  }
  return String(password || '');
}

/**
 * Create/update the preview admin so teacher login always works even when the
 * student ZIP seeded a different hash or the demo row was wiped.
 */
async function upsertPreviewAdminUser(mongoose, email, username, password) {
  const User = pickUserModel(mongoose);
  const adminRole =
    String(
      process.env.PREVIEW_FORCE_ADMIN_ROLE ||
        process.env.PREVIEW_MAIN_ROLE ||
        process.env.PREVIEW_ADMIN_ROLE ||
        ''
    ).trim() || 'admin';
  const uname = String(username || (email.includes('@') ? email.split('@')[0] : email) || 'admin').trim();
  const em = String(email || `${uname}@preview.demo`)
    .toLowerCase()
    .trim();
  const hash = await hashPassword(password);
  const setDoc = {
    email: em,
    username: uname,
    role: adminRole,
    isAdmin: true,
    is_admin: true,
    name: process.env.PREVIEW_ADMIN_NAME || 'Preview Admin',
    fullName: process.env.PREVIEW_ADMIN_NAME || 'Preview Admin',
    isActive: true,
    status: 'active',
  };

  if (User) {
    let user = null;
    try {
      user = await User.findOne({
        $or: [{ email: em }, { username: uname }, { username: 'admin' }, { email }],
      }).select('+passwordHash +password +passcode');
    } catch (_e) {
      user = await User.findOne({
        $or: [{ email: em }, { username: uname }, { username: 'admin' }],
      });
    }
    const passFields = {};
    if (User.schema?.paths?.passwordHash) passFields.passwordHash = hash;
    if (User.schema?.paths?.password) passFields.password = hash;
    if (User.schema?.paths?.passcode) passFields.passcode = hash;
    if (!Object.keys(passFields).length) {
      passFields.password = hash;
      passFields.passwordHash = hash;
    }
    if (user && user._id) {
      await User.updateOne({ _id: user._id }, { $set: { ...setDoc, ...passFields } });
      try {
        user = await User.findById(user._id).select('+passwordHash +password +passcode');
      } catch (_r) {
        user = await User.findById(user._id);
      }
      console.log('[preview] upserted preview admin', em, uname);
      return user;
    }
    try {
      user = await User.create({ ...setDoc, ...passFields });
      console.log('[preview] created preview admin', em, uname);
      return user;
    } catch (err) {
      console.log('[preview] create admin failed, retry find:', err.message || err);
      return User.findOne({ $or: [{ email: em }, { username: uname }] });
    }
  }

  // Raw mongo fallback
  const db = mongoose.connection && mongoose.connection.db;
  if (!db) return null;
  for (const collName of ['users', 'user', 'admins', 'admin']) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const col = db.collection(collName);
      // eslint-disable-next-line no-await-in-loop
      await col.updateOne(
        { $or: [{ email: em }, { username: uname }, { username: 'admin' }] },
        {
          $set: {
            ...setDoc,
            password: hash,
            passwordHash: hash,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      // eslint-disable-next-line no-await-in-loop
      const doc = await col.findOne({ $or: [{ email: em }, { username: uname }] });
      if (doc) {
        console.log('[preview] raw-mongo upserted admin in', collName);
        return doc;
      }
    } catch (_e) {
      /* try next */
    }
  }
  return null;
}

function isDemoAdminPair(email, password) {
  const e = String(email || '')
    .toLowerCase()
    .trim();
  const p = String(password || '');
  if (!e || !p) return false;
  // Extremely common student ZIP demo credentials (DropSafe and many others).
  // Accept admin, admin@…, administrator@preview.local, etc.
  const local = e.includes('@') ? e.split('@')[0] : e;
  if (
    /^(admin|administrator|previewadmin)$/i.test(local) &&
    /^(admin123|Admin@123|Admin123|password|123456|Preview123!)$/i.test(p)
  ) {
    return true;
  }
  return false;
}

async function previewUniversalLogin(req, res, next, options = {}) {
  const softFail = Boolean(options.softFail);
  const allowUpsert = options.upsert !== false;
  let { email, password } = pickCredentials(req.body);
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

  const pe = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo')
    .toLowerCase()
    .trim();
  const pp = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!');
  const seedUser = String(
    process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || pe.split('@')[0] || 'admin'
  ).trim();
  const forcePreview =
    Boolean(options.forcePreview) ||
    isPreviewAdminAttempt(email, password) ||
    isDemoAdminPair(email, password) ||
    isSandboxLoginFailureRecoverable(email, password);

  // Prefer seeded identity when teacher uses demo admin/admin123.
  if (forcePreview && allowUpsert) {
    email = pe.includes('@') ? pe : `${seedUser}@preview.demo`;
    // Keep username login working: also search/create under typed username.
  }

  try {
    let user = null;
    const User = pickUserModel(mongoose);
    const typed = String(pickCredentials(req.body).email || '').trim();
    const typedUser = typed.includes('@') ? typed.split('@')[0] : typed;
    if (User) {
      try {
        user = await User.findOne({
          $or: [
            { email },
            { username: email },
            { username: email.split('@')[0] },
            { username: typedUser },
            { username: seedUser },
            { username: 'admin' },
            { email: pe },
          ],
        }).select('+passwordHash +password +passcode');
      } catch (_e) {
        user = await User.findOne({
          $or: [{ email }, { username: typedUser }, { username: 'admin' }, { username: seedUser }],
        });
      }
    }
    if (!user) {
      user = await findUserRawMongo(mongoose, email);
    }
    if (!user) {
      user = await findUserRawMongo(mongoose, typedUser || seedUser || 'admin');
    }

    let ok = user ? await verifyPassword(user, password) : false;
    // Also accept seeded password against the found row.
    if (!ok && user && pp) {
      ok = await verifyPassword(user, pp);
      if (ok) password = pp;
    }

    if ((!user || !ok) && forcePreview && allowUpsert) {
      console.log('[preview] login upsert path for', typed || email);
      // Demo ZIPs (admin/admin123): store the typed password so student verify still works.
      // Seeded preview admin: store PREVIEW_ADMIN_PASSWORD.
      const upsertPass = isDemoAdminPair(typed, password) ? password : pp || password;
      user = await upsertPreviewAdminUser(
        mongoose,
        pe.includes('@') ? pe : `${seedUser}@preview.demo`,
        typedUser || seedUser || 'admin',
        upsertPass
      );
      ok = Boolean(user);
      if (ok) password = upsertPass;
    }

    if (!user) {
      if (softFail) return next();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!ok) {
      if (softFail) return next();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Preview teacher credentials → always admin in the JWT + JSON body.
    if (forcePreview || isPreviewAdminAttempt(email, password) || isDemoAdminPair(typed, password)) {
      try {
        const adminRole =
          String(
            process.env.PREVIEW_FORCE_ADMIN_ROLE ||
              process.env.PREVIEW_MAIN_ROLE ||
              process.env.PREVIEW_ADMIN_ROLE ||
              ''
          ).trim() || 'admin';
        if (User && user._id) {
          await User.updateOne(
            { _id: user._id },
            { $set: { role: adminRole, isAdmin: true, is_admin: true } }
          ).catch(() => null);
        }
        if (user.role !== undefined) user.role = adminRole;
        if (typeof user.set === 'function') {
          try {
            user.set('role', adminRole);
            user.set('isAdmin', true);
          } catch (_e) {
            /* ignore */
          }
        } else {
          user.role = adminRole;
          user.isAdmin = true;
        }
      } catch (_eRole) {
        /* ignore */
      }
    }

    const jwt = requireOptional('jsonwebtoken');
    if (!jwt) {
      console.log('[preview] universal login: jsonwebtoken missing — fall through');
      return next();
    }
    const safe = sanitizeUser(user);
    const token = jwt.sign(
      { id: user._id, _id: user._id, role: safe.role, email: user.email || email },
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
  const seedUser = String(
    process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || ''
  )
    .toLowerCase()
    .trim();
  const e = String(email || '')
    .toLowerCase()
    .trim();
  const p = String(password || '');
  if (!e || !p) return false;
  if (p !== pp) return false;
  if (e === pe) return true;
  if (pe.includes('@') && e === pe.split('@')[0]) return true;
  if (seedUser && e === seedUser) return true;
  if (e === 'admin@preview.demo' || e === 'admin@preview.local' || e === 'previewadmin' || e === 'admin') {
    return true;
  }
  if (/^admin@preview\./i.test(e)) return true;
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
  const origSend = typeof res.send === 'function' ? res.send.bind(res) : null;
  const origEnd = typeof res.end === 'function' ? res.end.bind(res) : null;

  function tryRecover(body, passthrough) {
    const failed =
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 422;
    const creds = pickCredentials(req.body);
    const shouldRecover =
      failed &&
      !res.__svLoginRecovered &&
      (isDemoAdminPair(creds.email, creds.password) ||
        isPreviewAdminAttempt(creds.email, creds.password) ||
        isSandboxLoginFailureRecoverable(creds.email, creds.password));
    if (!shouldRecover) return passthrough();

    res.__svLoginRecovered = true;
    const pe = String(
      process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo'
    )
      .toLowerCase()
      .trim();
    const pp = String(
      process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!'
    );
    const seedUser = String(
      process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || pe.split('@')[0] || 'admin'
    ).trim();
    const typedUser =
      String(creds.email || '').includes('@')
        ? String(creds.email).split('@')[0]
        : String(creds.email || seedUser || 'admin').trim();
    const recoverPass = isDemoAdminPair(creds.email, creds.password)
      ? creds.password
      : pp;
    try {
      const prev = req.body && typeof req.body === 'object' ? { ...req.body } : {};
      req.body = {
        ...prev,
        email: pe.includes('@') ? pe : `${seedUser}@preview.demo`,
        username: typedUser || seedUser || (pe.includes('@') ? pe.split('@')[0] : pe),
        password: recoverPass,
        identifier: pe,
        login: pe,
      };
    } catch (_b) {
      /* ignore */
    }
    console.log(
      '[preview] login recovery after',
      statusCode,
      '— retrying with preview admin',
      pe,
      '/',
      typedUser || seedUser
    );
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
        return passthrough();
      }, { softFail: false })
    ).catch(function () {
      return passthrough();
    });
  }

  res.status = function patchedStatus(code) {
    statusCode = Number(code) || statusCode;
    return origStatus(code);
  };
  res.json = function patchedJson(body) {
    return tryRecover(body, function () {
      return origJson(body);
    });
  };
  if (origSend) {
    res.send = function patchedSend(body) {
      // DropSafe and others: res.status(400).send({ message: '...' })
      return tryRecover(body, function () {
        return origSend(body);
      });
    };
  }
  if (origEnd) {
    res.end = function patchedEnd(chunk, encoding, cb) {
      if (res.__svLoginRecovered) {
        return origEnd(chunk, encoding, cb);
      }
      const failed =
        statusCode === 400 ||
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 422;
      if (!failed || res.headersSent) {
        return origEnd(chunk, encoding, cb);
      }
      let body = chunk;
      try {
        if (Buffer.isBuffer(chunk)) body = chunk.toString(encoding || 'utf8');
      } catch (_e) {
        /* ignore */
      }
      return tryRecover(body, function () {
        return origEnd(chunk, encoding, cb);
      });
    };
  }
}

/**
 * Any failed teacher preview login can fall back to the seeded sandbox admin.
 * Username "admin" + project demo password (admin123) is extremely common.
 */
function isSandboxLoginFailureRecoverable(email, password) {
  const e = String(email || '')
    .toLowerCase()
    .trim();
  const p = String(password || '');
  if (!e || !p) return false;
  const local = e.includes('@') ? e.split('@')[0] : e;
  if (/^(admin|previewadmin|administrator)$/i.test(local)) return true;
  if (/@preview\.(demo|local|test|dev)$/i.test(e)) return true;
  const pe = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .trim();
  const seedUser = String(process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || '')
    .toLowerCase()
    .trim();
  if (seedUser && (e === seedUser || local === seedUser)) return true;
  if (pe && (e === pe || (pe.includes('@') && e === pe.split('@')[0]) || local === pe.split('@')[0])) {
    return true;
  }
  return false;
}

function isRouteNotFoundPayload(body) {
  try {
    const s = typeof body === 'string' ? body : JSON.stringify(body == null ? '' : body);
    return /route\s*not\s*found|cannot\s+(GET|POST|PUT|PATCH|DELETE)|not\s+found:\s*\//i.test(s);
  } catch (_e) {
    return false;
  }
}

function toggleApiPrefixUrl(url) {
  const raw = String(url || '/');
  const pathOnly = raw.split('?')[0] || '/';
  const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  if (/^\/api\/v1\//i.test(pathOnly)) {
    return `${pathOnly.replace(/^\/api\/v1/i, '/api') || '/api'}${qs}`;
  }
  if (/^\/api\//i.test(pathOnly)) {
    const stripped = pathOnly.replace(/^\/api/i, '') || '/';
    return `${stripped}${qs}`;
  }
  if (pathOnly !== '/' && !/^\/api(\/|$)/i.test(pathOnly)) {
    return `/api${pathOnly}${qs}`;
  }
  return null;
}

function singularPluralPathVariants(pathOnly) {
  const p = String(pathOnly || '').split('?')[0] || '/';
  const parts = p.split('/').filter(Boolean);
  if (!parts.length) return [];
  const last = parts[parts.length - 1];
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(last)) return [];
  const next = parts.slice();
  if (/ies$/i.test(last) && last.length > 4) {
    next[next.length - 1] = `${last.slice(0, -3)}y`;
  } else if (/s$/i.test(last) && last.length > 2 && !/ss$/i.test(last)) {
    next[next.length - 1] = last.replace(/s$/i, '');
  } else if (/y$/i.test(last) && last.length > 2) {
    next[next.length - 1] = `${last.slice(0, -1)}ies`;
  } else {
    next[next.length - 1] = `${last}s`;
  }
  if (next[next.length - 1] === last) return [];
  return [`/${next.join('/')}`];
}

function buildApiPathAlternates(url) {
  const raw = String(url || '/');
  const pathOnly = raw.split('?')[0] || '/';
  const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  const out = [];
  const seen = new Set();
  function push(u) {
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  }
  const toggled = toggleApiPrefixUrl(raw);
  if (toggled) push(toggled);
  for (const sp of singularPluralPathVariants(pathOnly)) {
    push(`${sp}${qs}`);
    const t = toggleApiPrefixUrl(`${sp}${qs}`);
    if (t) push(t);
  }
  if (/^\/api\//i.test(pathOnly) && !/^\/api\/v1\//i.test(pathOnly)) {
    push(`${pathOnly.replace(/^\/api\//i, '/api/v1/')}${qs}`);
  }
  if (/^\/api\/v1\//i.test(pathOnly)) {
    push(`${pathOnly.replace(/^\/api\/v1\//i, '/api/')}${qs}`);
    push(`${pathOnly.replace(/^\/api\/v1/i, '') || '/'}${qs}`);
  }
  return out.filter((u) => u !== raw);
}

/**
 * When Express 404s on /api/students but the route is mounted at /students (or the
 * reverse), re-dispatch once/few times before the student catch-all response is sent.
 */
function wrapApiPath404Retry(req, res, origHandle, out) {
  if (!req || !res || typeof res.json !== 'function') return;
  if (req.__svApiPathWrapped) return;
  req.__svApiPathWrapped = true;

  let statusCode = 200;
  const origStatus = res.status.bind(res);
  const origJson = res.json.bind(res);
  const origSend = typeof res.send === 'function' ? res.send.bind(res) : null;

  function tryAlternate(body, passthrough) {
    if (res.headersSent) return passthrough();
    const failed =
      statusCode === 404 ||
      statusCode === 405 ||
      (statusCode >= 400 && statusCode < 500 && isRouteNotFoundPayload(body));
    if (!failed) return passthrough();

    if (!req.__svApiPathAlts) {
      req.__svApiPathAlts = buildApiPathAlternates(req.url || req.originalUrl || '/');
      req.__svApiPathRetryIdx = 0;
    }
    const alts = req.__svApiPathAlts || [];
    const idx = Number(req.__svApiPathRetryIdx) || 0;
    if (idx >= alts.length) return passthrough();

    const from = req.url || req.originalUrl || '/';
    const nextAlt = alts[idx];
    req.__svApiPathRetryIdx = idx + 1;
    req.url = nextAlt;
    try {
      req.originalUrl = nextAlt;
    } catch (_o) {
      /* ignore */
    }
    statusCode = 200;
    try {
      res.statusCode = 200;
    } catch (_s) {
      /* ignore */
    }
    console.log('[preview] api path 404 → retry', from, '→', nextAlt);
    try {
      return origHandle(req, res, out);
    } catch (err) {
      console.log('[preview] api path retry failed:', err && err.message ? err.message : err);
      return passthrough();
    }
  }

  res.status = function patchedStatus(code) {
    statusCode = Number(code) || statusCode;
    return origStatus(code);
  };
  res.json = function patchedJson(body) {
    return tryAlternate(body, function () {
      return origJson(body);
    });
  };
  if (origSend) {
    res.send = function patchedSend(body) {
      return tryAlternate(body, function () {
        return origSend(body);
      });
    };
  }
}

function installPreviewCorsFix(app) {
  if (!app || typeof app.use !== 'function') return;
  installPreviewRuntimeGuards();

  // Catch student login 401s + /api vs bare path 404s regardless of route order.
  if (!app.__svHandlePatch && typeof app.handle === 'function') {
    app.__svHandlePatch = true;
    const origHandle = app.handle.bind(app);
    app.handle = function svHandle(req, res, out) {
      try {
        wrapLoginResponseForRecovery(req, res);
        wrapApiPath404Retry(req, res, origHandle, out);
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
    const creds = pickCredentials(req.body || {});
    const hard =
      isPreviewAdminAttempt(creds.email, creds.password) ||
      isDemoAdminPair(creds.email, creds.password) ||
      (/^(admin|previewadmin)$/i.test(String(creds.email || '')) &&
        Boolean(String(creds.password || '').trim()));
    // admin/* demo or seeded preview identity: upsert + succeed (never soft-fail to 400).
    Promise.resolve(
      previewUniversalLogin(req, res, next, {
        softFail: !hard,
        upsert: true,
        forcePreview: hard,
      })
    ).catch(next);
  });

  for (const loginPath of LOGIN_PATHS) {
    try {
      app.post(loginPath, ...handlers);
    } catch (_e) {
      /* ignore */
    }
  }

  console.log('[preview] CORS + universal login installed (v9 api-path retry)');
}

/**
 * Used by the gateway when Express still returns 400/401 for admin/admin123
 * (inject order / wrap missed). Connects Mongo if needed, upserts admin, returns JWT JSON.
 */
async function forcePreviewLogin(body) {
  const creds = pickCredentials(body || {});
  const email = String(creds.email || '').trim();
  const password = String(creds.password || '');
  if (!email || !password) {
    return { ok: false, status: 400, body: { message: 'Missing credentials', error: 'no_creds' } };
  }
  const recoverable =
    isDemoAdminPair(email, password) ||
    isPreviewAdminAttempt(email, password) ||
    isSandboxLoginFailureRecoverable(email, password);
  if (!recoverable) {
    return {
      ok: false,
      status: 401,
      body: { message: 'Not a preview admin login', error: 'not_preview_admin' },
    };
  }

  let mongoose = requireOptional('mongoose') || requireFromCwd('mongoose');
  if (!mongoose) {
    return {
      ok: false,
      status: 503,
      body: { message: 'mongoose unavailable', error: 'no_mongoose' },
    };
  }

  if (mongoose.connection.readyState !== 1) {
    const uri = resolveSandboxMongoUri(previewMongoUri());
    if (!uri) {
      return {
        ok: false,
        status: 503,
        body: { message: 'MONGO_URI missing', error: 'no_mongo_uri' },
      };
    }
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    } catch (err) {
      return {
        ok: false,
        status: 503,
        body: {
          message: 'Mongo connect failed',
          detail: String((err && err.message) || err),
          error: 'mongo_connect',
        },
      };
    }
  }

  const pe = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo')
    .toLowerCase()
    .trim();
  const pp = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!');
  const seedUser = String(
    process.env.PREVIEW_SEED_USERNAME || process.env.ADMIN_USERNAME || pe.split('@')[0] || 'admin'
  ).trim();
  const typedUser = email.includes('@') ? email.split('@')[0] : email;
  const upsertPass = isDemoAdminPair(email, password) ? password : pp || password;

  let user;
  try {
    user = await upsertPreviewAdminUser(
      mongoose,
      pe.includes('@') ? pe : `${seedUser}@preview.demo`,
      typedUser || seedUser || 'admin',
      upsertPass
    );
  } catch (err) {
    return {
      ok: false,
      status: 500,
      body: {
        message: 'Upsert failed',
        detail: String((err && err.message) || err),
        error: 'upsert_failed',
      },
    };
  }
  if (!user) {
    return { ok: false, status: 500, body: { message: 'Upsert returned empty', error: 'no_user' } };
  }

  const adminRole =
    String(
      process.env.PREVIEW_FORCE_ADMIN_ROLE ||
        process.env.PREVIEW_MAIN_ROLE ||
        process.env.PREVIEW_ADMIN_ROLE ||
        ''
    ).trim() || 'admin';
  try {
    const User = pickUserModel(mongoose);
    if (User && user._id) {
      await User.updateOne(
        { _id: user._id },
        { $set: { role: adminRole, isAdmin: true, is_admin: true } }
      ).catch(() => null);
    }
    if (user.role !== undefined) user.role = adminRole;
    user.isAdmin = true;
  } catch (_e) {
    /* ignore */
  }

  const jwt = requireOptional('jsonwebtoken');
  if (!jwt) {
    return {
      ok: false,
      status: 500,
      body: { message: 'jsonwebtoken missing', error: 'no_jwt' },
    };
  }
  const safe = sanitizeUser(user);
  safe.role = adminRole;
  const token = jwt.sign(
    { id: user._id, _id: user._id, role: safe.role, email: user.email || pe },
    longJwtSecret(),
    { expiresIn: '7d' }
  );
  console.log('[preview] forcePreviewLogin OK for', typedUser || email, 'role=', safe.role);
  return {
    ok: true,
    status: 200,
    body: normalizeLoginResponseBody({
      success: true,
      token,
      accessToken: token,
      access_token: token,
      user: safe,
      data: { token, user: safe, success: true },
      message: 'Login successful',
    }),
  };
}

module.exports = {
  installPreviewCorsFix,
  installPreviewRuntimeGuards,
  normalizeLoginResponseBody,
  forcePreviewLogin,
  isDemoAdminPair,
};
