import mongoose from 'mongoose';
import { Class } from '../models/Class.js';
import { Subject } from '../models/Subject.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { Semester } from '../models/Semester.js';
import { Enrollment } from '../models/Enrollment.js';
import { StudentPerformanceRecord } from '../models/StudentPerformanceRecord.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { User } from '../models/User.js';

function toObjectId(id) {
  if (!id) return undefined;
  if (mongoose.Types.ObjectId.isValid(String(id))) return new mongoose.Types.ObjectId(String(id));
  return undefined;
}

function normalizeClassCode(code) {
  return String(code || '').trim().toUpperCase();
}

function randomPasscode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function mapAssignedTeachers(classDoc) {
  const assignments = classDoc.teacherAssignments || [];
  const teacherUserIds = assignments.map((a) => a.teacher).filter(Boolean);
  if (!teacherUserIds.length) return [];

  const profiles = await TeacherProfile.find({ user: { $in: teacherUserIds } }).populate('user');
  const byUserId = new Map(profiles.map((p) => [String(p.user?._id), p]));

  const subjectIdSet = new Set(
    assignments.flatMap((a) => (a.subjects || []).map((s) => String(s))).filter(Boolean)
  );
  const allSubjects = subjectIdSet.size
    ? await Subject.find({ _id: { $in: [...subjectIdSet] } }).lean()
    : [];
  const subjectMap = new Map(allSubjects.map((s) => [String(s._id), s]));

  return assignments
    .map((assignment) => {
      const uid = assignment.teacher;
      const p = byUserId.get(String(uid));
      if (!p || !p.user) return null;
      const teacherSubjects = (assignment.subjects || [])
        .map((sid) => subjectMap.get(String(sid)))
        .filter(Boolean)
        .map((s) => ({ _id: s._id, name: s.name, code: s.code }));
      return {
        _id: p._id,
        userId: p.user._id,
        teacherId: p.employeeId || '',
        name: p.user.name || '',
        email: p.user.email || '',
        department: p.department || '',
        photo: p.user.photo || p.photo || '',
        accountStatus: p.user.isActive === false ? 'inactive' : 'active',
        subjectIds: teacherSubjects.map((s) => s._id),
        subjects: teacherSubjects,
      };
    })
    .filter(Boolean);
}

async function mapEnrolledStudents(classCode) {
  const profiles = await StudentProfile.find({ classCode }).populate('user');
  return profiles
    .map((p) => {
      if (!p.user) return null;
      return {
        _id: p._id,
        userId: p.user._id,
        studentId: p.studentId || '',
        name: p.user.name || '',
        email: p.user.email || '',
        username: p.user.username || '',
        photo: p.user.photo || '',
        hasAccount: true,
        accountStatus: p.user.isActive === false ? 'inactive' : 'active',
        createdAt: p.createdAt,
      };
    })
    .filter(Boolean);
}

function formatClassRow(c, studentCount = 0) {
  return {
    _id: c._id,
    code: c.code,
    name: c.name,
    description: c.description || c.name,
    faculty: c.faculty || '',
    department: c.department || '',
    category: c.category || 'ACADEMIC',
    semester: c.semester || '',
    subjectIds: Array.isArray(c.subjects) ? c.subjects.map((s) => (s?._id ? s._id : s)) : [],
    subjects: Array.isArray(c.subjects)
      ? c.subjects.map((s) => (s?.name ? { _id: s._id, name: s.name, code: s.code } : s)).filter(Boolean)
      : [],
    subjectsCount: Array.isArray(c.subjects) ? c.subjects.length : 0,
    students: studentCount,
    createdAt: c.createdAt,
  };
}

/** Classes */
export async function listClasses() {
  const rows = await Class.find().populate('subjects').sort({ createdAt: -1 }).lean();
  const counts = await Promise.all(
    rows.map(async (r) => ({
      code: r.code,
      count: await StudentProfile.countDocuments({ classCode: r.code }),
    }))
  );
  const countMap = new Map(counts.map((c) => [c.code, c.count]));
  return rows.map((r) => formatClassRow(r, countMap.get(r.code) || 0));
}

export async function getClassByCode(code) {
  const classCode = normalizeClassCode(code);
  const row = await Class.findOne({ code: classCode }).populate('subjects').lean();
  if (!row) return null;

  const [assignedTeachers, enrolledStudents] = await Promise.all([
    mapAssignedTeachers(row),
    mapEnrolledStudents(classCode),
  ]);

  const sem = row.semester ? await Semester.findById(row.semester).lean() : null;

  return {
    ...formatClassRow(row, enrolledStudents.length),
    semester: sem?.name || '',
    semesterId: row.semester || null,
    assignedTeachers,
    enrolledStudents,
  };
}

export async function createClass(body) {
  const code = normalizeClassCode(body.code);
  if (!code) throw new Error('Class code is required');
  if (!String(body.name || '').trim()) throw new Error('Class name is required');

  const subjectIds = Array.isArray(body.subjectIds)
    ? body.subjectIds.map((id) => toObjectId(id)).filter(Boolean)
    : [];

  const doc = await Class.create({
    code,
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    faculty: String(body.faculty || '').trim(),
    department: String(body.department || '').trim(),
    category: String(body.category || 'ACADEMIC').trim().toUpperCase(),
    semester: toObjectId(body.semester),
    subjects: subjectIds,
    teacherAssignments: [],
  });
  const withSubjects = await Class.findById(doc._id).populate('subjects').lean();
  return formatClassRow(withSubjects || doc.toObject(), 0);
}

export async function updateClass(code, body) {
  const classCode = normalizeClassCode(code);
  const doc = await Class.findOne({ code: classCode });
  if (!doc) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  if (body.name !== undefined) doc.name = String(body.name || '').trim();
  if (body.description !== undefined) doc.description = String(body.description || '').trim();
  if (body.faculty !== undefined) doc.faculty = String(body.faculty || '').trim();
  if (body.department !== undefined) doc.department = String(body.department || '').trim();
  if (body.category !== undefined) doc.category = String(body.category || 'ACADEMIC').trim().toUpperCase();
  if (body.semester !== undefined) doc.semester = toObjectId(body.semester);
  if (body.subjectIds !== undefined) {
    doc.subjects = Array.isArray(body.subjectIds)
      ? body.subjectIds.map((id) => toObjectId(id)).filter(Boolean)
      : [];
  }
  await doc.save();
  const withSubjects = await Class.findById(doc._id).populate('subjects').lean();
  return formatClassRow(withSubjects || doc.toObject(), await StudentProfile.countDocuments({ classCode: doc.code }));
}

export async function assignTeacherToClass(code, body) {
  const classCode = normalizeClassCode(code);
  const cls = await Class.findOne({ code: classCode });
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const candidate = String(body.teacherId || body.userId || '').trim();
  if (!candidate) throw new Error('teacherId is required');

  let profile =
    (toObjectId(candidate) && (await TeacherProfile.findById(candidate))) ||
    (await TeacherProfile.findOne({ employeeId: candidate })) ||
    (toObjectId(candidate) && (await TeacherProfile.findOne({ user: candidate })));

  if (!profile && toObjectId(candidate)) {
    const u = await User.findById(candidate).lean();
    if (u && (u.role === 'teacher' || (u.roles || []).includes('teacher'))) {
      profile = await TeacherProfile.findOne({ user: u._id });
    }
  }

  if (!profile) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }

  const requestedSubjectIds = Array.isArray(body.subjectIds)
    ? body.subjectIds.map((id) => toObjectId(id)).filter(Boolean)
    : [];

  const existingAssignment = (cls.teacherAssignments || []).find(
    (t) => String(t.teacher) === String(profile.user)
  );
  if (!existingAssignment) {
    cls.teacherAssignments.push({ teacher: profile.user, subjects: requestedSubjectIds });
  } else if (body.subjectIds !== undefined) {
    existingAssignment.subjects = requestedSubjectIds;
  }
  await cls.save();

  const updated = await getClassByCode(classCode);
  return updated;
}

export async function generateStudentAccountsForClass(code) {
  const classCode = normalizeClassCode(code);
  const cls = await Class.findOne({ code: classCode }).lean();
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const studentProfiles = await StudentProfile.find({ classCode: classCode }).populate('user');
  if (!studentProfiles.length) {
    return {
      classCode,
      processed: 0,
      generated: 0,
      accounts: [],
      message: 'No students found in this class',
    };
  }

  const accounts = [];
  for (const profile of studentProfiles) {
    if (!profile.user) continue;
    const passcode = randomPasscode();
    profile.user.passwordHash = await User.hashPassword(passcode);
    profile.handoffPasscode = passcode;
    if (profile.user.isActive === false) profile.user.isActive = true;
    await profile.user.save();
    await profile.save();
    accounts.push({
      studentId: profile.studentId || '',
      name: profile.user.name || '',
      email: profile.user.email || '',
      passcode,
    });
  }

  return {
    classCode,
    processed: studentProfiles.length,
    generated: accounts.length,
    accounts,
    message: `Generated login accounts for ${accounts.length} student(s) in ${classCode}`,
  };
}

/** Subjects */
export async function listSubjects() {
  return Subject.find().sort({ createdAt: -1 }).lean();
}

export async function getSubject(id) {
  return Subject.findById(id).lean();
}

export async function createSubject(body) {
  const doc = await Subject.create({
    code: String(body.code || '').trim().toUpperCase(),
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    faculty: String(body.faculty || body.department || '').trim(),
    department: String(body.department || '').trim(),
  });
  return doc.toObject();
}

export async function updateSubject(id, body) {
  const doc = await Subject.findById(id);
  if (!doc) {
    const err = new Error('Subject not found');
    err.status = 404;
    throw err;
  }
  if (body.code !== undefined) doc.code = String(body.code || '').trim().toUpperCase();
  if (body.name !== undefined) doc.name = String(body.name || '').trim();
  if (body.description !== undefined) doc.description = String(body.description || '').trim();
  if (body.faculty !== undefined) {
    doc.faculty = String(body.faculty || '').trim();
  }
  if (body.department !== undefined) {
    doc.department = String(body.department || '').trim();
  } else if (body.faculty !== undefined && !doc.department) {
    // Backward compatibility: when only one taxonomy value is sent.
    doc.department = '';
  }
  await doc.save();
  return doc.toObject();
}

export async function deleteSubject(id) {
  await Subject.deleteOne({ _id: id });
  return { ok: true };
}

/** Academic years / semesters */
export async function listAcademicYears() {
  return AcademicYear.find().sort({ createdAt: -1 }).lean();
}

export async function createAcademicYear(body) {
  const payload = {
    label: String(body.label || '').trim(),
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
    isCurrent: Boolean(body.isCurrent),
  };
  if (!payload.label) throw new Error('Academic year label is required');

  if (payload.isCurrent) {
    await AcademicYear.updateMany({}, { $set: { isCurrent: false } });
  }
  const doc = await AcademicYear.create(payload);
  return doc.toObject();
}

export async function listSemesters(academicYearId) {
  const q = academicYearId ? { academicYear: academicYearId } : {};
  const rows = await Semester.find(q).populate('academicYear').sort({ academicYear: -1, order: 1, createdAt: 1 }).lean();
  return rows.map((r) => ({
    ...r,
    academicYearId: r.academicYear?._id || r.academicYear || null,
    academicYearLabel: r.academicYear?.label || '',
  }));
}

export async function createSemester(body) {
  const academicYearId = body.academicYearId || body.academicYear;
  if (!academicYearId) throw new Error('academicYearId is required');
  if (!String(body.name || '').trim()) throw new Error('Semester name is required');

  const doc = await Semester.create({
    academicYear: academicYearId,
    name: String(body.name || '').trim(),
    order: Number(body.order) || 0,
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
  });
  await doc.populate('academicYear');
  const row = doc.toObject();
  return {
    ...row,
    academicYearId: row.academicYear?._id || row.academicYear || null,
    academicYearLabel: row.academicYear?.label || '',
  };
}

/** Enrollments / performance */
export async function enrollStudent(studentUserId, body) {
  const student = toObjectId(studentUserId);
  if (!student) throw new Error('Invalid student id');

  const classCode = normalizeClassCode(body.classCode || body.classId || body.code);
  const cls = classCode ? await Class.findOne({ code: classCode }) : await Class.findById(body.classId);
  if (!cls) throw new Error('Class not found');

  const payload = {
    student,
    class: cls._id,
    academicYear: toObjectId(body.academicYearId || body.academicYear),
    semester: toObjectId(body.semesterId || body.semester),
    subjects: Array.isArray(body.subjectIds) ? body.subjectIds : [],
    status: body.status || 'active',
  };
  const row = await Enrollment.findOneAndUpdate(
    { student: payload.student, class: payload.class, semester: payload.semester || null },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('class')
    .populate('academicYear')
    .populate('semester')
    .populate('subjects');
  return row.toObject();
}

export async function listPerformanceForStudent(studentUserId) {
  const student = toObjectId(studentUserId);
  if (!student) return [];
  return StudentPerformanceRecord.find({ student })
    .populate('academicYear')
    .populate('semester')
    .sort({ createdAt: -1 })
    .lean();
}

export async function upsertPerformance(studentUserId, body) {
  const student = toObjectId(studentUserId);
  if (!student) throw new Error('Invalid student id');
  const semester = toObjectId(body.semesterId || body.semester);

  const row = await StudentPerformanceRecord.findOneAndUpdate(
    { student, semester: semester || null },
    {
      student,
      academicYear: toObjectId(body.academicYearId || body.academicYear),
      semester: semester || undefined,
      score: body.score ?? body.currentScore,
      gpa: body.gpa ?? body.currentGpa,
      performanceCategory: body.performanceCategory || 'unclassified',
      notes: body.notes || '',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('academicYear')
    .populate('semester');
  return row.toObject();
}

/** Settings */
const SETTINGS_KEY = 'platform_settings';

export async function getSettings() {
  const row = await SystemSettings.findOne({ key: SETTINGS_KEY }).lean();
  return row?.value || {};
}

export async function setSettings(value) {
  const row = await SystemSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, value, description: 'Platform settings' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return row?.value || {};
}
