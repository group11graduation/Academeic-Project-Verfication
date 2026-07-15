import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import Docker from 'dockerode';
import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import { isProjectStackHint } from '../constants/projectStackHints.js';
import { getPreviewProbeHost } from '../config/previewProbe.js';
import * as previewCredentials from './previewCredentials.service.js';
import * as previewWorkspaceCache from './previewWorkspaceCache.service.js';
import * as previewMern from './previewMern.service.js';
import * as previewSpring from './previewSpring.service.js';
import * as previewLoginVerify from './previewLoginVerify.service.js';
import { buildPhpPreviewLoginHint, parsePhpBootstrapCredentialsFromLog } from './previewPhp.service.js';
import {
  executeZipExtractionBarrier,
  executeTechAuditBarrier,
  executePreviewStructureBarrier,
  launchSandboxContainer,
  handlePreviewContainerExit,
  rmExtractDirSafe,
  SubmissionPipelineError,
  SUBMISSION_ERROR_CODES,
} from './submissionErrorHandler.service.js';
import { PreviewSession } from '../models/PreviewSession.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Proposal } from '../models/Proposal.js';
import { Assignment } from '../models/Assignment.js';
import { isProposalFullyApprovedForProject } from './collaborativeProposalReview.service.js';
import { teacherCanAccessAssignmentReview } from './teacherAssignmentAccess.service.js';
import { uploadPath } from '../config/env.js';

const PREVIEW_STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_STARTUP_TIMEOUT_MS || 600000);
const PREVIEW_SESSION_PORT_PROBE_MS = Number(process.env.PREVIEW_SESSION_PORT_PROBE_MS || 5_000);
const PREVIEW_STATIC_STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_STATIC_STARTUP_TIMEOUT_MS || 90000);
const PREVIEW_SPRING_STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_SPRING_STARTUP_TIMEOUT_MS || 1800000);
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
  await reconcileOrphanedPreviewSessionsOnStartup();
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

function deployResultFromSession(session) {
  return {
    previewUrl: session.previewUrl,
    previewApiUrl: session.previewApiUrl || '',
    hostPort: Number(session.hostPort) || null,
    apiHostPort: Number(session.previewApiHostPort) || null,
    containerName: dockerOrchestrator.containerNameFor(session._id.toString()),
    stack: session.previewStack || 'node-js',
    springPair: null,
    mernPair: null,
    flutterPair: null,
  };
}

/**
 * Clear or resume preview sessions left in "starting"/"running" after an API restart
 * or when the Docker container is no longer alive.
 */
const ORPHAN_STARTING_GRACE_MS = Number(process.env.PREVIEW_ORPHAN_GRACE_MS || 600_000);

export async function reconcileStalePreviewSession(sessionId) {
  const session = await PreviewSession.findById(sessionId);
  if (!session) return null;
  if (!['starting', 'running', 'runtime_error'].includes(session.status)) return session;

  const containerName = dockerOrchestrator.containerNameFor(session._id.toString());
  let containerRunning = false;
  try {
    containerRunning = await dockerOrchestrator.isPreviewContainerRunning(containerName);
  } catch {
    containerRunning = false;
  }
  // Double-check to avoid marking sessions dead on transient docker inspect races.
  if (!containerRunning) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      containerRunning = await dockerOrchestrator.isPreviewContainerRunning(containerName);
    } catch {
      containerRunning = false;
    }
  }

  const startedMs = session.startedAt ? new Date(session.startedAt).getTime() : 0;
  const startingGrace =
    session.status === 'starting' && startedMs > 0 && Date.now() - startedMs < ORPHAN_STARTING_GRACE_MS;

  if (session.status === 'running' && !containerRunning) {
    session.status = 'failed';
    session.errorMessage =
      'Preview container stopped (server may have restarted). Click Start preview again.';
    session.endedAt = new Date();
    appendLog(session, 'warn', session.errorMessage);
    await session.save();
    return session;
  }

  if (session.status === 'starting') {
    if (!containerRunning) {
      if (startingGrace || readinessJobs.has(session._id.toString())) {
        return session;
      }
      const lastError = [...(session.logs || [])].reverse().find((l) => l.level === 'error');
      session.status = 'failed';
      session.errorMessage =
        (lastError?.message && !lastError.message.startsWith('Container log'))
          ? lastError.message
          : session.errorMessage ||
            'Preview did not finish starting (container stopped). Click Start preview again and check the log below.';
      session.endedAt = new Date();
      if (!lastError) {
        appendLog(session, 'warn', 'Cleared stale starting session — no running container.');
      }
      await session.save();
      return session;
    }

    if (session.previewUrl && !readinessJobs.has(session._id.toString())) {
      appendLog(session, 'info', 'Resuming preview readiness check after server restart.');
      await session.save();
      const deployResult = deployResultFromSession(session);
      setImmediate(() => {
        finalizePreviewReadiness(session._id, deployResult, session.extractDirPath || '').catch((err) => {
          console.error('preview readiness resume', err);
        });
      });
    }
  }

  return session;
}

/** On API boot: fail dead sessions and resume in-flight ones that still have a live container. */
export async function reconcileOrphanedPreviewSessionsOnStartup() {
  if (!dockerEnabled()) return;
  const sessions = await PreviewSession.find({ status: { $in: ['starting', 'running'] } });
  for (const session of sessions) {
    // eslint-disable-next-line no-await-in-loop
    await reconcileStalePreviewSession(session._id);
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

  // Keep persistent workspace on disk for faster next start (cleared only when ZIP changes).

  session.status = finalStatus;
  session.endedAt = new Date();
  appendLog(session, 'info', logMessage);
  await session.save();
}

async function refreshPhpPreviewLoginHint(session, deployResult = {}) {
  if (!session || session.previewStack !== 'php-apache') return;

  const containerName =
    deployResult.containerName || dockerOrchestrator.containerNameFor(session._id.toString());
  const bootstrapLog = await dockerOrchestrator.readPreviewMysqlBootstrapLog(containerName);
  const bootstrapCredentials = parsePhpBootstrapCredentialsFromLog(bootstrapLog);
  const phpMeta = deployResult.phpPatchMeta || {};

  session.previewLoginHint = buildPhpPreviewLoginHint({
    previewLoginUrl: session.previewLoginUrl,
    hostPort: deployResult.hostPort || session.hostPort,
    dbName: phpMeta.dbName || deployResult.dbName,
    adminCredentials: phpMeta.adminCredentials || {},
    projectCredentials: {
      username: session.previewLoginEmail,
      password: session.previewLoginPassword,
    },
    bootstrapCredentials,
  });

  if (bootstrapCredentials?.password) {
    session.previewLoginPassword = bootstrapCredentials.password;
    session.previewLoginEmail = bootstrapCredentials.username || 'admin';
    session.previewLoginIdentifierType = bootstrapCredentials.identifierType || 'username';
    session.previewLoginIdentifierLabel =
      bootstrapCredentials.identifierType === 'email' ? 'Email' : 'Username';
    session.previewLoginSource = bootstrapCredentials.usernameAssumed
      ? 'bootstrap_log_assumed_username'
      : 'bootstrap_log';
  }
}

async function finalizePreviewReadiness(sessionId, deployResult, extractDir) {
  const jobKey = sessionId.toString();
  if (readinessJobs.has(jobKey)) return;
  readinessJobs.add(jobKey);

  try {
    const startupTimeout =
      deployResult.stack === 'static-html' || deployResult.stack === 'static-html-js'
        ? PREVIEW_STATIC_STARTUP_TIMEOUT_MS
        : deployResult.stack === 'java-spring-react'
          ? PREVIEW_SPRING_STARTUP_TIMEOUT_MS
          : PREVIEW_STARTUP_TIMEOUT_MS;
    const wait = await dockerOrchestrator.waitForPreviewReady({
      previewUrl: deployResult.previewUrl,
      apiPreviewUrl: deployResult.previewApiUrl || '',
      containerName: deployResult.containerName,
      stack: deployResult.stack,
      timeoutMs: startupTimeout,
    });

    const session = await PreviewSession.findById(sessionId);
    if (!session || session.status !== 'starting') return;

    if (wait.ready) {
      session.status = 'running';
      session.previewStack = deployResult.stack || session.previewStack;
      if (deployResult.stack === 'php-apache') {
        await refreshPhpPreviewLoginHint(session, deployResult);
      }
      if (deployResult.apiHostPort && session.previewLoginEmail && session.previewLoginPassword) {
        const backendLog = await dockerOrchestrator.readPreviewBackendLog(deployResult.containerName, 40);
        const seedLines = backendLog
          .split('\n')
          .filter(
            (l) =>
              l.includes('[preview-seed]') ||
              l.includes('[preview-login]') ||
              l.includes('[preview] MONGO_URI') ||
              l.includes('[preview] Spring') ||
              l.includes('[preview] mvn')
          )
          .slice(-12);
        for (const line of seedLines) {
          appendLog(session, 'info', line.trim());
        }

        if (wait.apiReady === false || wait.reason === 'http_ui_spring_api_timeout') {
          appendLog(
            session,
            'warn',
            `Spring API on :${deployResult.apiHostPort} is still starting (Maven may take several minutes). Wait, then try login — check /tmp/preview-spring.log in the container if it stays down.`
          );
          const springTail = await dockerOrchestrator
            .execInPreviewContainer(
              deployResult.containerName,
              'tail -n 40 /tmp/preview-spring.log 2>/dev/null || true',
              { timeoutMs: 15_000 }
            )
            .catch(() => '');
          if (springTail?.trim()) {
            appendLog(session, 'warn', `Spring build log:\n${springTail.trim().slice(-2000)}`);
          }
        } else {
          let loginPaths = [];
          let fallbackCredentials = [];
          if (extractDir) {
            if (deployResult.stack === 'java-spring-react') {
              const springSubdir = deployResult.springPair?.springSubdir || '.';
              loginPaths = await previewSpring.discoverSpringLoginApiPaths(extractDir, springSubdir);
            } else {
              const backendSubdir = deployResult.mernPair?.backendSubdir || 'backend';
              loginPaths = await previewMern.discoverLoginApiPaths(extractDir, backendSubdir);
            }
            const discovered = await previewCredentials.discoverPreviewCredentialsFromExtract(extractDir);
            fallbackCredentials = previewLoginVerify.buildFallbackPreviewCredentials(discovered);
          }
          const loginCheck = await previewLoginVerify.verifyAndFixMernPreviewLogin({
            containerName: deployResult.containerName,
            apiHostPort: Number(deployResult.apiHostPort || session.previewApiHostPort),
            backendSubdir:
              deployResult.mernPair?.backendSubdir ||
              deployResult.springPair?.springSubdir ||
              'backend',
            email: session.previewLoginEmail,
            password: session.previewLoginPassword,
            identifierType: session.previewLoginIdentifierType,
            loginPaths,
            fallbackCredentials,
          });
          if (loginCheck.ok) {
            appendLog(session, 'info', loginCheck.message);
            if (loginCheck.workingCredentials) {
              session.previewLoginEmail = loginCheck.workingCredentials.email;
              session.previewLoginPassword = loginCheck.workingCredentials.password;
              session.previewLoginSource = 'project_seed_fallback';
              session.previewLoginHint =
                'Preview admin account could not be seeded; using credentials from the student project seed/setup script.';
              appendLog(
                session,
                'info',
                `Use these working credentials: ${session.previewLoginIdentifierLabel || 'Email'}=${session.previewLoginEmail}`
              );
            }
          } else {
            appendLog(session, 'warn', loginCheck.message);
            if (loginCheck.seedTail) {
              appendLog(session, 'warn', `Admin seed log:\n${loginCheck.seedTail}`);
            } else if (loginCheck.seedOutput) {
              const tail = String(loginCheck.seedOutput).split('\n').slice(-6).join('\n');
              if (tail) appendLog(session, 'warn', `Admin seed output:\n${tail}`);
            }
          }
        }
      }
      appendLog(session, 'info', `Preview ready (${wait.reason}) at ${session.previewUrl}.`);
      if (session.extractDirPath) {
        await previewWorkspaceCache.markWorkspacePreviewReady(session.extractDirPath).catch(() => {});
      }
      if (session.submission) {
        await ProjectSubmission.findByIdAndUpdate(session.submission, {
          teacherPreviewedAt: new Date(),
        }).catch(() => {});
      }
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

    if (wait.reason === 'container_exited') {
      await handlePreviewContainerExit({
        sessionId,
        containerName: deployResult.containerName,
        extractDir,
        reason: 'Preview container stopped unexpectedly. Check runtime traceback below.',
      });
      return;
    }

    if (wait.reason === 'container_error') {
      const tailLogs = wait.logs || (await dockerOrchestrator.getContainerLogs(deployResult.containerName, 150));
      await dockerOrchestrator
        .stopProjectPreview(sessionId.toString(), {
          hostPort: deployResult.hostPort,
          apiHostPort: deployResult.apiHostPort || null,
          imageKey: session.submission?.toString?.() || sessionId.toString(),
          stack: deployResult.stack,
        })
        .catch(() => {});

      session.status = 'failed';
      session.errorMessage = `Preview failed: ${wait.logError || 'Container reported an error.'}`;
      session.validationFailures = [
        {
          rule: 'container_runtime',
          message: wait.logError || 'The student app failed inside Docker. See container log below.',
        },
      ];
      session.runtimeTraceback = tailLogs.slice(-8000);
      session.endedAt = new Date();
      appendLog(session, 'error', session.errorMessage);
      if (tailLogs.trim()) {
        appendLog(session, 'error', `Container log:\n${tailLogs.slice(-2500)}`);
      }
      await session.save();
      return;
    }

    const stillRunning = await dockerOrchestrator.isPreviewContainerRunning(deployResult.containerName);
    if (stillRunning && deployResult.stack === 'java-spring-react') {
      session.status = 'running';
      session.previewStack = deployResult.stack || session.previewStack;
      appendLog(
        session,
        'info',
        'Preview container is still building (npm install + React build + Maven can take 20–30 min on first start). Keep this page open — Open preview will unlock when the UI responds.'
      );
      await schedulePreviewTtl(session);
      await session.save();
      return;
    }

    const tailLogs =
      wait.logs || (await dockerOrchestrator.getContainerLogs(deployResult.containerName, 150));
    const logError = dockerOrchestrator.parsePreviewContainerErrors(tailLogs);

    const lastProbe = await dockerOrchestrator.checkPreviewAppHttpReady({
      previewUrl: deployResult.previewUrl,
      apiPreviewUrl: deployResult.previewApiUrl || '',
      stack: deployResult.stack,
    });
    const logReady = dockerOrchestrator.detectPreviewReadyFromLogs(tailLogs, deployResult.stack);

    if (lastProbe.ready || logReady?.ready) {
      session.status = 'running';
      session.previewStack = deployResult.stack || session.previewStack;
      if (deployResult.stack === 'php-apache') {
        await refreshPhpPreviewLoginHint(session, deployResult);
      }
      const reason = lastProbe.reason || logReady?.reason || 'ready';
      appendLog(session, 'info', `Preview ready (${reason}) at ${session.previewUrl}.`);
      if (lastProbe.apiReady === false && deployResult.apiHostPort) {
        appendLog(
          session,
          'warn',
          `Student API on port ${deployResult.apiHostPort} is still starting — login may fail until the backend is up.`
        );
      }
      if (session.extractDirPath) {
        await previewWorkspaceCache.markWorkspacePreviewReady(session.extractDirPath).catch(() => {});
      }
      await schedulePreviewTtl(session);
      await session.save();
      return;
    }

    const diagnosis = dockerOrchestrator.diagnosePreviewFailure({
      wait,
      session,
      logs: tailLogs,
    });
    if (!diagnosis.failed && diagnosis.ready) {
      session.status = 'running';
      session.previewStack = deployResult.stack || session.previewStack;
      if (deployResult.stack === 'php-apache') {
        await refreshPhpPreviewLoginHint(session, deployResult);
      }
      appendLog(session, 'info', `Preview ready (${diagnosis.reason || 'log'}) at ${session.previewUrl}.`);
      if (session.extractDirPath) {
        await previewWorkspaceCache.markWorkspacePreviewReady(session.extractDirPath).catch(() => {});
      }
      await schedulePreviewTtl(session);
      await session.save();
      return;
    }

    await dockerOrchestrator
      .stopProjectPreview(sessionId.toString(), {
        hostPort: deployResult.hostPort,
        apiHostPort: deployResult.apiHostPort || null,
        imageKey: session.submission?.toString?.() || sessionId.toString(),
        stack: deployResult.stack,
      })
      .catch(() => {});
    // Keep persistent workspace for faster retry on next Start preview.

    session.status = 'failed';
    session.errorMessage =
      diagnosis.message ||
      (logError ? `Preview failed: ${logError}` : dockerOrchestrator.describePreviewWaitFailure(wait, session));
    session.validationFailures =
      diagnosis.failures?.length > 0
        ? diagnosis.failures
        : logError
          ? [{ rule: 'container_runtime', message: logError }]
          : [];
    session.runtimeTraceback = tailLogs.slice(-8000);
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

async function stopActiveSessionsForProposalTeacher(proposalId, teacherId, docker, { includeStarting = true } = {}) {
  const statuses = includeStarting
    ? ['starting', 'running', 'runtime_error']
    : ['running'];
  const list = await PreviewSession.find({
    proposal: proposalId,
    teacher: teacherId,
    status: { $in: statuses },
  });
  for (const s of list) {
    await cleanupSessionResources(s, docker, 'stopped', 'Preview ended (superseded by a new session).');
  }
}

function isPopulatedAssignmentDoc(value) {
  return Boolean(value && typeof value === 'object' && value.teacher != null);
}

async function loadAssignmentForPreviewAccess(session) {
  if (isPopulatedAssignmentDoc(session.assignment)) {
    return typeof session.assignment.toObject === 'function'
      ? session.assignment.toObject()
      : session.assignment;
  }
  const assignmentId = session.assignment?._id || session.assignment;
  if (!assignmentId) return null;
  return Assignment.findById(assignmentId).lean();
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
  if (!teacherCanAccessAssignmentReview(teacherId, assignment)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  if (!isProposalFullyApprovedForProject(proposal, assignment)) {
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

  // Only stop this teacher's prior sessions so co-teachers can preview in parallel.
  await stopActiveSessionsForProposalTeacher(proposal._id, teacherId, docker, { includeStarting: true });

  // Student ZIP hint first, then assignment title — file signals still win when auto-detecting.
  const submissionHint = submission.projectStackHint || null;
  const stackHint = isProjectStackHint(submissionHint)
    ? submissionHint
    : dockerOrchestrator.inferStackHintFromAssignment(assignment);
  const memory = Number(process.env.PREVIEW_MEMORY_BYTES || 268435456);
  const nanoCpus = Number(process.env.PREVIEW_NANO_CPUS || 500000000);
  const ttl = PREVIEW_TTL_MS;

  const zipAbs = uploadPath(submission.storedRelativePath);
  if (!fsSync.existsSync(zipAbs)) {
    const err = new Error('Stored archive missing on server');
    err.status = 500;
    throw err;
  }

  const workspacePrep = await previewWorkspaceCache.prepareSubmissionWorkspace({
    submissionId: submission._id,
    zipAbs,
  });
  const extractDir = workspacePrep.workspaceDir;
  const session = await PreviewSession.create({
    teacher: teacherId,
    proposal: proposal._id,
    submission: submission._id,
    assignment: assignment._id,
    status: 'starting',
    previewStack: stackOverride || '',
    previewWorkspaceCached: workspacePrep.cacheHit || workspacePrep.buildCached,
    memoryBytes: memory,
    nanoCpus,
    ttlMs: ttl,
    extractDirPath: extractDir,
    logs: [
      { level: 'info', message: 'Session created; preparing project workspace.' },
      workspacePrep.cacheHit
        ? {
            level: 'info',
            message:
              'Reusing cached project workspace (2nd+ start — npm/Maven/build artifacts kept; usually 1–3 min).',
          }
        : { level: 'info', message: 'Project type will be detected automatically from ZIP files after extract.' },
    ],
    startedAt: new Date(),
  });

  try {
    if (!workspacePrep.cacheHit) {
      const extractMeta = await executeZipExtractionBarrier({
        zipAbs,
        destDir: extractDir,
        submissionId: submission._id,
        session,
      });
      if (extractMeta.skipped > 0) {
        appendLog(
          session,
          'info',
          `Skipped ${extractMeta.skipped} unneeded path(s) in ZIP (e.g. node_modules, .git, __MACOSX).`
        );
      }
      appendLog(session, 'info', `Extracted ${extractMeta.fileCount} file(s); running technical audit.`);

      const auditStackHint = isProjectStackHint(submission.projectStackHint)
        ? submission.projectStackHint
        : isProjectStackHint(stackHint)
          ? stackHint
          : '';
      await executeTechAuditBarrier({
        extractDir,
        submissionId: submission._id,
        session,
        stackHint: auditStackHint,
        assignment,
      });
      await previewWorkspaceCache.markWorkspaceAuditPassed(extractDir, workspacePrep.fingerprint);
      appendLog(session, 'info', 'Technical audit passed; detecting project type.');
    } else {
      appendLog(session, 'info', 'Skipped ZIP extract and audit (cached workspace matches submission archive).');
    }

    const structureAudit = await executePreviewStructureBarrier({
      extractDir,
      submissionId: submission._id,
      session,
      stackHint: submission.projectStackHint || stackHint || '',
      stackOverride: stackOverride || null,
      keepExtract: previewWorkspaceCache.isPersistentWorkspaceDir(extractDir),
    });
    session.previewStack = structureAudit.stack || stackOverride || '';
    const stackReason =
      structureAudit.detection?.reasons?.length > 0
        ? ` (${structureAudit.detection.reasons.slice(0, 2).join('; ')})`
        : '';
    appendLog(session, 'info', `Project structure OK — detected stack: ${structureAudit.stack}${stackReason}.`);

    const discovered = await previewCredentials.discoverPreviewCredentialsFromExtract(extractDir);
    const login = previewCredentials.resolvePreviewLoginCredentials({
      teacherEmail: adminEmail,
      teacherPassword: adminPassword,
      discovered,
    });
    previewCredentials.applyResolvedLoginCredentials(session, login);
    appendLog(
      session,
      'info',
      `Preview login for teacher: ${login.identifierLabel}=${login.identifier} (source: ${login.source.replace(/_/g, ' ')}).`
    );

    await session.save();
  } catch (e) {
    if (e instanceof SubmissionPipelineError) {
      if (e.code !== SUBMISSION_ERROR_CODES.TECH_AUDIT_REJECTED) {
        session.status = 'failed';
        session.errorMessage = e.publicError || e.message;
        session.endedAt = new Date();
        appendLog(session, 'error', session.errorMessage);
        await session.save();
      }
      throw e;
    }
    if (!previewWorkspaceCache.isPersistentWorkspaceDir(extractDir)) {
      await rmExtractDirSafe(extractDir);
    }
    session.status = 'failed';
    session.errorMessage = e.message || 'Extract failed';
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    await session.save();
    throw e;
  }
  let deployResult;
  const containerName = dockerOrchestrator.containerNameFor(session._id.toString());
  try {
    const credentialEnv = previewCredentials.buildPreviewCredentialEnvVars({
      email: session.previewLoginEmail,
      password: session.previewLoginPassword,
      username:
        session.previewLoginIdentifierType === 'username' ? session.previewLoginEmail : '',
      mongoUri: previewMern.buildPreviewMongoUri(session._id.toString()),
    });

    appendLog(
      session,
      'info',
      'Starting Docker preview (pre-built template image + bind-mounted project; first start of a stack may build the base image once).'
    );
    await session.save();

    deployResult = await launchSandboxContainer({
      sessionId: session._id,
      submissionId: submission._id,
      extractDir,
      containerName,
      deployFn: () =>
        dockerOrchestrator.deployProjectPreview(session._id.toString(), extractDir, {
          allowedRoot: extractDir,
          imageKey: submission._id.toString(),
          stackHint,
          stack: stackOverride || null,
          forceRebuild: false,
          previewCredentialEnv: credentialEnv,
          workspaceCached: workspacePrep.cacheHit || workspacePrep.buildCached,
        }),
    });
  } catch (e) {
    if (e instanceof SubmissionPipelineError && e.code === SUBMISSION_ERROR_CODES.RUNTIME_ERROR) {
      throw e;
    }
    if (!previewWorkspaceCache.isPersistentWorkspaceDir(extractDir)) {
      await rmExtractDirSafe(extractDir);
    }
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

  const phpMeta = deployResult.phpPatchMeta || {};
  const springMeta = deployResult.springPatchMeta || {};
  const resolvedLogin = await previewCredentials.buildPreviewLoginCredentials({
    extractDir,
    loginPath,
    teacherEmail: adminEmail,
    teacherPassword: adminPassword,
    phpAdmin: phpMeta.adminCredentials || null,
    springAdmin: springMeta.seedCredentials || null,
  });
  previewCredentials.applyResolvedLoginCredentials(session, resolvedLogin);

  if (deployResult.stack === 'php-apache') {
    session.previewLoginHint = buildPhpPreviewLoginHint({
      previewLoginUrl: session.previewLoginUrl,
      hostPort: deployResult.hostPort,
      dbName: phpMeta.dbName,
      adminCredentials: phpMeta.adminCredentials,
      projectCredentials: {
        username: session.previewLoginEmail,
        password: session.previewLoginPassword,
      },
    });
    if (phpMeta.bootstrapScripts?.length) {
      appendLog(
        session,
        'info',
        `PHP bootstrap: ${phpMeta.bootstrapScripts.join(', ')} (${phpMeta.patchedFiles || 0} config file(s) patched).`
      );
    }
  }
  if (deployResult.stack === 'static-html' || deployResult.stack === 'static-html-js') {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}Static web preview — open the URL in Chrome to view the student site (no server login unless their page includes one).`;
    appendLog(session, 'info', `Static site preview on port ${deployResult.hostPort}`);
  } else if (deployResult.flutterPair && deployResult.apiHostPort) {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}Flutter web preview: app UI on port ${deployResult.hostPort}, Node API on port ${deployResult.apiHostPort}. First start may take several minutes while Flutter builds for web.`;
    appendLog(
      session,
      'info',
      `Flutter+Node preview: web UI :${deployResult.hostPort}, API :${deployResult.apiHostPort}`
    );
  } else if (deployResult.springPair && deployResult.apiHostPort) {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}React + Spring Boot preview: UI on port ${deployResult.hostPort}, Java API on port ${deployResult.apiHostPort}. First start may take 5–15 minutes (Maven + npm).`;
    if (springMeta.seedCredentials?.username) {
      session.previewLoginHint += ` Sign in with ${session.previewLoginIdentifierLabel || 'Username'}=${springMeta.seedCredentials.username} (seeded in H2 on first API start).`;
    } else {
      session.previewLoginHint += ' Use the Register tab on the login page if no preview admin was seeded.';
    }
    appendLog(
      session,
      'info',
      `React + Spring Boot preview: UI :${deployResult.hostPort}, Spring API :${deployResult.apiHostPort} (${deployResult.springPair.springSubdir} + ${deployResult.springPair.frontendSubdir})`
    );
  } else if (deployResult.mernPair && deployResult.apiHostPort) {
    const baseHint = session.previewLoginHint ? `${session.previewLoginHint} ` : '';
    session.previewLoginHint =
      `${baseHint}React + Express preview: UI on port ${deployResult.hostPort}, Express API on port ${deployResult.apiHostPort}. MongoDB runs in a sidecar container for preview (no host Mongo setup required).`;
    appendLog(
      session,
      'info',
      `React + Express preview: frontend :${deployResult.hostPort}, API :${deployResult.apiHostPort}`
    );
  }
  session.previewImage = deployResult.imageTag;
  session.previewStack = deployResult.stack;
  session.previewTemplateCached = Boolean(deployResult.imageReused);
  session.previewStackLabel = deployResult.stackDisplayName || dockerOrchestrator.previewStackDisplayName(deployResult.stack);
  const stackName = session.previewStackLabel;
  const stackDisplay =
    deployResult.mernPair?.detectionNote || deployResult.springPair?.detectionNote
      ? `${stackName} — ${deployResult.mernPair?.detectionNote || deployResult.springPair?.detectionNote}`
      : `${stackName} (${deployResult.stack})`;

  appendLog(
    session,
    'info',
    `Detected project type: ${stackDisplay} — ${deployResult.detectionReason || 'from ZIP files'}`
  );
  appendLog(
    session,
    'info',
    `${deployResult.imageReused ? 'Using cached' : 'Prepared'} Docker template for ${stackName}; ZIP mounted (no full rebuild).`
  );
  appendLog(
    session,
    'info',
    `Container started (app folder: ${deployResult.appSubdir || '.'}); preview URL host:${deployResult.hostPort}`
  );
  if (deployResult.stack !== 'static-html' && deployResult.stack !== 'static-html-js') {
      appendLog(
        session,
        'info',
        `Use login ${session.previewLoginIdentifierLabel || 'Email'}=${session.previewLoginEmail} at ${session.previewLoginUrl || session.previewUrl}`
      );
  }
  await session.save();

  // Return immediately — readiness continues in background (React/Vite installs can take several minutes)
  setImmediate(() => {
    finalizePreviewReadiness(session._id, deployResult, extractDir).catch((err) => {
      console.error('preview readiness', err);
    });
  });

  return session;
}

async function assertTeacherCanAccessPreviewSession(teacherId, session) {
  const assignment = await loadAssignmentForPreviewAccess(session);
  if (!teacherCanAccessAssignmentReview(teacherId, assignment)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

export async function stopPreviewForTeacher(teacherId, sessionId) {
  const session = await PreviewSession.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  await assertTeacherCanAccessPreviewSession(teacherId, session);
  if (String(session.teacher) !== String(teacherId)) {
    const err = new Error('Only the teacher who started this preview can stop it.');
    err.status = 403;
    throw err;
  }
  if (!['starting', 'running', 'runtime_error'].includes(session.status)) {
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

async function maybeFailPreviewFromContainerLogs(session) {
  if (!session || session.status !== 'starting') return session;

  const containerName = dockerOrchestrator.containerNameFor(session._id.toString());
  const tail = await dockerOrchestrator.getContainerLogs(containerName, 150);
  const logError = dockerOrchestrator.parsePreviewContainerErrors(tail);
  if (!logError) return session;

  const live = await PreviewSession.findById(session._id);
  if (!live || live.status !== 'starting') {
    return live ? (typeof live.toObject === 'function' ? live.toObject() : live) : session;
  }

  await dockerOrchestrator
    .stopProjectPreview(session._id.toString(), {
      hostPort: Number(live.hostPort) || null,
      apiHostPort: Number(live.previewApiHostPort) || null,
      imageKey: live.submission?.toString?.() || live._id.toString(),
      stack: live.previewStack || 'node-js',
    })
    .catch(() => {});

  live.status = 'failed';
  live.errorMessage = `Preview failed: ${logError}`;
  live.validationFailures = [{ rule: 'container_runtime', message: logError }];
  live.runtimeTraceback = tail.slice(-8000);
  live.endedAt = new Date();
  live.logs.push({ level: 'error', message: live.errorMessage, at: new Date() });
  if (tail.trim()) {
    live.logs.push({
      level: 'error',
      message: `Container log:\n${tail.slice(-2500)}`,
      at: new Date(),
    });
  }
  await live.save();
  const out = typeof live.toObject === 'function' ? live.toObject() : { ...live };
  delete out.extractDirPath;
  return out;
}

export async function getPreviewSessionForTeacher(teacherId, sessionId) {
  await reconcileStalePreviewSession(sessionId);

  const session = await PreviewSession.findById(sessionId).lean();
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  await assertTeacherCanAccessPreviewSession(teacherId, session);
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
        80
      );
      if (tail?.trim()) {
        session.liveContainerLog = tail.slice(-2000);
        const logReady = dockerOrchestrator.detectPreviewReadyFromLogs(tail, session.previewStack || 'node-js');
        if (logReady?.ready) {
          session.previewAppReady = true;
          session.previewAppReadyReason = logReady.reason;
        }
      }
    } catch {
      /* ignore */
    }

    if (session.status === 'starting') {
      const failed = await maybeFailPreviewFromContainerLogs(session);
      if (failed?.status === 'failed') {
        delete failed.extractDirPath;
        return failed;
      }
    }

    const hostPort = Number(session.hostPort);
    if (hostPort > 0) {
      const probeHost = getPreviewProbeHost();
      const portProbeMs =
        session.status === 'starting' ? PREVIEW_SESSION_PORT_PROBE_MS : Math.min(PREVIEW_SESSION_PORT_PROBE_MS, 2_000);
      session.portReachable = session.previewUrl
        ? await dockerOrchestrator.waitForHostPortPublished({
            previewUrl: session.previewUrl,
            host: probeHost,
            port: hostPort,
            timeoutMs: portProbeMs,
          })
        : await dockerOrchestrator.pollTcpPortOpen(probeHost, hostPort, { timeoutMs: portProbeMs });
      const apiPort = Number(session.previewApiHostPort);
      if (apiPort > 0) {
        session.apiPortReachable = await dockerOrchestrator.pollTcpPortOpen(probeHost, apiPort, {
          timeoutMs: portProbeMs,
        });
      }
      const running = await dockerOrchestrator.isPreviewContainerRunning(
        dockerOrchestrator.containerNameFor(sessionId.toString())
      );
      session.containerRunning = running;

      if (session.portReachable && session.previewUrl) {
        const stack = session.previewStack || 'node-js';
        const needsApi = apiPort > 0;
        const apiOk = !needsApi || session.apiPortReachable === true;
        const springUiWithoutApi = stack === 'java-spring-react' && !apiOk;
        if (apiOk || springUiWithoutApi) {
          const probe = await dockerOrchestrator.checkPreviewAppHttpReady({
            previewUrl: session.previewUrl,
            apiPreviewUrl: session.previewApiUrl || '',
            stack,
          });
          session.previewAppReady = probe.ready;
          session.previewAppReadyReason = probe.reason;
          session.previewApiReady = probe.apiReady === true;
        } else {
          session.previewAppReady = false;
          session.previewAppReadyReason = 'api_port_closed';
          session.previewApiReady = false;
        }

        // Spring: if UI responds while readiness job is still waiting on Maven, unlock teachers now.
        if (
          session.status === 'starting' &&
          session.previewAppReady &&
          running &&
          stack === 'java-spring-react'
        ) {
          session.status = 'running';
          const alreadyNoted = (session.logs || []).some(
            (l) => typeof l.message === 'string' && l.message.includes('Preview UI ready')
          );
          if (!alreadyNoted) {
            appendLog(
              session,
              'info',
              session.previewApiReady
                ? `Preview ready (UI + Spring API) at ${session.previewUrl}.`
                : `Preview UI ready at ${session.previewUrl}. Spring API on :${apiPort} may still be starting — login can fail until it listens.`
            );
          }
          await schedulePreviewTtl(session);
          await session.save();
        }

        // Spring: API down for a while → pull diagnosis once so teachers see why login fails.
        if (
          stack === 'java-spring-react' &&
          running &&
          session.previewAppReady &&
          !session.previewApiReady &&
          apiPort > 0
        ) {
          const alreadyDiag = (session.logs || []).some(
            (l) => typeof l.message === 'string' && l.message.includes('[preview] DIAGNOSIS:')
          );
          const startedMs = session.startedAt ? new Date(session.startedAt).getTime() : 0;
          const waitMs = Number(process.env.PREVIEW_SPRING_DIAGNOSE_AFTER_MS || 90_000);
          if (!alreadyDiag && startedMs > 0 && Date.now() - startedMs > waitMs) {
            const springTail = await dockerOrchestrator
              .execInPreviewContainer(
                dockerOrchestrator.containerNameFor(sessionId.toString()),
                'tail -n 80 /tmp/preview-spring.log 2>/dev/null; echo "---"; grep -E "DIAGNOSIS:|Cannot load driver|APPLICATION FAILED|COMPILATION ERROR|Could not resolve placeholder|Address already in use|Failed to configure a DataSource" /tmp/preview-spring.log 2>/dev/null | tail -n 20 || true',
                { timeoutMs: 20_000 }
              )
              .catch(() => '');
            if (springTail?.trim()) {
              appendLog(
                session,
                'warn',
                `Spring API on :${apiPort} is not listening — login will fail until it starts. Build/runtime log:\n${springTail.trim().slice(-2500)}`
              );
              if (/Cannot load driver class/i.test(springTail)) {
                appendLog(
                  session,
                  'warn',
                  '[preview] DIAGNOSIS: Missing JDBC driver (often H2). Stop preview and Start again so the platform rebuilds the jar with H2.'
                );
              } else if (/Could not resolve placeholder/i.test(springTail)) {
                appendLog(
                  session,
                  'warn',
                  '[preview] DIAGNOSIS: Student project is missing a required config value (JWT secret / env placeholder). That is a project issue, not a preview-platform bug.'
                );
              } else if (/APPLICATION FAILED TO START|Failed to configure a DataSource/i.test(springTail)) {
                appendLog(
                  session,
                  'warn',
                  '[preview] DIAGNOSIS: Spring Boot failed to start. See the Spring build log above.'
                );
              } else {
                appendLog(
                  session,
                  'warn',
                  '[preview] DIAGNOSIS: Spring API still not reachable. Wait for Maven on first start, or Stop and Start preview again.'
                );
              }
              await session.save();
            }
          }
        }

        // Spring: API came up later — verify login once.
        if (
          stack === 'java-spring-react' &&
          running &&
          session.previewApiReady &&
          session.previewLoginEmail &&
          session.previewLoginPassword &&
          !(session.logs || []).some(
            (l) => typeof l.message === 'string' && l.message.includes('Login verified')
          )
        ) {
          const loginCheck = await previewLoginVerify
            .tryPreviewLogin({
              apiHostPort: apiPort,
              email: session.previewLoginEmail,
              password: session.previewLoginPassword,
              identifierType: session.previewLoginIdentifierType || 'username',
              probeHost: getPreviewProbeHost(),
              loginPaths: ['/auth/login', '/api/auth/login', '/api/login', '/login'],
            })
            .catch(() => null);
          if (loginCheck?.ok) {
            appendLog(session, 'info', `Login verified at ${loginCheck.url}`);
            await session.save();
          }
        }
      } else {
        session.previewAppReady = false;
        session.previewAppReadyReason = 'port_closed';
        session.previewApiReady = false;
      }
    }

    if (session.previewStack === 'php-apache') {
      await refreshPhpPreviewLoginHint(session, {
        hostPort: session.hostPort,
      });
    }
  }

  return session;
}

export async function getActivePreviewSessionForProposal(teacherId, proposalId) {
  const proposal = await Proposal.findById(proposalId).populate('assignment');
  if (!proposal) {
    const err = new Error('Proposal not found');
    err.status = 404;
    throw err;
  }
  if (!teacherCanAccessAssignmentReview(teacherId, proposal.assignment)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  let session = await PreviewSession.findOne({
    proposal: proposalId,
    teacher: teacherId,
    status: { $in: ['starting', 'running', 'runtime_error'] },
  })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();

  if (!session?._id) {
    session = await PreviewSession.findOne({
      proposal: proposalId,
      teacher: teacherId,
      status: 'failed',
      'validationFailures.0': { $exists: true },
    })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();
    if (session?._id) {
      return getPreviewSessionForTeacher(teacherId, session._id);
    }
    return null;
  }

  const reconciled = await reconcileStalePreviewSession(session._id);
  if (!reconciled || !['starting', 'running', 'runtime_error'].includes(reconciled.status)) {
    return null;
  }
  return getPreviewSessionForTeacher(teacherId, session._id);
}
