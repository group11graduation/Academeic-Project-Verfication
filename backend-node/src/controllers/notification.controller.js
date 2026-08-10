import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as notifications from '../services/notification.service.js';
import { User } from '../models/User.js';
import {
  resolveSmtpConfig,
  verifyEmailTransport,
  sendNotificationEmail,
  isNotificationEmailEnabled,
} from '../utils/notify.js';

/** GET /api/notifications — all notifications for the authenticated user, newest first. */
export const listMine = asyncHandler(async (req, res) => {
  const unreadOnly = String(req.query.unreadOnly || '') === '1' || req.query.unreadOnly === 'true';
  const limit = Number(req.query.limit) || 40;
  const data = await notifications.listNotifications(req.userId, { limit, unreadOnly });
  return success(res, data);
});

/** GET /api/notifications/unread-count */
export const unreadCount = asyncHandler(async (req, res) => {
  const count = await notifications.countUnread(req.userId);
  return success(res, { count });
});

/**
 * GET /api/notifications/email-status?verify=1
 * Diagnose whether Gmail/SMTP is configured and optionally verify login.
 */
export const emailStatus = asyncHandler(async (req, res) => {
  const cfg = resolveSmtpConfig();
  let verify = null;
  if (String(req.query.verify || '') === '1' || req.query.verify === 'true') {
    verify = await verifyEmailTransport();
  }
  return success(res, {
    configured: Boolean(cfg),
    host: cfg?.host || null,
    port: cfg?.port || null,
    user: cfg?.user || null,
    secure: cfg ? cfg.secure : null,
    appName: process.env.APP_NAME || 'ScholarVerify',
    frontendUrl: process.env.FRONTEND_URL || null,
    verify,
  });
});

/**
 * POST /api/notifications/test-email
 * Body: { to?: string } — defaults to the logged-in user's email.
 */
export const testEmail = asyncHandler(async (req, res) => {
  if (!isNotificationEmailEnabled()) {
    return fail(
      res,
      'Email is not configured on the server. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in backend-node/runtime.env and restart.',
      503
    );
  }

  const me = await User.findById(req.userId).select('email name').lean();
  const to = String(req.body?.to || me?.email || '')
    .trim()
    .toLowerCase();
  if (!to) {
    return fail(
      res,
      'No recipient email. Set one on your user account or pass { "to": "you@example.com" }.',
      400
    );
  }

  const sent = await sendNotificationEmail({
    to,
    title: 'ScholarVerify email test',
    message:
      `This is a test notification email sent at ${new Date().toISOString()}.\n` +
      'If you received this, assignment and system emails will work for accounts that have a valid email.',
    senderName: process.env.APP_NAME || 'ScholarVerify',
    link: '/teacher/assignments',
  });

  if (!sent) {
    return fail(
      res,
      'SMTP rejected the message. Check server logs for [notify] Email failed (auth, network, or Gmail block).',
      502
    );
  }

  return success(res, { sent: true, to });
});

/** PATCH /api/notifications/:id/read */
export const markRead = asyncHandler(async (req, res) => {
  const row = await notifications.markNotificationRead(req.userId, req.params.id);
  return success(res, row);
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notifications.markAllNotificationsRead(req.userId);
  return success(res, result);
});
