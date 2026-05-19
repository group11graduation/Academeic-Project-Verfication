import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Assignment } from '../models/Assignment.js';
import { Proposal } from '../models/Proposal.js';
import * as proposalWorkflow from './proposalWorkflow.service.js';
import { evaluateProposalAgainstAssignmentRequirements } from './requirementCheck.service.js';

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

/**
 * One submission record per proposal; re-upload replaces the file and bumps version (same MongoDB id).
 */
async function upsertProjectZipForProposal(proposal, submittedByUserId, file) {
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
  const payload = {
    storedRelativePath,
    originalFilename: file.originalname || `project${ext}`,
    sizeBytes: stat.size,
    mimeType: file.mimetype || 'application/zip',
    submittedBy: submittedByUserId,
    assignment: proposal.assignment,
    group: proposal.group || null,
  };

  if (primary) {
    primary.set(payload);
    primary.version = (primary.version || 1) + 1;
    await primary.save();
    return { submission: primary.toObject ? primary.toObject() : primary, isUpdate: true };
  }

  const rec = await ProjectSubmission.create({
    proposal: proposal._id,
    ...payload,
    version: 1,
  });
  return { submission: rec.toObject ? rec.toObject() : rec, isUpdate: false };
}

export async function submitProjectZip(userId, assignmentId, file) {
  const access = await proposalWorkflow.canAccessProjectSubmission(userId, assignmentId);
  if (!access.allowed) {
    const err = new Error(access.reason);
    err.status = 403;
    throw err;
  }

  return upsertProjectZipForProposal(access.proposal, userId, file);
}

export async function getLatestSubmissionForProposal(proposalId) {
  return ProjectSubmission.findOne({ proposal: proposalId }).sort({ createdAt: -1 }).lean();
}
