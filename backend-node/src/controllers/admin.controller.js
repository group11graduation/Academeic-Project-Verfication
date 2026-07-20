import { validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail, success, successMessage } from '../utils/apiResponse.js';
import * as adminUser from '../services/adminUser.service.js';
import * as academic from '../services/adminAcademic.service.js';
import * as dashboard from '../services/adminDashboard.service.js';

function validationFailed(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg, 400);
    return true;
  }
  return false;
}

/** Teachers */
export const listTeachers = asyncHandler(async (req, res) => {
  const data = await adminUser.listTeachers();
  return success(res, data);
});

export const getTeacher = asyncHandler(async (req, res) => {
  const row = await adminUser.getTeacherById(req.params.id);
  if (!row) return fail(res, 'Teacher not found', 404);
  return success(res, row);
});

export const createTeacher = asyncHandler(async (req, res) => {
  if (validationFailed(req, res)) return;
  const row = await adminUser.createTeacher(req.body);
  return success(res, row, 201);
});

export const updateTeacher = asyncHandler(async (req, res) => {
  if (validationFailed(req, res)) return;
  const row = await adminUser.updateTeacher(req.params.id, req.body);
  return success(res, row);
});

export const removeTeacher = asyncHandler(async (req, res) => {
  await adminUser.deleteTeacher(req.params.id);
  return successMessage(res, 'Teacher removed');
});

export const patchTeacherPasscode = asyncHandler(async (req, res) => {
  const { passcode } = await adminUser.regenerateTeacherPasscode(req.params.id);
  return success(res, { passcode, message: 'New passcode generated' });
});

export const patchTeacherClasses = asyncHandler(async (req, res) => {
  const { classes } = req.body;
  const row = await adminUser.assignTeacherClasses(req.params.id, classes || []);
  return success(res, row);
});

export const patchTeacherToggleAdmin = asyncHandler(async (req, res) => {
  const row = await adminUser.toggleTeacherAdmin(req.params.id);
  return success(res, row);
});

/** Students */
export const listStudents = asyncHandler(async (req, res) => {
  const data = await adminUser.listStudents();
  return success(res, data);
});

export const getStudent = asyncHandler(async (req, res) => {
  const row = await adminUser.getStudentById(req.params.id);
  if (!row) return fail(res, 'Student not found', 404);
  const performanceRecords = await academic.listPerformanceForStudent(row.userId);
  return success(res, { ...row, performanceRecords });
});

export const createStudent = asyncHandler(async (req, res) => {
  const row = await adminUser.createStudent(req.body);
  return success(res, row, 201);
});

export const importStudents = asyncHandler(async (req, res) => {
  const rows = req.body?.students || req.body?.rows || [];
  const result = await adminUser.importStudents(rows);
  return success(res, result, 201);
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { search, classId, classCode, faculty, format = 'csv' } = req.query || {};
  const filters = {
    search,
    classId,
    classCode,
    faculty,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  if (String(format).toLowerCase() === 'xlsx') {
    const file = await adminUser.exportStudentsXlsx(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="students-${stamp}.xlsx"`);
    return res.status(200).send(file);
  }
  const { csv, total } = await adminUser.exportStudentsCsv(filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="students-${stamp}.csv"`);
  res.setHeader('X-Export-Total', String(total));
  return res.status(200).send(csv);
});

export const importTeachers = asyncHandler(async (req, res) => {
  const rows = req.body?.teachers || req.body?.rows || [];
  const result = await adminUser.importTeachers(rows);
  return success(res, result, 201);
});

export const exportTeachers = asyncHandler(async (req, res) => {
  const { search, department, format = 'csv' } = req.query || {};
  const filters = { search, department };
  const stamp = new Date().toISOString().slice(0, 10);
  if (String(format).toLowerCase() === 'xlsx') {
    const file = await adminUser.exportTeachersXlsx(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="teachers-${stamp}.xlsx"`);
    return res.status(200).send(file);
  }
  const { csv, total } = await adminUser.exportTeachersCsv(filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="teachers-${stamp}.csv"`);
  res.setHeader('X-Export-Total', String(total));
  return res.status(200).send(csv);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const row = await adminUser.updateStudent(req.params.id, req.body);
  return success(res, row);
});

export const removeStudent = asyncHandler(async (req, res) => {
  await adminUser.deleteStudent(req.params.id);
  return successMessage(res, 'Student removed');
});

export const patchStudentPasscode = asyncHandler(async (req, res) => {
  const { passcode } = await adminUser.regenerateStudentPasscode(req.params.id);
  return success(res, { passcode, message: 'New passcode generated' });
});

/** Classes & subjects */
export const listClasses = asyncHandler(async (req, res) => {
  const data = await academic.listClasses();
  return success(res, data);
});

export const getClass = asyncHandler(async (req, res) => {
  const row = await academic.getClassByCode(req.params.code);
  if (!row) return fail(res, 'Class not found', 404);
  return success(res, row);
});

export const createClass = asyncHandler(async (req, res) => {
  const row = await academic.createClass(req.body);
  return success(res, row, 201);
});

export const updateClass = asyncHandler(async (req, res) => {
  const row = await academic.updateClass(req.params.code, req.body);
  return success(res, row);
});

export const removeClass = asyncHandler(async (req, res) => {
  const row = await academic.deleteClass(req.params.code);
  return successMessage(
    res,
    `Class ${row.code} deleted. ${row.studentsUnassigned} student(s) kept and set to unassigned.`,
    row
  );
});

export const assignTeacherClass = asyncHandler(async (req, res) => {
  const row = await academic.assignTeacherToClass(req.params.code, req.body);
  return success(res, row);
});

export const removeTeacherClass = asyncHandler(async (req, res) => {
  const row = await academic.removeTeacherFromClass(req.params.code, req.params.teacherId);
  return success(res, row);
});

export const generateClassStudentAccounts = asyncHandler(async (req, res) => {
  const row = await academic.generateStudentAccountsForClass(req.params.code);
  return success(res, row);
});

export const listSubjects = asyncHandler(async (req, res) => {
  const data = await academic.listSubjects();
  return success(res, data);
});

export const getSubject = asyncHandler(async (req, res) => {
  const row = await academic.getSubject(req.params.id);
  if (!row) return fail(res, 'Subject not found', 404);
  return success(res, row);
});

export const createSubject = asyncHandler(async (req, res) => {
  const row = await academic.createSubject(req.body);
  return success(res, row, 201);
});

export const updateSubject = asyncHandler(async (req, res) => {
  const row = await academic.updateSubject(req.params.id, req.body);
  return success(res, row);
});

export const removeSubject = asyncHandler(async (req, res) => {
  await academic.deleteSubject(req.params.id);
  return successMessage(res, 'Subject removed');
});

/** Academic structure */
export const listAcademicYears = asyncHandler(async (req, res) => {
  const data = await academic.listAcademicYears();
  return success(res, data);
});

export const createAcademicYear = asyncHandler(async (req, res) => {
  const row = await academic.createAcademicYear(req.body);
  return success(res, row, 201);
});

export const updateAcademicYear = asyncHandler(async (req, res) => {
  const row = await academic.updateAcademicYear(req.params.id, req.body);
  return success(res, row);
});

export const listSemesters = asyncHandler(async (req, res) => {
  const academicYearId = req.query.academicYearId;
  const data = await academic.listSemesters(academicYearId);
  return success(res, data);
});

export const createSemester = asyncHandler(async (req, res) => {
  const row = await academic.createSemester(req.body);
  return success(res, row, 201);
});

export const updateSemester = asyncHandler(async (req, res) => {
  const row = await academic.updateSemester(req.params.id, req.body);
  return success(res, row);
});

/** Enrollment & performance */
export const postEnrollment = asyncHandler(async (req, res) => {
  const row = await academic.enrollStudent(req.body.studentUserId, req.body);
  return success(res, row, 201);
});

export const patchPerformance = asyncHandler(async (req, res) => {
  const row = await academic.upsertPerformance(req.params.studentUserId, req.body);
  return success(res, row);
});

/** Settings */
export const getSettings = asyncHandler(async (req, res) => {
  const data = await academic.getSettings();
  return success(res, data);
});

export const putSettings = asyncHandler(async (req, res) => {
  const data = await academic.setSettings(req.body);
  return success(res, data);
});

export const listFaculties = asyncHandler(async (req, res) => {
  const data = await academic.listFacultyNames();
  return success(res, data);
});

/** Dashboard */
export const dashboardStats = asyncHandler(async (req, res) => {
  const data = await dashboard.getDashboardStats();
  return success(res, data);
});

/** Admins (user records) */
export const listAdmins = asyncHandler(async (req, res) => {
  const data = await adminUser.listAdmins();
  return success(res, data);
});

export const createAdmin = asyncHandler(async (req, res) => {
  const row = await adminUser.createAdminUser(req.body);
  return success(res, row, 201);
});

export const patchAdminPasscode = asyncHandler(async (req, res) => {
  const { passcode } = await adminUser.regenerateAdminPasscode(req.params.id);
  return success(res, { passcode, message: 'New passcode generated' });
});

export const getAdmin = asyncHandler(async (req, res) => {
  const row = await adminUser.getAdminById(req.params.id);
  if (!row) return fail(res, 'Admin not found', 404);
  return success(res, row);
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const row = await adminUser.updateAdminUser(req.params.id, req.body);
  return success(res, row);
});

export const removeAdmin = asyncHandler(async (req, res) => {
  await adminUser.deleteAdminUser(req.params.id, req.userId);
  return successMessage(res, 'Administrator removed');
});
