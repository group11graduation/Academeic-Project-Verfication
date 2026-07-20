import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { Subject } from '../models/Subject.js';
import { Enrollment } from '../models/Enrollment.js';
import { Proposal } from '../models/Proposal.js';

/** Proposals currently in the final-project pipeline (not draft / permanently rejected). */
const ACTIVE_PROJECT_STATUSES = [
  'pending_teacher_approval',
  'ai_flagged_previous_semester',
  'revision_required',
  'teacher_approved',
];

export async function getDashboardStats() {
  const [
    teacherCount,
    studentCount,
    adminCount,
    classCount,
    subjectCount,
    enrollmentCount,
    activeProjects,
  ] = await Promise.all([
    User.countDocuments({ role: 'teacher' }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'admin' }),
    Class.countDocuments(),
    Subject.countDocuments(),
    Enrollment.countDocuments(),
    Proposal.countDocuments({ status: { $in: ACTIVE_PROJECT_STATUSES } }),
  ]);

  return {
    totalTeachers: teacherCount,
    totalStudents: studentCount,
    totalClasses: classCount,
    activeProjects,
    admins: adminCount,
    subjects: subjectCount,
    enrollments: enrollmentCount,
  };
}
