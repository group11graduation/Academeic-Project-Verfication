import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import Docker from 'dockerode';
import AdmZip from 'adm-zip';
import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import { PreviewSession } from '../models/PreviewSession.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Proposal } from '../models/Proposal.js';

const MAX_FILES = Number(process.env.PREVIEW_MAX_EXTRACT_FILES || 500);
const MAX_TOTAL_BYTES = Number(process.env.PREVIEW_MAX_EXTRACT_BYTES || 52_428_800);
const PREVIEW_STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_STARTUP_TIMEOUT_MS || 300000);

/** Sessions waiting for container HTTP/TCP readiness */
const readinessJobs = new Set();
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const activeTimers = new Map();

let dockerSingleton = null;

function dockerEnabled() {
  return process.env.DOCKER_PREVIEW_ENABLED !== 'false';
}

function getDocker() {
  if (!dockerEnabled()) return null;
  if (!dockerSingleton) {
    const isWin = process.platform === 'win32';
    const socketPath =
      process.env.DOCKER_SOCKET || (isWin ? '//./pipe/docker_engine' : '/var/run/docker.sock');
    dockerSingleton = new Docker({ socketPath });
  }
  return dockerSingleton;
}

function appendLog(session, level, message) {
  session.logs.push({ level, message, at: new Date() });
}

function safeExtractZip(zipAbs, destDir) {
  const zip = new AdmZip(zipAbs);
  const entries = zip.getEntries();
  let totalBytes = 0;
  let fileCount = 0;
  const destResolved = path.resolve(destDir);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    fileCount += 1;
    if (fileCount > MAX_FILES) {
      throw new Error(`Archive exceeds file limit (${MAX_FILES})`);
    }
    const raw = entry.entryName.replace(/\\/g, '/');
    if (raw.startsWith('/') || raw.includes('..')) {
      throw new Error('Unsafe path in archive');
    }
    const target = path.resolve(destDir, raw);
    if (!target.startsWith(destResolved)) {
      throw new Error('Path traversal blocked in archive');
    }
    const data = entry.getData();
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('Extracted size exceeds configured limit');
    }
    fsSync.mkdirSync(path.dirname(target), { recursive: true });
    fsSync.writeFileSync(target, data);
  }
}

async function cleanupSessionResources(session, docker, finalStatus, logMessage) {
  const sid = session._id.toString();
  if (activeTimers.has(sid)) {
    clearTimeout(activeTimers.get(sid));
    activeTimers.delete(sid);
  }

  if (session.dockerContainerId || session.hostPort) {
    await dockerOrchestrator
      .stopProjectPreview(session._id.toString(), {
        hostPort: Number(session.hostPort) || null,
        imageKey: session.submission?.toString?.() || session._id.toString(),
        stack: session.previewStack || 'node-js',
      })
      .catch(() => {});
  }
  if (session.dockerContainerId && docker) {
    try {
      const c = docker.getContainer(session.dockerContainerId);
      await c.stop({ t: 8 });
    } catch {
      /* legacy dockerode session */
    }
  }

  if (session.extractDirPath) {
    try {
      await fs.rm(session.extractDirPath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  session.status = finalStatus;
  session.endedAt = new Date();
  appendLog(session, 'info', logMessage);
  await session.save();
}

async function finalizePreviewReadiness(sessionId, deployResult, extractDir) {
  const jobKey = sessionId.toString();
  if (readinessJobs.has(jobKey)) return;
  readinessJobs.add(jobKey);

  try {
    const wait = await dockerOrchestrator.waitForPreviewReady({
      previewUrl: deployResult.previewUrl,
      containerName: deployResult.containerName,
      stack: deployResult.stack,
      timeoutMs: PREVIEW_STARTUP_TIMEOUT_MS,
    });

    const session = await PreviewSession.findById(sessionId);
    if (!session || session.status !== 'starting') return;

    if (wait.ready) {
      session.status = 'running';
      session.previewStack = deployResult.stack || session.previewStack;
      appendLog(session, 'info', `Preview ready (${wait.reason}) at ${session.previewUrl}`);
      await session.save();

      const ttl = session.ttlMs || Number(process.env.PREVIEW_TTL_MS || 600000);
      const timer = setTimeout(async () => {
        try {
          const fresh = await PreviewSession.findById(sessionId);
          if (fresh && fresh.status === 'running') {
            await cleanupSessionResources(fresh, getDocker(), 'expired', 'TTL elapsed; container stopped.');
          }
        } catch (err) {
          console.error('preview TTL cleanup', err);
        }
      }, ttl);
      activeTimers.set(jobKey, timer);
      return;
    }

    const tailLogs = await dockerOrchestrator.getContainerLogs(deployResult.containerName, 100);
    await dockerOrchestrator
      .stopProjectPreview(sessionId.toString(), {
        hostPort: deployResult.hostPort,
        imageKey: session.submission?.toString?.() || sessionId.toString(),
        stack: deployResult.stack,
      })
      .catch(() => {});
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    session.status = 'failed';
    session.errorMessage =
      wait.reason === 'container_exited'
        ? 'Preview container stopped unexpectedly. Check logs below (wrong app folder or npm error).'
        : `Preview did not respond on port ${session.hostPort} in time. Open the preview link anyway or try Start preview again (image may be cached).`;
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    if (tailLogs.trim()) {
      appendLog(session, 'error', `Container logs: ${tailLogs.slice(-2500)}`);
    }
    await session.save();
  } finally {
    readinessJobs.delete(jobKey);
  }
}

async function stopActiveSessionsForProposal(proposalId, docker, { includeStarting = true } = {}) {
  const statuses = includeStarting ? ['starting', 'running'] : ['running'];
  const list = await PreviewSession.find({
    proposal: proposalId,
    status: { $in: statuses },
  });
  for (const s of list) {
    await cleanupSessionResources(s, docker, 'stopped', 'Preview ended (superseded by a new session).');
  }
}

/**
 * Start a bounded Docker preview for teacher review.
 * Security: caller must enforce teacher ownership + proposal approved + submission exists (done here).
 */
export async function startPreviewForProposal(teacherId, proposalId, options = {}) {
  const { stack: stackOverride = null } = options;
  const docker = getDocker();
  if (!docker) {
    const err = new Error('Docker preview is disabled. Set DOCKER_PREVIEW_ENABLED=true and configure Docker.');
    err.status = 503;
    throw err;
  }

  try {
    await docker.ping();
  } catch {
    const err = new Error(
      'Docker daemon unreachable. On Windows use Docker Desktop; on Linux mount the Docker socket into the API container only on trusted hosts.'
    );
    err.status = 503;
    throw err;
  }

  const proposal = await Proposal.findById(proposalId).populate('assignment');
  if (!proposal) {
    const err = new Error('Proposal not found');
    err.status = 404;
    throw err;
  }

  const assignment = proposal.assignment;
  if (!assignment || String(assignment.teacher) !== String(teacherId)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  if (proposal.status !== 'teacher_approved') {
    const err = new Error('Preview is only allowed for teacher-approved proposals.');
    err.status = 400;
    throw err;
  }

  const submission = await ProjectSubmission.findOne({ proposal: proposal._id }).sort({ createdAt: -1 });
  if (!submission) {
    const err = new Error('No project code archive submitted for this proposal.');
    err.status = 400;
    throw err;
  }

  const inflight = await PreviewSession.findOne({
    proposal: proposal._id,
    status: 'starting',
  });
  if (inflight) {
    return inflight;
  }

  await stopActiveSessionsForProposal(proposal._id, docker, { includeStarting: false });

  // Hint is only used when the ZIP has no clear file signals — files always win over assignment title.
  const stackHint = dockerOrchestrator.inferStackHintFromAssignment(assignment);
  const memory = Number(process.env.PREVIEW_MEMORY_BYTES || 268435456);
  const nanoCpus = Number(process.env.PREVIEW_NANO_CPUS || 500000000);
  const ttl = Number(process.env.PREVIEW_TTL_MS || 600000);

  const zipAbs = path.join(process.cwd(), 'uploads', submission.storedRelativePath);
  if (!fsSync.existsSync(zipAbs)) {
    const err = new Error('Stored archive missing on server');
    err.status = 500;
    throw err;
  }

  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholar-preview-'));
  const session = await PreviewSession.create({
    teacher: teacherId,
    proposal: proposal._id,
    submission: submission._id,
    assignment: assignment._id,
    status: 'starting',
    memoryBytes: memory,
    nanoCpus,
    ttlMs: ttl,
    extractDirPath: extractDir,
    logs: [{ level: 'info', message: 'Session created; extracting archive.' }],
    startedAt: new Date(),
  });

  try {
    safeExtractZip(zipAbs, extractDir);
    appendLog(session, 'info', 'Archive extracted safely; starting container.');
    await session.save();
  } catch (e) {
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    session.status = 'failed';
    session.errorMessage = e.message || 'Extract failed';
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    await session.save();
    throw e;
  }
  let deployResult;
  try {
    deployResult = await dockerOrchestrator.deployProjectPreview(session._id.toString(), extractDir, {
      allowedRoot: extractDir,
      imageKey: submission._id.toString(),
      stackHint,
      stack: stackOverride || null,
      forceRebuild: Boolean(stackOverride),
    });
  } catch (e) {
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    session.status = 'failed';
    session.errorMessage = e.message || 'Docker deploy failed';
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    await session.save();
    throw e;
  }

  session.dockerContainerId = deployResult.containerId;
  session.hostPort = String(deployResult.hostPort);
  session.previewUrl = deployResult.previewUrl;
  session.previewImage = deployResult.imageTag;
  session.previewStack = deployResult.stack;
  appendLog(
    session,
    'info',
    `Container type: ${deployResult.stack} — ${deployResult.detectionReason || 'auto-detected from files'}`
  );
  appendLog(
    session,
    'info',
    `${deployResult.imageReused ? 'Reused' : 'Built'} ${deployResult.stack} image (app dir: ${deployResult.appSubdir || '.'}); host:${deployResult.hostPort} -> container:${deployResult.internalPort}`
  );
  appendLog(session, 'info', `Container started; warming up app at ${session.previewUrl}`);
  await session.save();

  // Return immediately — readiness continues in background (React/Vite installs can take several minutes)
  setImmediate(() => {
    finalizePreviewReadiness(session._id, deployResult, extractDir).catch((err) => {
      console.error('preview readiness', err);
    });
  });

  return session;
}

export async function stopPreviewForTeacher(teacherId, sessionId) {
  const session = await PreviewSession.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (String(session.teacher) !== String(teacherId)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!['starting', 'running'].includes(session.status)) {
    return session;
  }
  await cleanupSessionResources(session, getDocker(), 'stopped', 'Stopped by teacher.');
  return session;
}

export function toPublicSession(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete o.extractDirPath;
  return o;
}

export async function getPreviewSessionForTeacher(teacherId, sessionId) {
  const session = await PreviewSession.findById(sessionId).lean();
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (String(session.teacher) !== String(teacherId)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  delete session.extractDirPath;
  return session;
}
