import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as assignmentStudent from '../services/assignmentStudent.service.js';
import * as proposalWorkflow from '../services/proposalWorkflow.service.js';
import * as projectCodeSubmission from '../services/projectCodeSubmission.service.js';
import * as normalAssignmentSubmission from '../services/normalAssignmentSubmission.service.js';
import * as studentProfile from '../services/studentProfile.service.js';

export const profile = asyncHandler(async (req, res) => {
  const data = await studentProfile.getProfileForStudent(req.userId);
  return success(res, data);
});

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

export const parseProposalFile = asyncHandler(async (req, res) => {
  const parsed = await proposalWorkflow.parseUploadedProposalFile(req.file, { cleanup: true });
  return success(res, { parsed });
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
  const hint = req.body?.projectStackHint || req.body?.projectType || '';
  const zipFile = req.files?.codeArchive?.[0];
  const screenshotFile = req.files?.projectScreenshot?.[0];
  if (!zipFile) return fail(res, 'Project ZIP file (codeArchive) is required.', 400);

  const result = await projectCodeSubmission.submitProjectZip(
    req.userId,
    req.params.assignmentId,
    zipFile,
    hint,
    screenshotFile || null
  );
  const status = result.isUpdate ? 200 : 201;
  return success(
    res,
    {
      ...result.submission,
      isUpdate: result.isUpdate,
      verdict: result.verdict || 'accepted',
      techMatch: result.techMatch || null,
      message:
        result.techMatch?.message ||
        (result.isUpdate ? 'Project ZIP updated and accepted.' : 'Project ZIP uploaded and accepted.'),
    },
    status
  );
});

export const submitProjectScreenshot = asyncHandler(async (req, res) => {
  const result = await projectCodeSubmission.submitProjectScreenshotOnly(
    req.userId,
    req.params.assignmentId,
    req.file
  );
  return success(res, result.submission, 200);
});

export const submitNormalAssignment = asyncHandler(async (req, res) => {
  const rec = await normalAssignmentSubmission.submitNormalAssignmentFile(
    req.userId,
    req.params.assignmentId,
    req.file
  );
  return success(res, rec, 201);
});
