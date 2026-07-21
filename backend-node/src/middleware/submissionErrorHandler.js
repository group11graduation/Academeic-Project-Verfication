import { logger } from '../config/logger.js';
import {
  SubmissionPipelineError,
  SUBMISSION_ERROR_CODES,
  formatStudentExtractionResponse,
  formatTechAuditResponse,
} from '../services/submissionErrorHandler.service.js';

/**
 * Express error middleware — isolates ZIP / tech-audit / preview-runtime failures
 * so a single bad submission cannot crash the API process.
 *
 * Mount after routes (before or merged with global errorHandler).
 */
export function submissionErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (!(err instanceof SubmissionPipelineError)) {
    return next(err);
  }

  logger.warn(`[submissionPipeline] ${err.code}: ${err.message}`, {
    path: req.originalUrl,
    submissionId: err.submissionId,
    sessionId: err.sessionId,
  });

  if (err.code === SUBMISSION_ERROR_CODES.FAILED_EXTRACTION) {
    return res.status(err.status || 400).json(formatStudentExtractionResponse(err));
  }

  if (err.code === SUBMISSION_ERROR_CODES.TECH_AUDIT_REJECTED) {
    return res.status(err.status || 422).json(formatTechAuditResponse(err));
  }

  if (err.code === SUBMISSION_ERROR_CODES.TECH_MISMATCH_REJECTED) {
    const message = err.publicError || err.message || 'Project ZIP does not match the approved proposal technology.';
    return res.status(err.status || 400).json({
      success: false,
      message,
      error: message,
      code: SUBMISSION_ERROR_CODES.TECH_MISMATCH_REJECTED,
      verdict: 'rejected',
      reason: 'technology_mismatch',
      failures: err.failures || [],
      approvedTech: err.failures?.[0]?.approvedTech || [],
      zipTech: err.failures?.[0]?.zipTech || [],
      detectedStack: err.failures?.[0]?.path || '',
    });
  }

  if (err.code === SUBMISSION_ERROR_CODES.RUNTIME_ERROR) {
    const message = err.publicError || err.message || 'Preview runtime error.';
    return res.status(err.status || 500).json({
      success: false,
      message,
      error: message,
      code: SUBMISSION_ERROR_CODES.RUNTIME_ERROR,
      sessionId: err.sessionId || null,
    });
  }

  const fallback = err.publicError || err.message || 'Upload failed.';
  return res.status(err.status || 400).json({
    success: false,
    message: fallback,
    error: fallback,
    code: err.code,
    verdict: 'rejected',
  });
}
