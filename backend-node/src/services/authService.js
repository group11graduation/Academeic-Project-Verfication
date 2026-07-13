import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';

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
  return { token, user: await enrichUserWithProfile(user) };
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
