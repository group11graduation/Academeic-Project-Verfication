import { logger } from '../config/logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error(err.message || err, err.stack || '');
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    return res.status(status).json({ success: false, message, stack: err.stack });
  }
  return res.status(status).json({ success: false, message });
}
