import { logger } from '../config/logger.js';

function humanizeMongooseMessage(err) {
  if (!err) return null;

  if (err.name === 'ValidationError' && err.errors && typeof err.errors === 'object') {
    const parts = Object.values(err.errors).map((e) => {
      const path = String(e?.path || 'field')
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .toLowerCase();
      const kind = e?.kind || '';
      if (kind === 'required') return `Please provide a valid ${path}.`;
      if (kind === 'enum') {
        return `The ${path} value is not allowed. Choose one of the supported options.`;
      }
      if (kind === 'min' || kind === 'max' || kind === 'minmax') {
        return `The ${path} value is out of the allowed range.`;
      }
      const msg = String(e?.message || '').trim();
      if (msg) {
        return msg
          .replace(/^Path `[^`]+`\s*/i, '')
          .replace(/`/g, '')
          .replace(/\bis required\b/i, `is required for ${path}`)
          .trim();
      }
      return `There is a problem with ${path}.`;
    });
    if (parts.length) return parts.join(' ');
  }

  if (err.name === 'CastError') {
    const path = String(err.path || 'value')
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
    return `The ${path || 'submitted'} value is invalid. Refresh the page and try again.`;
  }

  if (err.code === 11000) {
    return 'This record already exists. Refresh and try again, or contact support.';
  }

  return null;
}

export function errorHandler(err, req, res, _next) {
  const human = humanizeMongooseMessage(err);
  const message =
    human ||
    (err && typeof err.message === 'string' && err.message.trim()) ||
    (typeof err === 'string' ? err : '') ||
    'Internal server error';

  logger.error(message, err?.stack || err);

  let status = err?.status || err?.statusCode || 500;
  if (!err?.status && !err?.statusCode) {
    if (err?.name === 'ValidationError' || err?.name === 'CastError') status = 400;
    else if (err?.code === 11000) status = 409;
  }

  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    return res.status(status).json({ success: false, message, error: message, stack: err.stack });
  }
  return res.status(status).json({ success: false, message, error: message });
}
