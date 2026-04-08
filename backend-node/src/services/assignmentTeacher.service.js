import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment.js';
import { Group } from '../models/Group.js';
import { Class } from '../models/Class.js';
import { StudentProfile } from '../models/StudentProfile.js';

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

  const doc = new Assignment({
    teacher: teacherId,
    class: classId,
    subject: subjectId,
    semester: semesterId,
    academicYear: academicYearId,
    title: title?.trim(),
    description: description?.trim() || '',
    submissionMode: submissionMode || 'single',
    groupModeType: groupModeType || 'teacher_manual',
    maxGroupSize: maxGroupSize || 4,
    proposalPhaseOpen: proposalPhaseOpen !== false,
    projectPhaseOpen: !!projectPhaseOpen,
    proposalDeadline: proposalDeadline ? new Date(proposalDeadline) : null,
    projectDeadline: projectDeadline ? new Date(projectDeadline) : null,
  });
  await doc.save();
  return getAssignmentForTeacher(teacherId, doc._id);
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
