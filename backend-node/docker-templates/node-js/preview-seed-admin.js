#!/usr/bin/env node
/**
 * Ensure preview login credentials exist in the student MERN backend MongoDB.
 * Handles plain-password Mongoose hooks, bcrypt/bcryptjs, select:false passwords, and common role enums.
 *
 * Lives at /preview-seed-admin.js in the image; student deps are under process.cwd()/node_modules
 * (entrypoint cds into the backend). Resolve packages via createRequire(cwd) — never from /.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const requireFromCwd = createRequire(path.join(process.cwd(), 'package.json'));

/** Prefer student deps; fall back to image-baked /preview-tools (bcryptjs, mysql2). */
function requireOptional(pkg) {
  try {
    return requireFromCwd(pkg);
  } catch {
    /* try preview-tools */
  }
  try {
    return createRequire('/preview-tools/package.json')(pkg);
  } catch {
    /* try direct path */
  }
  try {
    return require(`/preview-tools/node_modules/${pkg}`);
  } catch {
    return null;
  }
}

/** Load KEY=VALUE from .env without requiring the dotenv package. Never overrides existing env. */
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

function loadPreviewEnv() {
  // Never require('dotenv') — many student projects omit it and the seed would crash.
  // Docker/entrypoint already injects MONGO_URI / PREVIEW_ADMIN_* into process.env;
  // we only fill gaps from a local .env if present.
  loadEnvFileManual(path.join(process.cwd(), '.env'));
}

(async () => {
  let mongoose;
  try {
    loadPreviewEnv();
    // React + Express + MySQL projects do not ship mongoose — skip cleanly.
    if (String(process.env.PREVIEW_DB_ENGINE || '').toLowerCase() === 'mysql') {
      console.log('[preview-seed] skipped: PREVIEW_DB_ENGINE=mysql (use preview-seed-mysql.js)');
      return;
    }
    try {
      mongoose = requireFromCwd('mongoose');
    } catch (err) {
      console.log(
        '[preview-seed] skipped: mongoose not installed in student project (' +
          (err && err.message ? err.message : 'Cannot find module mongoose') +
          ')'
      );
      return;
    }
    for (const key of Object.keys(mongoose.models || {})) {
      delete mongoose.models[key];
    }
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.log('[preview-seed] skipped: missing mongo uri');
      return;
    }

    const email = String(
      process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo'
    )
      .toLowerCase()
      .trim();
    const seedUsername = String(
      process.env.PREVIEW_SEED_USERNAME ||
        process.env.ADMIN_USERNAME ||
        process.env.LOGIN_USERNAME ||
        email.split('@')[0] ||
        'previewadmin'
    ).trim();
    const rawPass = String(
      process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!'
    );
    if (!email || !rawPass) {
      console.log('[preview-seed] skipped: missing email or password');
      return;
    }

    const staticPaths = [
      './src/models/User.js',
      './src/models/user.js',
      './src/models/userModel.js',
      './src/models/UserModel.js',
      './src/models/Admin.js',
      './src/models/admin.js',
      './src/models/adminModel.js',
      './models/User.js',
      './models/user.js',
      './models/Admin.js',
      './model/User.js',
      './dist/models/User.js',
      './dist/models/user.js',
      './dist/src/models/User.js',
      './build/models/User.js',
      './server/models/User.js',
      './backend/models/User.js',
    ];
    const discovered = [];
    for (const dir of ['src/models', 'models', 'model', 'src/model', 'dist/models', 'dist/src/models', 'server/models', 'backend/models']) {
      const abs = path.join(process.cwd(), dir);
      if (!fs.existsSync(abs)) continue;
      try {
        for (const file of fs.readdirSync(abs)) {
          if (/user|admin/i.test(file) && /\.(js|cjs|mjs)$/i.test(file)) {
            discovered.push(`./${path.join(dir, file).replace(/\\/g, '/')}`);
          }
        }
      } catch {
        /* ignore */
      }
    }
    const userModelPaths = [...new Set([...staticPaths, ...discovered])];
    const loadedModels = [];

    const bcrypt = requireOptional('bcrypt');
    const bcryptjs = requireOptional('bcryptjs');
    if (!bcrypt && !bcryptjs) {
      console.log('[preview-seed] no bcrypt in student ZIP or /preview-tools');
    } else {
      try {
        requireFromCwd('bcrypt');
      } catch {
        try {
          requireFromCwd('bcryptjs');
        } catch {
          console.log('[preview-seed] using bcryptjs from /preview-tools');
        }
      }
    }

    const hashPassword = async (plain) => {
      if (bcrypt) return bcrypt.hash(plain, 10);
      if (bcryptjs) return bcryptjs.hash(plain, 10);
      throw new Error('bcrypt or bcryptjs required (install in /preview-tools)');
    };

    const rawUpsertDoc = async (roleForRaw = 'admin') => {
      const hashed = await hashPassword(rawPass);
      const db = mongoose.connection.db;
      const doc = {
        email,
        username: seedUsername || email.split('@')[0] || 'previewadmin',
        password: hashed,
        passwordHash: hashed,
        name: process.env.PREVIEW_ADMIN_NAME || 'Preview Admin',
        firstName: 'Preview',
        lastName: 'Admin',
        // Match mongoose-seeded role. SYADA/Sky enums still pass super_admin / SUPER_ADMIN.
        role: roleForRaw || 'admin',
        isAdmin: true,
        isActive: true,
        active: true,
        status: 'active',
        isVerified: true,
        verified: true,
        emailVerified: true,
        isApproved: true,
        approved: true,
        blocked: false,
        isBlocked: false,
      };
      for (const collName of ['users', 'user', 'admins', 'admin', 'staffs', 'staff']) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await db.collection(collName).updateOne(
            { $or: [{ email }, { username: email }, { username: seedUsername }] },
            { $set: doc },
            { upsert: true }
          );
          console.log('[preview-seed] raw mongo upsert in', collName);
        } catch (err) {
          console.log('[preview-seed] raw mongo upsert failed for', collName, err.message || err);
        }
      }
    };

    // Load ALL User/Admin models — some apps authenticate against Admin while we
    // previously only seeded the first matching User file.
    for (const p of userModelPaths) {
      try {
        const Mod = requireFromCwd(p);
        if (Mod && (Mod.schema || Mod.modelName || typeof Mod.findOne === 'function')) {
          loadedModels.push({ Mod, path: p });
          console.log('[preview-seed] loaded model', p);
        }
      } catch {
        /* try next */
      }
    }
    if (!loadedModels.length) {
      console.log('[preview-seed] no Mongoose User model file — registering flexible User schema');
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
      // Many student apps (loan app) define User inline in server.js — not a separate file.
      // Register a strict:false User model so we can upsert passwordHash/password into `users`.
      const flexibleSchema = new mongoose.Schema(
        {
          email: { type: String, index: true },
          username: String,
          password: String,
          passwordHash: String,
          name: String,
          fullName: String,
          firstName: String,
          lastName: String,
          phone: String,
          role: { type: String, default: 'admin' },
          isAdmin: { type: Boolean, default: true },
          isActive: { type: Boolean, default: true },
          emailVerified: { type: Boolean, default: true },
          isVerified: { type: Boolean, default: true },
          status: { type: String, default: 'active' },
        },
        { strict: false, collection: 'users' }
      );
      const FlexUser =
        mongoose.models.User || mongoose.model('User', flexibleSchema);
      loadedModels.push({ Mod: FlexUser, path: '(flexible-inline)' });
      await rawUpsertDoc('admin');
      // Continue into mongoose seed path below with FlexUser.
    }

    // Seed against every loaded model (use the last one's helpers via closure below).
    let User = loadedModels[0].Mod;
    let lastSeededRole = 'admin';

    const comparePassword = async (plain, hash) => {
      if (!hash) return false;
      if (bcrypt) {
        try {
          if (await bcrypt.compare(plain, hash)) return true;
        } catch {
          /* fall through */
        }
      }
      if (bcryptjs) {
        try {
          if (await bcryptjs.compare(plain, hash)) return true;
        } catch {
          /* fall through */
        }
      }
      return false;
    };

    function pickDefaultRole() {
      const forced = String(
        process.env.PREVIEW_FORCE_ADMIN_ROLE ||
          process.env.PREVIEW_MAIN_ROLE ||
          process.env.PREVIEW_ADMIN_ROLE ||
          ''
      ).trim();
      const rolePath = User.schema?.paths?.role;
      const enumValues = rolePath?.enumValues;
      if (Array.isArray(enumValues) && enumValues.length) {
        const vals = enumValues.map((v) => String(v));
        // Prefer env role from ZIP discovery when it exists in the schema enum.
        if (forced) {
          const exact = vals.find((v) => v === forced);
          if (exact) return exact;
          const fuzzy = vals.find(
            (v) => v.toLowerCase().replace(/[\s_-]/g, '') === forced.toLowerCase().replace(/[\s_-]/g, '')
          );
          if (fuzzy) return fuzzy;
        }
        const hasBorrower = vals.some((v) => /^borrower$/i.test(v));
        const hasOfficer = vals.some((v) => /^officer$/i.test(v));
        const adminExact = vals.find((v) => /^admin$/i.test(v));
        // LoanFlow: admin (not borrower).
        if ((hasBorrower || hasOfficer) && adminExact) return adminExact;
        if (hasOfficer && !adminExact) {
          const officerExact = vals.find((v) => /^officer$/i.test(v));
          if (officerExact) return officerExact;
        }
        const prefer = [
          'SUPER_ADMIN',
          'super_admin',
          'SuperAdmin',
          'superadmin',
          'ADMIN',
          'admin',
          'Admin',
          'MANAGER',
          'manager',
          'Manager',
          'SUB_ADMIN',
          'sub_admin',
          'officer',
          'Officer',
          'editor',
          'user',
          'USER',
        ];
        // Sky Property-style enums: prefer SUPER_ADMIN over plain ADMIN.
        const hasSkySuper = vals.includes('SUPER_ADMIN');
        const hasSkyManager = vals.includes('MANAGER') || vals.includes('SUB_MANAGER');
        if (hasSkySuper && hasSkyManager) return 'SUPER_ADMIN';
        for (const p of prefer) {
          if (vals.includes(p)) return p;
        }
        const fuzzy =
          vals.find((v) => /^super[_\s-]?admin$/i.test(v)) ||
          vals.find((v) => /super[_\s-]?admin/i.test(v)) ||
          vals.find((v) => /^admin$/i.test(v)) ||
          vals.find((v) => /^manager$/i.test(v)) ||
          vals.find((v) => /admin/i.test(v));
        if (fuzzy) return fuzzy;
        return vals[0];
      }
      // No enum: ZIP-discovered role wins, else "admin".
      return forced || 'admin';
    }

    function passwordFieldName() {
      // Prefer passwordHash — loan-app style schemas require it (password alone is ignored).
      if (User.schema?.paths?.passwordHash) return 'passwordHash';
      if (User.schema?.paths?.password) return 'password';
      if (User.schema?.paths?.passcode) return 'passcode';
      return 'passwordHash';
    }

    function passwordSelectPath(field) {
      const path = User.schema?.paths?.[field];
      if (path?.options?.select === false) return `+${field}`;
      return field;
    }

    async function findUserWithSecrets(query) {
      const field = passwordFieldName();
      const select = `${passwordSelectPath(field)} email username role`;
      try {
        return await User.findOne(query).select(select);
      } catch {
        return User.findOne(query);
      }
    }

    async function reloadUserWithSecrets(id) {
      const field = passwordFieldName();
      const select = `${passwordSelectPath(field)} email username role`;
      try {
        return await User.findById(id).select(select);
      } catch {
        return User.findById(id);
      }
    }

    async function passwordMatches(user, plain) {
      if (!user) return false;
      const field = passwordFieldName();
      let stored = user[field];
      if (!stored && typeof user.get === 'function') {
        stored = user.get(field);
      }
      if (!stored) {
        const reloaded = await reloadUserWithSecrets(user._id);
        stored = reloaded?.[field];
      }
      if (!stored) return false;
      if (typeof user.comparePassword === 'function') {
        try {
          if (await user.comparePassword(plain)) return true;
        } catch {
          /* fall through */
        }
      }
      if (typeof user.matchPassword === 'function') {
        try {
          if (await user.matchPassword(plain)) return true;
        } catch {
          /* fall through */
        }
      }
      if (typeof user.correctPassword === 'function') {
        try {
          if (await user.correctPassword(plain, stored)) return true;
        } catch {
          /* fall through */
        }
      }
      return comparePassword(plain, String(stored));
    }

    async function writePasswordHash(userId, plain) {
      const hashed = await hashPassword(plain);
      const updates = {};
      if (User.schema?.paths?.passwordHash) updates.passwordHash = hashed;
      if (User.schema?.paths?.password) updates.password = hashed;
      if (User.schema?.paths?.passcode) updates.passcode = hashed;
      if (!Object.keys(updates).length) {
        updates[passwordFieldName()] = hashed;
      }
      await User.updateOne({ _id: userId }, { $set: updates });
      return reloadUserWithSecrets(userId);
    }

    async function setPassword(user, plain) {
      // Flexible / inline schemas often have no pre-save hash hook — always store bcrypt hashes.
      return writePasswordHash(user._id, plain);
    }

    function applyActiveFlags(doc) {
      if (User.schema?.paths?.isActive && doc.isActive === undefined) doc.isActive = true;
      if (User.schema?.paths?.isAdmin && doc.isAdmin === undefined) doc.isAdmin = true;
      if (User.schema?.paths?.status && !doc.status) doc.status = 'active';
      if (User.schema?.paths?.isVerified && doc.isVerified === undefined) doc.isVerified = true;
      if (User.schema?.paths?.verified && doc.verified === undefined) doc.verified = true;
      if (User.schema?.paths?.emailVerified && doc.emailVerified === undefined) doc.emailVerified = true;
      if (User.schema?.paths?.isApproved && doc.isApproved === undefined) doc.isApproved = true;
      if (User.schema?.paths?.approved && doc.approved === undefined) doc.approved = true;
      if (User.schema?.paths?.active && doc.active === undefined) doc.active = true;
      if (User.schema?.paths?.enabled && doc.enabled === undefined) doc.enabled = true;
      if (User.schema?.paths?.blocked && doc.blocked === undefined) doc.blocked = false;
      if (User.schema?.paths?.isBlocked && doc.isBlocked === undefined) doc.isBlocked = false;
      if (User.schema?.paths?.isDeleted && doc.isDeleted === undefined) doc.isDeleted = false;
      return doc;
    }

    function applyRequiredFields(doc) {
      const paths = User.schema?.paths || {};
      if (paths.name && !doc.name) doc.name = process.env.PREVIEW_ADMIN_NAME || 'Preview Admin';
      if (paths.firstName && !doc.firstName) doc.firstName = 'Preview';
      if (paths.lastName && !doc.lastName) doc.lastName = 'Admin';
      if (paths.phone && !doc.phone) doc.phone = '0000000000';
      return applyActiveFlags(doc);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    console.log('[preview-seed] connected to mongo');

    let anyVerified = false;
    for (const entry of loadedModels) {
      User = entry.Mod;
      console.log('[preview-seed] seeding model', entry.path);

      const role = pickDefaultRole();
      const lookup = { $or: [{ email }, { username: email }, { username: seedUsername }] };
      let user = await findUserWithSecrets(lookup);
      if (!user) {
        const hashed = await hashPassword(rawPass);
        const doc = applyRequiredFields({
          name: process.env.PREVIEW_ADMIN_NAME || 'Preview Admin',
          email,
          role,
        });
        if (User.schema?.paths?.username) {
          doc.username = seedUsername || email.split('@')[0] || 'previewadmin';
        }
        if (User.schema?.paths?.passwordHash) doc.passwordHash = hashed;
        if (User.schema?.paths?.password) doc.password = hashed;
        if (User.schema?.paths?.passcode) doc.passcode = hashed;
        if (!doc.password && !doc.passwordHash && !doc.passcode) {
          doc[passwordFieldName()] = hashed;
        }
        user = new User(doc);
        try {
          await user.save();
        } catch (err) {
          console.log('[preview-seed] create via save failed, trying direct hash:', err.message || err);
          try {
            user = await User.create(doc);
          } catch (err2) {
            console.log('[preview-seed] create failed for', entry.path, err2.message || err2);
            continue;
          }
        }
        user = await reloadUserWithSecrets(user._id);
        console.log('[preview-seed] created preview admin', email, 'role=', user?.role || role);
      } else {
        console.log('[preview-seed] found existing user', email);
      }

      if (!(await passwordMatches(user, rawPass))) {
        user = await setPassword(user, rawPass);
        console.log('[preview-seed] reset preview admin password', email);
      } else {
        console.log('[preview-seed] preview admin password already valid', email);
      }

      const rolePath = User.schema?.paths?.role;
      const enumValues = rolePath?.enumValues?.map((v) => String(v)) || [];
      // Use the same role picker as create — LoanFlow gets admin; SYADA/Sky get super_admin.
      const preferredRole = pickDefaultRole();
      if (preferredRole && user) {
        if (String(user.role) !== preferredRole) {
          await User.updateOne({ _id: user._id }, { $set: { role: preferredRole } });
          user.role = preferredRole;
          console.log('[preview-seed] set role to', preferredRole, enumValues.length ? `(enum=${enumValues.join(',')})` : '(no enum)');
        } else {
          // Still force-write so lean documents / stale caches cannot keep role:"user".
          await User.updateOne({ _id: user._id }, { $set: { role: preferredRole } });
          console.log('[preview-seed] confirmed role', preferredRole);
        }
      }
      lastSeededRole = String((user && user.role) || preferredRole || 'admin');

      if (user?._id) {
        const flagSet = { role: lastSeededRole };
        const paths = User.schema?.paths || {};
        if (paths.isActive) flagSet.isActive = true;
        if (paths.isAdmin) flagSet.isAdmin = true;
        if (paths.is_admin) flagSet.is_admin = true;
        if (paths.status) flagSet.status = 'active';
        if (paths.isVerified) flagSet.isVerified = true;
        if (paths.verified) flagSet.verified = true;
        if (paths.emailVerified) flagSet.emailVerified = true;
        if (paths.isApproved) flagSet.isApproved = true;
        if (paths.approved) flagSet.approved = true;
        if (paths.active) flagSet.active = true;
        if (paths.blocked) flagSet.blocked = false;
        if (paths.isBlocked) flagSet.isBlocked = false;
        // Always $set role + flags even when schema is strict:false / missing path defs.
        flagSet.role = lastSeededRole;
        flagSet.isAdmin = true;
        await User.updateOne({ _id: user._id }, { $set: flagSet });
        console.log('[preview-seed] ensured account flags', JSON.stringify(flagSet));
      }

      const verified = await passwordMatches(await reloadUserWithSecrets(user._id), rawPass);
      console.log('[preview-seed] password verify:', entry.path, verified ? 'OK' : 'FAILED');
      if (verified) anyVerified = true;
    }

    // Always also upsert raw collections — covers apps that query Mongo without the
    // model we found, or that authenticate against a separate admins collection.
    // Use the same role we just seeded — do NOT overwrite with a different privilege name.
    await rawUpsertDoc(lastSeededRole || 'admin');
    console.log('[preview-seed] password verify:', anyVerified ? 'OK' : 'RAW_OK');
  } catch (err) {
    console.error('[preview-seed] failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (mongoose) {
      try {
        await mongoose.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
})();
