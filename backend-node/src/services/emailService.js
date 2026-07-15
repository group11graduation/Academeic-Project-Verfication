import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';

let cachedTransporter = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!smtpConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

export function getFrontendBaseUrl() {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    (process.env.CORS_ORIGINS || '').split(',')[0]?.trim() ||
    'http://localhost:5173';
  return String(raw).replace(/\/$/, '');
}

export function buildPasswordResetUrl(rawToken) {
  const base = getFrontendBaseUrl();
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Send password reset email. Returns true if sent, false if SMTP unavailable or send failed.
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const transporter = getTransporter();
  if (!transporter || !to) return false;

  const appName = process.env.APP_NAME || 'Project Verify';
  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER || `noreply@${process.env.SMTP_HOST || 'localhost'}`;
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
      <h2 style="color:#1d4ed8;margin-bottom:8px;">${appName} — password reset</h2>
      <p>${greeting}</p>
      <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
      <p style="margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;">
          Reset password
        </a>
      </p>
      <p style="font-size:13px;color:#64748b;">If the button does not work, copy this link into your browser:</p>
      <p style="font-size:13px;word-break:break-all;color:#475569;">${resetUrl}</p>
      <p style="font-size:13px;color:#64748b;margin-top:24px;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const text = `${greeting}\n\nReset your ${appName} password (expires in 30 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `${appName} — reset your password`,
      text,
      html,
    });
    logger.info(`[email] Password reset sent to ${to}`);
    return true;
  } catch (err) {
    logger.error(`[email] Password reset failed for ${to}: ${err.message || err}`);
    return false;
  }
}

export function isEmailDeliveryEnabled() {
  return smtpConfigured();
}
