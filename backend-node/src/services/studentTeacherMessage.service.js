import { Assignment } from '../models/Assignment.js';
import { StudentTeacherMessage, MESSAGE_CATEGORIES, MESSAGE_STATUSES } from '../models/StudentTeacherMessage.js';
import { getAssignmentDetailForStudent } from './assignmentStudent.service.js';
import {
  distinctAssignmentIdsForTeacher,
  findAssignmentVisibleToTeacher,
  teacherCanAccessAssignmentReview,
} from './teacherAssignmentAccess.service.js';

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function isDualTeacherAssignment(assignment) {
  return Boolean(
    assignment?.isCollaborative ||
      assignment?.coTeacherId ||
      (assignment?.teachers && assignment.teachers.length > 1)
  );
}

function resolveCollabTeachers(assignment) {
  const fromList = Array.isArray(assignment?.teachers) ? assignment.teachers : [];
  if (fromList.length >= 2) {
    const frontend = fromList.find((t) => /frontend/i.test(t.roleLabel || '')) || fromList[0];
    const backend = fromList.find((t) => /backend/i.test(t.roleLabel || '')) || fromList[1];
    return { frontend, backend, all: fromList };
  }

  const frontendRef = assignment?.frontendTeacherId || assignment?.teacher;
  const backendRef = assignment?.backendTeacherId || assignment?.coTeacherId;
  const frontend = typeof frontendRef === 'object' ? frontendRef : null;
  const backend = typeof backendRef === 'object' ? backendRef : null;
  const all = [frontend, backend].filter(Boolean);
  return { frontend, backend, all };
}

function resolveRecipients(assignment, recipientTarget = 'primary') {
  const target = String(recipientTarget || 'primary').toLowerCase();
  const primaryId = idOf(assignment?.teacher?._id || assignment?.teacher);

  if (!isDualTeacherAssignment(assignment)) {
    return {
      recipientTarget: 'primary',
      recipientTeacherIds: primaryId ? [primaryId] : [],
      recipientLabel: assignment?.teacher?.name ? `Teacher — ${assignment.teacher.name}` : 'Teacher',
      primaryTeacherId: primaryId,
    };
  }

  const { frontend, backend, all } = resolveCollabTeachers(assignment);
  const frontendId = idOf(frontend?._id || frontend);
  const backendId = idOf(backend?._id || backend);

  if (target === 'frontend' && frontendId) {
    return {
      recipientTarget: 'frontend',
      recipientTeacherIds: [frontendId],
      recipientLabel: `Frontend teacher${frontend?.name ? ` — ${frontend.name}` : ''}`,
      primaryTeacherId: frontendId,
    };
  }
  if (target === 'backend' && backendId) {
    return {
      recipientTarget: 'backend',
      recipientTeacherIds: [backendId],
      recipientLabel: `Backend teacher${backend?.name ? ` — ${backend.name}` : ''}`,
      primaryTeacherId: backendId,
    };
  }
  if (target === 'both') {
    const ids = [...new Set([frontendId, backendId].filter(Boolean))];
    const names = all.map((t) => t?.name).filter(Boolean);
    return {
      recipientTarget: 'both',
      recipientTeacherIds: ids,
      recipientLabel: names.length
        ? `Both teachers (${names.join(' + ')})`
        : 'Both teachers',
      primaryTeacherId: ids[0] || primaryId,
    };
  }

  return {
    recipientTarget: 'primary',
    recipientTeacherIds: primaryId ? [primaryId] : [],
    recipientLabel: assignment?.teacher?.name ? `Teacher — ${assignment.teacher.name}` : 'Teacher',
    primaryTeacherId: primaryId,
  };
}

function teacherCanAccessMessage(teacherId, msg) {
  const tid = String(teacherId);
  const recipients = (msg.recipientTeacherIds || []).map(String);
  if (recipients.includes(tid)) return true;
  if (String(msg.teacher) === tid) return true;
  return false;
}

function normalizeMessage(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    ...plain,
    id: plain._id,
  };
}

export async function createStudentMessage(studentId, payload = {}) {
  const { assignmentId, category, subject, message, deadlineType, recipientTarget } = payload;
  if (!assignmentId) {
    const err = new Error('Assignment is required.');
    err.status = 400;
    throw err;
  }

  const row = await getAssignmentDetailForStudent(studentId, assignmentId);
  const assignment = row.assignment;
  const recipients = resolveRecipients(assignment, recipientTarget);

  if (!recipients.primaryTeacherId || !recipients.recipientTeacherIds.length) {
    const err = new Error('This assignment has no teacher assigned.');
    err.status = 400;
    throw err;
  }

  const cat = MESSAGE_CATEGORIES.includes(category) ? category : 'general';
  const subj = String(subject || '').trim();
  const body = String(message || '').trim();
  if (!subj) {
    const err = new Error('Subject is required.');
    err.status = 400;
    throw err;
  }
  if (!body) {
    const err = new Error('Message is required.');
    err.status = 400;
    throw err;
  }

  const doc = await StudentTeacherMessage.create({
    student: studentId,
    teacher: recipients.primaryTeacherId,
    recipientTeacherIds: recipients.recipientTeacherIds,
    recipientTarget: recipients.recipientTarget,
    recipientLabel: recipients.recipientLabel,
    assignment: assignment._id,
    category: cat,
    deadlineType: cat === 'deadline_extension' ? String(deadlineType || '').trim() : '',
    subject: subj,
    message: body,
    status: 'open',
  });

  return populateMessage(doc._id);
}

export async function listStudentMessages(studentId, { assignmentId } = {}) {
  const filter = { student: studentId };
  if (assignmentId) filter.assignment = assignmentId;

  const rows = await StudentTeacherMessage.find(filter)
    .populate('teacher', 'name email')
    .populate('assignment', 'title assignmentType')
    .populate('teacherRepliedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return rows.map(normalizeMessage);
}

export async function listTeacherMessages(teacherId, { status, assignmentId } = {}) {
  const assignmentIds = assignmentId
    ? [assignmentId]
    : await distinctAssignmentIdsForTeacher(teacherId);

  if (!assignmentIds.length) return [];

  const filter = {
    assignment: { $in: assignmentIds },
    $or: [{ recipientTeacherIds: teacherId }, { teacher: teacherId }],
  };
  if (status && MESSAGE_STATUSES.includes(status)) filter.status = status;

  const rows = await StudentTeacherMessage.find(filter)
    .populate('student', 'name email username')
    .populate('assignment', 'title assignmentType subject')
    .populate('teacherRepliedBy', 'name email')
    .sort({ status: 1, createdAt: -1 })
    .lean();

  return rows.map(normalizeMessage);
}

export async function countOpenTeacherMessages(teacherId) {
  const assignmentIds = await distinctAssignmentIdsForTeacher(teacherId);
  if (!assignmentIds.length) return 0;
  return StudentTeacherMessage.countDocuments({
    assignment: { $in: assignmentIds },
    status: 'open',
    $or: [{ recipientTeacherIds: teacherId }, { teacher: teacherId }],
  });
}

export async function replyToStudentMessage(teacherId, messageId, { reply, close = false } = {}) {
  const msg = await StudentTeacherMessage.findById(messageId).populate('assignment');
  if (!msg) {
    const err = new Error('Message not found.');
    err.status = 404;
    throw err;
  }

  const assignment = await Assignment.findById(msg.assignment?._id || msg.assignment);
  if (!teacherCanAccessAssignmentReview(teacherId, assignment)) {
    const err = new Error('You cannot reply to this message.');
    err.status = 403;
    throw err;
  }
  if (!teacherCanAccessMessage(teacherId, msg)) {
    const err = new Error('This message was not sent to you.');
    err.status = 403;
    throw err;
  }

  const replyText = String(reply || '').trim();
  if (!replyText && !close) {
    const err = new Error('Reply text is required.');
    err.status = 400;
    throw err;
  }

  if (replyText) {
    msg.teacherReply = replyText;
    msg.teacherRepliedAt = new Date();
    msg.teacherRepliedBy = teacherId;
    msg.status = 'replied';
  }
  if (close) {
    msg.status = 'closed';
    msg.closedAt = new Date();
  }

  await msg.save();
  return populateMessage(msg._id);
}

async function populateMessage(id) {
  const doc = await StudentTeacherMessage.findById(id)
    .populate('student', 'name email username')
    .populate('teacher', 'name email')
    .populate('assignment', 'title assignmentType subject')
    .populate('teacherRepliedBy', 'name email')
    .lean();
  return normalizeMessage(doc);
}

export async function getMessageForStudent(studentId, messageId) {
  const doc = await StudentTeacherMessage.findOne({ _id: messageId, student: studentId })
    .populate('teacher', 'name email')
    .populate('assignment', 'title assignmentType')
    .populate('teacherRepliedBy', 'name email')
    .lean();
  if (!doc) {
    const err = new Error('Message not found.');
    err.status = 404;
    throw err;
  }
  return normalizeMessage(doc);
}

export async function getMessageForTeacher(teacherId, messageId) {
  const doc = await StudentTeacherMessage.findById(messageId)
    .populate('student', 'name email username')
    .populate('assignment', 'title assignmentType subject')
    .populate('teacherRepliedBy', 'name email')
    .lean();
  if (!doc) {
    const err = new Error('Message not found.');
    err.status = 404;
    throw err;
  }

  const assignment = await findAssignmentVisibleToTeacher(teacherId, doc.assignment?._id || doc.assignment);
  if (!assignment || !teacherCanAccessMessage(teacherId, doc)) {
    const err = new Error('Message not found.');
    err.status = 404;
    throw err;
  }

  return normalizeMessage(doc);
}
