import { StudentProfile } from '../models/StudentProfile.js';
import * as assignmentStudent from './assignmentStudent.service.js';

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

function formatAcademicInfo(profile) {
  return {
    faculty: profile.faculty || '',
    department: profile.department || '',
    campus: profile.campus || '',
    studyMode: profile.studyMode || '',
    entryDate: profile.entryDate ? new Date(profile.entryDate).toISOString() : null,
  };
}

function countProjectStats(assignments = []) {
  let submitted = 0;
  let pending = 0;
  for (const row of assignments) {
    const hasProject = Boolean(row.latestProjectSubmission);
    const hasProposal = Boolean(row.proposal);
    if (hasProject) submitted += 1;
    else if (hasProposal && row.proposal?.status !== 'rejected') pending += 1;
  }
  return {
    submitted,
    pending,
    totalCourses: assignments.length,
    progressPercent:
      assignments.length > 0 ? Math.round((submitted / assignments.length) * 100) : 0,
  };
}

export async function getProfileForStudent(userId) {
  const profile = await StudentProfile.findOne({ user: userId }).populate('user');
  if (!profile?.user) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }

  const overview = await assignmentStudent.getStudentAssignmentsOverview(userId);
  const u = profile.user;
  const projectStats = countProjectStats(overview.assignments || []);

  return {
    _id: profile._id,
    userId: u._id,
    name: u.name || '',
    email: u.email || '',
    username: u.username || '',
    photo: u.photo || '',
    studentId: profile.studentId || '',
    classId: profile.classCode || overview.class?.code || '',
    classCode: profile.classCode || overview.class?.code || '',
    program: profile.program || '',
    faculty: profile.faculty || '',
    status: u.isActive === false ? 'INACTIVE' : 'ACTIVE',
    currentScore: profile.currentScore,
    currentGpa: profile.currentGpa,
    academicInfo: formatAcademicInfo(profile),
    personalInfo: formatPersonalInfo(profile),
    parentDetails: formatParentDetails(profile),
    educationalBackground: formatEducationalBackground(profile),
    projectStats,
    class: overview.class || null,
    subjects: overview.subjects || [],
  };
}
