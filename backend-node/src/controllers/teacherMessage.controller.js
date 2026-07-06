import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as studentTeacherMessage from '../services/studentTeacherMessage.service.js';

export const listMessages = asyncHandler(async (req, res) => {
  const rows = await studentTeacherMessage.listTeacherMessages(req.userId, {
    status: req.query.status || undefined,
    assignmentId: req.query.assignmentId || undefined,
  });
  return success(res, rows);
});

export const openCount = asyncHandler(async (req, res) => {
  const count = await studentTeacherMessage.countOpenTeacherMessages(req.userId);
  return success(res, { count });
});

export const replyMessage = asyncHandler(async (req, res) => {
  const row = await studentTeacherMessage.replyToStudentMessage(req.userId, req.params.messageId, {
    reply: req.body?.reply,
    close: Boolean(req.body?.close),
  });
  return success(res, row);
});

export const getMessage = asyncHandler(async (req, res) => {
  const row = await studentTeacherMessage.getMessageForTeacher(req.userId, req.params.messageId);
  return success(res, row);
});
