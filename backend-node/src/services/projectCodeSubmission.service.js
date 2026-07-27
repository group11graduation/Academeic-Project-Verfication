import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Assignment } from '../models/Assignment.js';
import * as proposalWorkflow from './proposalWorkflow.service.js';
import { evaluateProposalAgainstAssignmentRequirements } from './requirementCheck.service.js';
import { isProposalFullyApprovedForProject } from './collaborativeProposalReview.service.js';
import {
  executeZipExtractionBarrier,
  executeTechAuditBarrier,
  rmExtractDirSafe,
  flagSubmissionPipelineStatus,
  SubmissionPipelineError,
  SUBMISSION_PIPELINE_STATUSES,
  SUBMISSION_ERROR_CODES,
} from './submissionErrorHandler.service.js';
import {
  assertZipMatchesApprovedTechnology,
  approvedTechnologiesForProposal,
} from './projectTechMatch.service.js';
import { buildConsistencyEvidenceBundle } from './projectEvidenceBundle.service.js';
import { analyzeConsistencyPayload } from './aiClient.service.js';
import { PROJECT_DEADLINE_PASSED_MESSAGE } from './assignmentDeadline.service.js';
import { getUploadDir } from '../config/env.js';
import { normalizeProjectStackHint } from '../constants/projectStackHints.js';
import {
  notifySafe,
  notifyAssignmentTeachers,
} from './notification.service.js';
import { User } from '../models/User.js';
import { logger } from '../config/logger.js';

export function isProjectDeadlineOpen(assignment) {
  if (!assignment?.projectDeadline) return true;
  return new Date() <= new Date(assignment.projectDeadline);
}

function assertProjectDeadlineOpen(assignment) {
  if (!isProjectDeadlineOpen(assignment)) {
    const err = new Error(PROJECT_DEADLINE_PASSED_MESSAGE);
    err.status = 400;
    throw err;
  }
}

function normalizeZipExt(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext === '.zip' ? '.zip' : '.zip';
}

async function unlinkQuiet(absPath) {
  if (!absPath) return;
  await fs.unlink(absPath).catch(() => {});
}

async function persistProjectScreenshot(proposalId, file) {
  if (!file?.path) return null;

  const uploadsRoot = getUploadDir();
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

function normalizeConsistencyCheck(raw, { needsReview = false } = {}) {
  if (!raw || typeof raw !== 'object') {
    return {
      tech_match_score: null,
      description_match_score: null,
      tech_verdict: '',
      description_verdict: '',
      overall_verdict: '',
      needs_review: needsReview,
      checkedAt: new Date(),
    };
  }
  return {
    tech_match_score:
      typeof raw.tech_match_score === 'number' ? raw.tech_match_score : null,
    description_match_score:
      typeof raw.description_match_score === 'number' ? raw.description_match_score : null,
    tech_verdict: String(raw.tech_verdict || ''),
    description_verdict: String(raw.description_verdict || ''),
    overall_verdict: String(raw.overall_verdict || ''),
    needs_review: Boolean(needsReview || raw.overall_verdict === 'needs_review'),
    checkedAt: new Date(),
  };
}

function buildDeclaredTechMissingReason(declaredTech, detectedTech) {
  const detected = new Set(
    (detectedTech || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
  );
  const missing = (declaredTech || []).filter((t) => {
    const key = String(t || '').trim().toLowerCase();
    if (!key) return false;
    if (detected.has(key)) return false;
    // soft: substring / family overlap
    for (const d of detected) {
      if (d.includes(key) || key.includes(d)) return false;
    }
    return true;
  });
  if (!missing.length) {
    return 'Uploaded project technology does not match the technologies declared for this proposal.';
  }
  return (
    `Declared technologies not found in the uploaded project dependencies: ${missing.join(', ')}. ` +
    'Update your ZIP so it uses the approved stack, then try again.'
  );
}

async function upsertSubmissionRecord({
  primary,
  proposal,
  submittedByUserId,
  payload,
}) {
  if (primary) {
    primary.set(payload);
    primary.version = (primary.version || 1) + 1;
    await primary.save();
    return primary;
  }
  return ProjectSubmission.create({
    proposal: proposal._id,
    ...payload,
    version: 1,
  });
}

/**
 * One submission record per proposal.
 * ZIP stays on staging until the full gate accepts; only then rename to project-code/.
 */
async function upsertProjectZipForProposal(proposal, submittedByUserId, file, projectStackHint = '', screenshotFile = null) {
  if (!file?.path) {
    const err = new Error('No file uploaded');
    err.status = 400;
    throw err;
  }

  const stagingZipPath = file.path;
  let auditDir = null;
  let renamedToPermanent = false;

  const cleanupStaging = async () => {
    if (!renamedToPermanent) await unlinkQuiet(stagingZipPath);
  };

  try {
    const assignment = await Assignment.findById(proposal.assignment).lean();
    if (!assignment) {
      const err = new Error('Assignment not found');
      err.status = 404;
      throw err;
    }

    assertProjectDeadlineOpen(assignment);

    if (!isProposalFullyApprovedForProject(proposal, assignment)) {
      const err = new Error(
        assignment?.isCollaborative
          ? 'Both frontend and backend teachers must approve the proposal before submitting project code.'
          : 'Proposal must be teacher-approved before submitting project code.'
      );
      err.status = 400;
      throw err;
    }

    const reqCheck = await evaluateProposalAgainstAssignmentRequirements(assignment, proposal);
    if (!reqCheck.passed) {
      const err = new Error(`Project submission blocked: ${reqCheck.summary}`);
      err.status = 400;
      throw err;
    }

    const uploadsRoot = getUploadDir();
    const existingRows = await ProjectSubmission.find({ proposal: proposal._id }).sort({ createdAt: -1 });
    const primary = existingRows[0] || null;

    // Step 0d — block overwrite of an already-accepted submission
    if (primary?.pipelineStatus === SUBMISSION_PIPELINE_STATUSES.ACCEPTED) {
      const err = new Error(
        'This proposal already has an accepted project submission. Contact your teacher if you need to resubmit.'
      );
      err.status = 409;
      throw err;
    }

    for (const dup of existingRows.slice(1)) {
      if (dup.storedRelativePath) {
        await unlinkQuiet(path.join(uploadsRoot, dup.storedRelativePath));
      }
      await ProjectSubmission.deleteOne({ _id: dup._id });
    }

    const hint = normalizeProjectStackHint(projectStackHint);
    let screenshotRelativePath = primary?.screenshotRelativePath || '';
    if (screenshotFile) {
      screenshotRelativePath =
        (await persistProjectScreenshot(proposal._id, screenshotFile)) || screenshotRelativePath;
    }

    const baseMeta = {
      originalFilename: file.originalname || 'project.zip',
      mimeType: file.mimetype || 'application/zip',
      submittedBy: submittedByUserId,
      assignment: proposal.assignment,
      group: proposal.group || null,
      projectStackHint: hint,
      screenshotRelativePath,
    };

    auditDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholar-upload-audit-'));

    // 1) Extract staged ZIP (no permanent rename yet)
    try {
      await executeZipExtractionBarrier({
        zipAbs: stagingZipPath,
        destDir: auditDir,
        submissionId: primary?._id || null,
      });
    } catch (extractErr) {
      const message =
        extractErr?.publicError || extractErr?.message || 'Archive extraction failed.';
      await upsertSubmissionRecord({
        primary,
        proposal,
        submittedByUserId,
        payload: {
          ...baseMeta,
          storedRelativePath: '',
          sizeBytes: 0,
          pipelineStatus: SUBMISSION_PIPELINE_STATUSES.FAILED_EXTRACTION,
          pipelineUpdatedAt: new Date(),
          pipelineError: message,
          pipelineFailures: [{ rule: 'zip_extraction', message, path: '' }],
          consistencyCheck: normalizeConsistencyCheck(null),
        },
      });
      throw extractErr;
    }

    // 2) Rule-based tech match (unchanged helper) — reject before Python
    const techMatch = await assertZipMatchesApprovedTechnology({
      extractDir: auditDir,
      assignment,
      proposal,
      stackHint: hint,
    });

    if (!techMatch.ok) {
      const consistencyCheck = normalizeConsistencyCheck(null, { needsReview: false });
      const saved = await upsertSubmissionRecord({
        primary,
        proposal,
        submittedByUserId,
        payload: {
          ...baseMeta,
          storedRelativePath: '',
          sizeBytes: 0,
          pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
          pipelineUpdatedAt: new Date(),
          pipelineError: techMatch.message,
          pipelineFailures: [
            {
              rule: SUBMISSION_ERROR_CODES.TECH_MISMATCH_REJECTED,
              message: techMatch.message,
              path: techMatch.detectedStack || '',
            },
          ],
          consistencyCheck,
        },
      });

      return {
        accepted: false,
        reason: techMatch.message,
        isUpdate: Boolean(primary),
        verdict: 'rejected',
        consistencyCheck,
        techMatch,
        submission: saved.toObject ? saved.toObject() : saved,
      };
    }

    // 3) ML consistency check
    const declaredTech = approvedTechnologiesForProposal(assignment, proposal);
    const evidence = await buildConsistencyEvidenceBundle(auditDir);
    // Merge coarse stack families into detected_tech for Jaccard (deps alone may miss "php")
    const stackFamilies = techMatch.zipTech || [];
    const detectedTech = [...new Set([...(evidence.detected_tech || []), ...stackFamilies])];

    let consistencyRaw = null;
    try {
      consistencyRaw = await analyzeConsistencyPayload({
        proposal_description: [
          proposal.title || '',
          proposal.description || '',
          ...(Array.isArray(proposal.features) ? proposal.features : []),
        ]
          .filter(Boolean)
          .join('\n'),
        declared_tech: declaredTech,
        detected_tech: detectedTech,
        readme_text: evidence.readme_text || '',
        routes: evidence.routes || [],
        models: evidence.models || [],
      });
    } catch (aiErr) {
      logger.error(`[projectCodeSubmission] consistency AI unavailable: ${aiErr.message}`);
      const reason =
        'Consistency check unavailable, please try again. The AI analysis service did not respond.';
      const consistencyCheck = normalizeConsistencyCheck(
        {
          tech_match_score: null,
          description_match_score: null,
          tech_verdict: 'unavailable',
          description_verdict: 'unavailable',
          overall_verdict: 'reject',
        },
        { needsReview: false }
      );
      const saved = await upsertSubmissionRecord({
        primary,
        proposal,
        submittedByUserId,
        payload: {
          ...baseMeta,
          storedRelativePath: '',
          sizeBytes: 0,
          pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
          pipelineUpdatedAt: new Date(),
          pipelineError: reason,
          pipelineFailures: [
            {
              rule: 'consistency_unavailable',
              message: reason,
              path: '',
            },
          ],
          consistencyCheck,
        },
      });
      return {
        accepted: false,
        reason,
        isUpdate: Boolean(primary),
        verdict: 'rejected',
        consistencyCheck,
        techMatch: {
          ok: true,
          detectedStack: techMatch.detectedStack || '',
          approvedTech: techMatch.approvedTech || [],
          zipTech: techMatch.zipTech || [],
          message: techMatch.message || '',
        },
        submission: saved.toObject ? saved.toObject() : saved,
      };
    }

    const techVerdict = String(consistencyRaw?.tech_verdict || '').toLowerCase();
    const descVerdict = String(consistencyRaw?.description_verdict || '').toLowerCase();
    const overall = String(consistencyRaw?.overall_verdict || '').toLowerCase();

    // 4) Final decision
    if (techVerdict === 'mismatch' || overall === 'reject') {
      const reason = buildDeclaredTechMissingReason(declaredTech, detectedTech);
      const consistencyCheck = normalizeConsistencyCheck(consistencyRaw, { needsReview: false });
      const saved = await upsertSubmissionRecord({
        primary,
        proposal,
        submittedByUserId,
        payload: {
          ...baseMeta,
          storedRelativePath: '',
          sizeBytes: 0,
          pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
          pipelineUpdatedAt: new Date(),
          pipelineError: reason,
          pipelineFailures: [
            {
              rule: 'consistency_tech_mismatch',
              message: reason,
              path: '',
            },
          ],
          consistencyCheck,
        },
      });
      return {
        accepted: false,
        reason,
        isUpdate: Boolean(primary),
        verdict: 'rejected',
        consistencyCheck,
        techMatch: {
          ok: true,
          detectedStack: techMatch.detectedStack || '',
          approvedTech: techMatch.approvedTech || declaredTech,
          zipTech: detectedTech,
          message: reason,
        },
        submission: saved.toObject ? saved.toObject() : saved,
      };
    }

    const needsReview = descVerdict === 'mismatch' || overall === 'needs_review';
    const consistencyCheck = normalizeConsistencyCheck(consistencyRaw, { needsReview });

    // ACCEPT — rename staging → permanent project-code/
    const relDir = path.join('project-code', String(proposal._id));
    const destDir = path.join(uploadsRoot, relDir);
    await fs.mkdir(destDir, { recursive: true });

    const ext = normalizeZipExt(file.originalname);
    const storedRelativePath = path.join(relDir, `project${ext}`).replace(/\\/g, '/');
    const destPath = path.join(uploadsRoot, storedRelativePath);

    if (primary?.storedRelativePath) {
      const oldAbs = path.join(uploadsRoot, primary.storedRelativePath);
      if (oldAbs !== destPath) await unlinkQuiet(oldAbs);
    }

    try {
      const dirFiles = await fs.readdir(destDir);
      for (const name of dirFiles) {
        if (name !== path.basename(storedRelativePath)) {
          await unlinkQuiet(path.join(destDir, name));
        }
      }
    } catch {
      /* ignore */
    }

    try {
      await fs.rename(stagingZipPath, destPath);
    } catch {
      await fs.copyFile(stagingZipPath, destPath);
      await unlinkQuiet(stagingZipPath);
    }
    renamedToPermanent = true;

    const stat = await fs.stat(destPath);
    const saved = await upsertSubmissionRecord({
      primary,
      proposal,
      submittedByUserId,
      payload: {
        ...baseMeta,
        storedRelativePath,
        sizeBytes: stat.size,
        pipelineStatus: '',
        pipelineUpdatedAt: new Date(),
        pipelineError: '',
        pipelineFailures: [],
        consistencyCheck,
      },
    });

    const submissionId = saved._id;

    // Structure/security audit only after permanent save
    await executeTechAuditBarrier({
      extractDir: auditDir,
      submissionId,
      stackHint: hint,
      assignment,
    });
    await flagSubmissionPipelineStatus(submissionId, SUBMISSION_PIPELINE_STATUSES.ACCEPTED, {
      consistencyCheck,
    });

    const submission = saved.toObject ? saved.toObject() : saved;
    submission.pipelineStatus = SUBMISSION_PIPELINE_STATUSES.ACCEPTED;
    submission.consistencyCheck = consistencyCheck;

    let studentName = 'A student';
    try {
      const u = await User.findById(submittedByUserId).select('name').lean();
      if (u?.name) studentName = u.name;
    } catch {
      /* ignore */
    }
    notifySafe(() =>
      notifyAssignmentTeachers(assignment, {
        type: 'project_uploaded',
        title: primary ? 'Project ZIP updated' : 'Project ZIP uploaded',
        body: `${studentName} uploaded a project for "${assignment.title || 'assignment'}".`,
        link: `/teacher/assignments/${assignment._id}/proposals/${proposal._id}`,
        meta: {
          assignmentId: String(assignment._id),
          proposalId: String(proposal._id),
          submissionId: String(submissionId),
        },
      })
    );

    return {
      accepted: true,
      reason: '',
      isUpdate: Boolean(primary),
      verdict: needsReview ? 'needs_review' : 'accepted',
      consistencyCheck,
      techMatch: {
        ok: true,
        detectedStack: techMatch.detectedStack || '',
        approvedTech: techMatch.approvedTech || declaredTech,
        zipTech: detectedTech,
        message:
          techMatch.message ||
          (needsReview
            ? 'Project accepted but flagged for teacher review (description vs code consistency).'
            : 'Project ZIP technology matches the approved proposal.'),
      },
      submission,
    };
  } catch (e) {
    if (e instanceof SubmissionPipelineError) throw e;
    throw e;
  } finally {
    await rmExtractDirSafe(auditDir);
    await cleanupStaging();
  }
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
  const assignment = await Assignment.findById(assignmentId).lean();
  if (!isProposalFullyApprovedForProject(proposal, assignment)) {
    const err = new Error(
      assignment?.isCollaborative
        ? 'Both teachers must approve the proposal before uploading a project screenshot.'
        : 'Proposal must be teacher-approved before uploading a project screenshot.'
    );
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

  if (!primary.storedRelativePath || primary.pipelineStatus !== SUBMISSION_PIPELINE_STATUSES.ACCEPTED) {
    const err = new Error('Upload an accepted project ZIP first, then add a UI screenshot for the verified gallery.');
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
