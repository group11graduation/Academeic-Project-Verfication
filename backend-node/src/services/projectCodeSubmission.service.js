import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Assignment } from '../models/Assignment.js';
import { Proposal } from '../models/Proposal.js';
import * as proposalWorkflow from './proposalWorkflow.service.js';
import { evaluateProposalAgainstAssignmentRequirements } from './requirementCheck.service.js';
import {
  executeZipExtractionBarrier,
  executeTechAuditBarrier,
  rmExtractDirSafe,
  flagSubmissionPipelineStatus,
  SubmissionPipelineError,
  SUBMISSION_PIPELINE_STATUSES,
} from './submissionErrorHandler.service.js';

export function isProjectDeadlineOpen(assignment) {
  if (!assignment?.projectDeadline) return true;
  return new Date() <= new Date(assignment.projectDeadline);
}

function assertProjectDeadlineOpen(assignment) {
  if (!isProjectDeadlineOpen(assignment)) {
    const err = new Error('Project submission deadline has passed. You can no longer upload or update.');
    err.status = 400;
    throw err;
  }
}

function normalizeZipExt(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext === '.zip' ? '.zip' : '.zip';
}

async function persistProjectScreenshot(proposalId, file) {
  if (!file?.path) return null;

  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const relDir = path.join('project-screenshots', String(proposalId));
  const destDir = path.join(uploadsRoot, relDir);
  await fs.mkdir(destDir, { recursive: true });

  const ext = path.extname(file.originalname || '').toLowerCase();
  const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
  const storedRelativePath = path.join(relDir, `screenshot${safeExt}`).replace(/\\/g, '/');
  const destPath = path.join(uploadsRoot, storedRelativePath);

  try {
    const existing = await fs.readdir(destDir);
    for (const name of existing) {
      if (name.startsWith('screenshot')) {
        await fs.unlink(path.join(destDir, name)).catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }

  try {
    await fs.rename(file.path, destPath);
  } catch {
    await fs.copyFile(file.path, destPath);
    await fs.unlink(file.path).catch(() => {});
  }

  return storedRelativePath;
}

/**
 * One submission record per proposal; re-upload replaces the file and bumps version (same MongoDB id).
 */
async function upsertProjectZipForProposal(proposal, submittedByUserId, file, projectStackHint = '', screenshotFile = null) {
  if (!file?.path) {
    const err = new Error('No file uploaded');
    err.status = 400;
    throw err;
  }

  const assignment = await Assignment.findById(proposal.assignment).lean();
  if (!assignment) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }

  assertProjectDeadlineOpen(assignment);

  if (proposal.status !== 'teacher_approved') {
    const err = new Error('Proposal must be teacher-approved before submitting project code.');
    err.status = 400;
    throw err;
  }

  const reqCheck = evaluateProposalAgainstAssignmentRequirements(assignment, proposal);
  if (!reqCheck.passed) {
    const err = new Error(`Project submission blocked: ${reqCheck.summary}`);
    err.status = 400;
    throw err;
  }

  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const relDir = path.join('project-code', String(proposal._id));
  const destDir = path.join(uploadsRoot, relDir);
  await fs.mkdir(destDir, { recursive: true });

  const ext = normalizeZipExt(file.originalname);
  const storedRelativePath = path.join(relDir, `project${ext}`).replace(/\\/g, '/');
  const destPath = path.join(uploadsRoot, storedRelativePath);

  const existingRows = await ProjectSubmission.find({ proposal: proposal._id }).sort({ createdAt: -1 });
  const primary = existingRows[0] || null;

  for (const dup of existingRows.slice(1)) {
    if (dup.storedRelativePath) {
      const dupPath = path.join(uploadsRoot, dup.storedRelativePath);
      await fs.unlink(dupPath).catch(() => {});
    }
    await ProjectSubmission.deleteOne({ _id: dup._id });
  }

  if (primary?.storedRelativePath) {
    const oldAbs = path.join(uploadsRoot, primary.storedRelativePath);
    if (oldAbs !== destPath) {
      await fs.unlink(oldAbs).catch(() => {});
    }
  }

  try {
    const dirFiles = await fs.readdir(destDir);
    for (const name of dirFiles) {
      if (name !== path.basename(storedRelativePath)) {
        await fs.unlink(path.join(destDir, name)).catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }

  try {
    await fs.rename(file.path, destPath);
  } catch {
    await fs.copyFile(file.path, destPath);
    await fs.unlink(file.path).catch(() => {});
  }

  const stat = await fs.stat(destPath);
  const hint =
    projectStackHint && ['static-html', 'static-html-js'].includes(projectStackHint) ? projectStackHint : '';

  let screenshotRelativePath = primary?.screenshotRelativePath || '';
  if (screenshotFile) {
    screenshotRelativePath = (await persistProjectScreenshot(proposal._id, screenshotFile)) || screenshotRelativePath;
  }

  const payload = {
    storedRelativePath,
    originalFilename: file.originalname || `project${ext}`,
    sizeBytes: stat.size,
    mimeType: file.mimetype || 'application/zip',
    submittedBy: submittedByUserId,
    assignment: proposal.assignment,
    group: proposal.group || null,
    projectStackHint: hint,
    pipelineStatus: '',
    pipelineFailures: [],
    pipelineError: '',
    screenshotRelativePath,
  };

  let saved;
  if (primary) {
    primary.set(payload);
    primary.version = (primary.version || 1) + 1;
    await primary.save();
    saved = primary;
  } else {
    saved = await ProjectSubmission.create({
      proposal: proposal._id,
      ...payload,
      version: 1,
    });
  }

  const submissionId = saved._id;
  const auditDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholar-upload-audit-'));
  try {
    await executeZipExtractionBarrier({
      zipAbs: destPath,
      destDir: auditDir,
      submissionId,
    });
    await executeTechAuditBarrier({
      extractDir: auditDir,
      submissionId,
      stackHint: hint,
      assignment,
    });
    await flagSubmissionPipelineStatus(submissionId, SUBMISSION_PIPELINE_STATUSES.ACCEPTED);
  } catch (e) {
    await rmExtractDirSafe(auditDir);
    if (e instanceof SubmissionPipelineError) throw e;
    throw e;
  } finally {
    await rmExtractDirSafe(auditDir);
  }

  const submission = saved.toObject ? saved.toObject() : saved;
  return { submission, isUpdate: Boolean(primary) };
}

export async function submitProjectZip(userId, assignmentId, file, projectStackHint = '', screenshotFile = null) {
  const access = await proposalWorkflow.canAccessProjectSubmission(userId, assignmentId);
  if (!access.allowed) {
    const err = new Error(access.reason);
    err.status = 403;
    throw err;
  }

  return upsertProjectZipForProposal(access.proposal, userId, file, projectStackHint, screenshotFile);
}

export async function submitProjectScreenshotOnly(userId, assignmentId, screenshotFile) {
  if (!screenshotFile?.path) {
    const err = new Error('Screenshot image is required.');
    err.status = 400;
    throw err;
  }

  const access = await proposalWorkflow.canAccessProjectSubmission(userId, assignmentId);
  if (!access.allowed) {
    const err = new Error(access.reason);
    err.status = 403;
    throw err;
  }

  const proposal = access.proposal;
  if (proposal.status !== 'teacher_approved') {
    const err = new Error('Proposal must be teacher-approved before uploading a project screenshot.');
    err.status = 400;
    throw err;
  }

  const screenshotRelativePath = await persistProjectScreenshot(proposal._id, screenshotFile);
  const primary = await ProjectSubmission.findOne({ proposal: proposal._id }).sort({ createdAt: -1 });

  if (!primary) {
    const err = new Error('Upload your project ZIP first, then add a UI screenshot for the verified gallery.');
    err.status = 400;
    throw err;
  }

  primary.screenshotRelativePath = screenshotRelativePath;
  await primary.save();

  return { submission: primary.toObject ? primary.toObject() : primary };
}

export async function getLatestSubmissionForProposal(proposalId) {
  return ProjectSubmission.findOne({ proposal: proposalId }).sort({ createdAt: -1 }).lean();
}
