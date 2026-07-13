import mongoose from 'mongoose';
import path from 'path';
import { CollaborativeAssignmentDraft } from '../models/CollaborativeAssignmentDraft.js';
import { assertActiveCollaboration } from './teacherCollaboration.service.js';
import {
  createCollaborativeAssignment,
  isTechSectionComplete,
} from './collaborativeAssignment.service.js';
import { parseObjectIdList } from './assignmentTeacher.service.js';

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function teacherCanAccessDraft(draft, teacherId) {
  const tid = idOf(teacherId);
  if (!tid) return false;
  return [draft.initiatedBy, draft.coTeacherId, draft.frontendTeacherId, draft.backendTeacherId].some(
    (field) => idOf(field) === tid
  );
}

function assertDraftParticipant(draft, teacherId) {
  if (!teacherCanAccessDraft(draft, teacherId)) {
    const err = new Error('You do not have access to this collaborative draft');
    err.status = 403;
    throw err;
  }
}

function formatDraftRow(row) {
  if (!row) return null;
  const doc = row.toObject ? row.toObject() : row;
  return {
    ...doc,
    frontendSectionComplete: isTechSectionComplete(doc.frontendTechRequirements),
    backendSectionComplete: isTechSectionComplete(doc.backendTechRequirements),
    readyToPublish:
      Boolean(doc.title?.trim()) &&
      isTechSectionComplete(doc.frontendTechRequirements) &&
      isTechSectionComplete(doc.backendTechRequirements) &&
      (doc.classes?.length > 0 || doc.class),
  };
}

export async function listCollaborativeDraftsForTeacher(teacherId) {
  if (!teacherId || !mongoose.Types.ObjectId.isValid(String(teacherId))) return [];
  const tid = new mongoose.Types.ObjectId(String(teacherId));
  const rows = await CollaborativeAssignmentDraft.find({
    status: 'draft',
    $or: [{ initiatedBy: tid }, { coTeacherId: tid }, { frontendTeacherId: tid }, { backendTeacherId: tid }],
  })
    .populate('initiatedBy', 'name email')
    .populate('coTeacherId', 'name email')
    .populate('frontendTeacherId', 'name email')
    .populate('backendTeacherId', 'name email')
    .populate('class', 'code name')
    .populate('classes', 'code name')
    .populate('subject', 'code name')
    .sort({ updatedAt: -1 })
    .lean();

  return rows.map((row) => formatDraftRow(row));
}

export async function getCollaborativeDraftForTeacher(teacherId, draftId) {
  const row = await CollaborativeAssignmentDraft.findById(draftId)
    .populate('initiatedBy', 'name email')
    .populate('coTeacherId', 'name email')
    .populate('frontendTeacherId', 'name email')
    .populate('backendTeacherId', 'name email')
    .populate('class', 'code name')
    .populate('classes', 'code name')
    .populate('subject', 'code name')
    .populate('semester', 'name')
    .populate('academicYear', 'label');

  if (!row || row.status !== 'draft') {
    const err = new Error('Collaborative draft not found');
    err.status = 404;
    throw err;
  }
  assertDraftParticipant(row, teacherId);
  return formatDraftRow(row);
}

/**
 * Start a draft: pick co-teacher and whether the logged-in teacher owns frontend or backend.
 */
export async function createCollaborativeDraft(teacherId, { coTeacherId, myRole }) {
  if (!coTeacherId) {
    const err = new Error('coTeacherId is required');
    err.status = 400;
    throw err;
  }
  const role = String(myRole || '').trim().toLowerCase();
  if (!['frontend', 'backend'].includes(role)) {
    const err = new Error('myRole must be frontend or backend');
    err.status = 400;
    throw err;
  }
  if (String(teacherId) === String(coTeacherId)) {
    const err = new Error('You cannot collaborate with yourself');
    err.status = 400;
    throw err;
  }

  await assertActiveCollaboration(teacherId, coTeacherId);

  const frontendTeacherId = role === 'frontend' ? teacherId : coTeacherId;
  const backendTeacherId = role === 'backend' ? teacherId : coTeacherId;

  const doc = await CollaborativeAssignmentDraft.create({
    initiatedBy: teacherId,
    coTeacherId,
    frontendTeacherId,
    backendTeacherId,
  });

  return getCollaborativeDraftForTeacher(teacherId, doc._id);
}

export async function updateCollaborativeDraft(teacherId, draftId, payload = {}) {
  const draft = await CollaborativeAssignmentDraft.findById(draftId);
  if (!draft || draft.status !== 'draft') {
    const err = new Error('Collaborative draft not found');
    err.status = 404;
    throw err;
  }
  assertDraftParticipant(draft, teacherId);

  const {
    classId,
    classIds,
    subjectId,
    semesterId,
    academicYearId,
    title,
    description,
    submissionMode,
    proposalDeadline,
    projectDeadline,
    frontendTechRequirements,
    backendTechRequirements,
  } = payload;

  const selectedClassIds = [...new Set(parseObjectIdList(classIds).concat(classId ? [String(classId)] : []))];
  if (selectedClassIds.length) {
    draft.class = new mongoose.Types.ObjectId(selectedClassIds[0]);
    draft.classes = selectedClassIds.map((id) => new mongoose.Types.ObjectId(id));
  }
  if (subjectId) draft.subject = new mongoose.Types.ObjectId(subjectId);
  if (semesterId) draft.semester = new mongoose.Types.ObjectId(semesterId);
  if (academicYearId) draft.academicYear = new mongoose.Types.ObjectId(academicYearId);
  if (title !== undefined) draft.title = String(title || '').trim();
  if (description !== undefined) draft.description = String(description || '').trim();
  if (submissionMode) draft.submissionMode = submissionMode;
  if (proposalDeadline !== undefined) draft.proposalDeadline = proposalDeadline ? new Date(proposalDeadline) : null;
  if (projectDeadline !== undefined) draft.projectDeadline = projectDeadline ? new Date(projectDeadline) : null;

  if (frontendTechRequirements !== undefined) {
    if (idOf(draft.frontendTeacherId) !== idOf(teacherId)) {
      const err = new Error('Only the frontend teacher can update frontend requirements');
      err.status = 403;
      throw err;
    }
    draft.frontendTechRequirements = {
      ...draft.frontendTechRequirements?.toObject?.() || draft.frontendTechRequirements || {},
      ...frontendTechRequirements,
    };
    draft.frontendSectionComplete = isTechSectionComplete(draft.frontendTechRequirements);
  }

  if (backendTechRequirements !== undefined) {
    if (idOf(draft.backendTeacherId) !== idOf(teacherId)) {
      const err = new Error('Only the backend teacher can update backend requirements');
      err.status = 403;
      throw err;
    }
    draft.backendTechRequirements = {
      ...draft.backendTechRequirements?.toObject?.() || draft.backendTechRequirements || {},
      ...backendTechRequirements,
    };
    draft.backendSectionComplete = isTechSectionComplete(draft.backendTechRequirements);
  }

  await draft.save();
  return getCollaborativeDraftForTeacher(teacherId, draft._id);
}

export async function uploadCollaborativeDraftSectionFile(teacherId, draftId, section, file) {
  if (!file) {
    const err = new Error('requirements file is required');
    err.status = 400;
    throw err;
  }
  const sectionKey = String(section || '').trim().toLowerCase();
  if (!['frontend', 'backend'].includes(sectionKey)) {
    const err = new Error('section must be frontend or backend');
    err.status = 400;
    throw err;
  }

  const draft = await CollaborativeAssignmentDraft.findById(draftId);
  if (!draft || draft.status !== 'draft') {
    const err = new Error('Collaborative draft not found');
    err.status = 404;
    throw err;
  }
  assertDraftParticipant(draft, teacherId);

  const ownerField = sectionKey === 'frontend' ? 'frontendTeacherId' : 'backendTeacherId';
  if (idOf(draft[ownerField]) !== idOf(teacherId)) {
    const err = new Error(`Only the ${sectionKey} teacher can upload this requirements file`);
    err.status = 403;
    throw err;
  }

  const relPath = path.posix.join('assignment-requirements', path.basename(file.filename));
  const blockField = sectionKey === 'frontend' ? 'frontendTechRequirements' : 'backendTechRequirements';
  const completeField = sectionKey === 'frontend' ? 'frontendSectionComplete' : 'backendSectionComplete';

  draft[blockField] = {
    ...draft[blockField]?.toObject?.() || draft[blockField] || {},
    requirementFile: relPath,
    originalFileName: file.originalname || '',
  };
  draft[completeField] = isTechSectionComplete(draft[blockField]);
  await draft.save();
  return getCollaborativeDraftForTeacher(teacherId, draft._id);
}

export async function publishCollaborativeDraft(teacherId, draftId) {
  const draft = await CollaborativeAssignmentDraft.findById(draftId);
  if (!draft || draft.status !== 'draft') {
    const err = new Error('Collaborative draft not found');
    err.status = 404;
    throw err;
  }
  assertDraftParticipant(draft, teacherId);

  if (!draft.title?.trim()) {
    const err = new Error('Title is required before publishing');
    err.status = 400;
    throw err;
  }
  const classIds = (draft.classes?.length ? draft.classes : draft.class ? [draft.class] : []).map(String);
  if (!classIds.length || !draft.subject) {
    const err = new Error('Select at least one class and a subject before publishing');
    err.status = 400;
    throw err;
  }
  if (!isTechSectionComplete(draft.frontendTechRequirements)) {
    const err = new Error('Frontend teacher must complete their requirements section first');
    err.status = 400;
    throw err;
  }
  if (!isTechSectionComplete(draft.backendTechRequirements)) {
    const err = new Error('Backend teacher must complete their requirements section first');
    err.status = 400;
    throw err;
  }

  const assignment = await createCollaborativeAssignment(draft.initiatedBy, {
    coTeacherId: draft.coTeacherId,
    frontendTeacherId: draft.frontendTeacherId,
    backendTeacherId: draft.backendTeacherId,
    classId: classIds[0],
    classIds,
    subjectId: draft.subject,
    semesterId: draft.semester,
    academicYearId: draft.academicYear,
    title: draft.title,
    description: draft.description,
    submissionMode: draft.submissionMode,
    proposalDeadline: draft.proposalDeadline,
    projectDeadline: draft.projectDeadline,
    frontendTechRequirements: draft.frontendTechRequirements,
    backendTechRequirements: draft.backendTechRequirements,
  });

  draft.status = 'published';
  draft.publishedAssignmentId = assignment._id;
  draft.frontendSectionComplete = true;
  draft.backendSectionComplete = true;
  await draft.save();

  return assignment;
}

/** Either collaborating teacher may delete an unpublished draft. */
export async function deleteCollaborativeDraft(teacherId, draftId) {
  const draft = await CollaborativeAssignmentDraft.findById(draftId);
  if (!draft || draft.status !== 'draft') {
    const err = new Error('Collaborative draft not found');
    err.status = 404;
    throw err;
  }
  assertDraftParticipant(draft, teacherId);
  await CollaborativeAssignmentDraft.deleteOne({ _id: draft._id });
  return { deleted: true, draftId: String(draft._id) };
}
