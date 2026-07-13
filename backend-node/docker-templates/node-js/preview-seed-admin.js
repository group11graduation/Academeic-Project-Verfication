#!/usr/bin/env node
/**
 * Ensure preview login credentials exist in the student MERN backend MongoDB.
 * Handles plain-password Mongoose hooks, bcrypt/bcryptjs, select:false passwords, and common role enums.
 */
(async () => {
  let mongoose;
  try {
    require('dotenv').config({ path: '.env' });
    mongoose = require('mongoose');
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
      './models/User.js',
      './models/user.js',
      './model/User.js',
    ];
    const discovered = [];
    const fs = require('fs');
    const path = require('path');
    for (const dir of ['src/models', 'models', 'model', 'src/model']) {
      const abs = path.join(process.cwd(), dir);
      if (!fs.existsSync(abs)) continue;
      try {
        for (const file of fs.readdirSync(abs)) {
          if (/user/i.test(file) && /\.(js|cjs|mjs)$/i.test(file)) {
            discovered.push(path.join(dir, file).replace(/\\/g, '/'));
          }
        }
      } catch {
        /* ignore */
      }
    }
    const userModelPaths = [...new Set([...staticPaths, ...discovered])];
    let User = null;
    for (const p of userModelPaths) {
      try {
        User = require(p);
        console.log('[preview-seed] using User model', p);
        break;
      } catch {
        /* try next */
      }
    }
    if (!User) {
      console.log('[preview-seed] skipped: no User model found');
      return;
    }

    let bcrypt;
    let bcryptjs;
    try {
      bcrypt = require('bcrypt');
    } catch {
      bcrypt = null;
    }
    try {
      bcryptjs = require('bcryptjs');
    } catch {
      bcryptjs = null;
    }

    const hashPassword = async (plain) => {
      if (bcrypt) return bcrypt.hash(plain, 10);
      if (bcryptjs) return bcryptjs.hash(plain, 10);
      throw new Error('bcrypt or bcryptjs required');
    };

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
      const rolePath = User.schema?.paths?.role;
      const enumValues = rolePath?.enumValues;
      if (Array.isArray(enumValues) && enumValues.length) {
        const vals = enumValues.map((v) => String(v));
        const prefer = ['admin', 'ADMIN', 'manager', 'MANAGER', 'superadmin', 'SuperAdmin', 'user', 'USER'];
        for (const p of prefer) {
          if (vals.includes(p)) return p;
        }
        return vals[0];
      }
      return 'admin';
    }

    function passwordFieldName() {
      if (User.schema?.paths?.password) return 'password';
      if (User.schema?.paths?.passwordHash) return 'passwordHash';
      if (User.schema?.paths?.passcode) return 'passcode';
      return 'password';
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
      return comparePassword(plain, String(stored));
    }

    async function writePasswordHash(userId, plain) {
      const field = passwordFieldName();
      const hashed = await hashPassword(plain);
      await User.updateOne({ _id: userId }, { $set: { [field]: hashed } });
      return reloadUserWithSecrets(userId);
    }

    async function setPassword(user, plain) {
      const field = passwordFieldName();
      user[field] = plain;
      if (typeof user.markModified === 'function') user.markModified(field);
      try {
        await user.save();
      } catch (err) {
        console.log('[preview-seed] save with plain password failed:', err.message || err);
      }
      let reloaded = await reloadUserWithSecrets(user._id);
      if (await passwordMatches(reloaded, plain)) {
        return reloaded;
      }
      return writePasswordHash(user._id, plain);
    }

    function applyActiveFlags(doc) {
      if (User.schema?.paths?.isActive && doc.isActive === undefined) doc.isActive = true;
      if (User.schema?.paths?.status && !doc.status) doc.status = 'active';
      if (User.schema?.paths?.isVerified && doc.isVerified === undefined) doc.isVerified = true;
      return doc;
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    console.log('[preview-seed] connected to mongo');

    const role = pickDefaultRole();
    const lookup = { $or: [{ email }, { username: email }] };
    let user = await findUserWithSecrets(lookup);
    if (!user) {
      const doc = applyActiveFlags({
        name: process.env.PREVIEW_ADMIN_NAME || 'Preview Admin',
        email,
        role,
      });
      if (User.schema?.paths?.username) {
        doc.username = email.split('@')[0] || 'previewadmin';
      }
      doc[passwordFieldName()] = rawPass;
      user = new User(doc);
      try {
        await user.save();
      } catch (err) {
        console.log('[preview-seed] create via save failed, trying direct hash:', err.message || err);
        user = await User.create({
          ...doc,
          [passwordFieldName()]: await hashPassword(rawPass),
        });
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
    const adminLike = enumValues.find((v) => /admin|manager/i.test(v));
    if (adminLike && user && String(user.role) !== adminLike) {
      await User.updateOne({ _id: user._id }, { $set: { role: adminLike } });
      console.log('[preview-seed] set role to', adminLike);
    }

    const verified = await passwordMatches(await reloadUserWithSecrets(user._id), rawPass);
    console.log('[preview-seed] password verify:', verified ? 'OK' : 'FAILED');
    if (!verified) {
      process.exitCode = 1;
    }
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
