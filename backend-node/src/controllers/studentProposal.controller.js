import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as assignmentStudent from '../services/assignmentStudent.service.js';
import * as proposalWorkflow from '../services/proposalWorkflow.service.js';
import * as projectCodeSubmission from '../services/projectCodeSubmission.service.js';

export const dashboard = asyncHandler(async (req, res) => {
  const assignments = await assignmentStudent.listAssignmentsWithProposalsForStudent(req.userId);
  return success(res, { assignments });
});

export const listAssignments = asyncHandler(async (req, res) => {
  const data = await assignmentStudent.getStudentAssignmentsOverview(req.userId);
  return success(res, data);
});

export const getAssignment = asyncHandler(async (req, res) => {
  const data = await assignmentStudent.getAssignmentDetailForStudent(req.userId, req.params.assignmentId);
  return success(res, data);
});

export const submitProposal = asyncHandler(async (req, res) => {
  const result = await proposalWorkflow.upsertAndSubmitProposal(
    req.userId,
    req.params.assignmentId,
    req.body,
    req.file || null
  );
  return success(res, result);
});

export const getProposal = asyncHandler(async (req, res) => {
  const p = await proposalWorkflow.getProposalForStudent(req.userId, req.params.proposalId);
  return success(res, p);
});

export const projectAccess = asyncHandler(async (req, res) => {
  const data = await proposalWorkflow.canAccessProjectSubmission(req.userId, req.params.assignmentId);
  return success(res, data);
});

export const submitProjectCode = asyncHandler(async (req, res) => {
  const rec = await projectCodeSubmission.submitProjectZip(req.userId, req.params.assignmentId, req.file);
  return success(res, rec, 201);
});
