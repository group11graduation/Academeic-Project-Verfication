import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';
import { Group } from '../models/Group.js';
import { Class } from '../models/Class.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Semester } from '../models/Semester.js';

export async function listClassesForTeacher(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const classes = await Class.find({ 'teacherAssignments.teacher': tid }).lean();

  const rows = await Promise.all(
    classes.map(async (c) => {
      const students = await StudentProfile.countDocuments({ classCode: c.code });
      return {
        _id: c._id,
        code: c.code,
        title: c.name,
        section: 'A',
        students,
      };
    })
  );
  return rows;
}
export async function listAssignmentsForTeacher(teacherId) {
  return Assignment.find({ teacher: teacherId, isActive: true })
    .populate('class', 'code name')
    .populate('subject', 'code name')
    .populate('semester', 'name')
    .populate('academicYear', 'label')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getAssignmentForTeacher(teacherId, assignmentId) {
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId })
    .populate('class')
    .populate('subject')
    .populate('semester')
    .populate('academicYear')
    .lean();
  return a;
}

export async function getTeacherCatalog(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const classes = await Class.find({ 'teacherAssignments.teacher': tid })
    .populate('teacherAssignments.subjects')
    .populate('academicYear')
    .populate('semester')
    .lean();

  return classes.map((c) => {
    const ta = c.teacherAssignments?.find((x) => tid.equals(x.teacher));
    return {
      class: { _id: c._id, code: c.code, name: c.name },
      subjects: ta?.subjects || [],
      academicYear: c.academicYear,
      semester: c.semester,
    };
  });
}

export async function createAssignment(teacherId, payload) {
  const {
    classId,
    subjectId,
    semesterId,
    academicYearId,
    title,
    description,
    submissionMode,
    groupModeType,
    maxGroupSize,
    proposalPhaseOpen,
    projectPhaseOpen,
    proposalDeadline,
    projectDeadline,
  } = payload;

  const classDoc = await Class.findById(classId).populate('teacherAssignments.subjects');
  if (!classDoc) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  const tid = new mongoose.Types.ObjectId(teacherId);
  const ta = classDoc.teacherAssignments?.find((x) => tid.equals(x.teacher));
  if (!ta) {
    const err = new Error('You are not assigned to teach this class');
    err.status = 403;
    throw err;
  }
  const subjOk = ta.subjects?.some((s) => s._id.equals(subjectId));
  if (!subjOk) {
    const err = new Error('You are not assigned to this subject in this class');
    err.status = 403;
    throw err;
  }

  const semesterResolved = semesterId || classDoc.semester || null;
  let academicYearResolved = classDoc.academicYear || null;
  if (!academicYearResolved && semesterResolved) {
    const sem = await Semester.findById(semesterResolved).lean();
    academicYearResolved = sem?.academicYear || null;
  }
  if (!semesterResolved) {
    const err = new Error('semesterId is required for assignment');
    err.status = 400;
    throw err;
  }
  if (!academicYearResolved) {
    const err = new Error('academicYear is required; assign class semester/academic year first');
    err.status = 400;
    throw err;
  }

  const parseList = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
    return [];
  };
  const parseBool = (v, fallback = false) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      if (v.toLowerCase() === 'true') return true;
      if (v.toLowerCase() === 'false') return false;
    }
    return fallback;
  };

  const doc = new Assignment({
    teacher: teacherId,
    class: classId,
    subject: subjectId,
    semester: semesterResolved,
    academicYear: academicYearResolved,
    title: title?.trim(),
    description: description?.trim() || '',
    requirementText: String(payload.requirementText || '').trim(),
    requiredKeywords: parseList(payload.requiredKeywords || payload.requiredKeywordsText),
    allowedTechnologies: parseList(payload.allowedTechnologies || payload.allowedTechnologiesText),
    assignmentFile: payload._requirementsFilePath || '',
    originalFileName: payload._requirementsOriginalName || '',
    submissionMode: submissionMode || 'single',
    groupModeType: groupModeType || 'teacher_manual',
    maxGroupSize: maxGroupSize || 4,
    proposalPhaseOpen: parseBool(proposalPhaseOpen, true),
    projectPhaseOpen: parseBool(projectPhaseOpen, false),
    proposalDeadline: proposalDeadline ? new Date(proposalDeadline) : null,
    projectDeadline: projectDeadline ? new Date(projectDeadline) : null,
  });
  await doc.save();
  return getAssignmentForTeacher(teacherId, doc._id);
}

export async function attachRequirementsFile(teacherId, assignmentId, file) {
  if (!file?.filename) {
    const err = new Error('No requirements file uploaded');
    err.status = 400;
    throw err;
  }
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
  if (!a) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  a.assignmentFile = `/uploads/assignment-requirements/${file.filename}`;
  a.originalFileName = file.originalname || file.filename;
  await a.save();
  return getAssignmentForTeacher(teacherId, assignmentId);
}

export async function createGroupForAssignment(teacherId, assignmentId, { name, leaderUserId, memberUserIds }) {
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
  if (!a) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (a.submissionMode !== 'group') {
    const err = new Error('This assignment is not in group mode');
    err.status = 400;
    throw err;
  }
  const leader = new mongoose.Types.ObjectId(leaderUserId);
  const memberIds = new Set((memberUserIds || []).map((id) => String(id)));
  memberIds.delete(String(leaderUserId));
  const members = [...memberIds].map((id) => ({ user: new mongoose.Types.ObjectId(id) }));
  const group = new Group({
    assignment: a._id,
    name: name?.trim() || 'Group',
    leader,
    members,
  });
  await group.save();
  return group.populate('leader', 'name email');
}

export async function listGroupsForAssignment(teacherId, assignmentId) {
  const a = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
  if (!a) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  return Group.find({ assignment: assignmentId })
    .populate('leader', 'name email')
    .populate('members.user', 'name email')
    .lean();
}
