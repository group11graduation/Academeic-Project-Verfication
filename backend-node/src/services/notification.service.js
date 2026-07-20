import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Class } from '../models/Class.js';
import { Enrollment } from '../models/Enrollment.js';

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

/** Fire-and-forget — never blocks or fails the parent workflow. */
export function notifySafe(task) {
  Promise.resolve()
    .then(() => task())
    .catch((err) => {
      console.error('[notifications]', err?.message || err);
    });
}

export async function createNotification({ userId, type = 'system', title, body = '', link = '', meta = {} }) {
  const user = toId(userId);
  if (!user || !String(title || '').trim()) return null;
  return Notification.create({
    user,
    type,
    title: String(title).trim().slice(0, 200),
    body: String(body || '').trim().slice(0, 1000),
    link: String(link || '').trim().slice(0, 500),
    meta: meta && typeof meta === 'object' ? meta : {},
  });
}

export async function createNotificationsForUsers(userIds, payload) {
  const ids = uniqueIds(userIds);
  if (!ids.length) return [];
  const docs = ids.map((user) => ({
    user,
    type: payload.type || 'system',
    title: String(payload.title || '').trim().slice(0, 200),
    body: String(payload.body || '').trim().slice(0, 1000),
    link: String(payload.link || '').trim().slice(0, 500),
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
  }));
  return Notification.insertMany(docs, { ordered: false });
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

export async function notifyAssignmentTeachers(assignment, payload) {
  const ids = assignmentTeacherIds(assignment);
  if (!ids.length) return [];
  return createNotificationsForUsers(ids, payload);
}

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

export async function listNotifications(userId, { limit = 40, unreadOnly = false } = {}) {
  const user = toId(userId);
  if (!user) return [];
  const filter = { user };
  if (unreadOnly) filter.readAt = null;
  const rows = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 40)))
    .lean();
  return rows.map((row) => ({
    ...row,
    id: row._id,
    unread: !row.readAt,
  }));
}

export async function countUnread(userId) {
  const user = toId(userId);
  if (!user) return 0;
  return Notification.countDocuments({ user, readAt: null });
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
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();
  if (!doc) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  return { ...doc, id: doc._id, unread: false };
}

export async function markAllNotificationsRead(userId) {
  const user = toId(userId);
  if (!user) return { modified: 0 };
  const result = await Notification.updateMany(
    { user, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { modified: result.modifiedCount || 0 };
}
