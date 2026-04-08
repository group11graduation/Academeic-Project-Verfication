import fs from 'fs/promises';
import path from 'path';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import * as proposalWorkflow from './proposalWorkflow.service.js';

/**
 * Save uploaded ZIP and record submission. Requires same gates as project phase access
 * plus an approved proposal (per product rules: code only after approval).
 */
export async function submitProjectZip(userId, assignmentId, file) {
  if (!file?.path) {
    const err = new Error('No file uploaded');
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
    const err = new Error('Your proposal must be teacher-approved before submitting project code.');
    err.status = 400;
    throw err;
  }

  const relDir = path.join('project-code', String(proposal._id));
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const destDir = path.join(uploadsRoot, relDir);
  await fs.mkdir(destDir, { recursive: true });
  const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.zip`;
  const destPath = path.join(destDir, finalName);

  try {
    await fs.rename(file.path, destPath);
  } catch {
    await fs.copyFile(file.path, destPath);
    await fs.unlink(file.path).catch(() => {});
  }

  const stat = await fs.stat(destPath);
  const storedRelativePath = path.join(relDir, finalName).replace(/\\/g, '/');

  const rec = await ProjectSubmission.create({
    proposal: proposal._id,
    assignment: proposal.assignment,
    submittedBy: userId,
    group: proposal.group || null,
    storedRelativePath,
    originalFilename: file.originalname || finalName,
    sizeBytes: stat.size,
  });

  return rec;
}

export async function getLatestSubmissionForProposal(proposalId) {
  return ProjectSubmission.findOne({ proposal: proposalId }).sort({ createdAt: -1 }).lean();
}
