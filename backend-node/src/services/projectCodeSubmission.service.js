import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { LegacyProject } from '../models/LegacyProject.js';
import { Proposal } from '../models/Proposal.js';
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
import {
  buildLightFunctionalityEvidence,
} from './projectEvidenceBundle.service.js';
import { scoreProposalZipFunctionality, isFunctionalityMatchEnabled } from './projectFunctionalityMatch.service.js';
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
import { toProjectSubmissionClient } from './projectSubmissionSummary.service.js';
import {
  MIN_PROJECT_SCREENSHOTS,
  MAX_PROJECT_SCREENSHOTS,
} from '../middleware/projectArtifactsUpload.js';

/**
 * Legacy = strong TITLE identity only (filename / package name).
 * Keep high so unrelated ZIPs fall through to the "not related to proposal" gate.
 */
const LEGACY_ZIP_REJECT_THRESHOLD = Number(process.env.LEGACY_ZIP_REJECT_THRESHOLD || 0.78);
/** Generic words that must not alone prove "already exists in system". */
const LEGACY_TITLE_STOPWORDS = new Set([
  'system',
  'systems',
  'project',
  'projects',
  'app',
  'apps',
  'application',
  'applications',
  'web',
  'website',
  'api',
  'apis',
  'platform',
  'platforms',
  'management',
  'manage',
  'manager',
  'service',
  'services',
  'comprehensive',
  'based',
  'using',
  'online',
  'portal',
  'tool',
  'tools',
  'main',
  'final',
  'code',
  'soft',
  'software',
  'solution',
  'solutions',
  'module',
  'modules',
  'data',
  'info',
  'information',
  'student',
  'students',
  'school',
  'university',
]);
/** Hard cap for optional ML consistency (only when ENABLE_PROJECT_CONSISTENCY_CHECK=true). */
const CONSISTENCY_HARD_DEADLINE_MS = Number(process.env.AI_CONSISTENCY_HARD_DEADLINE_MS || 10000);
/** Default OFF so ZIP upload never waits on AI / cannot hang the request. */
function isConsistencyCheckEnabled() {
  return String(process.env.ENABLE_PROJECT_CONSISTENCY_CHECK || 'false').toLowerCase() === 'true';
}

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

async function clearProjectScreenshotDir(proposalId) {
  const uploadsRoot = getUploadDir();
  const destDir = path.join(uploadsRoot, 'project-screenshots', String(proposalId));
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
}

/**
 * Persist 1..N screenshot images. Returns relative paths (forward slashes).
 * Replaces any previous screenshots for this proposal.
 */
async function persistProjectScreenshots(proposalId, files) {
  const list = (Array.isArray(files) ? files : files ? [files] : []).filter((f) => f?.path);
  if (!list.length) return [];

  const uploadsRoot = getUploadDir();
  const relDir = path.join('project-screenshots', String(proposalId));
  const destDir = path.join(uploadsRoot, relDir);
  await fs.mkdir(destDir, { recursive: true });
  await clearProjectScreenshotDir(proposalId);

  const saved = [];
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    const storedRelativePath = path
      .join(relDir, `screenshot-${i + 1}${safeExt}`)
      .replace(/\\/g, '/');
    const destPath = path.join(uploadsRoot, storedRelativePath);
    try {
      await fs.rename(file.path, destPath);
    } catch {
      await fs.copyFile(file.path, destPath);
      await fs.unlink(file.path).catch(() => {});
    }
    saved.push(storedRelativePath);
  }
  return saved;
}

/** @deprecated single-file helper kept for callers; prefer persistProjectScreenshots */
async function persistProjectScreenshot(proposalId, file) {
  const paths = await persistProjectScreenshots(proposalId, file ? [file] : []);
  return paths[0] || null;
}

function assertScreenshotCount(files, { allowEmpty = false } = {}) {
  const list = (Array.isArray(files) ? files : files ? [files] : []).filter((f) => f?.path);
  if (allowEmpty && !list.length) return list;
  if (list.length < MIN_PROJECT_SCREENSHOTS || list.length > MAX_PROJECT_SCREENSHOTS) {
    const err = new Error(
      `Upload between ${MIN_PROJECT_SCREENSHOTS} and ${MAX_PROJECT_SCREENSHOTS} project screenshots (PNG/JPG/WebP). You selected ${list.length}.`
    );
    err.status = 400;
    throw err;
  }
  return list;
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

function buildDescriptionMismatchReason(consistencyRaw) {
  const score = consistencyRaw?.description_match_score;
  const pct =
    typeof score === 'number' && Number.isFinite(score) ? ` (${Math.round(score * 100)}% match)` : '';
  return (
    `This ZIP does not match your approved proposal description${pct}. ` +
    'Upload the project that implements what you proposed - same technology alone is not enough.'
  );
}

async function sha256OfFile(absPath) {
  const buf = await fs.readFile(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Exact ZIP copy already accepted by another proposal/student. */
async function findExactDuplicateAcceptedZip({ contentHash, proposalId }) {
  if (!contentHash) return null;
  return ProjectSubmission.findOne({
    contentHash,
    pipelineStatus: SUBMISSION_PIPELINE_STATUSES.ACCEPTED,
    storedRelativePath: { $nin: ['', null] },
    proposal: { $ne: proposalId },
  })
    .select('_id originalFilename submittedBy proposal')
    .lean();
}

/**
 * Proposal was flagged for previous-semester similarity, student added features, teacher accepted.
 * ZIP upload should check technology + functionality only - not legacy title match
 * (same idea / similar ZIP names are expected; teacher decides after preview).
 */
function isPreviousSemesterRecommendedProposal(proposal) {
  if (!proposal) return false;
  const legacyScore = Number(proposal.aiPreviousSemesterMaxScore || 0);
  if (proposal.aiMatchedLegacyId || String(proposal.aiMatchedLegacyKey || '').trim()) {
    return true;
  }
  // Cross-semester match stored as another proposal id + previous-semester score
  if (proposal.aiMatchedProposalId && legacyScore > 0) {
    return true;
  }
  if (legacyScore >= 0.35) return true;

  const hist = Array.isArray(proposal.submissionHistory) ? proposal.submissionHistory : [];
  return hist.some(
    (h) =>
      h?.outcome === 'ai_flagged_previous_semester' ||
      h?.aiVerdict === 'warn_previous_semester' ||
      String(h?.aiVerdict || '').includes('previous')
  );
}

function editDistanceAtMost1(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la > lb) return editDistanceAtMost1(b, a);
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (la === lb) {
      i += 1;
      j += 1;
    } else {
      j += 1;
    }
  }
  edits += lb - j + (la - i);
  return edits <= 1;
}

function wordMatchesZip(word, zipLower, zipSlug) {
  if (!word || word.length < 4) return false;
  if (zipSlug.includes(word) || zipLower.includes(word)) return true;
  if (word.length < 6) return false;
  for (const len of [word.length - 1, word.length, word.length + 1]) {
    if (len < 5) continue;
    for (let i = 0; i + len <= zipSlug.length; i += 1) {
      if (editDistanceAtMost1(word, zipSlug.slice(i, i + len))) return true;
    }
  }
  return false;
}

function distinctiveTitleWords(title) {
  return String(title || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !LEGACY_TITLE_STOPWORDS.has(w));
}

/** Bigrams that include at least one non-generic word (e.g. building+management). */
function significantTitlePhrases(title) {
  const words = String(title || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const phrases = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    const a = words[i];
    const b = words[i + 1];
    if (LEGACY_TITLE_STOPWORDS.has(a) && LEGACY_TITLE_STOPWORDS.has(b)) continue;
    if (a.length < 4 || b.length < 4) continue;
    phrases.push(`${a}${b}`);
  }
  return phrases;
}

/**
 * Score only ZIP identity surfaces (filename + package name) against a known title.
 * Do NOT use README/proposal body - that confuses "already exists" with "related topic".
 */
function scoreAgainstZipIdentity({ title, zipLower, zipSlug }) {
  const titleTrim = String(title || '').trim();
  if (!titleTrim) return 0;

  const titleLower = titleTrim.toLowerCase();
  const titleSlug = titleLower.replace(/[^a-z0-9]+/g, '');
  let score = 0;

  // Full title / slug containment (strongest signal)
  if (titleLower.length >= 8 && zipLower.includes(titleLower)) score = Math.max(score, 0.95);
  if (titleSlug.length >= 10 && zipSlug.includes(titleSlug)) score = Math.max(score, 0.95);

  // Significant phrases (building+management) - typo tolerant
  const phrases = significantTitlePhrases(titleTrim);
  const phraseHits = phrases.filter((p) => wordMatchesZip(p, zipLower, zipSlug) || zipSlug.includes(p)).length;
  if (phraseHits >= 1 && phrases.length >= 1) {
    score = Math.max(score, phraseHits >= 2 ? 0.92 : 0.86);
  }

  // Distinctive title words only (ignores system/management/api alone)
  const distinctive = distinctiveTitleWords(titleTrim);
  if (distinctive.length >= 2) {
    const hit = distinctive.filter((w) => wordMatchesZip(w, zipLower, zipSlug)).length;
    const ratio = hit / distinctive.length;
    if (ratio >= 0.8 && hit >= 2) score = Math.max(score, 0.9);
    else if (ratio >= 0.67 && hit >= 2) score = Math.max(score, 0.8);
  } else if (distinctive.length === 1 && wordMatchesZip(distinctive[0], zipLower, zipSlug)) {
    if (distinctive[0].length >= 5) score = Math.max(score, 0.82);
  }

  if (distinctive.length >= 2) {
    const distSlug = distinctive.join('');
    if (distSlug.length >= 8 && zipSlug.includes(distSlug)) score = Math.max(score, 0.92);
  }

  return score;
}

/**
 * Fast legacy / prior-work match (no AI) - runs BEFORE description/keyword gate.
 * Only strong title identity → "already exists". Unrelated ZIPs must fall through
 * to the functionality gate → "not related to your proposal".
 */
async function findLegacyProjectMatch({
  assignment,
  evidence,
  originalFilename = '',
  currentProposalId = null,
} = {}) {
  const subjectId = assignment?.subject?._id || assignment?.subject || null;
  const nameHint = String(originalFilename || '')
    .replace(/\.zip$/i, '')
    .replace(/[-_]+/g, ' ');
  const packageId = String(evidence?.package_identity || '').trim();
  // Identity only - never full README (avoids mixing prior uploads / topic overlap)
  const identityText = [nameHint, packageId].filter(Boolean).join('\n');
  if (!identityText.trim() || identityText.trim().length < 4) return null;

  const zipLower = identityText.toLowerCase();
  const zipSlug = zipLower.replace(/[^a-z0-9]+/g, '');

  /** @type {{ score: number, title: string, ownerLabel: string, matchedLegacyId: string|null, source: string }[]} */
  const candidates = [];

  // --- 1) Archived legacy projects ---
  let legacyDocs = [];
  if (subjectId) {
    legacyDocs = await LegacyProject.find({ subject: subjectId })
      .sort({ createdAt: -1 })
      .limit(60)
      .select('_id title ownerLabel')
      .lean();
  }
  if (!legacyDocs.length) {
    legacyDocs = await LegacyProject.find({})
      .sort({ createdAt: -1 })
      .limit(80)
      .select('_id title ownerLabel')
      .lean();
  }

  for (const l of legacyDocs) {
    const title = String(l.title || '').trim();
    if (!title) continue;
    const score = scoreAgainstZipIdentity({ title, zipLower, zipSlug });
    candidates.push({
      score,
      title: title || 'a previous project',
      ownerLabel: l.ownerLabel || '',
      matchedLegacyId: String(l._id),
      source: 'legacy_archive',
    });
  }

  // --- 2) Other approved proposals (same subject) - title identity only ---
  if (subjectId) {
    const assignmentIds = await Assignment.find({ subject: subjectId }).select('_id').limit(200).lean();
    const ids = assignmentIds.map((a) => a._id);
    if (ids.length) {
      const peerProposals = await Proposal.find({
        assignment: { $in: ids },
        status: 'teacher_approved',
        ...(currentProposalId ? { _id: { $ne: currentProposalId } } : {}),
      })
        .sort({ updatedAt: -1 })
        .limit(60)
        .select('_id title submittedBy')
        .populate('submittedBy', 'name')
        .lean();

      for (const p of peerProposals) {
        const title = String(p.title || '').trim();
        if (!title) continue;
        const score = scoreAgainstZipIdentity({ title, zipLower, zipSlug });
        candidates.push({
          score,
          title,
          ownerLabel: p.submittedBy?.name || 'another student',
          matchedLegacyId: `proposal:${p._id}`,
          source: 'approved_proposal',
        });
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < LEGACY_ZIP_REJECT_THRESHOLD) return null;
  return best;
}

function withDeadline(promise, ms, label = 'operation') {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} deadline exceeded (${ms}ms)`)), ms);
    }),
  ]);
}

async function analyzeConsistencyWithDeadline(payload) {
  return withDeadline(
    analyzeConsistencyPayload(payload),
    CONSISTENCY_HARD_DEADLINE_MS,
    'AI consistency'
  );
}

/** True when this proposal already has an accepted ZIP we should keep until a new upload succeeds. */
function hasReplaceableAcceptedZip(primary) {
  return Boolean(
    primary?.storedRelativePath &&
      (primary.pipelineStatus === SUBMISSION_PIPELINE_STATUSES.ACCEPTED ||
        primary.pipelineStatus === '' ||
        primary.teacherDecision === 'revision_required')
  );
}

/**
 * On failed gates during an update/revision, keep the previous ZIP + screenshots in place.
 * Only the new staging upload is discarded.
 */
function rejectionPayloadPreservingPrevious(primary, payload) {
  if (!hasReplaceableAcceptedZip(primary)) return payload;
  return {
    ...payload,
    storedRelativePath: primary.storedRelativePath,
    sizeBytes: primary.sizeBytes ?? payload.sizeBytes ?? 0,
    contentHash: primary.contentHash || payload.contentHash || '',
    screenshotRelativePath: primary.screenshotRelativePath || '',
    screenshotRelativePaths: Array.isArray(primary.screenshotRelativePaths)
      ? [...primary.screenshotRelativePaths]
      : primary.screenshotRelativePath
        ? [primary.screenshotRelativePath]
        : [],
    // Keep revision state so the next attempt still skips legacy matching.
    teacherDecision: primary.teacherDecision || '',
    teacherComment: primary.teacherComment || '',
    teacherScore: primary.teacherScore ?? null,
    teacherScoreMax: primary.teacherScoreMax ?? 100,
    teacherReviewedAt: primary.teacherReviewedAt || null,
    collaborativeProjectReviews: primary.collaborativeProjectReviews || payload.collaborativeProjectReviews,
  };
}

async function upsertSubmissionRecord({
  primary,
  proposal,
  submittedByUserId,
  payload,
}) {
  let nextPayload = payload;
  // Failed gates on an update must not erase the previous accepted ZIP until a new one succeeds.
  if (
    primary &&
    Object.prototype.hasOwnProperty.call(payload || {}, 'storedRelativePath') &&
    !payload.storedRelativePath &&
    hasReplaceableAcceptedZip(primary)
  ) {
    nextPayload = rejectionPayloadPreservingPrevious(primary, payload);
  }

  if (primary) {
    primary.set(nextPayload);
    primary.version = (primary.version || 1) + 1;
    await primary.save();
    return primary;
  }
  return ProjectSubmission.create({
    proposal: proposal._id,
    ...nextPayload,
    version: 1,
  });
}

async function invalidatePreviewArtifactsAfterZipReplace(proposalId, submissionId) {
  try {
    const { getSubmissionWorkspaceDir } = await import('./previewWorkspaceCache.service.js');
    const workspaceDir = getSubmissionWorkspaceDir(String(submissionId));
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    const { PreviewSession } = await import('../models/PreviewSession.js');
    const sessions = await PreviewSession.find({
      proposal: proposalId,
      status: { $in: ['starting', 'running', 'runtime_error'] },
    });
    for (const session of sessions) {
      try {
        const docker = await import('./dockerOrchestrator.service.js');
        await docker
          .stopProjectPreview(String(session._id), {
            hostPort: Number(session.hostPort) || null,
            apiHostPort: Number(session.previewApiHostPort) || null,
            imageKey: session.submission?.toString?.() || String(session._id),
            stack: session.previewStack || 'node-js',
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
      session.status = 'stopped';
      session.errorMessage = 'Stopped because the student uploaded a replacement project ZIP.';
      session.endedAt = new Date();
      await session.save().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * One submission record per proposal.
 * ZIP stays on staging until the full gate accepts; only then rename to project-code/.
 * Updates replace the previous ZIP in the same place and remove the old file after success.
 */
async function upsertProjectZipForProposal(proposal, submittedByUserId, file, projectStackHint = '', screenshotFiles = null) {
  if (!file?.path) {
    const err = new Error('No file uploaded');
    err.status = 400;
    throw err;
  }

  const screenshots = assertScreenshotCount(screenshotFiles, { allowEmpty: false });

  const stagingZipPath = file.path;
  let auditDir = null;
  let renamedToPermanent = false;
  let pendingScreenshots = [];

  const cleanupStaging = async () => {
    if (!renamedToPermanent) {
      await unlinkQuiet(stagingZipPath);
      for (const f of pendingScreenshots) {
        await unlinkQuiet(f?.path);
      }
    }
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

    // Allow replace/update until the project deadline (including previously accepted ZIPs).
    // Deadline is enforced by assertProjectDeadlineOpen above.

    for (const dup of existingRows.slice(1)) {
      if (dup.storedRelativePath) {
        await unlinkQuiet(path.join(uploadsRoot, dup.storedRelativePath));
      }
      await ProjectSubmission.deleteOne({ _id: dup._id });
    }

    const hint = normalizeProjectStackHint(projectStackHint);
    pendingScreenshots = screenshots;

    let screenshotRelativePaths = Array.isArray(primary?.screenshotRelativePaths)
      ? [...primary.screenshotRelativePaths]
      : primary?.screenshotRelativePath
        ? [primary.screenshotRelativePath]
        : [];
    // New screenshots are saved only after the ZIP is accepted (see below).
    const screenshotRelativePath = screenshotRelativePaths[0] || '';

    const baseMeta = {
      originalFilename: file.originalname || 'project.zip',
      mimeType: file.mimetype || 'application/zip',
      submittedBy: submittedByUserId,
      assignment: proposal.assignment,
      group: proposal.group || null,
      projectStackHint: hint,
      screenshotRelativePath,
      screenshotRelativePaths,
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

    // 2) Rule-based tech match - hard-capped (stack scan can be slow on huge trees)
    let techMatch;
    try {
      techMatch = await withDeadline(
        assertZipMatchesApprovedTechnology({
          extractDir: auditDir,
          assignment,
          proposal,
          stackHint: hint,
        }),
        Number(process.env.TECH_MATCH_DEADLINE_MS || 8000),
        'tech match'
      );
    } catch (techErr) {
      logger.warn(`[projectCodeSubmission] tech match skipped: ${techErr.message}`);
      techMatch = {
        ok: true,
        skipped: true,
        detectedStack: 'unknown',
        approvedTech: approvedTechnologiesForProposal(assignment, proposal),
        zipTech: [],
        message: 'Technology scan timed out; skipped to keep upload fast.',
      };
    }

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

    // 3) Fast local gates: hash → light evidence → legacy (before description) → keyword.
    // AI is OFF by default - never blocks upload.
    const declaredTech = approvedTechnologiesForProposal(assignment, proposal);
    const consistencyEnabled = isConsistencyCheckEnabled();
    let detectedTech = [...(techMatch.zipTech || [])];
    let evidence = { detected_tech: [], readme_text: '', routes: [], models: [] };
    let consistencyRaw = null;
    let consistencyTimedOut = false;

    let contentHash = '';
    try {
      contentHash = await sha256OfFile(stagingZipPath);
    } catch (e) {
      logger.warn(`[projectCodeSubmission] zip hash failed: ${e.message}`);
    }

    const exactDup = await findExactDuplicateAcceptedZip({
      contentHash,
      proposalId: proposal._id,
    });
    if (exactDup) {
      const reason =
        'This ZIP is an exact copy of a project already submitted by another student. Upload your own work.';
      const consistencyCheck = normalizeConsistencyCheck(null, { needsReview: false });
      const saved = await upsertSubmissionRecord({
        primary,
        proposal,
        submittedByUserId,
        payload: {
          ...baseMeta,
          contentHash,
          storedRelativePath: '',
          sizeBytes: 0,
          pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
          pipelineUpdatedAt: new Date(),
          pipelineError: reason,
          pipelineFailures: [{ rule: 'duplicate_zip_hash', message: reason, path: '' }],
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

    // Light ZIP identity (README / package.json) - used by legacy gate first, then description gate
    try {
      evidence = await withDeadline(
        buildLightFunctionalityEvidence(auditDir),
        Number(process.env.FUNCTIONALITY_EVIDENCE_DEADLINE_MS || 3000),
        'functionality evidence'
      );
    } catch (evErr) {
      logger.warn(`[projectCodeSubmission] light evidence skipped: ${evErr.message}`);
      evidence = { detected_tech: [], readme_text: '', routes: [], models: [], package_identity: '' };
    }
    detectedTech = [...new Set([...(evidence.detected_tech || []), ...(techMatch.zipTech || [])])];

    // After teacher asked for project changes, allow the student to re-upload their updated ZIP
    // without being blocked by the legacy / prior-work title gate.
    const allowRevisionResubmit = String(primary?.teacherDecision || '') === 'revision_required';
    // Previous-semester recommended work (add features → teacher accepted): skip legacy ZIP check.
    // Teacher reviews the real project; tech + functionality gates still run.
    const previousSemesterAcceptedPath = isPreviousSemesterRecommendedProposal(proposal);
    const skipLegacyMatch = allowRevisionResubmit || previousSemesterAcceptedPath;

    // LEGACY FIRST (before description/keyword check): reject known system / prior-student projects.
    // Skipped for revision re-uploads and for previous-semester similarity proposals.
    let legacyHit = null;
    if (!skipLegacyMatch) {
      try {
        legacyHit = await withDeadline(
          findLegacyProjectMatch({
            assignment,
            evidence,
            originalFilename: file.originalname || baseMeta.originalFilename || '',
            currentProposalId: proposal._id,
          }),
          Number(process.env.LEGACY_MATCH_DEADLINE_MS || 4000),
          'legacy match'
        );
      } catch (legErr) {
        logger.warn(`[projectCodeSubmission] legacy match skipped: ${legErr.message}`);
      }
    } else {
      logger.info(
        `[projectCodeSubmission] legacy match skipped for proposal ${proposal._id} (${
          allowRevisionResubmit ? 'teacher requested changes' : 'previous-semester recommended work'
        })`
      );
    }
    if (legacyHit) {
      const ownerBit = legacyHit.ownerLabel ? ` (${legacyHit.ownerLabel})` : '';
      const reason =
        `REJECTED - already exists in the system: this ZIP matches "${legacyHit.title}"${ownerBit}. ` +
        'Do not upload a legacy or another student’s project. Upload your own work for your approved proposal.';
      const consistencyCheck = normalizeConsistencyCheck(null, { needsReview: false });
      const saved = await upsertSubmissionRecord({
        primary,
        proposal,
        submittedByUserId,
        payload: {
          ...baseMeta,
          contentHash,
          storedRelativePath: '',
          sizeBytes: 0,
          pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
          pipelineUpdatedAt: new Date(),
          pipelineError: reason,
          pipelineFailures: [
            {
              rule: 'legacy_project_match',
              message: reason,
              path: legacyHit.matchedLegacyId || '',
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

    // Option 1 - Keyword / feature overlap (only after legacy check passes)
    if (isFunctionalityMatchEnabled()) {
      const functionality = scoreProposalZipFunctionality({
        proposal,
        evidence,
        originalFilename: file.originalname || baseMeta.originalFilename || '',
      });
      if (!functionality.ok) {
        const reason = functionality.message;
        const consistencyCheck = normalizeConsistencyCheck(
          {
            tech_match_score: null,
            description_match_score: functionality.score,
            tech_verdict: 'skipped',
            description_verdict: 'mismatch',
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
            contentHash,
            storedRelativePath: '',
            sizeBytes: 0,
            pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
            pipelineUpdatedAt: new Date(),
            pipelineError: reason,
            pipelineFailures: [
              {
                rule: 'functionality_mismatch',
                message: reason,
                path: `score=${functionality.score.toFixed(3)};title=${functionality.titleCoverage.toFixed(2)};features=${functionality.featureCoverage.toFixed(2)}`,
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
    }

    // Optional ML (only if explicitly enabled). Hard-capped; fail-open on timeout.
    // Previous-semester recommended proposals: technology + functionality only (teacher decides).
    if (consistencyEnabled && !previousSemesterAcceptedPath) {
      try {
        consistencyRaw = await analyzeConsistencyWithDeadline({
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
        consistencyTimedOut = true;
        logger.warn(
          `[projectCodeSubmission] consistency AI skipped (upload continues): ${aiErr.message}`
        );
        consistencyRaw = {
          tech_match_score: null,
          description_match_score: null,
          tech_verdict: 'skipped',
          description_verdict: 'skipped',
          overall_verdict: 'needs_review',
        };
      }

      const techVerdict = String(consistencyRaw?.tech_verdict || '').toLowerCase();
      const descVerdict = String(consistencyRaw?.description_verdict || '').toLowerCase();
      const overall = String(consistencyRaw?.overall_verdict || '').toLowerCase();

      if (
        !consistencyTimedOut &&
        (techVerdict === 'mismatch' || descVerdict === 'mismatch' || overall === 'reject')
      ) {
        const isDescReject =
          descVerdict === 'mismatch' ||
          (overall === 'reject' && techVerdict !== 'mismatch');
        const reason = isDescReject
          ? buildDescriptionMismatchReason(consistencyRaw)
          : buildDeclaredTechMissingReason(declaredTech, detectedTech);
        const consistencyCheck = normalizeConsistencyCheck(consistencyRaw, { needsReview: false });
        const saved = await upsertSubmissionRecord({
          primary,
          proposal,
          submittedByUserId,
          payload: {
            ...baseMeta,
            contentHash,
            storedRelativePath: '',
            sizeBytes: 0,
            pipelineStatus: SUBMISSION_PIPELINE_STATUSES.TECH_MISMATCH_REJECTED,
            pipelineUpdatedAt: new Date(),
            pipelineError: reason,
            pipelineFailures: [
              {
                rule: isDescReject ? 'consistency_description_mismatch' : 'consistency_tech_mismatch',
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
            ok: !isDescReject,
            detectedStack: techMatch.detectedStack || '',
            approvedTech: techMatch.approvedTech || declaredTech,
            zipTech: detectedTech,
            message: reason,
          },
          submission: saved.toObject ? saved.toObject() : saved,
        };
      }
    }

    const needsReview =
      consistencyTimedOut ||
      String(consistencyRaw?.overall_verdict || '').toLowerCase() === 'needs_review';
    const consistencyCheck = normalizeConsistencyCheck(consistencyRaw, { needsReview });

    // ACCEPT - replace previous ZIP in the same project-code/<proposalId>/ place.
    const previousZipRel = primary?.storedRelativePath
      ? String(primary.storedRelativePath).replace(/^\/+/, '')
      : '';
    const previousShotRels = Array.isArray(primary?.screenshotRelativePaths)
      ? primary.screenshotRelativePaths.map((p) => String(p || '').replace(/^\/+/, '')).filter(Boolean)
      : primary?.screenshotRelativePath
        ? [String(primary.screenshotRelativePath).replace(/^\/+/, '')]
        : [];
    const isInPlaceUpdate = Boolean(previousZipRel || primary);

    const relDir = path.join('project-code', String(proposal._id));
    const destDir = path.join(uploadsRoot, relDir);
    await fs.mkdir(destDir, { recursive: true });

    const ext = normalizeZipExt(file.originalname);
    const storedRelativePath = path.join(relDir, `project${ext}`).replace(/\\/g, '/');
    const destPath = path.join(uploadsRoot, storedRelativePath);

    // Write the new ZIP first (same place as before), then remove leftover older files.
    try {
      await fs.rename(stagingZipPath, destPath);
    } catch {
      await fs.copyFile(stagingZipPath, destPath);
      await unlinkQuiet(stagingZipPath);
    }
    renamedToPermanent = true;

    try {
      const dirFiles = await fs.readdir(destDir);
      const keepName = path.basename(storedRelativePath);
      for (const name of dirFiles) {
        if (name !== keepName) {
          await unlinkQuiet(path.join(destDir, name));
        }
      }
    } catch {
      /* ignore */
    }

    if (previousZipRel) {
      const oldAbs = path.join(uploadsRoot, previousZipRel);
      if (oldAbs !== destPath) await unlinkQuiet(oldAbs);
    }

    // New screenshots replace previous gallery images for this proposal.
    if (pendingScreenshots.length) {
      screenshotRelativePaths = await persistProjectScreenshots(proposal._id, pendingScreenshots);
    }

    // Delete any leftover previous screenshot files not in the new set.
    const keepShot = new Set(screenshotRelativePaths.map((p) => String(p).replace(/^\/+/, '')));
    for (const oldRel of previousShotRels) {
      if (!keepShot.has(oldRel)) {
        await unlinkQuiet(path.join(uploadsRoot, oldRel));
      }
    }

    const stat = await fs.stat(destPath);
    const saved = await upsertSubmissionRecord({
      primary,
      proposal,
      submittedByUserId,
      payload: {
        ...baseMeta,
        screenshotRelativePath: screenshotRelativePaths[0] || '',
        screenshotRelativePaths,
        contentHash,
        storedRelativePath,
        sizeBytes: stat.size,
        pipelineStatus: '',
        pipelineUpdatedAt: new Date(),
        pipelineError: '',
        pipelineFailures: [],
        consistencyCheck,
        teacherDecision: '',
        teacherComment: '',
        teacherScore: null,
        teacherReviewedAt: null,
        teacherPreviewedAt: null,
        collaborativeProjectReviews: {
          frontend: { teacherId: null, comment: '', score: null, scoreMax: 100, reviewedAt: null, decision: '' },
          backend: { teacherId: null, comment: '', score: null, scoreMax: 100, reviewedAt: null, decision: '' },
        },
      },
    });

    // Clear any prior hard-reject / revision notice so the student UI shows the new upload.
    await Proposal.updateOne(
      { _id: proposal._id },
      {
        $set: {
          lastProjectReview: {
            decision: '',
            comment: '',
            score: null,
            scoreMax: 100,
            reviewedAt: null,
          },
        },
      }
    ).catch(() => {});

    const submissionId = saved._id;

    // Drop cached preview workspace / running containers so teachers open the updated ZIP.
    if (isInPlaceUpdate) {
      await invalidatePreviewArtifactsAfterZipReplace(proposal._id, submissionId);
    }

    // Skip heavy tech-audit on the upload request (preview runs its own audit later).
    // This keeps ZIP upload fast and prevents request timeouts / crashes.
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
    const isUpdate = Boolean(primary);
    const nextVersion = saved.version || (isUpdate ? 2 : 1);

    notifySafe(() =>
      notifyAssignmentTeachers(assignment, {
        type: 'project_uploaded',
        title: isUpdate ? 'Student replaced project ZIP' : 'Project ZIP uploaded',
        body: isUpdate
          ? `${studentName} replaced their previous project ZIP for "${assignment.title || 'assignment'}" (v${nextVersion}). The old archive was removed.`
          : `${studentName} uploaded a project for "${assignment.title || 'assignment'}".`,
        link: `/teacher/assignments/${assignment._id}/proposals/${proposal._id}`,
        meta: {
          assignmentId: String(assignment._id),
          proposalId: String(proposal._id),
          submissionId: String(submissionId),
          version: nextVersion,
          isUpdate,
          replacedPrevious: isInPlaceUpdate,
        },
      })
    );

    return {
      accepted: true,
      reason: '',
      isUpdate,
      replacedPrevious: isInPlaceUpdate,
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
            ? consistencyTimedOut
              ? 'Project ZIP saved. Description AI check timed out - flagged for teacher review.'
              : 'Project ZIP saved but flagged for teacher review.'
            : isUpdate
              ? 'Project ZIP updated in place. Your previous archive was replaced and removed. Your teacher was notified.'
              : previousSemesterAcceptedPath
                ? 'Project ZIP accepted (technology + functionality checks). Previous-semester similarity is for your teacher to review - legacy archive check was skipped.'
                : 'Project ZIP matches your approved proposal (technology and description).'),
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

export async function submitProjectZip(userId, assignmentId, file, projectStackHint = '', screenshotFiles = null) {
  const access = await proposalWorkflow.canAccessProjectSubmission(userId, assignmentId);
  if (!access.allowed) {
    const err = new Error(access.reason);
    err.status = 403;
    throw err;
  }

  return upsertProjectZipForProposal(access.proposal, userId, file, projectStackHint, screenshotFiles);
}

export async function submitProjectScreenshotOnly(userId, assignmentId, screenshotFiles) {
  const screenshots = assertScreenshotCount(screenshotFiles, { allowEmpty: false });

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
        ? 'Both teachers must approve the proposal before uploading project screenshots.'
        : 'Proposal must be teacher-approved before uploading project screenshots.'
    );
    err.status = 400;
    throw err;
  }

  const screenshotRelativePaths = await persistProjectScreenshots(proposal._id, screenshots);
  const primary = await ProjectSubmission.findOne({ proposal: proposal._id }).sort({ createdAt: -1 });

  if (!primary) {
    const err = new Error(
      'Upload your project ZIP together with 4–10 screenshots first (screenshots are required with the ZIP).'
    );
    err.status = 400;
    throw err;
  }

  if (!primary.storedRelativePath || primary.pipelineStatus !== SUBMISSION_PIPELINE_STATUSES.ACCEPTED) {
    const err = new Error(
      'Upload an accepted project ZIP first (with 4–10 screenshots), then you can replace gallery screenshots.'
    );
    err.status = 400;
    throw err;
  }

  primary.screenshotRelativePaths = screenshotRelativePaths;
  primary.screenshotRelativePath = screenshotRelativePaths[0] || '';
  await primary.save();

  return { submission: toProjectSubmissionClient(primary) };
}
export async function getLatestSubmissionForProposal(proposalId) {
  return ProjectSubmission.findOne({ proposal: proposalId }).sort({ createdAt: -1 }).lean();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Hard-delete project ZIP + screenshots for a proposal, and remove matching LegacyProject rows.
 * Used when a teacher rejects the project (not when they only request changes).
 */
export async function purgeProjectSubmissionForProposal(proposal, assignment = null, reviewMeta = {}) {
  const proposalId = proposal?._id || proposal;
  if (!proposalId) return { deletedSubmissions: 0, deletedLegacy: 0 };

  const uploadsRoot = getUploadDir();
  const rows = await ProjectSubmission.find({ proposal: proposalId });
  for (const row of rows) {
    if (row.storedRelativePath) {
      await unlinkQuiet(path.join(uploadsRoot, String(row.storedRelativePath).replace(/^\/+/, '')));
    }
    const shotPaths = Array.isArray(row.screenshotRelativePaths)
      ? row.screenshotRelativePaths
      : row.screenshotRelativePath
        ? [row.screenshotRelativePath]
        : [];
    for (const rel of shotPaths) {
      if (!rel) continue;
      await unlinkQuiet(path.join(uploadsRoot, String(rel).replace(/^\/+/, '')));
    }
  }
  await clearProjectScreenshotDir(proposalId);

  const delSubs = await ProjectSubmission.deleteMany({ proposal: proposalId });

  const title = String(proposal?.title || '').trim();
  let deletedLegacy = 0;
  if (title) {
    const subjectId =
      assignment?.subject?._id || assignment?.subject || proposal?.assignment?.subject || null;
    const filter = { title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' } };
    if (subjectId) filter.subject = subjectId;
    const legacyResult = await LegacyProject.deleteMany(filter);
    deletedLegacy = legacyResult.deletedCount || 0;

    // If subject filter found nothing, still remove exact-title legacy rows for this owner label.
    if (!deletedLegacy) {
      const ownerLabel = String(reviewMeta.ownerLabel || proposal?.submittedBy?.name || '').trim();
      const broad = { title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' } };
      if (ownerLabel) broad.ownerLabel = { $regex: escapeRegex(ownerLabel), $options: 'i' };
      const broadResult = await LegacyProject.deleteMany(broad);
      deletedLegacy = broadResult.deletedCount || 0;
    }
  }

  await Proposal.updateOne(
    { _id: proposalId },
    {
      $set: {
        lastProjectReview: {
          decision: reviewMeta.decision || 'rejected',
          comment: String(reviewMeta.comment || '').trim(),
          score: reviewMeta.score ?? null,
          scoreMax: reviewMeta.scoreMax ?? 100,
          reviewedAt: reviewMeta.reviewedAt || new Date(),
        },
      },
    }
  );

  return {
    deletedSubmissions: delSubs.deletedCount || 0,
    deletedLegacy,
  };
}
