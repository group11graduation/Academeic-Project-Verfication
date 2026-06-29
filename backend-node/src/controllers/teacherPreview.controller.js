import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as previewSandbox from '../services/previewSandbox.service.js';

const ALLOWED_PREVIEW_STACKS = new Set(['node-js', 'php-apache', 'jupyter', 'static-html', 'static-html-js']);

export const startPreview = asyncHandler(async (req, res) => {
  const rawStack = req.body?.stack || req.query?.stack;
  const stack = ALLOWED_PREVIEW_STACKS.has(rawStack) ? rawStack : null;
  const session = await previewSandbox.startPreviewForProposal(req.userId, req.params.proposalId, {
    stack,
    adminEmail: req.body?.adminEmail,
    adminPassword: req.body?.adminPassword,
  });
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
