import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as previewSandbox from '../services/previewSandbox.service.js';

const ALLOWED_PREVIEW_STACKS = new Set([
  'node-js',
  'node-js-mysql',
  'php-apache',
  'laravel-react-mysql',
  'jupyter',
  'static-html',
  'static-html-js',
  'java-spring-react',
  'java-spring-thymeleaf',
]);

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
  try {
    const session = await previewSandbox.getPreviewSessionForTeacher(req.userId, req.params.sessionId);
    return success(res, session);
  } catch (err) {
    // Network blips / docker inspect races during Start preview must not 500 the poller.
    if (err?.status === 404 || err?.status === 403) throw err;
    console.error('[preview-session] get failed:', err?.message || err);
    const fallback = {
      _id: req.params.sessionId,
      status: 'starting',
      errorMessage: null,
      logs: [
        {
          level: 'warn',
          message: 'Preview status temporarily unavailable — retrying…',
          at: new Date(),
        },
      ],
    };
    return success(res, fallback);
  }
});

export const getActivePreviewForProposal = asyncHandler(async (req, res) => {
  const session = await previewSandbox.getActivePreviewSessionForProposal(req.userId, req.params.proposalId);
  return success(res, session);
});
