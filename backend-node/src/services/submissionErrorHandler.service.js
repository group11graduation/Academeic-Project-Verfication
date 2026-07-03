import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { PreviewSession } from '../models/PreviewSession.js';
import { safeExtractProjectZip, shouldSkipZipEntry } from './previewZipExtract.service.js';
import { runPreviewStructureAudit } from './previewStructureAudit.service.js';
import * as previewWorkspaceCache from './previewWorkspaceCache.service.js';
import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import { logger } from '../config/logger.js';

/** Default sandbox caps — override via env (bytes / nano CPUs). */
export const PREVIEW_SANDBOX_MEMORY = process.env.PREVIEW_SANDBOX_MEMORY || '256m';
export const PREVIEW_SANDBOX_CPUS = process.env.PREVIEW_SANDBOX_CPUS || '0.5';
export const PREVIEW_CONTAINER_INIT_TIMEOUT_MS = Number(
  process.env.PREVIEW_CONTAINER_INIT_TIMEOUT_MS || 30_000
);

/** Pipeline status values persisted on ProjectSubmission. */
export const SUBMISSION_PIPELINE_STATUSES = Object.freeze({
  ACCEPTED: 'accepted',
  FAILED_EXTRACTION: 'failed_extraction',
  TECH_AUDIT_REJECTED: 'tech_audit_rejected',
});

/** Recognized failure codes for API + middleware mapping. */
export const SUBMISSION_ERROR_CODES = Object.freeze({
  FAILED_EXTRACTION: 'failed_extraction',
  TECH_AUDIT_REJECTED: 'tech_audit_rejected',
  RUNTIME_ERROR: 'runtime_error',
});

const ZIP_CORRUPT_PATTERNS = [
  /invalid zip/i,
  /end of central directory/i,
  /corrupt/i,
  /truncated/i,
  /unexpected end/i,
  /bad archive/i,
  /no end header/i,
  /compressed data/i,
];

const TEXT_PROBE_BYTES = 8192;
const FORBIDDEN_SIGNATURES = [
  { id: 'php_open_tag', pattern: /<\?php/i, label: 'PHP opening tag (<?php)', stacks: ['static-html', 'static-html-js'] },
  { id: 'node_modules_path', pattern: /(?:^|\/)node_modules(?:\/|$)/i, label: 'node_modules directory' },
];

/**
 * Structured pipeline error — never crashes the process; caught by middleware or callers.
 */
export class SubmissionPipelineError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'SubmissionPipelineError';
    this.code = options.code || SUBMISSION_ERROR_CODES.FAILED_EXTRACTION;
    this.status = options.status ?? 400;
    this.failures = Array.isArray(options.failures) ? options.failures : [];
    this.submissionId = options.submissionId || null;
    this.sessionId = options.sessionId || null;
    this.extractDir = options.extractDir || null;
    this.publicError = options.publicError || message;
  }
}

function isZipCorruptionError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`;
  return ZIP_CORRUPT_PATTERNS.some((re) => re.test(msg));
}

/**
 * Remove an extracted directory tree without throwing.
 */
export async function rmExtractDirSafe(extractDir) {
  if (!extractDir) return;
  try {
    await fs.rm(extractDir, { recursive: true, force: true });
  } catch (e) {
    logger.warn(`[submissionErrorHandler] cleanup failed for ${extractDir}: ${e.message}`);
  }
}

/**
 * Persist pipeline status + optional audit metadata on ProjectSubmission.
 */
export async function flagSubmissionPipelineStatus(submissionId, status, extra = {}) {
  if (!submissionId) return null;
  const update = {
    pipelineStatus: status,
    pipelineUpdatedAt: new Date(),
    ...extra,
  };
  return ProjectSubmission.findByIdAndUpdate(submissionId, { $set: update }, { new: true }).lean();
}

/**
 * Build a relative file manifest from an on-disk extract (post-extraction tech audit input).
 */
export async function buildExtractManifest(extractDir) {
  const manifest = [];

  async function walk(relDir = '') {
    const abs = relDir ? path.join(extractDir, relDir) : extractDir;
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const rel = relDir ? path.posix.join(relDir.replace(/\\/g, '/'), ent.name) : ent.name;
      if (shouldSkipZipEntry(rel)) continue;

      if (ent.isDirectory()) {
        manifest.push({ path: rel, type: 'directory' });
        await walk(rel);
      } else if (ent.isFile()) {
        manifest.push({ path: rel, type: 'file' });
      }
    }
  }

  await walk('');
  return manifest;
}

function manifestHasFile(manifest, matcher) {
  return manifest.some((e) => e.type === 'file' && matcher(e.path));
}

function manifestHasDir(manifest, dirName) {
  const needle = dirName.toLowerCase();
  return manifest.some(
    (e) =>
      e.type === 'directory' &&
      (e.path.toLowerCase() === needle || e.path.toLowerCase().endsWith(`/${needle}`))
  );
}

async function probeTextSignature(extractDir, relPath, pattern) {
  const abs = path.join(extractDir, relPath);
  try {
    const fh = await fs.open(abs, 'r');
    try {
      const buf = Buffer.alloc(TEXT_PROBE_BYTES);
      const { bytesRead } = await fh.read(buf, 0, TEXT_PROBE_BYTES, 0);
      return pattern.test(buf.subarray(0, bytesRead).toString('utf8'));
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}

/**
 * Assignment-aware tech audit on extracted manifest.
 * @returns {{ passed: boolean, failures: Array<{ rule: string, message: string, path?: string }> }}
 */
export async function runTechAuditOnManifest({
  extractDir,
  manifest,
  stackHint = '',
  assignment = null,
} = {}) {
  const failures = [];
  const stack = stackHint || 'node-js';

  const fileCount = manifest.filter((e) => e.type === 'file').length;
  if (fileCount === 0) {
    failures.push({
      rule: 'empty_archive',
      message:
        'The ZIP is empty or has no usable project files after extraction. Ask the student to re-zip their source code (not node_modules, .git, or an empty folder).',
    });
    return { passed: false, failures };
  }

  if (manifestHasDir(manifest, 'node_modules')) {
    failures.push({
      rule: 'forbidden_node_modules',
      message: 'Archive contains a node_modules folder. Remove it and re-zip only source files.',
      path: 'node_modules',
    });
  }

  if (stack === 'static-html' || stack === 'static-html-js') {
    const hasIndex = manifestHasFile(manifest, (p) => path.posix.basename(p).toLowerCase() === 'index.html');
    if (!hasIndex) {
      failures.push({
        rule: 'missing_index_html',
        message:
          'Missing index.html — static sites need a main HTML page at the project root or in a subfolder. Without it the preview has nothing to display.',
        path: 'index.html',
      });
    }
    if (stack === 'static-html-js') {
      const hasJs = manifestHasFile(manifest, (p) => /\.(m?js|cjs)$/i.test(p));
      if (!hasJs) {
        failures.push({
          rule: 'missing_javascript',
          message: 'HTML + JavaScript submissions must include at least one .js file.',
        });
      }
    }
  }

  const textLike = manifest.filter(
    (e) =>
      e.type === 'file' &&
      /\.(html?|css|js|mjs|cjs|jsx|tsx|php|env|json|txt|md)$/i.test(e.path)
  );

  for (const entry of textLike) {
    for (const sig of FORBIDDEN_SIGNATURES) {
      if (sig.stacks && !sig.stacks.includes(stack)) continue;
      if (sig.id === 'node_modules_path') {
        if (/(?:^|\/)node_modules(?:\/|$)/i.test(entry.path)) {
          failures.push({
            rule: sig.id,
            message: `${sig.label} is not allowed in student archives.`,
            path: entry.path,
          });
        }
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const hit = await probeTextSignature(extractDir, entry.path, sig.pattern);
      if (hit) {
        failures.push({
          rule: sig.id,
          message: `${sig.label} detected in uploaded project files.`,
          path: entry.path,
        });
      }
    }
  }

  if (assignment?.allowedTechnologies?.length) {
    const allowed = assignment.allowedTechnologies.map((t) => String(t).toLowerCase());
    const manifestText = manifest.map((m) => m.path.toLowerCase()).join('\n');
    const missingTech = allowed.filter((tech) => !manifestText.includes(tech) && tech.length > 2);
    if (missingTech.length === allowed.length) {
      failures.push({
        rule: 'allowed_technologies',
        message: `Project files do not appear to use allowed technologies: ${assignment.allowedTechnologies.join(', ')}.`,
      });
    }
  }

  return { passed: failures.length === 0, failures };
}

function teacherPreviewRejectionSummary(failures) {
  if (!failures?.length) {
    return 'The student project cannot be previewed. Required files are missing.';
  }
  if (failures.length === 1) {
    return `Preview blocked: ${failures[0].message}`;
  }
  return `Preview blocked: the student project is missing ${failures.length} required items (see list below).`;
}

async function rejectPreviewValidation({
  failures,
  submissionId = null,
  session = null,
  extractDir = null,
  deleteExtract = true,
  pipelineStatus = SUBMISSION_PIPELINE_STATUSES.TECH_AUDIT_REJECTED,
  logPrefix = 'Validation',
}) {
  if (deleteExtract && extractDir) {
    await rmExtractDirSafe(extractDir);
  }

  if (submissionId) {
    await flagSubmissionPipelineStatus(submissionId, pipelineStatus, {
      pipelineError: teacherPreviewRejectionSummary(failures),
      pipelineFailures: failures,
    });
  }

  const publicError = teacherPreviewRejectionSummary(failures);

  if (session) {
    session.status = 'failed';
    session.errorMessage = publicError;
    session.endedAt = new Date();
    session.logs.push({
      level: 'error',
      message: `${logPrefix} failed (${failures.length} issue(s)).`,
      at: new Date(),
    });
    for (const f of failures.slice(0, 16)) {
      session.logs.push({
        level: 'error',
        message: `[${f.rule}] ${f.message}${f.path ? ` (${f.path})` : ''}`,
        at: new Date(),
      });
    }
    session.validationFailures = failures;
    await session.save();
  }

  throw new SubmissionPipelineError(publicError, {
    code: SUBMISSION_ERROR_CODES.TECH_AUDIT_REJECTED,
    status: 422,
    failures,
    submissionId,
    sessionId: session?._id?.toString() || null,
    extractDir,
    publicError,
  });
}

/**
 * ZIP EXTRACTION BARRIER — wraps adm-zip extraction; maps corruption to failed_extraction.
 */
export async function executeZipExtractionBarrier({
  zipAbs,
  destDir,
  submissionId = null,
  session = null,
} = {}) {
  if (!zipAbs || !destDir) {
    throw new SubmissionPipelineError('ZIP path and destination are required.', {
      code: SUBMISSION_ERROR_CODES.FAILED_EXTRACTION,
      status: 400,
      publicError: 'Corrupted archive. Please re-zip and re-submit your files.',
    });
  }

  if (!fsSync.existsSync(zipAbs)) {
    throw new SubmissionPipelineError('Archive file missing on server.', {
      code: SUBMISSION_ERROR_CODES.FAILED_EXTRACTION,
      status: 400,
      submissionId,
      publicError: 'Corrupted archive. Please re-zip and re-submit your files.',
    });
  }

  try {
    const extractMeta = safeExtractProjectZip(zipAbs, destDir);
    if (submissionId) {
      await ProjectSubmission.findByIdAndUpdate(submissionId, {
        $set: {
          lastExtractAt: new Date(),
          lastExtractFileCount: extractMeta.fileCount,
        },
      });
    }
    if (session) {
      session.logs.push({
        level: 'info',
        message: `Extracted ${extractMeta.fileCount} file(s) from archive.`,
        at: new Date(),
      });
    }
    return extractMeta;
  } catch (err) {
    await rmExtractDirSafe(destDir);

    const corrupt = isZipCorruptionError(err);
    const message = corrupt
      ? 'Corrupted archive. Please re-zip and re-submit your files.'
      : err.message || 'Archive extraction failed.';

    if (submissionId) {
      await flagSubmissionPipelineStatus(submissionId, SUBMISSION_PIPELINE_STATUSES.FAILED_EXTRACTION, {
        pipelineError: message,
        pipelineFailures: [{ rule: 'zip_extraction', message }],
      });
    }

    throw new SubmissionPipelineError(message, {
      code: SUBMISSION_ERROR_CODES.FAILED_EXTRACTION,
      status: corrupt ? 400 : err.status || 400,
      submissionId,
      extractDir: destDir,
      publicError: corrupt
        ? 'Corrupted archive. Please re-zip and re-submit your files.'
        : message,
    });
  }
}

/**
 * TECH AUDIT BLOCKER — runs immediately after extraction; deletes extract + flags DB on violation.
 */
export async function executeTechAuditBarrier({
  extractDir,
  submissionId = null,
  session = null,
  stackHint = '',
  assignment = null,
} = {}) {
  const manifest = await buildExtractManifest(extractDir);
  const audit = await runTechAuditOnManifest({ extractDir, manifest, stackHint, assignment });

  if (audit.passed) {
    if (submissionId) {
      await flagSubmissionPipelineStatus(submissionId, SUBMISSION_PIPELINE_STATUSES.ACCEPTED, {
        lastAuditAt: new Date(),
        pipelineFailures: [],
      });
    }
    return { manifest, failures: [] };
  }

  await rejectPreviewValidation({
    failures: audit.failures,
    submissionId,
    session,
    extractDir,
    deleteExtract: true,
    logPrefix: 'Tech audit',
  });
}

/**
 * PROJECT STRUCTURE BLOCKER — after security audit, verify stack-specific required files exist.
 */
export async function executePreviewStructureBarrier({
  extractDir,
  submissionId = null,
  session = null,
  stackHint = '',
  stackOverride = null,
  keepExtract = false,
} = {}) {
  const audit = await runPreviewStructureAudit(extractDir, { stackHint, stackOverride });

  if (audit.passed) {
    return audit;
  }

  await rejectPreviewValidation({
    failures: audit.failures,
    submissionId,
    session,
    extractDir,
    deleteExtract: !keepExtract,
    logPrefix: 'Project structure check',
  });
}

/**
 * Force-kill and remove a preview container (idempotent).
 */
export async function forceKillPreviewContainer(containerName) {
  if (!containerName) return;
  try {
    await dockerOrchestrator.removeContainerIfExists(containerName);
  } catch (e) {
    logger.warn(`[submissionErrorHandler] docker rm -f failed for ${containerName}: ${e.message}`);
  }
}

/**
 * Scrape docker logs and persist runtime_error on PreviewSession for the teacher dashboard.
 */
export async function recordPreviewRuntimeError({
  sessionId,
  containerName,
  reason = 'Container runtime error',
  stderr = '',
  extractDir = null,
} = {}) {
  const tail = containerName ? await dockerOrchestrator.getContainerLogs(containerName, 200) : '';
  const traceback = [stderr, tail].filter(Boolean).join('\n---\n').slice(-12_000);

  if (containerName) {
    await forceKillPreviewContainer(containerName);
  }
  if (extractDir && !previewWorkspaceCache.isPersistentWorkspaceDir(extractDir)) {
    await rmExtractDirSafe(extractDir);
  }

  const session = await PreviewSession.findById(sessionId);
  if (!session) return null;

  session.status = 'runtime_error';
  session.errorMessage = reason;
  session.runtimeTraceback = traceback;
  session.endedAt = new Date();
  session.logs.push({ level: 'error', message: reason, at: new Date() });
  if (traceback.trim()) {
    session.logs.push({
      level: 'error',
      message: `Runtime traceback (docker logs):\n${traceback.slice(-4000)}`,
      at: new Date(),
    });
  }
  await session.save();
  return session;
}

/**
 * RUNTIME SANDBOX — wraps deploy; docker run already enforces memory/CPU + init timeout.
 * On failure: force-kill container, scrape logs, persist runtime_error on PreviewSession.
 */
export async function launchSandboxContainer({
  sessionId,
  submissionId = null,
  extractDir = null,
  deployFn,
  containerName,
} = {}) {
  if (typeof deployFn !== 'function') {
    throw new SubmissionPipelineError('Sandbox deploy function missing.', {
      code: SUBMISSION_ERROR_CODES.RUNTIME_ERROR,
      status: 500,
    });
  }

  try {
    return await deployFn();
  } catch (err) {
    const stderr = err.stderr || err.message || '';
    if (containerName) {
      await forceKillPreviewContainer(containerName);
    }
    await recordPreviewRuntimeError({
      sessionId,
      containerName,
      reason: err.publicError || err.message || 'Preview sandbox initialization failed.',
      stderr,
      extractDir,
    });
    if (submissionId) {
      await flagSubmissionPipelineStatus(submissionId, SUBMISSION_PIPELINE_STATUSES.ACCEPTED, {
        lastRuntimeErrorAt: new Date(),
        pipelineError: err.message,
      });
    }
    throw err instanceof SubmissionPipelineError
      ? err
      : new SubmissionPipelineError(err.message || 'Preview sandbox failed.', {
          code: SUBMISSION_ERROR_CODES.RUNTIME_ERROR,
          status: err.status || 500,
          sessionId,
          submissionId,
        });
  }
}

/**
 * Watch container exit during readiness; upgrade to runtime_error with scraped logs.
 */
export async function handlePreviewContainerExit({
  sessionId,
  containerName,
  extractDir = null,
  reason = 'Preview container exited unexpectedly.',
} = {}) {
  return recordPreviewRuntimeError({ sessionId, containerName, reason, extractDir });
}

/**
 * Student-facing JSON body for extraction failures (spec-compliant shape).
 */
export function formatStudentExtractionResponse(err) {
  return {
    success: false,
    error:
      err?.publicError ||
      err?.message ||
      'Corrupted archive. Please re-zip and re-submit your files.',
  };
}

/**
 * Teacher / audit JSON payload with verbose validation failures.
 */
export function formatTechAuditResponse(err) {
  return {
    success: false,
    error: err?.publicError || err?.message || 'The student project cannot be previewed.',
    code: SUBMISSION_ERROR_CODES.TECH_AUDIT_REJECTED,
    validationFailures: err?.failures || [],
    sessionId: err?.sessionId || null,
  };
}
