import { logger } from '../config/logger.js';

export function errorHandler(err, req, res, _next) {
  const message =
    (err && typeof err.message === 'string' && err.message.trim()) ||
    (typeof err === 'string' ? err : '') ||
    'Internal server error';
  logger.error(message, err?.stack || err);
  const status = err?.status || err?.statusCode || 500;
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    return res.status(status).json({ success: false, message, error: message, stack: err.stack });
  }
  return res.status(status).json({ success: false, message, error: message });
}
