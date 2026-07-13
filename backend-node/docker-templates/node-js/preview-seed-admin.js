#!/usr/bin/env node
/**
 * Ensure preview login credentials exist in the student MERN backend MongoDB.
 * Handles plain-password Mongoose hooks, bcrypt/bcryptjs, and common role enums.
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

    const userModelPaths = [
      './src/models/User.js',
      './src/models/user.js',
      './models/User.js',
      './model/User.js',
    ];
    let User = null;
    let userModelPath = '';
    for (const p of userModelPaths) {
      try {
        User = require(p);
        userModelPath = p;
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

    async function passwordMatches(user, plain) {
      const field = passwordFieldName();
      const stored = user[field];
      if (!stored) return false;
      return comparePassword(plain, String(stored));
    }

    async function setPassword(user, plain) {
      const field = passwordFieldName();
      user[field] = plain;
      if (typeof user.markModified === 'function') user.markModified(field);
      await user.save();
      const reloaded = await User.findById(user._id);
      if (await passwordMatches(reloaded, plain)) {
        return reloaded;
      }
      const hashed = await hashPassword(plain);
      reloaded[field] = hashed;
      if (typeof reloaded.markModified === 'function') reloaded.markModified(field);
      await reloaded.save();
      return reloaded;
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    console.log('[preview-seed] connected to mongo');

    const role = pickDefaultRole();
    const lookup = { $or: [{ email }, { username: email }] };
    let user = await User.findOne(lookup);
    if (!user) {
      const doc = {
        name: process.env.PREVIEW_ADMIN_NAME || 'Preview Admin',
        email,
        role,
      };
      if (User.schema?.paths?.username && !String(email).includes('@')) {
        doc.username = email;
      } else if (User.schema?.paths?.username) {
        doc.username = email.split('@')[0] || 'previewadmin';
      }
      doc[passwordFieldName()] = rawPass;
      user = new User(doc);
      await user.save();
      user = await User.findById(user._id);
      console.log('[preview-seed] created preview admin', email, 'role=', user.role || role);
    } else {
      console.log('[preview-seed] found existing user', email);
    }

    if (!(await passwordMatches(user, rawPass))) {
      user = await setPassword(user, rawPass);
      console.log('[preview-seed] reset preview admin password', email);
    } else {
      console.log('[preview-seed] preview admin password already valid', email);
    }

    if (user.role && role && String(user.role).toLowerCase() !== String(role).toLowerCase()) {
      const rolePath = User.schema?.paths?.role;
      const enumValues = rolePath?.enumValues?.map((v) => String(v)) || [];
      const adminLike = enumValues.find((v) => /admin|manager/i.test(v));
      if (adminLike) {
        user.role = adminLike;
        await user.save();
        console.log('[preview-seed] set role to', adminLike);
      }
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
