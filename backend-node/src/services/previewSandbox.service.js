import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import Docker from 'dockerode';
import AdmZip from 'adm-zip';
import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import * as previewCredentials from './previewCredentials.service.js';
import * as previewMern from './previewMern.service.js';
import { PreviewSession } from '../models/PreviewSession.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Proposal } from '../models/Proposal.js';

const MAX_FILES = Number(process.env.PREVIEW_MAX_EXTRACT_FILES || 500);
const MAX_TOTAL_BYTES = Number(process.env.PREVIEW_MAX_EXTRACT_BYTES || 52_428_800);
const PREVIEW_STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_STARTUP_TIMEOUT_MS || 600000);
const PREVIEW_TTL_MS = Number(process.env.PREVIEW_TTL_MS || 1800000);
const PREVIEW_TTL_MIN_MS = Number(process.env.PREVIEW_TTL_MIN_MS || 300000);
const PREVIEW_TTL_TOUCH_MS = Number(process.env.PREVIEW_TTL_TOUCH_MS || 1800000);
const PREVIEW_TTL_MAX_MS = Number(process.env.PREVIEW_TTL_MAX_MS || 7200000);

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

function previewTtlMs(session) {
  const raw = Number(session?.ttlMs) || PREVIEW_TTL_MS;
  return Math.max(raw, PREVIEW_TTL_MIN_MS);
}

function clearPreviewTtl(sessionId) {
  const key = sessionId.toString();
  if (activeTimers.has(key)) {
    clearTimeout(activeTimers.get(key));
    activeTimers.delete(key);
  }
}

/**
 * Start (or restart) the auto-stop timer. TTL always counts from when the preview is ready,
 * not from when the session was created.
 */
async function schedulePreviewTtl(session, { extendOnly = false } = {}) {
  const sessionId = session._id.toString();
  clearPreviewTtl(sessionId);

  const ttlMs = previewTtlMs(session);
  const now = Date.now();
  const readyAt = session.readyAt ? new Date(session.readyAt) : new Date();
  const maxExpires = readyAt.getTime() + PREVIEW_TTL_MAX_MS;
  let expiresAt = new Date(now + ttlMs);

  if (extendOnly && session.expiresAt) {
    const bumped = new Date(now + PREVIEW_TTL_TOUCH_MS);
    expiresAt = new Date(Math.max(new Date(session.expiresAt).getTime(), bumped.getTime()));
  }

  if (expiresAt.getTime() > maxExpires) {
    expiresAt = new Date(maxExpires);
  }

  const remaining = Math.max(expiresAt.getTime() - now, 5000);
  session.readyAt = readyAt;
  session.expiresAt = expiresAt;
  await session.save();

  const timer = setTimeout(async () => {
    try {
      const fresh = await PreviewSession.findById(sessionId);
      if (fresh && fresh.status === 'running') {
        await cleanupSessionResources(fresh, getDocker(), 'expired', 'TTL elapsed; container stopped.');
      }
    } catch (err) {
      console.error('preview TTL cleanup', err);
    }
  }, remaining);
  activeTimers.set(sessionId, timer);
  return session;
}

/** Keep preview alive while the teacher page is open (polls every few seconds). */
async function touchPreviewTtl(session) {
  if (!session || session.status !== 'running') return session;
  const now = Date.now();
  const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  const touchThreshold = PREVIEW_TTL_TOUCH_MS * 0.25;
  if (expiresAt - now > touchThreshold) {
    return session;
  }
  return schedulePreviewTtl(session, { extendOnly: true });
}

/** Re-arm timers after API restart for sessions still marked running in MongoDB. */
export async function restoreRunningPreviewTtls() {
  if (!dockerEnabled()) return;
  const running = await PreviewSession.find({ status: 'running' });
  for (const session of running) {
    const remaining = session.expiresAt
      ? new Date(session.expiresAt).getTime() - Date.now()
      : previewTtlMs(session);
    if (remaining <= 0) {
      // eslint-disable-next-line no-await-in-loop
      await cleanupSessionResources(session, getDocker(), 'expired', 'TTL elapsed; container stopped.');
    } else {
      clearPreviewTtl(session._id);
      const timer = setTimeout(async () => {
        try {
          const fresh = await PreviewSession.findById(session._id);
          if (fresh && fresh.status === 'running') {
            await cleanupSessionResources(fresh, getDocker(), 'expired', 'TTL elapsed; container stopped.');
          }
        } catch (err) {
          console.error('preview TTL restore', err);
        }
      }, remaining);
      activeTimers.set(session._id.toString(), timer);
    }
  }
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
  clearPreviewTtl(sid);

  if (session.dockerContainerId || session.hostPort) {
    await dockerOrchestrator
      .stopProjectPreview(session._id.toString(), {
        hostPort: Number(session.hostPort) || null,
        apiHostPort: Number(session.previewApiHostPort) || null,
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
      apiPreviewUrl: deployResult.previewApiUrl || '',
      containerName: deployResult.containerName,
      stack: deployResult.stack,
      timeoutMs: PREVIEW_STARTUP_TIMEOUT_MS,
    });

    const session = await PreviewSession.findById(sessionId);
    if (!session || session.status !== 'starting') return;

    if (wait.ready) {
      session.status = 'running';
      session.previewStack = deployResult.stack || session.previewStack;
      const warmupNote =
        wait.reason === 'tcp_warmup' || wait.reason === 'tcp_slow'
          ? ' Port is open; npm may still be installing — refresh the page if you see a blank screen.'
          : '';
      appendLog(session, 'info', `Preview ready (${wait.reason}) at ${session.previewUrl}.${warmupNote}`);
      await schedulePreviewTtl(session);
      const until = session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : '';
      appendLog(
        session,
        'info',
        `Preview stays active until ${until} (~${Math.round(previewTtlMs(session) / 60000)} min). Open the link above; it extends while this page is open.`
      );
      await session.save();
      return;
    }

    const { host, port } = dockerOrchestrator.parseHostPortFromPreviewUrl(deployResult.previewUrl);
    const checkHost = host === 'localhost' ? '127.0.0.1' : host;
    const portStillOpen = await dockerOrchestrator.isTcpPortOpen(checkHost, port);
    const containerUp = deployResult.containerName
      ? await dockerOrchestrator.isPreviewContainerRunning(deployResult.containerName)
      : false;

    if (wait.reason !== 'container_exited' && portStillOpen && containerUp) {
      session.status = 'running';
      appendLog(
        session,
        'info',
        `Preview port ${port} is open (still warming up). Open the link below; refresh after 1–2 min if blank.`
      );
      await schedulePreviewTtl(session);
      appendLog(
        session,
        'info',
        `Preview stays active until ${session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : 'later'} while you review.`
      );
      await session.save();
      return;
    }

    const tailLogs = await dockerOrchestrator.getContainerLogs(deployResult.containerName, 100);
    await dockerOrchestrator
      .stopProjectPreview(sessionId.toString(), {
        hostPort: deployResult.hostPort,
        apiHostPort: deployResult.apiHostPort || null,
        imageKey: session.submission?.toString?.() || sessionId.toString(),
        stack: deployResult.stack,
      })
      .catch(() => {});
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    session.status = 'failed';
    session.errorMessage =
      wait.reason === 'container_exited'
        ? 'Preview container stopped unexpectedly. Check logs below (wrong app folder or npm error).'
        : wait.reason === 'api_port_timeout'
          ? `Student API did not start on port ${session.previewApiHostPort || '?'}. Ensure MongoDB is running (Docker Desktop), then Start preview again.`
          : `Preview did not respond on port ${session.hostPort} in time. Click Start preview again after checking Docker is running.`;
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
  const { stack: stackOverride = null, adminEmail = null, adminPassword = null } = options;
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

  // Always stop prior sessions (including stuck "starting") so a new stack choice takes effect.
  await stopActiveSessionsForProposal(proposal._id, docker, { includeStarting: true });

  // Hint is only used when the ZIP has no clear file signals — files always win over assignment title.
  const stackHint = dockerOrchestrator.inferStackHintFromAssignment(assignment);
  const memory = Number(process.env.PREVIEW_MEMORY_BYTES || 268435456);
  const nanoCpus = Number(process.env.PREVIEW_NANO_CPUS || 500000000);
  const ttl = PREVIEW_TTL_MS;

  const zipAbs = path.join(process.cwd(), 'uploads', submission.storedRelativePath);
  if (!fsSync.existsSync(zipAbs)) {
    const err = new Error('Stored archive missing on server');
    err.status = 500;
    throw err;
  }

  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholar-preview-'));
  const stackLabel =
    stackOverride && ['node-js', 'php-apache', 'jupyter'].includes(stackOverride)
      ? stackOverride === 'node-js'
        ? 'React / Node.js'
        : stackOverride === 'php-apache'
          ? 'PHP / Apache'
          : 'Jupyter notebook'
      : 'Auto-detect from ZIP';

  const session = await PreviewSession.create({
    teacher: teacherId,
    proposal: proposal._id,
    submission: submission._id,
    assignment: assignment._id,
    status: 'starting',
    previewStack: stackOverride || '',
    memoryBytes: memory,
    nanoCpus,
    ttlMs: ttl,
    extractDirPath: extractDir,
    logs: [
      { level: 'info', message: 'Session created; extracting archive.' },
      {
        level: 'info',
        message:
          stackOverride != null
            ? `Container type selected by teacher: ${stackLabel} (file auto-detect skipped).`
            : `Container type: ${stackLabel}.`,
      },
    ],
    startedAt: new Date(),
  });

  try {
    safeExtractZip(zipAbs, extractDir);
    appendLog(session, 'info', 'Archive extracted safely; starting container.');

    const discovered = await previewCredentials.discoverPreviewCredentialsFromExtract(extractDir);
    const login = previewCredentials.resolvePreviewLoginCredentials({
      teacherEmail: adminEmail,
      teacherPassword: adminPassword,
      discovered,
    });
    session.previewLoginEmail = login.email;
    session.previewLoginPassword = login.password;
    session.previewLoginSource = login.source;
    session.previewLoginHint = login.hint;
    appendLog(
      session,
      'info',
      `Preview login for teacher: ${login.email} (source: ${login.source.replace(/_/g, ' ')}).`
    );

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
    const credentialEnv = previewCredentials.buildPreviewCredentialEnvVars({
      email: session.previewLoginEmail,
      password: session.previewLoginPassword,
      mongoUri: previewMern.buildPreviewMongoUri(session._id.toString()),
    });

    appendLog(
      session,
      'info',
      'Starting Docker deploy (first full-stack preview may take up to 10 minutes while the MongoDB image downloads).'
    );
    await session.save();

    deployResult = await dockerOrchestrator.deployProjectPreview(session._id.toString(), extractDir, {
      allowedRoot: extractDir,
      imageKey: submission._id.toString(),
      stackHint,
      stack: stackOverride || null,
      forceRebuild: false,
      previewCredentialEnv: credentialEnv,
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
  session.previewApiHostPort = deployResult.apiHostPort ? String(deployResult.apiHostPort) : '';
  session.previewUrl = deployResult.previewUrl;
  session.previewApiUrl = deployResult.previewApiUrl || '';
  const loginPath =
    deployResult.stack === 'php-apache'
      ? deployResult.phpLoginPath || '/auth/login.php'
      : '/login';
  session.previewLoginUrl = previewCredentials.buildPreviewLoginUrl(deployResult.previewUrl, loginPath);
  if (deployResult.stack === 'php-apache') {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}PHP preview uses the mapped port (e.g. :${deployResult.hostPort}), not localhost/BBMS. Open ${session.previewLoginUrl}. Default BBMS admin is often username admin / Admin@123 if no project credentials were found.`;
  }
  if (deployResult.flutterPair && deployResult.apiHostPort) {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}Flutter web preview: app UI on port ${deployResult.hostPort}, Node API on port ${deployResult.apiHostPort}. First start may take several minutes while Flutter builds for web.`;
    appendLog(
      session,
      'info',
      `Flutter+Node preview: web UI :${deployResult.hostPort}, API :${deployResult.apiHostPort}`
    );
  } else if (deployResult.mernPair && deployResult.apiHostPort) {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}Full-stack preview: UI on port ${deployResult.hostPort}, student API on port ${deployResult.apiHostPort}. MongoDB runs in a sidecar container for preview (no host Mongo setup required).`;
    appendLog(
      session,
      'info',
      `MERN preview: frontend :${deployResult.hostPort}, API :${deployResult.apiHostPort}`
    );
  }
  session.previewImage = deployResult.imageTag;
  session.previewStack = deployResult.stack;
  const stackDisplay =
    deployResult.stack === 'node-js'
      ? 'React / Node.js (node-js)'
      : deployResult.stack === 'php-apache'
        ? 'PHP / Apache (php-apache)'
        : deployResult.stack === 'jupyter'
          ? 'Jupyter (jupyter)'
          : deployResult.stack;

  if (stackOverride != null) {
    appendLog(session, 'info', `Running with teacher-selected stack: ${stackDisplay}.`);
  } else {
    appendLog(
      session,
      'info',
      `Auto-detected stack: ${stackDisplay} — ${deployResult.detectionReason || 'from project files'}`
    );
  }

  appendLog(
    session,
    'info',
    `${deployResult.imageReused ? 'Reused' : 'Built'} ${stackDisplay} image (app dir: ${deployResult.appSubdir || '.'}); host:${deployResult.hostPort} -> container:${deployResult.internalPort}`
  );
  appendLog(session, 'info', `Container started; warming up app at ${session.previewUrl}`);
  appendLog(
    session,
    'info',
    `Use login ${session.previewLoginEmail} / (password shown in teacher panel) at ${session.previewLoginUrl || session.previewUrl}`
  );
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

  if (session.status === 'running') {
    const live = await PreviewSession.findById(sessionId);
    if (live) {
      await touchPreviewTtl(live);
      session.expiresAt = live.expiresAt;
    }
  }

  if (['starting', 'running'].includes(session.status)) {
    try {
      const tail = await dockerOrchestrator.getContainerLogs(
        dockerOrchestrator.containerNameFor(sessionId.toString()),
        40
      );
      if (tail?.trim()) {
        session.liveContainerLog = tail.slice(-2000);
      }
    } catch {
      /* ignore */
    }

    const hostPort = Number(session.hostPort);
    if (hostPort > 0) {
      session.portReachable = await dockerOrchestrator.isTcpPortOpen('127.0.0.1', hostPort);
      const apiPort = Number(session.previewApiHostPort);
      if (apiPort > 0) {
        session.apiPortReachable = await dockerOrchestrator.isTcpPortOpen('127.0.0.1', apiPort);
      }
      const running = await dockerOrchestrator.isPreviewContainerRunning(
        dockerOrchestrator.containerNameFor(sessionId.toString())
      );
      session.containerRunning = running;
    }
  }

  return session;
}
