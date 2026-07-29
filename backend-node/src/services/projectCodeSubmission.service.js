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
  buildConsistencyEvidenceBundle,
  buildEvidenceCompositeText,
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

/** Local token overlap vs legacy archive (filename + light evidence; no AI). */
const LEGACY_ZIP_REJECT_THRESHOLD = Number(process.env.LEGACY_ZIP_REJECT_THRESHOLD || 0.45);
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

function buildDescriptionMismatchReason(consistencyRaw) {
  const score = consistencyRaw?.description_match_score;
  const pct =
    typeof score === 'number' && Number.isFinite(score) ? ` (${Math.round(score * 100)}% match)` : '';
  return (
    `This ZIP does not match your approved proposal description${pct}. ` +
    'Upload the project that implements what you proposed — same technology alone is not enough.'
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

function tokenizeForLegacy(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSets(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  return inter / (a.size + b.size - inter);
}

/**
 * Fast legacy / prior-work match (no AI) — runs BEFORE description/keyword gate.
 * Sources:
 *  1) LegacyProject archive in the system
 *  2) Other teacher-approved proposals (same subject) already in the system
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
  const composite = [nameHint, buildEvidenceCompositeText(evidence || {})].filter(Boolean).join('\n');
  if (!composite.trim() || composite.trim().length < 6) return null;

  const zipTokens = tokenizeForLegacy(composite);
  const zipLower = composite.toLowerCase();
  const zipSlug = zipLower.replace(/[^a-z0-9]+/g, '');

  /** @type {{ score: number, title: string, ownerLabel: string, matchedLegacyId: string|null, source: string }[]} */
  const candidates = [];

  // --- 1) Archived legacy projects ---
  let legacyDocs = [];
  if (subjectId) {
    legacyDocs = await LegacyProject.find({ subject: subjectId })
      .sort({ createdAt: -1 })
      .limit(60)
      .select('_id title proposalDescription features ownerLabel')
      .lean();
  }
  // Fallback: scan recent legacy archive if subject has none (still system legacy)
  if (!legacyDocs.length) {
    legacyDocs = await LegacyProject.find({})
      .sort({ createdAt: -1 })
      .limit(80)
      .select('_id title proposalDescription features ownerLabel')
      .lean();
  }

  for (const l of legacyDocs) {
    const title = String(l.title || '').trim();
    if (!title) continue;
    const legacyText = [title, l.proposalDescription || '', ...(Array.isArray(l.features) ? l.features : [])]
      .filter(Boolean)
      .join('\n');
    let score = jaccardSets(zipTokens, tokenizeForLegacy(legacyText));
    const titleLower = title.toLowerCase();
    const titleSlug = titleLower.replace(/[^a-z0-9]+/g, '');
    if (titleLower.length >= 5 && zipLower.includes(titleLower)) score = Math.max(score, 0.88);
    if (titleSlug.length >= 6 && zipSlug.includes(titleSlug)) score = Math.max(score, 0.92);
    // Partial: "building management" vs "Building-Managment-System-main"
    const titleWords = titleLower.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    if (titleWords.length >= 2) {
      const hit = titleWords.filter((w) => zipSlug.includes(w) || zipLower.includes(w)).length;
      if (hit / titleWords.length >= 0.7) score = Math.max(score, 0.8);
    }
    candidates.push({
      score,
      title: title || 'a previous project',
      ownerLabel: l.ownerLabel || '',
      matchedLegacyId: String(l._id),
      source: 'legacy_archive',
    });
  }

  // --- 2) Other approved proposals already in the system (same subject) ---
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
        .select('_id title description features submittedBy')
        .populate('submittedBy', 'name')
        .lean();

      for (const p of peerProposals) {
        const title = String(p.title || '').trim();
        if (!title) continue;
        const peerText = [title, p.description || '', ...(Array.isArray(p.features) ? p.features : [])]
          .filter(Boolean)
          .join('\n');
        let score = jaccardSets(zipTokens, tokenizeForLegacy(peerText));
        const titleLower = title.toLowerCase();
        const titleSlug = titleLower.replace(/[^a-z0-9]+/g, '');
        if (titleLower.length >= 5 && zipLower.includes(titleLower)) score = Math.max(score, 0.88);
        if (titleSlug.length >= 6 && zipSlug.includes(titleSlug)) score = Math.max(score, 0.92);
        const titleWords = titleLower.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
        if (titleWords.length >= 2) {
          const hit = titleWords.filter((w) => zipSlug.includes(w) || zipLower.includes(w)).length;
          if (hit / titleWords.length >= 0.7) score = Math.max(score, 0.8);
        }
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

    // Allow replace/update until the project deadline (including previously accepted ZIPs).
    // Deadline is enforced by assertProjectDeadlineOpen above.

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

    // 2) Rule-based tech match — hard-capped (stack scan can be slow on huge trees)
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
    // AI is OFF by default — never blocks upload.
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

    // Light ZIP identity (README / package.json) — used by legacy gate first, then description gate
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

    // LEGACY FIRST (before description/keyword check): reject known system / prior-student projects
    let legacyHit = null;
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
    if (legacyHit) {
      const ownerBit = legacyHit.ownerLabel ? ` (${legacyHit.ownerLabel})` : '';
      const sourceBit =
        legacyHit.source === 'approved_proposal'
          ? 'an approved project already in the system'
          : 'a legacy project archived in the system';
      const reason =
        `This ZIP matches ${sourceBit}: "${legacyHit.title}"${ownerBit}. ` +
        'Upload your own implementation of your approved proposal — legacy/other-student projects are rejected before description checks.';
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

    // Option 1 — Keyword / feature overlap (only after legacy check passes)
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
    if (consistencyEnabled) {
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
        contentHash,
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
        title: isUpdate ? 'Student updated project ZIP' : 'Project ZIP uploaded',
        body: isUpdate
          ? `${studentName} updated their project ZIP for "${assignment.title || 'assignment'}" (v${nextVersion}). Review the latest upload.`
          : `${studentName} uploaded a project for "${assignment.title || 'assignment'}".`,
        link: `/teacher/assignments/${assignment._id}/proposals/${proposal._id}`,
        meta: {
          assignmentId: String(assignment._id),
          proposalId: String(proposal._id),
          submissionId: String(submissionId),
          version: nextVersion,
          isUpdate,
        },
      })
    );

    return {
      accepted: true,
      reason: '',
      isUpdate,
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
              ? 'Project ZIP saved. Description AI check timed out — flagged for teacher review.'
              : 'Project ZIP saved but flagged for teacher review.'
            : isUpdate
              ? 'Project ZIP updated. Your teacher was notified.'
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
