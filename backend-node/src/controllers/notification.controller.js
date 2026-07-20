import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as notifications from '../services/notification.service.js';

export const listMine = asyncHandler(async (req, res) => {
  const unreadOnly = String(req.query.unreadOnly || '') === '1' || req.query.unreadOnly === 'true';
  const limit = Number(req.query.limit) || 40;
  const data = await notifications.listNotifications(req.userId, { limit, unreadOnly });
  return success(res, data);
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await notifications.countUnread(req.userId);
  return success(res, { count });
});

export const markRead = asyncHandler(async (req, res) => {
  const row = await notifications.markNotificationRead(req.userId, req.params.id);
  return success(res, row);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notifications.markAllNotificationsRead(req.userId);
  return success(res, result);
});
