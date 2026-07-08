import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { fail } from '../utils/apiResponse.js';
import { getJwtSecret } from '../config/auth.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return fail(res, 'Authentication required', 401);
  }
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const primaryRole = String(payload.role || '').trim().toLowerCase();
    const parsedRoles = Array.isArray(payload.roles)
      ? payload.roles.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const roles = parsedRoles.length > 0
      ? [...new Set(parsedRoles)]
      : primaryRole
        ? [primaryRole]
        : [];
    req.userId = payload.sub;
    req.userRole = primaryRole;
    req.roles = roles;
    next();
  } catch (err) {
    const message =
      err?.name === 'TokenExpiredError'
        ? 'Session expired — please sign in again'
        : 'Invalid or expired token';
    return fail(res, message, 401);
  }
}

export async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('+passwordHash');
    if (!user || !user.isActive) {
      return fail(res, 'User not found or inactive', 401);
    }
    req.user = user;
    next();
  } catch (e) {
    return fail(res, 'Authentication failed', 401);
  }
}

/**
 * @param {string[]} allowed Any of these roles (or extra roles on user) grants access
 */
export function requireRoles(...allowed) {
  return (req, res, next) => {
    const roles = req.roles || [];
    const ok = allowed.some((r) => roles.includes(r));
    if (!ok) {
      return fail(res, 'Forbidden', 403);
    }
    next();
  };
}
