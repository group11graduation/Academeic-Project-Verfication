import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { Subject } from '../models/Subject.js';
import { Enrollment } from '../models/Enrollment.js';

export async function getDashboardStats() {
  const [teacherCount, studentCount, adminCount, classCount, subjectCount, enrollmentCount] =
    await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      Class.countDocuments(),
      Subject.countDocuments(),
      Enrollment.countDocuments(),
    ]);

  return {
    totalTeachers: teacherCount,
    totalStudents: studentCount,
    totalClasses: classCount,
    /** Placeholder until assignment/project module exists */
    activeProjects: 0,
    admins: adminCount,
    subjects: subjectCount,
    enrollments: enrollmentCount,
  };
}
