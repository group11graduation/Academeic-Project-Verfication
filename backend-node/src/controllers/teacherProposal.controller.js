import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as assignmentTeacher from '../services/assignmentTeacher.service.js';
import * as proposalWorkflow from '../services/proposalWorkflow.service.js';

export const getCatalog = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.getTeacherCatalog(req.userId);
  return success(res, data);
});

export const listMyClasses = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listClassesForTeacher(req.userId);
  return success(res, data);
});

export const listAssignments = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listAssignmentsForTeacher(req.userId);
  return success(res, data);
});

export const getAssignment = asyncHandler(async (req, res) => {
  const row = await assignmentTeacher.getAssignmentForTeacher(req.userId, req.params.id);
  if (!row) return fail(res, 'Not found', 404);
  return success(res, row);
});

export const createAssignment = asyncHandler(async (req, res) => {
  const row = await assignmentTeacher.createAssignment(req.userId, req.body);
  return success(res, row, 201);
});

export const listProposals = asyncHandler(async (req, res) => {
  const data = await proposalWorkflow.listProposalsForTeacher(req.userId, req.params.assignmentId || null);
  return success(res, data);
});

export const reviewProposal = asyncHandler(async (req, res) => {
  const p = await proposalWorkflow.teacherReviewProposal(req.userId, req.params.proposalId, req.body);
  return success(res, p);
});

export const listGroups = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listGroupsForAssignment(req.userId, req.params.assignmentId);
  return success(res, data);
});

export const createGroup = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.createGroupForAssignment(req.userId, req.params.assignmentId, req.body);
  return success(res, data, 201);
});
