import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';

function signToken(user) {
  const roles = user.getRoleList();
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      roles,
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export function toPublicUser(user) {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.passwordHash;
  const roles = typeof user.getRoleList === 'function' ? user.getRoleList() : [user.role];
  return {
    ...u,
    roles,
  };
}

export async function loginWithIdentifier(identifier, passcode) {
  const id = (identifier || '').trim();
  if (!id || !passcode) {
    const err = new Error('Identifier and passcode are required');
    err.status = 400;
    throw err;
  }

  let user = await User.findOne({
    $or: [{ email: id.toLowerCase() }, { username: id }, { username: id.toLowerCase() }],
  }).select('+passwordHash');

  if (!user) {
    const teacherProf = await TeacherProfile.findOne({ employeeId: id }).populate({
      path: 'user',
      select: '+passwordHash',
    });
    if (teacherProf?.user) user = teacherProf.user;
  }
  if (!user) {
    const studentProf = await StudentProfile.findOne({ studentId: id }).populate({
      path: 'user',
      select: '+passwordHash',
    });
    if (studentProf?.user) user = studentProf.user;
  }

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
  return { token, user: toPublicUser(user) };
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return toPublicUser(user);
}
