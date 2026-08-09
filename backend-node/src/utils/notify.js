import nodemailer from 'nodemailer';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';
import { logger } from '../config/logger.js';

let cachedTransporter = null;

/**
 * Resolve SMTP settings from EMAIL_* (preferred) or legacy SMTP_* env vars.
 */
export function resolveSmtpConfig() {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || '';
  const user = process.env.EMAIL_USER || process.env.SMTP_USER || '';
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.EMAIL_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
    port === 465;

  if (!host || !user || !pass) return null;

  return { host, port, secure, user, pass };
}

function getTransporter() {
  const cfg = resolveSmtpConfig();
  if (!cfg) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });

  return cachedTransporter;
}

/** Map free-form type labels onto allowed Notification enum values. */
export function normalizeNotificationType(type) {
  const raw = String(type || 'SYSTEM').trim();
  if (NOTIFICATION_TYPES.includes(raw)) return raw;

  const upper = raw.toUpperCase();
  if (upper === 'ASSIGNMENT' || upper === 'PROPOSAL' || upper === 'SYSTEM') {
    return upper;
  }

  const lower = raw.toLowerCase();
  if (NOTIFICATION_TYPES.includes(lower)) return lower;

  return 'SYSTEM';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildNotificationEmailHtml({ title, message, senderName, link }) {
  const appName = process.env.APP_NAME || 'ScholarVerify';
  const frontend =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    (process.env.CORS_ORIGINS || '').split(',')[0]?.trim() ||
    '';
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
  const safeSender = escapeHtml(senderName || appName);
  const rawLink = String(link || '').trim();
  let actionUrl = '';
  if (rawLink) {
    if (/^https?:\/\//i.test(rawLink)) actionUrl = rawLink;
    else if (frontend) actionUrl = `${String(frontend).replace(/\/$/, '')}${rawLink.startsWith('/') ? '' : '/'}${rawLink}`;
  }

  const cta = actionUrl
    ? `<p style="margin:24px 0 0;">
         <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">
           Open in ${escapeHtml(appName)}
         </a>
       </p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#0f766e;padding:20px 28px;">
                <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#ccfbf1;">${escapeHtml(appName)}</p>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:600;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${safeMessage}</p>
                ${cta}
                <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
                  This alert was sent by <strong style="color:#0f172a;">${safeSender}</strong>.
                  You can also review it in your ${escapeHtml(appName)} notification center (admin, teacher, or student dashboard).
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  You are receiving this email because you have an account on ${escapeHtml(appName)}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

/**
 * Send a notification email only (no DB write).
 * Never throws — failures are logged so APIs always stay healthy.
 */
export async function sendNotificationEmail({
  to,
  title,
  message,
  senderName,
  senderEmail,
  link = '',
  notificationId = null,
} = {}) {
  const recipientEmail = String(to || '').trim().toLowerCase();
  if (!recipientEmail) return false;

  const appName = process.env.APP_NAME || 'ScholarVerify';
  const displaySender = String(senderName || appName).trim() || appName;
  const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER || '';
  const trimmedTitle = String(title || '').trim() || 'Notification';
  const bodyText = String(message || '').trim() || trimmedTitle;

  const transporter = getTransporter();
  if (!transporter || !smtpUser) {
    logger.warn(
      `[notify] Email skipped for ${recipientEmail}${notificationId ? ` (notification ${notificationId})` : ''}: SMTP not configured`
    );
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${displaySender}" <${smtpUser}>`,
      to: recipientEmail,
      replyTo: senderEmail || smtpUser,
      subject: `${appName}: ${trimmedTitle}`.slice(0, 200),
      text: bodyText,
      html: buildNotificationEmailHtml({
        title: trimmedTitle,
        message: bodyText,
        senderName: displaySender,
        link,
      }),
    });
    logger.info(
      `[notify] Email sent to ${recipientEmail}${notificationId ? ` for notification ${notificationId}` : ''}`
    );
    return true;
  } catch (err) {
    logger.error(
      `[notify] Email failed for ${recipientEmail}${notificationId ? ` (notification ${notificationId})` : ''}: ${err?.message || err}`
    );
    return false;
  }
}

/**
 * Dual notification: persist in-app record, then email the recipient.
 * Email failures are logged only — never thrown — so API handlers stay stable.
 */
export async function sendNotification({
  recipientUser,
  senderName,
  senderEmail,
  title,
  message,
  type = 'SYSTEM',
  link = '',
  meta = {},
} = {}) {
  const recipientId = recipientUser?._id || recipientUser?.id;
  const trimmedTitle = String(title || '').trim();
  if (!recipientId || !trimmedTitle) {
    logger.warn('[notify] sendNotification skipped: missing recipient or title');
    return null;
  }

  const bodyText = String(message || '').trim();
  const dbType = normalizeNotificationType(type);

  let notification = null;
  try {
    notification = await Notification.create({
      user: recipientId,
      type: dbType,
      title: trimmedTitle.slice(0, 200),
      body: bodyText.slice(0, 1000),
      link: String(link || '').trim().slice(0, 500),
      meta: meta && typeof meta === 'object' ? meta : {},
      isRead: false,
      readAt: null,
    });
  } catch (err) {
    logger.error(`[notify] Failed to save in-app notification: ${err?.message || err}`);
    throw err;
  }

  await sendNotificationEmail({
    to: recipientUser?.email,
    title: trimmedTitle,
    message: bodyText || trimmedTitle,
    senderName,
    senderEmail,
    link,
    notificationId: notification._id,
  });

  return notification.toObject ? notification.toObject() : notification;
}

/** True when EMAIL_* / SMTP_* credentials are present. */
export function isNotificationEmailEnabled() {
  return Boolean(resolveSmtpConfig());
}
