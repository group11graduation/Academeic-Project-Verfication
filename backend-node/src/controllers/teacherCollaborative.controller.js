import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import { createCollaborativeAssignment as persistCollaborativeAssignment } from '../services/collaborativeAssignment.service.js';
import {
  createCollaborativeDraft,
  getCollaborativeDraftForTeacher,
  listCollaborativeDraftsForTeacher,
  publishCollaborativeDraft,
  updateCollaborativeDraft,
  uploadCollaborativeDraftSectionFile,
} from '../services/collaborativeAssignmentDraft.service.js';
import {
  countIncomingPendingCollaborations,
  listAcceptedCollaboratorsForTeacher,
  listCollaborationsForTeacher,
  listTeachersAvailableForCollaboration,
  requestCollaboration,
  respondToCollaboration,
} from '../services/teacherCollaboration.service.js';

/**
 * GET /teacher/collaborations
 * Incoming/outgoing pending requests and accepted partners.
 */
export const listCollaborations = asyncHandler(async (req, res) => {
  const data = await listCollaborationsForTeacher(req.userId);
  return success(res, data);
});

/**
 * GET /teacher/collaborations/teachers
 * Teachers the logged-in user can invite (same class or all active teachers).
 */
export const listCollaborationCandidates = asyncHandler(async (req, res) => {
  const rows = await listTeachersAvailableForCollaboration(req.userId, {
    classId: req.query.classId || null,
  });
  return success(res, rows);
});

/**
 * GET /teacher/collaborations/pending-count
 */
export const collaborationPendingCount = asyncHandler(async (req, res) => {
  const count = await countIncomingPendingCollaborations(req.userId);
  return success(res, { count });
});

/**
 * POST /teacher/collaborations/request
 * Body: { targetTeacherId, classId, subjectId, myRole, notes? }
 */
export const sendCollaborationRequest = asyncHandler(async (req, res) => {
  const { targetTeacherId, notes, classId, subjectId, myRole } = req.body || {};
  if (!targetTeacherId) return fail(res, 'targetTeacherId is required', 400);
  const row = await requestCollaboration(req.userId, targetTeacherId, {
    notes,
    classId,
    subjectId,
    myRole,
  });
  return success(res, row, 201);
});

/**
 * PATCH /teacher/collaborations/:id/respond
 * Body: { action: 'accept' | 'decline' | 'cancel' }
 */
export const respondCollaborationRequest = asyncHandler(async (req, res) => {
  const { action } = req.body || {};
  const row = await respondToCollaboration(req.userId, req.params.id, action);
  return success(res, row);
});

/**
 * GET /teacher/collaborations/accepted
 * Returns teachers the logged-in teacher may select as co-teacher.
 */
export const listAcceptedCollaborators = asyncHandler(async (req, res) => {
  const rows = await listAcceptedCollaboratorsForTeacher(req.userId);
  return success(res, rows);
});

/**
 * POST /teacher/assignments/collaborative
 * Single-form creation of a dual-teacher assignment (primary = logged-in teacher).
 */
export const createCollaborativeAssignment = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (typeof payload.frontendTechRequirements === 'string') {
    try {
      payload.frontendTechRequirements = JSON.parse(payload.frontendTechRequirements);
    } catch {
      return fail(res, 'frontendTechRequirements must be valid JSON', 400);
    }
  }
  if (typeof payload.backendTechRequirements === 'string') {
    try {
      payload.backendTechRequirements = JSON.parse(payload.backendTechRequirements);
    } catch {
      return fail(res, 'backendTechRequirements must be valid JSON', 400);
    }
  }

  const row = await persistCollaborativeAssignment(req.userId, payload);
  return success(res, row, 201);
});

export const listCollaborativeDrafts = asyncHandler(async (req, res) => {
  const rows = await listCollaborativeDraftsForTeacher(req.userId);
  return success(res, rows);
});

export const getCollaborativeDraft = asyncHandler(async (req, res) => {
  const row = await getCollaborativeDraftForTeacher(req.userId, req.params.id);
  return success(res, row);
});

export const createCollaborativeDraftHandler = asyncHandler(async (req, res) => {
  const { coTeacherId, myRole } = req.body || {};
  if (!coTeacherId) return fail(res, 'coTeacherId is required', 400);
  const row = await createCollaborativeDraft(req.userId, { coTeacherId, myRole });
  return success(res, row, 201);
});

export const updateCollaborativeDraftHandler = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (typeof payload.frontendTechRequirements === 'string') {
    try {
      payload.frontendTechRequirements = JSON.parse(payload.frontendTechRequirements);
    } catch {
      return fail(res, 'frontendTechRequirements must be valid JSON', 400);
    }
  }
  if (typeof payload.backendTechRequirements === 'string') {
    try {
      payload.backendTechRequirements = JSON.parse(payload.backendTechRequirements);
    } catch {
      return fail(res, 'backendTechRequirements must be valid JSON', 400);
    }
  }
  const row = await updateCollaborativeDraft(req.userId, req.params.id, payload);
  return success(res, row);
});

export const uploadCollaborativeDraftSectionFileHandler = asyncHandler(async (req, res) => {
  const section = req.body?.section || req.query?.section;
  const row = await uploadCollaborativeDraftSectionFile(req.userId, req.params.id, section, req.file);
  return success(res, row);
});

export const publishCollaborativeDraftHandler = asyncHandler(async (req, res) => {
  const row = await publishCollaborativeDraft(req.userId, req.params.id);
  return success(res, row, 201);
});
