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

function toDayStart(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function assertSemesterDatesWithinAcademicYear({ startDate, endDate }, year) {
  const semStart = startDate ? toDayStart(startDate) : null;
  const semEnd = endDate ? toDayStart(endDate) : null;
  const yearStart = year?.startDate ? toDayStart(year.startDate) : null;
  const yearEnd = year?.endDate ? toDayStart(year.endDate) : null;

  if (semStart && semEnd && semStart > semEnd) {
    throw new Error('Semester start date must be on or before the end date.');
  }

  if (!semStart && !semEnd) return;

  if (!yearStart || !yearEnd) {
    throw new Error(
      `Set start and end dates on academic year "${year?.label || 'selected year'}" before adding semester dates.`
    );
  }

  if (semStart && semStart < yearStart) {
    throw new Error(
      `Semester start date cannot be before the academic year start (${formatDayLabel(year.startDate)}).`
    );
  }
  if (semEnd && semEnd > yearEnd) {
    throw new Error(
      `Semester end date cannot be after the academic year end (${formatDayLabel(year.endDate)}).`
    );
  }
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
    // Keep teacher assignments consistent with current class subjects.
    // Drop removed subjects from each teacher assignment, and if a teacher
    // has no remaining subjects in this class, remove the teacher assignment.
    const allowed = new Set((doc.subjects || []).map((sid) => String(sid)));
    const cleanedAssignments = (doc.teacherAssignments || [])
      .map((assignment) => ({
        ...assignment.toObject(),
        subjects: (assignment.subjects || []).filter((sid) => allowed.has(String(sid))),
      }))
      .filter((assignment) => assignment.subjects.length > 0);
    doc.teacherAssignments = cleanedAssignments;
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

  if (body.subjectIds !== undefined && requestedSubjectIds.length === 0) {
    const err = new Error('Select at least one subject for this teacher in this class.');
    err.status = 400;
    throw err;
  }

  const classSubjectIds = new Set((cls.subjects || []).map((sid) => String(sid)));
  const invalidSubjects = requestedSubjectIds.filter((sid) => !classSubjectIds.has(String(sid)));
  if (invalidSubjects.length) {
    const err = new Error(
      'One or more subjects are not linked to this class. Save class subjects first, then assign the teacher.'
    );
    err.status = 400;
    throw err;
  }

  const existingAssignment = (cls.teacherAssignments || []).find(
    (t) => String(t.teacher) === String(profile.user)
  );
  if (!existingAssignment) {
    cls.teacherAssignments.push({ teacher: profile.user, subjects: requestedSubjectIds });
  } else if (body.subjectIds !== undefined) {
    // Replace with the full checkbox selection (supports 1..N subjects per teacher in this class).
    existingAssignment.subjects = requestedSubjectIds;
  }
  await cls.save();

  const updated = await getClassByCode(classCode);
  return updated;
}

export async function removeTeacherFromClass(code, teacherId) {
  const classCode = normalizeClassCode(code);
  const cls = await Class.findOne({ code: classCode });
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }

  const candidate = String(teacherId || '').trim();
  if (!candidate) {
    const err = new Error('teacherId is required');
    err.status = 400;
    throw err;
  }

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

  const before = (cls.teacherAssignments || []).length;
  cls.teacherAssignments = (cls.teacherAssignments || []).filter(
    (t) => String(t.teacher) !== String(profile.user)
  );
  if (cls.teacherAssignments.length === before) {
    const err = new Error('Teacher is not assigned to this class');
    err.status = 404;
    throw err;
  }
  await cls.save();

  return getClassByCode(classCode);
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

function validateAcademicYearDates({ startDate, endDate }) {
  if (startDate && endDate) {
    const start = toDayStart(startDate);
    const end = toDayStart(endDate);
    if (start != null && end != null && start > end) {
      throw new Error('Academic year end date must be on or after the start date.');
    }
  }
}

export async function createAcademicYear(body) {
  const payload = {
    label: String(body.label || '').trim(),
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
    isCurrent: Boolean(body.isCurrent),
  };
  if (!payload.label) throw new Error('Academic year label is required');

  validateAcademicYearDates(payload);

  if (payload.isCurrent) {
    await AcademicYear.updateMany({}, { $set: { isCurrent: false } });
  }
  const doc = await AcademicYear.create(payload);
  return doc.toObject();
}

export async function updateAcademicYear(id, body) {
  const doc = await AcademicYear.findById(id);
  if (!doc) {
    const err = new Error('Academic year not found');
    err.status = 404;
    throw err;
  }

  if (body.label !== undefined) {
    const label = String(body.label || '').trim();
    if (!label) throw new Error('Academic year label is required');
    const duplicate = await AcademicYear.findOne({ label, _id: { $ne: doc._id } }).lean();
    if (duplicate) throw new Error('An academic year with this label already exists.');
    doc.label = label;
  }
  if (body.startDate !== undefined) doc.startDate = body.startDate || undefined;
  if (body.endDate !== undefined) doc.endDate = body.endDate || undefined;
  if (body.isCurrent !== undefined) doc.isCurrent = Boolean(body.isCurrent);

  validateAcademicYearDates({
    startDate: doc.startDate,
    endDate: doc.endDate,
  });

  if (doc.isCurrent) {
    await AcademicYear.updateMany({ _id: { $ne: doc._id } }, { $set: { isCurrent: false } });
  }

  await doc.save();
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

  const year = await AcademicYear.findById(academicYearId).lean();
  if (!year) throw new Error('Academic year not found');

  assertSemesterDatesWithinAcademicYear(
    { startDate: body.startDate, endDate: body.endDate },
    year
  );

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

export async function updateSemester(id, body) {
  const doc = await Semester.findById(id);
  if (!doc) {
    const err = new Error('Semester not found');
    err.status = 404;
    throw err;
  }

  const academicYearId = body.academicYearId || body.academicYear;
  if (academicYearId) {
    const year = await AcademicYear.findById(academicYearId).lean();
    if (!year) throw new Error('Academic year not found');
    doc.academicYear = academicYearId;
  }

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new Error('Semester name is required');
    doc.name = name;
  }
  if (body.order !== undefined) doc.order = Number(body.order) || 0;
  if (body.startDate !== undefined) doc.startDate = body.startDate || undefined;
  if (body.endDate !== undefined) doc.endDate = body.endDate || undefined;

  const year = await AcademicYear.findById(doc.academicYear).lean();
  if (!year) throw new Error('Academic year not found');

  assertSemesterDatesWithinAcademicYear(
    { startDate: doc.startDate, endDate: doc.endDate },
    year
  );

  await doc.save();
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
