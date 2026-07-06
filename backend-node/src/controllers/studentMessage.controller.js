import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as studentTeacherMessage from '../services/studentTeacherMessage.service.js';

export const listMyMessages = asyncHandler(async (req, res) => {
  const assignmentId = req.query.assignmentId || null;
  const rows = await studentTeacherMessage.listStudentMessages(req.userId, { assignmentId });
  return success(res, rows);
});

export const createMessage = asyncHandler(async (req, res) => {
  const row = await studentTeacherMessage.createStudentMessage(req.userId, {
    assignmentId: req.body?.assignmentId || req.params.assignmentId,
    category: req.body?.category,
    subject: req.body?.subject,
    message: req.body?.message,
    deadlineType: req.body?.deadlineType,
    recipientTarget: req.body?.recipientTarget,
  });
  return success(res, row, 201);
});

export const getMessage = asyncHandler(async (req, res) => {
  const row = await studentTeacherMessage.getMessageForStudent(req.userId, req.params.messageId);
  return success(res, row);
});
