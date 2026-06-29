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

  if (err.code === SUBMISSION_ERROR_CODES.RUNTIME_ERROR) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.publicError || err.message || 'Preview runtime error.',
      code: SUBMISSION_ERROR_CODES.RUNTIME_ERROR,
      sessionId: err.sessionId || null,
    });
  }

  return res.status(err.status || 400).json({
    success: false,
    error: err.publicError || err.message,
    code: err.code,
  });
}
