import { Router } from 'express';
import { body } from 'express-validator';
import * as admin from '../controllers/admin.controller.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRoles('admin'));

router.get('/dashboard/stats', admin.dashboardStats);

router.get('/admins', admin.listAdmins);
router.post('/admins', admin.createAdmin);
router.get('/admins/:id', admin.getAdmin);
router.put('/admins/:id', admin.updateAdmin);
router.delete('/admins/:id', admin.removeAdmin);

router.get('/teachers', admin.listTeachers);
router.get('/teachers/:id', admin.getTeacher);
router.post(
  '/teachers',
  [
    body('name').optional().trim(),
    body('email').optional({ checkFalsy: true }).isEmail(),
  ],
  admin.createTeacher
);
router.put('/teachers/:id', admin.updateTeacher);
router.delete('/teachers/:id', admin.removeTeacher);
router.patch('/teachers/:id/passcode', admin.patchTeacherPasscode);
router.patch('/teachers/:id/classes', admin.patchTeacherClasses);
router.patch('/teachers/:id/toggle-admin', admin.patchTeacherToggleAdmin);

router.get('/students', admin.listStudents);
router.post('/students/import', admin.importStudents);
router.get('/students/export', admin.exportStudents);
router.post('/students', admin.createStudent);
router.get('/students/:id', admin.getStudent);
router.put('/students/:id', admin.updateStudent);
router.delete('/students/:id', admin.removeStudent);
router.patch('/students/:id/passcode', admin.patchStudentPasscode);

router.get('/classes', admin.listClasses);
router.get('/classes/:code', admin.getClass);
router.post('/classes', admin.createClass);
router.put('/classes/:code', admin.updateClass);
router.post('/classes/:code/assign-teacher', admin.assignTeacherClass);
router.delete('/classes/:code/teachers/:teacherId', admin.removeTeacherClass);
router.post('/classes/:code/generate-accounts', admin.generateClassStudentAccounts);

router.get('/subjects', admin.listSubjects);
router.get('/subjects/:id', admin.getSubject);
router.post('/subjects', admin.createSubject);
router.put('/subjects/:id', admin.updateSubject);
router.delete('/subjects/:id', admin.removeSubject);

router.get('/academic-years', admin.listAcademicYears);
router.post('/academic-years', admin.createAcademicYear);

router.get('/semesters', admin.listSemesters);
router.post('/semesters', admin.createSemester);

router.post('/enrollments', admin.postEnrollment);
router.patch('/students/:studentUserId/performance', admin.patchPerformance);

router.get('/settings', admin.getSettings);
router.put('/settings', admin.putSettings);

export default router;
