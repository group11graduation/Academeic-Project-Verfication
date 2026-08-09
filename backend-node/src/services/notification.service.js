import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import { Enrollment } from '../models/Enrollment.js';
import {
  sendNotificationEmail,
  normalizeNotificationType,
  isNotificationEmailEnabled,
} from '../utils/notify.js';
import { logger } from '../config/logger.js';

const EMAIL_BATCH_SIZE = 8;

function toId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'object' && value._id) return toId(value._id);
  const s = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

function uniqueIds(values = []) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    const id = toId(v);
    if (!id) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

function defaultSender() {
  return {
    senderName: process.env.APP_NAME || 'ScholarVerify',
    senderEmail: process.env.EMAIL_USER || process.env.SMTP_USER || '',
  };
}

/**
 * After in-app rows are saved, email every recipient who has an address.
 * Never throws — safe for every admin / teacher / student workflow.
 */
async function deliverEmailsForNotificationDocs(docs, { senderName, senderEmail } = {}) {
  if (!docs?.length || !isNotificationEmailEnabled()) return;

  const defaults = defaultSender();
  const fromName = senderName || defaults.senderName;
  const replyTo = senderEmail || defaults.senderEmail;

  const userIds = uniqueIds(docs.map((d) => d.user));
  if (!userIds.length) return;

  let users = [];
  try {
    users = await User.find({ _id: { $in: userIds }, isActive: { $ne: false } })
      .select('_id email name')
      .lean();
  } catch (err) {
    logger.error(`[notifications] Failed to load recipients for email: ${err?.message || err}`);
    return;
  }

  const byId = new Map(users.map((u) => [String(u._id), u]));
  const jobs = [];

  for (const doc of docs) {
    const plain = doc?.toObject ? doc.toObject() : doc;
    const uid = String(plain.user);
    const recipient = byId.get(uid);
    if (!recipient?.email) continue;

    jobs.push({
      to: recipient.email,
      title: plain.title,
      message: plain.body || plain.title,
      link: plain.link || '',
      notificationId: plain._id,
      senderName: fromName,
      senderEmail: replyTo,
    });
  }

  for (let i = 0; i < jobs.length; i += EMAIL_BATCH_SIZE) {
    const batch = jobs.slice(i, i + EMAIL_BATCH_SIZE);
    await Promise.allSettled(batch.map((job) => sendNotificationEmail(job)));
  }
}

/** Fire-and-forget - never blocks or fails the parent workflow. */
export function notifySafe(task) {
  Promise.resolve()
    .then(() => task())
    .catch((err) => {
      logger.error(`[notifications] ${err?.message || err}`);
    });
}

/**
 * Create one in-app notification and email the recipient (admin / teacher / student).
 * Pass `email: false` to skip mail (rare).
 */
export async function createNotification({
  userId,
  type = 'system',
  title,
  body = '',
  link = '',
  meta = {},
  senderName,
  senderEmail,
  email = true,
} = {}) {
  const user = toId(userId);
  if (!user || !String(title || '').trim()) return null;

  const doc = await Notification.create({
    user,
    type: normalizeNotificationType(type),
    title: String(title).trim().slice(0, 200),
    body: String(body || '').trim().slice(0, 1000),
    link: String(link || '').trim().slice(0, 500),
    meta: meta && typeof meta === 'object' ? meta : {},
    isRead: false,
    readAt: null,
  });

  if (email !== false) {
    await deliverEmailsForNotificationDocs([doc], { senderName, senderEmail });
  }

  return doc;
}

/**
 * Batch in-app notifications + dual email for every recipient with an email address.
 * Used for class-wide student alerts, all teachers on an assignment, all admins, etc.
 */
export async function createNotificationsForUsers(userIds, payload = {}) {
  const ids = uniqueIds(userIds);
  if (!ids.length) return [];

  const title = String(payload.title || '').trim().slice(0, 200);
  if (!title) return [];

  const body = String(payload.body || '').trim().slice(0, 1000);
  const link = String(payload.link || '').trim().slice(0, 500);
  const type = normalizeNotificationType(payload.type || 'system');
  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};

  const docs = ids.map((user) => ({
    user,
    type,
    title,
    body,
    link,
    meta,
    isRead: false,
    readAt: null,
  }));

  let inserted = [];
  try {
    inserted = await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    // insertMany with ordered:false may still insert some docs and throw BulkWriteError
    if (err?.insertedDocs?.length) {
      inserted = err.insertedDocs;
      logger.warn(`[notifications] Partial bulk insert: ${err.message || err}`);
    } else {
      throw err;
    }
  }

  if (payload.email !== false) {
    await deliverEmailsForNotificationDocs(inserted, {
      senderName: payload.senderName,
      senderEmail: payload.senderEmail,
    });
  }

  return inserted;
}

export function assignmentTeacherIds(assignment) {
  if (!assignment) return [];
  return uniqueIds([
    assignment.teacher,
    assignment.coTeacherId,
    assignment.frontendTeacherId,
    assignment.backendTeacherId,
  ]);
}

/** Teachers on an assignment (in-app + email). */
export async function notifyAssignmentTeachers(assignment, payload) {
  const ids = assignmentTeacherIds(assignment);
  if (!ids.length) return [];
  return createNotificationsForUsers(ids, payload);
}

/** Students enrolled / profile-linked to the given classes (in-app + email). */
export async function notifyStudentUsersInClasses(classIds, payload) {
  const ids = uniqueIds(classIds);
  if (!ids.length) return [];

  const classes = await Class.find({ _id: { $in: ids } }).select('code').lean();
  const codes = classes.map((c) => String(c.code || '').trim().toUpperCase()).filter(Boolean);

  const [enrollments, profiles] = await Promise.all([
    Enrollment.find({ class: { $in: ids } }).select('student').lean(),
    codes.length
      ? StudentProfile.find({ classCode: { $in: codes } }).select('user').lean()
      : Promise.resolve([]),
  ]);

  const studentUserIds = uniqueIds([
    ...enrollments.map((e) => e.student),
    ...profiles.map((p) => p.user),
  ]);

  return createNotificationsForUsers(studentUserIds, payload);
}

/** All active admins (in-app + email). */
export async function notifyAllAdmins(payload) {
  const admins = await User.find({
    isActive: true,
    $or: [{ role: 'admin' }, { roles: 'admin' }],
  })
    .select('_id')
    .lean();
  return createNotificationsForUsers(
    admins.map((a) => a._id),
    payload
  );
}

function shapeNotification(row) {
  if (!row) return null;
  const isRead = Boolean(row.isRead || row.readAt);
  return {
    ...row,
    id: row._id,
    recipient: row.user,
    message: row.body,
    isRead,
    unread: !isRead,
  };
}

function unreadFilter(user) {
  return {
    user,
    $or: [{ isRead: false }, { isRead: { $exists: false }, readAt: null }, { readAt: null }],
  };
}

export async function listNotifications(userId, { limit = 40, unreadOnly = false } = {}) {
  const user = toId(userId);
  if (!user) return [];
  const filter = unreadOnly ? unreadFilter(user) : { user };
  const rows = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 40)))
    .lean();
  return rows.map(shapeNotification);
}

export async function countUnread(userId) {
  const user = toId(userId);
  if (!user) return 0;
  return Notification.countDocuments(unreadFilter(user));
}

export async function markNotificationRead(userId, notificationId) {
  const user = toId(userId);
  const id = toId(notificationId);
  if (!user || !id) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  const doc = await Notification.findOneAndUpdate(
    { _id: id, user },
    { $set: { readAt: new Date(), isRead: true } },
    { new: true }
  ).lean();
  if (!doc) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  return shapeNotification(doc);
}

export async function markAllNotificationsRead(userId) {
  const user = toId(userId);
  if (!user) return { modified: 0 };
  const result = await Notification.updateMany(unreadFilter(user), {
    $set: { readAt: new Date(), isRead: true },
  });
  return { modified: result.modifiedCount || 0 };
}
