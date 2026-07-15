import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';
import { logger } from '../config/logger.js';
import {
  buildPasswordResetUrl,
  isEmailDeliveryEnabled,
  sendPasswordResetEmail,
} from './emailService.js';

function signToken(user) {
  const roles = user.getRoleList();
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      roles,
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
}

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

async function findUserByIdentifier(identifier) {
  const id = (identifier || '').trim();
  if (!id) return null;

  let user = await User.findOne({
    $or: [{ email: id.toLowerCase() }, { username: id }, { username: id.toLowerCase() }],
  }).select('+passwordHash +passwordResetToken +passwordResetExpires');

  if (!user) {
    const teacherProf = await TeacherProfile.findOne({ employeeId: id }).populate({
      path: 'user',
      select: '+passwordHash +passwordResetToken +passwordResetExpires',
    });
    if (teacherProf?.user) user = teacherProf.user;
  }
  if (!user) {
    const studentProf = await StudentProfile.findOne({ studentId: id }).populate({
      path: 'user',
      select: '+passwordHash +passwordResetToken +passwordResetExpires',
    });
    if (studentProf?.user) user = studentProf.user;
  }

  return user;
}

export async function loginWithIdentifier(identifier, passcode) {
  const id = (identifier || '').trim();
  if (!id || !passcode) {
    const err = new Error('Identifier and passcode are required');
    err.status = 400;
    throw err;
  }

  const user = await findUserByIdentifier(id);

  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const match = await user.comparePassword(passcode);
  if (!match) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account is disabled');
    err.status = 403;
    throw err;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  return { token, user: await enrichUserWithProfile(user) };
}

/**
 * Start password reset. Always returns a generic message (no account enumeration).
 * Sends reset link by email when SMTP is configured; dev fallback returns token only when
 * AUTH_RETURN_RESET_TOKEN=true and SMTP is not configured.
 */
export async function requestPasswordReset(identifier) {
  const generic = {
    message:
      'If an account matches that email or ID, we sent a password reset link. Check your inbox (and spam). The link expires in 30 minutes.',
  };

  const user = await findUserByIdentifier(identifier);
  if (!user || !user.isActive) {
    return generic;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const recipientEmail = String(user.email || '').trim().toLowerCase();
  if (isEmailDeliveryEnabled()) {
    if (!recipientEmail) {
      logger.warn(`[auth] Password reset for user ${user._id} — no email on account`);
      return {
        message:
          'This account has no email address on file. Ask your administrator to reset your password or add an email to your profile.',
      };
    }
    const resetUrl = buildPasswordResetUrl(rawToken);
    const sent = await sendPasswordResetEmail({
      to: recipientEmail,
      name: user.name || '',
      resetUrl,
    });
    if (!sent) {
      const err = new Error('Could not send reset email. Try again later or contact your administrator.');
      err.status = 503;
      throw err;
    }
    logger.info(`[auth] Password reset email sent for user ${user._id}`);
    return generic;
  }

  const returnToken = String(process.env.AUTH_RETURN_RESET_TOKEN || 'false').toLowerCase() === 'true';
  if (returnToken) {
    logger.info(`[auth] Password reset token issued for user ${user._id} (SMTP not configured — dev mode)`);
    return {
      message:
        'SMTP is not configured. Use the reset link shown in development mode only.',
      resetToken: rawToken,
    };
  }

  logger.warn('[auth] Password reset requested but SMTP is not configured');
  const err = new Error('Password reset email is not configured. Contact your administrator.');
  err.status = 503;
  throw err;
}

export async function resetPasswordWithToken(rawToken, newPassword) {
  const token = String(rawToken || '').trim();
  const password = String(newPassword || '');
  if (!token || password.length < 6) {
    const err = new Error('A valid reset token and a password of at least 6 characters are required');
    err.status = 400;
    throw err;
  }

  const hashed = hashResetToken(token);
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordHash +passwordResetToken +passwordResetExpires');

  if (!user) {
    const err = new Error('This reset link is invalid or has expired. Request a new one.');
    err.status = 400;
    throw err;
  }

  user.passwordHash = await User.hashPassword(password);
  user.handoffPasscode = password;
  user.passwordResetToken = '';
  user.passwordResetExpires = null;
  await user.save();

  return { message: 'Password updated. You can sign in with your new password.' };
}

export function toPublicUser(user) {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.passwordHash;
  delete u.passwordResetToken;
  const roles = typeof user.getRoleList === 'function' ? user.getRoleList() : [user.role];
  return {
    ...u,
    roles,
  };
}

async function enrichUserWithProfile(user) {
  const publicUser = toPublicUser(user);
  const roles = publicUser.roles || [publicUser.role];

  if (roles.includes('teacher')) {
    const profile = await TeacherProfile.findOne({ user: user._id }).lean();
    if (profile) {
      publicUser.department = profile.department || '';
      publicUser.employeeId = profile.employeeId || '';
    }
  }

  if (roles.includes('student')) {
    const profile = await StudentProfile.findOne({ user: user._id }).lean();
    if (profile) {
      let faculty = profile.faculty || '';
      const classCode = String(profile.classCode || '').trim().toUpperCase();
      if (classCode) {
        const cls = await Class.findOne({ code: classCode }).select('faculty').lean();
        if (cls?.faculty) faculty = cls.faculty;
      }
      publicUser.department = faculty || profile.program || '';
      publicUser.studentId = profile.studentId || '';
      publicUser.classCode = profile.classCode || '';
      publicUser.faculty = faculty;
    }
  }

  return publicUser;
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return enrichUserWithProfile(user);
}
