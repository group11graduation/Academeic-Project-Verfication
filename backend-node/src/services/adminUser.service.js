import { User } from '../models/User.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import mongoose from 'mongoose';
import XLSX from 'xlsx';

function randomPasscode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Align with Class.code (uppercase) so enrollments and class detail match imports. */
function normalizeStudentClassCodeValue(code) {
  const c = String(code ?? '').trim();
  if (!c) return '';
  return c.toUpperCase();
}

/** Faculty shown for a student always follows their current class when the class has a faculty. */
async function loadClassAcademicMeta(classCode) {
  const code = normalizeStudentClassCodeValue(classCode);
  if (!code) return null;
  return Class.findOne({ code }).select('code faculty department').lean();
}

async function loadClassAcademicMetaMap(classCodes = []) {
  const codes = [
    ...new Set(
      (classCodes || []).map((c) => normalizeStudentClassCodeValue(c)).filter(Boolean)
    ),
  ];
  if (!codes.length) return new Map();
  const rows = await Class.find({ code: { $in: codes } }).select('code faculty department').lean();
  return new Map(
    rows.map((row) => [
      normalizeStudentClassCodeValue(row.code),
      {
        faculty: String(row.faculty || '').trim(),
        department: String(row.department || '').trim(),
      },
    ])
  );
}

function applyClassAcademicMetaToProfile(profile, classMeta) {
  if (!profile || !classMeta) return;
  if (classMeta.faculty) profile.faculty = classMeta.faculty;
  if (classMeta.department) profile.department = classMeta.department;
}

function makeNumericId(prefix = '', serial = 1, width = 4) {
  return `${prefix}${String(serial).padStart(width, '0')}`;
}

async function generateUniqueStudentId() {
  const profiles = await StudentProfile.find({ studentId: { $exists: true, $ne: '' } }, { studentId: 1 }).lean();
  let max = 0;
  for (const row of profiles) {
    const match = String(row.studentId || '').match(/(\d+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  let candidate = '';
  do {
    max += 1;
    candidate = makeNumericId('S', max, 4);
  } while (await StudentProfile.exists({ studentId: candidate }));
  return candidate;
}

async function generateUniqueTeacherId() {
  const profiles = await TeacherProfile.find({ employeeId: { $exists: true, $ne: '' } }, { employeeId: 1 }).lean();
  let max = 0;
  for (const row of profiles) {
    const match = String(row.employeeId || '').match(/(\d+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  let candidate = '';
  do {
    max += 1;
    candidate = makeNumericId('T', max, 4);
  } while (await TeacherProfile.exists({ employeeId: candidate }));
  return candidate;
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
    faculty: profile.faculty || '',
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
    faculty,
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

  const empId = (employeeId || teacherId || '').trim() || (await generateUniqueTeacherId());
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
    faculty: faculty?.trim() || '',
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
  if (body.faculty !== undefined) profile.faculty = String(body.faculty).trim();
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
  const classMetaMap = await loadClassAcademicMetaMap(profiles.map((p) => p.classCode));
  return profiles.map((profile) => {
    const classMeta = classMetaMap.get(normalizeStudentClassCodeValue(profile.classCode));
    return formatStudent(profile, classMeta);
  });
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
  const classMeta = await loadClassAcademicMeta(profile.classCode);
  return formatStudent(profile, classMeta);
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const serial = Number(s);
  if (/^\d+(\.\d+)?$/.test(s) && serial > 1000 && serial < 100000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
    return Number.isNaN(utc.getTime()) ? null : utc;
  }

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPersonalInfo(profile) {
  const p = profile.personalInfo || {};
  return {
    phone: p.phone || '',
    dob: p.dob ? new Date(p.dob).toISOString() : null,
    gender: p.gender || '',
  };
}

function formatParentDetails(profile) {
  const p = profile.parentDetails || {};
  return {
    fatherName: p.fatherName || '',
    fatherContact: p.fatherContact || '',
    motherName: p.motherName || '',
    motherContact: p.motherContact || '',
  };
}

function formatEducationalBackground(profile) {
  const e = profile.educationalBackground || {};
  return {
    highSchoolName: e.highSchoolName || '',
    graduationYear: e.graduationYear || '',
    certificateUrl: e.certificateUrl || '',
  };
}

function formatAcademicInfo(profile, classMeta = null) {
  return {
    faculty: classMeta?.faculty || profile.faculty || '',
    department: classMeta?.department || profile.department || '',
    campus: profile.campus || '',
    studyMode: profile.studyMode || '',
    entryDate: profile.entryDate ? new Date(profile.entryDate).toISOString() : null,
  };
}

function applyStudentExtendedFields(profile, body) {
  if (body.personalInfo) {
    const p = body.personalInfo;
    profile.personalInfo = profile.personalInfo || {};
    if (p.phone !== undefined) profile.personalInfo.phone = String(p.phone || '').trim();
    if (p.dob !== undefined) profile.personalInfo.dob = parseOptionalDate(p.dob);
    if (p.gender !== undefined) profile.personalInfo.gender = String(p.gender || '').trim();
  }

  if (body.parentDetails) {
    const p = body.parentDetails;
    profile.parentDetails = profile.parentDetails || {};
    if (p.fatherName !== undefined) profile.parentDetails.fatherName = String(p.fatherName || '').trim();
    if (p.fatherContact !== undefined) {
      profile.parentDetails.fatherContact = String(p.fatherContact || '').trim();
    }
    if (p.motherName !== undefined) profile.parentDetails.motherName = String(p.motherName || '').trim();
    if (p.motherContact !== undefined) {
      profile.parentDetails.motherContact = String(p.motherContact || '').trim();
    }
  }

  if (body.educationalBackground) {
    const e = body.educationalBackground;
    profile.educationalBackground = profile.educationalBackground || {};
    if (e.highSchoolName !== undefined) {
      profile.educationalBackground.highSchoolName = String(e.highSchoolName || '').trim();
    }
    if (e.graduationYear !== undefined) {
      profile.educationalBackground.graduationYear = String(e.graduationYear || '').trim();
    }
    if (e.certificateUrl !== undefined) {
      profile.educationalBackground.certificateUrl = String(e.certificateUrl || '').trim();
    }
  }

  if (body.academicInfo) {
    const a = body.academicInfo;
    if (a.faculty !== undefined) profile.faculty = String(a.faculty).trim();
    if (a.department !== undefined) profile.department = String(a.department).trim();
    if (a.campus !== undefined) profile.campus = String(a.campus).trim();
    if (a.studyMode !== undefined) profile.studyMode = String(a.studyMode).trim();
    if (a.entryDate !== undefined) profile.entryDate = parseOptionalDate(a.entryDate);
  }

  if (body.personalInfo) profile.markModified('personalInfo');
  if (body.parentDetails) profile.markModified('parentDetails');
  if (body.educationalBackground) profile.markModified('educationalBackground');
}

function formatStudent(profile, classMeta = null) {
  const u = profile.user;
  if (!u) return null;
  const handoff = profile.handoffPasscode || '';
  const faculty = classMeta?.faculty || profile.faculty || '';
  const academicInfo = formatAcademicInfo(profile, classMeta);
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
    faculty,
    academicInfo,
    personalInfo: formatPersonalInfo(profile),
    parentDetails: formatParentDetails(profile),
    educationalBackground: formatEducationalBackground(profile),
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
  const sid = (studentId || '').trim() || (await generateUniqueStudentId());
  const cc = normalizeStudentClassCodeValue(classCode || classId || '');
  let fac = (faculty || body.academicInfo?.faculty || '').trim();
  let department = String(body.academicInfo?.department || body.department || '').trim();
  const classMeta = await loadClassAcademicMeta(cc);
  if (classMeta?.faculty) fac = classMeta.faculty;
  if (classMeta?.department) department = classMeta.department;
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
    department,
    campus: String(body.academicInfo?.campus || body.campus || '').trim(),
    studyMode: String(body.academicInfo?.studyMode || body.studyMode || '').trim(),
    entryDate: parseOptionalDate(body.academicInfo?.entryDate ?? body.entryDate),
    currentScore: currentScore != null && currentScore !== '' ? Number(currentScore) : undefined,
    currentGpa: currentGpa != null && currentGpa !== '' ? Number(currentGpa) : undefined,
    handoffPasscode: String(plain),
  });
  applyStudentExtendedFields(profile, body);
  await profile.save();
  await profile.populate('user');
  return formatStudent(profile, classMeta);
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
  const previousClassCode = normalizeStudentClassCodeValue(profile.classCode);
  if (body.classCode !== undefined || body.classId !== undefined) {
    profile.classCode = normalizeStudentClassCodeValue(body.classCode ?? body.classId ?? '');
  }
  if (body.faculty !== undefined) profile.faculty = String(body.faculty).trim();
  else if (body.academicInfo?.faculty !== undefined) {
    profile.faculty = String(body.academicInfo.faculty).trim();
  }
  applyStudentExtendedFields(profile, body);
  // Class faculty always wins when the student belongs to a real class.
  const classMeta = await loadClassAcademicMeta(profile.classCode);
  if (classMeta) {
    applyClassAcademicMetaToProfile(profile, classMeta);
  } else if (
    previousClassCode &&
    !normalizeStudentClassCodeValue(profile.classCode) &&
    (body.classCode !== undefined || body.classId !== undefined)
  ) {
    // Removed from class — keep last faculty unless explicitly cleared.
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
  return formatStudent(profile, classMeta);
}

export async function importStudents(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const created = [];
  const failed = [];
  const concurrency = Math.min(5, Math.max(1, Number(process.env.IMPORT_CONCURRENCY) || 5));

  const importOne = async (row, i) => {
    try {
      if (!row.name || !String(row.name).trim()) {
        throw new Error('name is required');
      }
      if (!row.email || !String(row.email).trim()) {
        throw new Error('email is required');
      }
      const studentId = String(row.studentId || row.id || row.student_id || '').trim();
      if (!studentId) {
        throw new Error('student ID is required');
      }
      const plain =
        row.password ||
        row.passcode ||
        String(Math.floor(100000 + Math.random() * 900000));
      const personalInfo = row.personalInfo || {};
      const parentDetails = row.parentDetails || {};
      const educationalBackground = row.educationalBackground || {};
      const academicInfo = row.academicInfo || {};
      const stu = await createStudent({
        name: row.name,
        email: row.email,
        username: row.username,
        studentId,
        password: plain,
        passcode: row.passcode || plain,
        photo: row.photo || '',
        classId: row.classId || row.classCode || academicInfo.classId || '',
        classCode: row.classCode || row.classId || '',
        faculty: row.faculty || academicInfo.faculty || '',
        program: row.program || '',
        currentScore: row.currentScore ?? row.score,
        currentGpa: row.currentGpa ?? row.gpa,
        personalInfo: {
          phone: row.phone || personalInfo.phone || '',
          dob: row.dob || personalInfo.dob || null,
          gender: row.gender || personalInfo.gender || '',
        },
        parentDetails: {
          fatherName: row.fatherName || parentDetails.fatherName || '',
          fatherContact: row.fatherContact || parentDetails.fatherContact || '',
          motherName: row.motherName || parentDetails.motherName || '',
          motherContact: row.motherContact || parentDetails.motherContact || '',
        },
        educationalBackground: {
          highSchoolName: row.highSchoolName || row.highSchool || educationalBackground.highSchoolName || '',
          graduationYear: row.graduationYear || educationalBackground.graduationYear || '',
          certificateUrl: row.certificateUrl || educationalBackground.certificateUrl || '',
        },
        academicInfo: {
          faculty: row.faculty || academicInfo.faculty || '',
          department: row.department || academicInfo.department || '',
          campus: row.campus || academicInfo.campus || '',
          studyMode: row.studyMode || academicInfo.studyMode || '',
          entryDate: row.entryDate || academicInfo.entryDate || null,
        },
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
  };

  for (let offset = 0; offset < list.length; offset += concurrency) {
    const slice = list.slice(offset, offset + concurrency);
    await Promise.all(slice.map((row, j) => importOne(row, offset + j)));
  }

  return { created, failed, total: list.length };
}

export async function importTeachers(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const created = [];
  const failed = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || {};
    try {
      const plain = row.password || row.passcode || randomPasscode();
      if (!row.name || !String(row.name).trim()) {
        throw new Error('name is required');
      }
      if (!row.email || !String(row.email).trim()) {
        throw new Error('email is required');
      }
      const teacher = await createTeacher({
        name: row.name,
        email: row.email,
        username: row.username,
        department: row.department || row.faculty || '',
        teacherId: row.teacherId || row.employeeId || row.teacher_id,
        employeeId: row.employeeId || row.teacherId || row.employee_id,
        phone: row.phone || '',
        skills: Array.isArray(row.skills)
          ? row.skills
          : String(row.skills || '')
              .split(/[|,]/)
              .map((s) => s.trim())
              .filter(Boolean),
        classCodes: row.assignedClassCodes || row.classCodes || '',
        password: plain,
      });
      created.push({
        index: i,
        teacherId: teacher.teacherId,
        _id: teacher._id,
        loginPasscode: plain,
        email: row.email,
      });
    } catch (e) {
      failed.push({
        index: i,
        teacherId: row.teacherId || row.employeeId,
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
    'department',
    'program',
    'phone',
    'dob',
    'gender',
    'fatherName',
    'fatherContact',
    'motherName',
    'motherContact',
    'highSchoolName',
    'graduationYear',
    'campus',
    'studyMode',
    'entryDate',
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
        csvEscape(student.academicInfo?.department),
        csvEscape(student.program),
        csvEscape(student.personalInfo?.phone),
        csvEscape(student.personalInfo?.dob ? new Date(student.personalInfo.dob).toISOString().split('T')[0] : ''),
        csvEscape(student.personalInfo?.gender),
        csvEscape(student.parentDetails?.fatherName),
        csvEscape(student.parentDetails?.fatherContact),
        csvEscape(student.parentDetails?.motherName),
        csvEscape(student.parentDetails?.motherContact),
        csvEscape(student.educationalBackground?.highSchoolName),
        csvEscape(student.educationalBackground?.graduationYear),
        csvEscape(student.academicInfo?.campus),
        csvEscape(student.academicInfo?.studyMode),
        csvEscape(student.academicInfo?.entryDate ? new Date(student.academicInfo.entryDate).toISOString().split('T')[0] : ''),
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

export async function exportStudentsXlsx(filters = {}) {
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

  const rows = all
    .filter((student) => {
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
    })
    .map((student) => ({
      name: student.name || '',
      email: student.email || '',
      studentId: student.studentId || '',
      classCode: student.classId || student.classCode || '',
      faculty: student.faculty || student.academicInfo?.faculty || '',
      department: student.academicInfo?.department || '',
      program: student.program || '',
      phone: student.personalInfo?.phone || '',
      dob: student.personalInfo?.dob ? new Date(student.personalInfo.dob).toISOString().split('T')[0] : '',
      gender: student.personalInfo?.gender || '',
      fatherName: student.parentDetails?.fatherName || '',
      fatherContact: student.parentDetails?.fatherContact || '',
      motherName: student.parentDetails?.motherName || '',
      motherContact: student.parentDetails?.motherContact || '',
      highSchoolName: student.educationalBackground?.highSchoolName || '',
      graduationYear: student.educationalBackground?.graduationYear || '',
      campus: student.academicInfo?.campus || '',
      studyMode: student.academicInfo?.studyMode || '',
      entryDate: student.academicInfo?.entryDate
        ? new Date(student.academicInfo.entryDate).toISOString().split('T')[0]
        : '',
      score: student.currentScore ?? '',
      gpa: student.currentGpa ?? '',
      status: student.status || '',
    }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export async function exportTeachersCsv(filters = {}) {
  const all = await listTeachers();
  const search = String(filters.search || '')
    .trim()
    .toLowerCase();
  const department = String(filters.department || '')
    .trim()
    .toLowerCase();

  const rows = all.filter((teacher) => {
    const matchesSearch =
      !search ||
      String(teacher.name || '')
        .toLowerCase()
        .includes(search) ||
      String(teacher.email || '')
        .toLowerCase()
        .includes(search) ||
      String(teacher.teacherId || '')
        .toLowerCase()
        .includes(search);
    const matchesDepartment = !department || String(teacher.department || '').toLowerCase() === department;
    return matchesSearch && matchesDepartment;
  });

  const header = [
    'name',
    'email',
    'teacherId',
    'department',
    'phone',
    'skills',
    'assignedClassCodes',
    'status',
  ];
  const lines = [header.join(',')];
  for (const teacher of rows) {
    lines.push(
      [
        csvEscape(teacher.name),
        csvEscape(teacher.email),
        csvEscape(teacher.teacherId || teacher.employeeId),
        csvEscape(teacher.department),
        csvEscape(teacher.phone),
        csvEscape((teacher.skills || []).join('|')),
        csvEscape((teacher.assignedClassCodes || []).join('|')),
        csvEscape(teacher.status),
      ].join(',')
    );
  }

  return {
    csv: lines.join('\n'),
    total: rows.length,
  };
}

export async function exportTeachersXlsx(filters = {}) {
  const all = await listTeachers();
  const search = String(filters.search || '')
    .trim()
    .toLowerCase();
  const department = String(filters.department || '')
    .trim()
    .toLowerCase();

  const rows = all
    .filter((teacher) => {
      const matchesSearch =
        !search ||
        String(teacher.name || '')
          .toLowerCase()
          .includes(search) ||
        String(teacher.email || '')
          .toLowerCase()
          .includes(search) ||
        String(teacher.teacherId || '')
          .toLowerCase()
          .includes(search);
      const matchesDepartment = !department || String(teacher.department || '').toLowerCase() === department;
      return matchesSearch && matchesDepartment;
    })
    .map((teacher) => ({
      name: teacher.name || '',
      email: teacher.email || '',
      teacherId: teacher.teacherId || teacher.employeeId || '',
      department: teacher.department || '',
      phone: teacher.phone || '',
      skills: (teacher.skills || []).join('|'),
      assignedClassCodes: (teacher.assignedClassCodes || []).join('|'),
      status: teacher.status || '',
    }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
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
  const users = await User.find({ role: 'admin' }).select('+handoffPasscode').sort({ createdAt: -1 }).lean();
  return users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    passcode: u.handoffPasscode || '',
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
    handoffPasscode: String(plain),
  });
  await user.save();
  return { _id: user._id, name: user.name, email: user.email, username: user.username, passcode: user.handoffPasscode };
}

export async function getAdminById(id) {
  const u = await User.findOne({ _id: id, role: 'admin' }).select('+handoffPasscode').lean();
  if (!u) return null;
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    passcode: u.handoffPasscode || '',
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
    const nextPasscode = body.password || body.passcode;
    u.passwordHash = await User.hashPassword(nextPasscode);
    u.handoffPasscode = String(nextPasscode);
  }
  await u.save();
  return getAdminById(id);
}

export async function regenerateAdminPasscode(id) {
  const u = await User.findOne({ _id: id, role: 'admin' }).select('+handoffPasscode');
  if (!u) {
    const err = new Error('Admin not found');
    err.status = 404;
    throw err;
  }
  const passcode = randomPasscode();
  u.passwordHash = await User.hashPassword(passcode);
  u.handoffPasscode = passcode;
  await u.save();
  return { passcode };
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
