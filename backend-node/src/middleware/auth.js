import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { fail } from '../utils/apiResponse.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return fail(res, 'Authentication required', 401);
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    const payload = jwt.verify(token, secret);
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.roles = payload.roles || [payload.role];
    next();
  } catch {
    return fail(res, 'Invalid or expired token', 401);
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
