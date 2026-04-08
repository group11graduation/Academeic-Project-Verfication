import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as previewSandbox from '../services/previewSandbox.service.js';

export const startPreview = asyncHandler(async (req, res) => {
  const session = await previewSandbox.startPreviewForProposal(req.userId, req.params.proposalId);
  return success(res, previewSandbox.toPublicSession(session), 201);
});

export const stopPreview = asyncHandler(async (req, res) => {
  const session = await previewSandbox.stopPreviewForTeacher(req.userId, req.params.sessionId);
  return success(res, previewSandbox.toPublicSession(session));
});

export const getPreviewSession = asyncHandler(async (req, res) => {
  const session = await previewSandbox.getPreviewSessionForTeacher(req.userId, req.params.sessionId);
  return success(res, session);
});
