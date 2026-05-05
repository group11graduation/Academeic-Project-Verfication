import { User } from '../models/User.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import mongoose from 'mongoose';

function randomPasscode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function listTeachers() {
  const profiles = await TeacherProfile.find().populate('user');
  return profiles.map((p) => formatTeacher(p));
}

export async function getTeacherById(id) {
  if (!id) return null;
  let profile = await TeacherProfile.findById(id).populate('user');
  if (!profile) {
    const sid = String(id).trim();
    profile = await TeacherProfile.findOne({
      $or: [{ employeeId: sid }, { employeeId: sid.toUpperCase() }],
    }).populate('user');
  }
  if (!profile) return null;
  return formatTeacher(profile);
}

async function findTeacherProfileByUserId(userId) {
  return TeacherProfile.findOne({ user: userId }).populate('user');
}

function formatTeacher(profile) {
  const u = profile.user;
  if (!u) return null;
  const handoff = profile.handoffPasscode || '';
  return {
    _id: profile._id,
    userId: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    department: profile.department,
    teacherId: profile.employeeId,
    employeeId: profile.employeeId,
    phone: profile.phone || '',
    photo: u.photo || profile.photo || '',
    skills: profile.skills || [],
    assignedClassCodes: profile.assignedClassCodes || [],
    assignedClasses: profile.assignedClassCodes || [],
    role: u.role,
    roles: u.getRoleList(),
    isActive: u.isActive,
    status: u.isActive === false ? 'INACTIVE' : 'ACTIVE',
    createdAt: profile.createdAt,
    handoffPasscode: handoff,
    passcode: handoff,
  };
}

export async function createTeacher(body) {
  const {
    name,
    email,
    username,
    department,
    teacherId,
    employeeId,
    phone,
    photo,
    skills,
    password,
    passcode,
  } = body;

  let plain = password || passcode;
  if (!plain) {
    plain = randomPasscode();
  }

  const empId = (employeeId || teacherId || '').trim();
  const user = new User({
    email: email?.toLowerCase()?.trim(),
    username: username?.trim() || empId || email?.split('@')[0],
    passwordHash: await User.hashPassword(plain),
    role: 'teacher',
    roles: ['teacher'],
    name: name?.trim() || '',
    photo: photo || '',
  });
  await user.save();

  const profile = new TeacherProfile({
    user: user._id,
    employeeId: empId || undefined,
    department: department?.trim() || '',
    phone: phone?.trim() || '',
    skills: Array.isArray(skills) ? skills : [],
    assignedClassCodes: [],
    handoffPasscode: String(plain),
  });
  await profile.save();
  await profile.populate('user');
  return formatTeacher(profile);
}

export async function updateTeacher(profileId, body) {
  const profile = await TeacherProfile.findById(profileId).populate('user');
  if (!profile) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }
  const u = profile.user;
  if (body.name !== undefined) u.name = body.name;
  if (body.email !== undefined) u.email = body.email?.toLowerCase()?.trim();
  if (body.username !== undefined) u.username = body.username?.trim();
  if (body.photo !== undefined) u.photo = body.photo;
  if (body.isActive !== undefined) u.isActive = body.isActive;
  if (body.department !== undefined) profile.department = body.department;
  if (body.phone !== undefined) profile.phone = body.phone;
  if (body.skills !== undefined) profile.skills = body.skills;
  if (body.employeeId !== undefined || body.teacherId !== undefined) {
    profile.employeeId = (body.employeeId || body.teacherId || '').trim();
  }
  if (body.password || body.passcode) {
    const p = body.password || body.passcode;
    u.passwordHash = await User.hashPassword(p);
    profile.handoffPasscode = String(p);
  }
  await u.save();
  await profile.save();
  await profile.populate('user');
  return formatTeacher(profile);
}

export async function deleteTeacher(profileId) {
  const profile = await TeacherProfile.findById(profileId);
  if (!profile) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }
  await User.deleteOne({ _id: profile.user });
  await TeacherProfile.deleteOne({ _id: profile._id });
  return { ok: true };
}

export async function regenerateTeacherPasscode(profileId) {
  const profile = await TeacherProfile.findById(profileId).populate('user');
  if (!profile) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }
  const passcode = randomPasscode();
  profile.user.passwordHash = await User.hashPassword(passcode);
  profile.handoffPasscode = passcode;
  await profile.user.save();
  await profile.save();
  return { passcode };
}

export async function assignTeacherClasses(profileId, classCodes) {
  const profile = await TeacherProfile.findById(profileId);
  if (!profile) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }
  profile.assignedClassCodes = (classCodes || []).map((c) => String(c).trim().toUpperCase());
  await profile.save();
  return findTeacherProfileByUserId(profile.user).then(formatTeacher);
}

export async function toggleTeacherAdmin(profileId) {
  const profile = await TeacherProfile.findById(profileId).populate('user');
  if (!profile) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }
  const u = profile.user;
  const hasAdmin = u.getRoleList().includes('admin');
  if (hasAdmin) {
    u.roles = (u.roles || []).filter((r) => r !== 'admin');
    if (u.role === 'admin') u.role = 'teacher';
  } else {
    u.roles = [...new Set([...(u.roles || []), 'admin'])];
  }
  await u.save();
  await profile.populate('user');
  return formatTeacher(profile);
}

/** --- Students --- */

export async function listStudents() {
  const profiles = await StudentProfile.find().populate('user');
  return profiles.map(formatStudent);
}

async function resolveStudentProfile(id) {
  if (!id) return null;
  const sid = String(id).trim();
  let profile = null;
  if (mongoose.Types.ObjectId.isValid(sid)) {
    profile = await StudentProfile.findById(sid).populate('user');
  }
  if (!profile) {
    profile = await StudentProfile.findOne({ studentId: sid }).populate('user');
  }
  return profile;
}

export async function getStudentById(id) {
  const profile = await resolveStudentProfile(id);
  if (!profile) return null;
  return formatStudent(profile);
}

function formatStudent(profile) {
  const u = profile.user;
  if (!u) return null;
  const handoff = profile.handoffPasscode || '';
  return {
    _id: profile._id,
    userId: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    studentId: profile.studentId,
    program: profile.program,
    classId: profile.classCode || '',
    classCode: profile.classCode || '',
    faculty: profile.faculty || '',
    academicInfo: { faculty: profile.faculty || '' },
    currentScore: profile.currentScore,
    currentGpa: profile.currentGpa,
    photo: u.photo || '',
    role: u.role,
    roles: u.getRoleList(),
    isActive: u.isActive,
    status: u.isActive === false ? 'INACTIVE' : 'ACTIVE',
    createdAt: profile.createdAt,
    handoffPasscode: handoff,
    passcode: handoff,
  };
}

export async function createStudent(body) {
  const {
    name,
    email,
    username,
    studentId,
    program,
    photo,
    password,
    passcode,
    classCode,
    classId,
    faculty,
    currentScore,
    currentGpa,
  } = body;
  let plain = password || passcode;
  if (!plain) {
    plain = randomPasscode();
  }
  const sid = (studentId || '').trim();
  const cc = (classCode || classId || '').trim();
  const fac = (faculty || '').trim();
  const user = new User({
    email: email?.toLowerCase()?.trim(),
    username: username?.trim() || sid || email?.split('@')[0],
    passwordHash: await User.hashPassword(plain),
    role: 'student',
    roles: ['student'],
    name: name?.trim() || '',
    photo: photo || '',
  });
  await user.save();
  const profile = new StudentProfile({
    user: user._id,
    studentId: sid || undefined,
    program: program?.trim() || '',
    classCode: cc,
    faculty: fac,
    currentScore: currentScore != null && currentScore !== '' ? Number(currentScore) : undefined,
    currentGpa: currentGpa != null && currentGpa !== '' ? Number(currentGpa) : undefined,
    handoffPasscode: String(plain),
  });
  await profile.save();
  await profile.populate('user');
  return formatStudent(profile);
}

export async function updateStudent(profileId, body) {
  const profile = await resolveStudentProfile(profileId);
  if (!profile) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  const u = profile.user;
  if (body.name !== undefined) u.name = body.name;
  if (body.email !== undefined) u.email = body.email?.toLowerCase()?.trim();
  if (body.username !== undefined) u.username = body.username?.trim();
  if (body.photo !== undefined) u.photo = body.photo;
  if (body.isActive !== undefined) u.isActive = body.isActive;
  if (body.studentId !== undefined) profile.studentId = body.studentId?.trim();
  if (body.program !== undefined) profile.program = body.program;
  if (body.classCode !== undefined || body.classId !== undefined) {
    profile.classCode = String(body.classCode ?? body.classId ?? '').trim();
  }
  if (body.faculty !== undefined) profile.faculty = String(body.faculty).trim();
  else if (body.academicInfo?.faculty !== undefined) {
    profile.faculty = String(body.academicInfo.faculty).trim();
  }
  if (body.currentScore !== undefined) {
    profile.currentScore =
      body.currentScore === '' || body.currentScore === null ? undefined : Number(body.currentScore);
  }
  if (body.currentGpa !== undefined) {
    profile.currentGpa =
      body.currentGpa === '' || body.currentGpa === null ? undefined : Number(body.currentGpa);
  }
  if (body.password || body.passcode) {
    const p = body.password || body.passcode;
    u.passwordHash = await User.hashPassword(p);
    profile.handoffPasscode = String(p);
  }
  await u.save();
  await profile.save();
  await profile.populate('user');
  return formatStudent(profile);
}

export async function importStudents(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const created = [];
  const failed = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || {};
    try {
      const plain =
        row.password ||
        row.passcode ||
        String(Math.floor(100000 + Math.random() * 900000));
      if (!row.name || !String(row.name).trim()) {
        throw new Error('name is required');
      }
      if (!row.email || !String(row.email).trim()) {
        throw new Error('email is required');
      }
      const stu = await createStudent({
        name: row.name,
        email: row.email,
        username: row.username,
        studentId: row.studentId || row.id,
        program: row.program || '',
        classCode: row.classCode || row.classId || row.class,
        faculty: row.faculty || '',
        currentScore: row.score ?? row.currentScore,
        currentGpa: row.gpa ?? row.currentGpa,
        password: plain,
      });
      created.push({
        index: i,
        studentId: stu.studentId,
        _id: stu._id,
        loginPasscode: plain,
        email: row.email,
      });
    } catch (e) {
      failed.push({
        index: i,
        studentId: row.studentId,
        email: row.email,
        message: e.message || 'Failed',
      });
    }
  }
  return { created, failed, total: list.length };
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportStudentsCsv(filters = {}) {
  const all = await listStudents();
  const search = String(filters.search || '')
    .trim()
    .toLowerCase();
  const classId = String(filters.classId || filters.classCode || '')
    .trim()
    .toLowerCase();
  const faculty = String(filters.faculty || '')
    .trim()
    .toLowerCase();

  const rows = all.filter((student) => {
    const matchesSearch =
      !search ||
      String(student.name || '')
        .toLowerCase()
        .includes(search) ||
      String(student.email || '')
        .toLowerCase()
        .includes(search) ||
      String(student.studentId || '')
        .toLowerCase()
        .includes(search);
    const matchesClass = !classId || String(student.classId || '').toLowerCase() === classId;
    const matchesFaculty = !faculty || String(student.faculty || '').toLowerCase() === faculty;
    return matchesSearch && matchesClass && matchesFaculty;
  });

  const header = [
    'name',
    'email',
    'studentId',
    'classCode',
    'faculty',
    'program',
    'score',
    'gpa',
    'status',
  ];
  const lines = [header.join(',')];
  for (const student of rows) {
    lines.push(
      [
        csvEscape(student.name),
        csvEscape(student.email),
        csvEscape(student.studentId),
        csvEscape(student.classId || student.classCode),
        csvEscape(student.faculty || student.academicInfo?.faculty),
        csvEscape(student.program),
        csvEscape(student.currentScore),
        csvEscape(student.currentGpa),
        csvEscape(student.status),
      ].join(',')
    );
  }

  return {
    csv: lines.join('\n'),
    total: rows.length,
  };
}

export async function deleteStudent(profileId) {
  const profile = await resolveStudentProfile(profileId);
  if (!profile) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  await User.deleteOne({ _id: profile.user });
  await StudentProfile.deleteOne({ _id: profile._id });
  return { ok: true };
}

/** Admins — user accounts with primary role admin */
export async function listAdmins() {
  const users = await User.find({ role: 'admin' }).sort({ createdAt: -1 }).lean();
  return users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }));
}

export async function createAdminUser(body) {
  const { name, email, username, password, passcode } = body;
  const plain = password || passcode;
  if (!plain) {
    const err = new Error('Password is required');
    err.status = 400;
    throw err;
  }
  const user = new User({
    email: email?.toLowerCase()?.trim(),
    username: username?.trim() || email?.split('@')[0],
    passwordHash: await User.hashPassword(plain),
    role: 'admin',
    roles: ['admin'],
    name: name?.trim() || '',
  });
  await user.save();
  return { _id: user._id, name: user.name, email: user.email, username: user.username };
}

export async function getAdminById(id) {
  const u = await User.findOne({ _id: id, role: 'admin' }).lean();
  if (!u) return null;
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    isActive: u.isActive,
    photo: u.photo || '',
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt || null,
  };
}

export async function updateAdminUser(id, body) {
  const u = await User.findOne({ _id: id, role: 'admin' });
  if (!u) {
    const err = new Error('Admin not found');
    err.status = 404;
    throw err;
  }
  if (body.name !== undefined) u.name = String(body.name).trim();
  if (body.email !== undefined) u.email = body.email?.toLowerCase()?.trim();
  if (body.username !== undefined) u.username = body.username?.trim();
  if (body.isActive !== undefined) u.isActive = Boolean(body.isActive);
  if (body.photo !== undefined) u.photo = body.photo;
  if (body.password || body.passcode) {
    u.passwordHash = await User.hashPassword(body.password || body.passcode);
  }
  await u.save();
  return getAdminById(id);
}

export async function deleteAdminUser(id, requesterUserId) {
  const u = await User.findOne({ _id: id, role: 'admin' });
  if (!u) {
    const err = new Error('Admin not found');
    err.status = 404;
    throw err;
  }
  if (String(id) === String(requesterUserId)) {
    const err = new Error('Cannot delete your own account');
    err.status = 400;
    throw err;
  }
  const adminCount = await User.countDocuments({ role: 'admin' });
  if (adminCount <= 1) {
    const err = new Error('Cannot delete the last administrator account');
    err.status = 400;
    throw err;
  }
  await User.deleteOne({ _id: id });
  return { ok: true };
}

export async function regenerateStudentPasscode(profileIdOrStudentId) {
  const profile = await resolveStudentProfile(profileIdOrStudentId);
  if (!profile) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }
  const passcode = randomPasscode();
  profile.user.passwordHash = await User.hashPassword(passcode);
  profile.handoffPasscode = passcode;
  await profile.user.save();
  await profile.save();
  return { passcode };
}
