import mongoose from 'mongoose';
import { TeacherCollaboration } from '../models/TeacherCollaboration.js';
import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import {
  assertComplementaryTeacherSubjects,
  oppositeCollaborationSide,
  resolveSubjectCollaborationSide,
} from './subjectCollaboration.service.js';

/** Stable pair key so (A,B) and (B,A) share one document. */
function normalizeTeacherPair(teacherAId, teacherBId) {
  const sa = String(teacherAId);
  const sb = String(teacherBId);
  return sa < sb
    ? { primaryTeacher: new mongoose.Types.ObjectId(teacherAId), coTeacher: new mongoose.Types.ObjectId(teacherBId) }
    : { primaryTeacher: new mongoose.Types.ObjectId(teacherBId), coTeacher: new mongoose.Types.ObjectId(teacherAId) };
}

function partnerFromRow(row, viewerId) {
  const tid = String(viewerId);
  const primaryId = String(row.primaryTeacher?._id || row.primaryTeacher);
  const coId = String(row.coTeacher?._id || row.coTeacher);
  return primaryId === tid ? row.coTeacher : row.primaryTeacher;
}

function formatCollaborationRow(row, viewerId) {
  const partner = partnerFromRow(row, viewerId);
  const initiatedById = String(row.initiatedBy?._id || row.initiatedBy);
  const viewerIdStr = String(viewerId);
  const requesterRole = row.requesterRole || '';
  const partnerRole = requesterRole ? oppositeCollaborationSide(requesterRole) : '';
  const myRole =
    initiatedById === viewerIdStr ? requesterRole : partnerRole;
  return {
    _id: row._id,
    status: row.status,
    notes: row.notes || '',
    acceptedAt: row.acceptedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    initiatedBy: row.initiatedBy,
    initiatedByMe: initiatedById === viewerIdStr,
    requesterRole,
    partnerRole,
    myRole,
    class: row.class
      ? {
          _id: row.class._id || row.class,
          code: row.class.code || '',
          name: row.class.name || '',
        }
      : null,
    subject: row.subject
      ? {
          _id: row.subject._id || row.subject,
          code: row.subject.code || '',
          name: row.subject.name || '',
          collaborationSide: resolveSubjectCollaborationSide(row.subject),
        }
      : null,
    partner: {
      _id: partner?._id || partner,
      name: partner?.name || '',
      email: partner?.email || '',
    },
  };
}

export async function findCollaborationPair(teacherAId, teacherBId) {
  const a = new mongoose.Types.ObjectId(teacherAId);
  const b = new mongoose.Types.ObjectId(teacherBId);
  return TeacherCollaboration.findOne({
    $or: [
      { primaryTeacher: a, coTeacher: b },
      { primaryTeacher: b, coTeacher: a },
    ],
  });
}

/**
 * Verify that two teachers have an accepted collaboration in TeacherCollaborations.
 */
export async function findAcceptedCollaboration(teacherAId, teacherBId) {
  const row = await findCollaborationPair(teacherAId, teacherBId);
  return row?.status === 'accepted' ? row.toObject?.() || row : null;
}

export async function assertActiveCollaboration(primaryTeacherId, coTeacherId) {
  if (String(primaryTeacherId) === String(coTeacherId)) {
    const err = new Error('Primary teacher and co-teacher must be different users');
    err.status = 400;
    throw err;
  }

  const coTeacher = await User.findOne({ _id: coTeacherId, role: 'teacher', isActive: true }).lean();
  if (!coTeacher) {
    const err = new Error('Co-teacher not found or inactive');
    err.status = 404;
    throw err;
  }

  const collaboration = await findAcceptedCollaboration(primaryTeacherId, coTeacherId);
  if (!collaboration) {
    const err = new Error(
      'No accepted collaboration with the selected co-teacher. Send a collaboration request and wait for them to accept.'
    );
    err.status = 403;
    throw err;
  }

  return collaboration;
}

export async function listAcceptedCollaboratorsForTeacher(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const rows = await TeacherCollaboration.find({
    status: 'accepted',
    $or: [{ primaryTeacher: tid }, { coTeacher: tid }],
  })
    .populate('primaryTeacher', 'name email')
    .populate('coTeacher', 'name email')
    .sort({ acceptedAt: -1, updatedAt: -1 })
    .lean();

  return rows.map((row) => {
    const partner = partnerFromRow(row, teacherId);
    return {
      collaborationId: row._id,
      teacherId: partner?._id || partner,
      name: partner?.name || '',
      email: partner?.email || '',
      acceptedAt: row.acceptedAt || row.updatedAt,
    };
  });
}

export async function countIncomingPendingCollaborations(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  return TeacherCollaboration.countDocuments({
    status: 'pending',
    $or: [{ primaryTeacher: tid }, { coTeacher: tid }],
    initiatedBy: { $ne: tid },
  });
}

/** Incoming pending, outgoing pending, and accepted collaborations for the logged-in teacher. */
export async function listCollaborationsForTeacher(teacherId) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const rows = await TeacherCollaboration.find({
    $or: [{ primaryTeacher: tid }, { coTeacher: tid }],
    status: { $in: ['pending', 'accepted'] },
  })
    .populate('primaryTeacher', 'name email')
    .populate('coTeacher', 'name email')
    .populate('initiatedBy', 'name email')
    .populate('class', 'code name')
    .populate('subject', 'code name description collaborationSide')
    .sort({ updatedAt: -1 })
    .lean();

  const formatted = rows.map((row) => formatCollaborationRow(row, teacherId));
  return {
    incoming: formatted.filter((r) => r.status === 'pending' && !r.initiatedByMe),
    outgoing: formatted.filter((r) => r.status === 'pending' && r.initiatedByMe),
    accepted: formatted.filter((r) => r.status === 'accepted'),
  };
}

/** Teachers assigned to the same class(es) as the requester — candidates for collaboration. */
export async function listTeachersAvailableForCollaboration(teacherId, { classId = null } = {}) {
  const tid = new mongoose.Types.ObjectId(teacherId);
  const classQuery = { 'teacherAssignments.teacher': tid };
  if (classId && mongoose.Types.ObjectId.isValid(classId)) {
    classQuery._id = new mongoose.Types.ObjectId(classId);
  }
  const myClasses = await Class.find(classQuery).select('teacherAssignments').lean();
  const peerIds = new Set();
  for (const cls of myClasses) {
    for (const ta of cls.teacherAssignments || []) {
      const id = String(ta.teacher?._id || ta.teacher);
      if (id && id !== String(teacherId)) peerIds.add(id);
    }
  }

  if (!peerIds.size) {
    const allTeachers = await User.find({ role: 'teacher', isActive: true, _id: { $ne: tid } })
      .select('name email')
      .sort({ name: 1 })
      .lean();
    return mapTeachersWithCollabStatus(teacherId, allTeachers);
  }

  const peers = await User.find({ _id: { $in: [...peerIds] }, role: 'teacher', isActive: true })
    .select('name email')
    .sort({ name: 1 })
    .lean();
  return mapTeachersWithCollabStatus(teacherId, peers);
}

async function mapTeachersWithCollabStatus(teacherId, teachers) {
  const rows = await TeacherCollaboration.find({
    $or: [{ primaryTeacher: teacherId }, { coTeacher: teacherId }],
  }).lean();
  const statusByPartner = new Map();
  for (const row of rows) {
    const partnerId =
      String(row.primaryTeacher) === String(teacherId) ? String(row.coTeacher) : String(row.primaryTeacher);
    statusByPartner.set(partnerId, row.status);
  }

  return teachers.map((t) => ({
    _id: t._id,
    name: t.name || '',
    email: t.email || '',
    collaborationStatus: statusByPartner.get(String(t._id)) || 'none',
  }));
}

async function loadClassTeacherSubjects(classId, teacherId) {
  const cls = await Class.findById(classId)
    .populate('teacherAssignments.subjects', 'code name description collaborationSide')
    .populate('subjects', 'code name description collaborationSide')
    .lean();
  if (!cls) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  const ta = (cls.teacherAssignments || []).find(
    (row) => String(row.teacher?._id || row.teacher) === String(teacherId)
  );
  if (!ta) {
    const err = new Error('You are not assigned to this class');
    err.status = 403;
    throw err;
  }
  const classSubjects = (cls.subjects || []).filter(Boolean);
  const teacherSubjects = (ta.subjects || []).filter(Boolean);
  const subjects = classSubjects.length ? classSubjects : teacherSubjects;
  return { classDoc: cls, subjects, teacherAssignment: ta };
}

/**
 * Teacher A requests to collaborate with Teacher B.
 * If B already sent a pending request to A, it is auto-accepted.
 */
export async function requestCollaboration(
  requesterId,
  targetTeacherId,
  { notes = '', classId = null, subjectId = null, myRole = '' } = {}
) {
  if (String(requesterId) === String(targetTeacherId)) {
    const err = new Error('You cannot send a collaboration request to yourself');
    err.status = 400;
    throw err;
  }

  const target = await User.findOne({ _id: targetTeacherId, role: 'teacher', isActive: true }).lean();
  if (!target) {
    const err = new Error('Teacher not found or inactive');
    err.status = 404;
    throw err;
  }

  if (!classId || !subjectId || !myRole) {
    const err = new Error('classId, subjectId, and myRole (frontend or backend) are required');
    err.status = 400;
    throw err;
  }

  const requesterCtx = await loadClassTeacherSubjects(classId, requesterId);
  const targetCtx = await loadClassTeacherSubjects(classId, targetTeacherId);
  assertComplementaryTeacherSubjects({
    requesterSubjects: requesterCtx.subjects,
    targetSubjects: targetCtx.subjects,
    requesterRole: myRole,
    subjectId,
  });

  const existing = await findCollaborationPair(requesterId, targetTeacherId);

  if (existing?.status === 'accepted') {
    const err = new Error('You are already collaborating with this teacher');
    err.status = 409;
    throw err;
  }

  if (existing?.status === 'pending') {
    const initiatedByOther = String(existing.initiatedBy) !== String(requesterId);
    if (initiatedByOther) {
      existing.status = 'accepted';
      existing.acceptedAt = new Date();
      await existing.save();
      return existing.populate(['primaryTeacher', 'coTeacher', 'initiatedBy', 'class', 'subject']);
    }
    const err = new Error('Collaboration request already sent — waiting for their response');
    err.status = 409;
    throw err;
  }

  const pair = normalizeTeacherPair(requesterId, targetTeacherId);

  if (existing) {
    existing.status = 'pending';
    existing.initiatedBy = requesterId;
    existing.primaryTeacher = pair.primaryTeacher;
    existing.coTeacher = pair.coTeacher;
    existing.notes = String(notes || '').trim();
    existing.class = classId;
    existing.subject = subjectId;
    existing.requesterRole = String(myRole).trim().toLowerCase();
    existing.acceptedAt = null;
    await existing.save();
    return existing.populate(['primaryTeacher', 'coTeacher', 'initiatedBy', 'class', 'subject']);
  }

  const doc = await TeacherCollaboration.create({
    ...pair,
    status: 'pending',
    initiatedBy: requesterId,
    notes: String(notes || '').trim(),
    class: classId,
    subject: subjectId,
    requesterRole: String(myRole).trim().toLowerCase(),
  });
  return doc.populate(['primaryTeacher', 'coTeacher', 'initiatedBy', 'class', 'subject']);
}

/** Recipient accepts or declines; initiator may cancel a pending outgoing request. */
export async function respondToCollaboration(teacherId, collaborationId, action) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['accept', 'decline', 'cancel'].includes(normalizedAction)) {
    const err = new Error('action must be accept, decline, or cancel');
    err.status = 400;
    throw err;
  }

  const row = await TeacherCollaboration.findById(collaborationId)
    .populate('primaryTeacher', 'name email')
    .populate('coTeacher', 'name email')
    .populate('initiatedBy', 'name email');

  if (!row) {
    const err = new Error('Collaboration request not found');
    err.status = 404;
    throw err;
  }

  const isParticipant =
    String(row.primaryTeacher?._id || row.primaryTeacher) === String(teacherId) ||
    String(row.coTeacher?._id || row.coTeacher) === String(teacherId);
  if (!isParticipant) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  if (row.status !== 'pending') {
    const err = new Error('This collaboration request is no longer pending');
    err.status = 400;
    throw err;
  }

  const initiatedByMe = String(row.initiatedBy?._id || row.initiatedBy) === String(teacherId);

  if (normalizedAction === 'cancel') {
    if (!initiatedByMe) {
      const err = new Error('Only the request sender can cancel');
      err.status = 403;
      throw err;
    }
    row.status = 'declined';
    await row.save();
    return row;
  }

  if (initiatedByMe) {
    const err = new Error('You cannot accept or decline your own request');
    err.status = 403;
    throw err;
  }

  if (normalizedAction === 'accept') {
    row.status = 'accepted';
    row.acceptedAt = new Date();
  } else {
    row.status = 'declined';
  }
  await row.save();
  return row;
}
