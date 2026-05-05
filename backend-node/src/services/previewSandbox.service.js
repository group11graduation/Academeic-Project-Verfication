import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import Docker from 'dockerode';
import AdmZip from 'adm-zip';
import { PreviewSession } from '../models/PreviewSession.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { Proposal } from '../models/Proposal.js';

const MAX_FILES = Number(process.env.PREVIEW_MAX_EXTRACT_FILES || 500);
const MAX_TOTAL_BYTES = Number(process.env.PREVIEW_MAX_EXTRACT_BYTES || 52_428_800);
const PREVIEW_STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_STARTUP_TIMEOUT_MS || 300000);
const PREVIEW_STARTUP_POLL_MS = Number(process.env.PREVIEW_STARTUP_POLL_MS || 1500);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function containerIsRunning(container) {
  const inspect = await container.inspect();
  return Boolean(inspect?.State?.Running);
}

async function waitForPreviewReady(container, previewUrl, startupTimeoutMs) {
  const started = Date.now();
  while (Date.now() - started < startupTimeoutMs) {
    try {
      const res = await fetch(previewUrl, { method: 'GET' });
      if (res && res.status >= 200 && res.status < 500) {
        return true;
      }
    } catch {
      // Not ready yet.
    }
    try {
      const running = await containerIsRunning(container);
      if (!running) return false;
    } catch {
      return false;
    }
    await sleep(PREVIEW_STARTUP_POLL_MS);
  }
  return false;
}

function rewriteLocalDbHostForContainer(value) {
  if (!value) return value;
  // Container cannot reach host DB via localhost/127.0.0.1.
  return String(value).replace(/(localhost|127\.0\.0\.1)/g, 'host.docker.internal');
}

function buildPreviewEnv(runtime, containerPort) {
  const env = [`PORT=${containerPort}`];

  if (runtime.mode === 'fullstack' && runtime.backendPort) {
    env.push(`PREVIEW_BACKEND_PORT=${runtime.backendPort}`);
    env.push(`VITE_API_URL=http://localhost:${runtime.backendPort}`);
  }

  // Pass DB/app env for student backend inside preview container.
  // Priority: explicit PREVIEW_* overrides, then host process env.
  const mongoUri = process.env.PREVIEW_MONGODB_URI || process.env.MONGODB_URI;
  const databaseUrl = process.env.PREVIEW_DATABASE_URL || process.env.DATABASE_URL;
  const dbHost = process.env.PREVIEW_DB_HOST || process.env.DB_HOST;
  const dbPort = process.env.PREVIEW_DB_PORT || process.env.DB_PORT;
  const dbName = process.env.PREVIEW_DB_NAME || process.env.DB_NAME;
  const nodeEnv = process.env.PREVIEW_NODE_ENV || process.env.NODE_ENV || 'development';

  if (mongoUri) env.push(`MONGODB_URI=${rewriteLocalDbHostForContainer(mongoUri)}`);
  if (databaseUrl) env.push(`DATABASE_URL=${rewriteLocalDbHostForContainer(databaseUrl)}`);
  if (dbHost) env.push(`DB_HOST=${rewriteLocalDbHostForContainer(dbHost)}`);
  if (dbPort) env.push(`DB_PORT=${dbPort}`);
  if (dbName) env.push(`DB_NAME=${dbName}`);
  env.push(`NODE_ENV=${nodeEnv}`);

  return env;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findFirstPackageJsonDir(baseDir) {
  const candidates = [
    path.join(baseDir, 'bms-frontend'),
    path.join(baseDir, 'frontend'),
    path.join(baseDir, 'client'),
    path.join(baseDir, 'web'),
    path.join(baseDir, 'app'),
    baseDir,
  ];

  for (const c of candidates) {
    if (await pathExists(path.join(c, 'package.json'))) return c;
  }

  const top = await fs.readdir(baseDir, { withFileTypes: true });
  for (const d of top) {
    if (!d.isDirectory()) continue;
    const sub = path.join(baseDir, d.name);
    if (await pathExists(path.join(sub, 'package.json'))) return sub;
  }
  return null;
}

async function findPackageDirByNames(baseDir, names) {
  for (const n of names) {
    const p = path.join(baseDir, n);
    if (await pathExists(path.join(p, 'package.json'))) return p;
  }
  return null;
}

async function detectPreviewRuntime(extractDir, session) {
  // If zip contains a single wrapper folder, prefer it as working root.
  const topEntries = await fs.readdir(extractDir, { withFileTypes: true });
  const dirs = topEntries.filter((e) => e.isDirectory());
  let root = extractDir;
  if (dirs.length === 1) {
    const candidate = path.join(extractDir, dirs[0].name);
    // Wrapper folder heuristic: use it when root has no app entry file.
    const hasRootIndex = await pathExists(path.join(extractDir, 'index.html'));
    const hasRootPkg = await pathExists(path.join(extractDir, 'package.json'));
    if (!hasRootIndex && !hasRootPkg) root = candidate;
  }

  // Full-stack mode: detect common frontend + backend folders and run both.
  const frontendDir = await findPackageDirByNames(root, ['frontend', 'bms-frontend', 'client', 'web', 'app']);
  const backendDir = await findPackageDirByNames(root, ['backend', 'backend-node', 'server', 'api']);
  if (frontendDir && backendDir) {
    const frontendRel = path.relative(root, frontendDir).replace(/\\/g, '/');
    const backendRel = path.relative(root, backendDir).replace(/\\/g, '/');
    appendLog(session, 'info', `Detected full-stack project. frontend=${frontendRel}, backend=${backendRel}`);
    return {
      mode: 'fullstack',
      workdir: root,
      image: process.env.PREVIEW_NODE_IMAGE || 'node:20-alpine',
      backendPort: String(process.env.PREVIEW_BACKEND_PORT || '18080'),
      command: [
        'sh',
        '-lc',
        [
          'set -e',
          `cd "${backendRel}"`,
          'npm install --no-audit --no-fund',
          '(npm run dev || npm run start) &',
          `cd "/workspace/${frontendRel}"`,
          'npm install --no-audit --no-fund',
          'npm run dev -- --host 0.0.0.0 --port "$PORT"',
        ].join(' && '),
      ],
    };
  }

  const packageDir = await findFirstPackageJsonDir(root);
  if (packageDir) {
    const packageJsonPath = path.join(packageDir, 'package.json');
    let pkg = {};
    try {
      pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    } catch {
      pkg = {};
    }
    const scripts = pkg.scripts || {};
    const hasPreview = Boolean(scripts.preview);
    const hasDev = Boolean(scripts.dev);
    const hasStart = Boolean(scripts.start);
    const relativeWorkdir = path.relative(extractDir, packageDir).replace(/\\/g, '/');
    appendLog(
      session,
      'info',
      `Detected Node project at ${relativeWorkdir || '.'}; scripts: ${Object.keys(scripts).join(', ') || 'none'}`
    );
    return {
      mode: 'node',
      workdir: packageDir,
      image: process.env.PREVIEW_NODE_IMAGE || 'node:20-alpine',
      command: [
        'sh',
        '-lc',
        [
          'set -e',
          'npm install --no-audit --no-fund',
          hasPreview
            ? 'npm run preview -- --host 0.0.0.0 --port "$PORT"'
            : hasDev
              ? 'npm run dev -- --host 0.0.0.0 --port "$PORT"'
              : hasStart
                ? 'npm run start -- --host 0.0.0.0 --port "$PORT"'
                : 'npx --yes serve -s . -l "$PORT"',
        ].join(' && '),
      ],
    };
  }

  appendLog(session, 'info', 'No Node app detected. Falling back to static file server.');
  return {
    mode: 'static',
    workdir: root,
    image: process.env.PREVIEW_IMAGE || 'python:3.12-alpine',
    command: ['sh', '-lc', 'python -m http.server "$PORT" --bind 0.0.0.0 --directory .'],
  };
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

async function ensureImage(docker, image) {
  try {
    await docker.getImage(image).inspect();
  } catch {
    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
      });
    });
  }
}

async function cleanupSessionResources(session, docker, finalStatus, logMessage) {
  const sid = session._id.toString();
  if (activeTimers.has(sid)) {
    clearTimeout(activeTimers.get(sid));
    activeTimers.delete(sid);
  }

  if (session.dockerContainerId && docker) {
    try {
      const c = docker.getContainer(session.dockerContainerId);
      await c.stop({ t: 8 });
    } catch {
      /* already stopped / removed (AutoRemove) */
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

async function stopActiveSessionsForProposal(proposalId, docker) {
  const list = await PreviewSession.find({
    proposal: proposalId,
    status: { $in: ['starting', 'running'] },
  });
  for (const s of list) {
    await cleanupSessionResources(s, docker, 'stopped', 'Preview ended (superseded by a new session).');
  }
}

/**
 * Start a bounded Docker preview for teacher review.
 * Security: caller must enforce teacher ownership + proposal approved + submission exists (done here).
 */
export async function startPreviewForProposal(teacherId, proposalId) {
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

  await stopActiveSessionsForProposal(proposal._id, docker);

  const CONTAINER_PORT = String(process.env.PREVIEW_CONTAINER_PORT || '8080');
  const memory = Number(process.env.PREVIEW_MEMORY_BYTES || 268435456);
  const nanoCpus = Number(process.env.PREVIEW_NANO_CPUS || 500000000);
  const ttl = Number(process.env.PREVIEW_TTL_MS || 600000);
  const rawPreviewHost = (process.env.PREVIEW_PUBLIC_HOST || 'http://localhost').replace(/\/$/, '');
  const publicHost = rawPreviewHost.replace('127.0.0.1', 'localhost');

  const zipAbs = path.join(process.cwd(), 'uploads', submission.storedRelativePath);
  if (!fsSync.existsSync(zipAbs)) {
    const err = new Error('Stored archive missing on server');
    err.status = 500;
    throw err;
  }

  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholar-preview-'));
  const bindHostPath =
    process.platform === 'win32' ? path.resolve(extractDir).replace(/\\/g, '/') : path.resolve(extractDir);
  const runtime = await detectPreviewRuntime(extractDir, { logs: [] });

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
    previewImage: runtime.image,
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
  // Re-detect with live session logger to capture useful diagnostics.
  const runtimeDetected = await detectPreviewRuntime(extractDir, session);
  runtime.mode = runtimeDetected.mode;
  runtime.workdir = runtimeDetected.workdir;
  runtime.image = runtimeDetected.image;
  runtime.command = runtimeDetected.command;
  runtime.backendPort = runtimeDetected.backendPort;
  session.previewImage = runtime.image;
  await session.save();
  await ensureImage(docker, runtime.image);

  const containerName = `sv-preview-${session._id.toString().slice(-10)}`;
  const exposed = `${CONTAINER_PORT}/tcp`;
  const extraExposed = runtime.mode === 'fullstack' && runtime.backendPort
    ? [`${runtime.backendPort}/tcp`]
    : [];

  let container;
  try {
    container = await docker.createContainer({
      name: containerName,
      Image: runtime.image,
      Cmd: runtime.command,
      WorkingDir: `/workspace/${path.relative(extractDir, runtime.workdir).replace(/\\/g, '/') || ''}`,
      Env: buildPreviewEnv(runtime, CONTAINER_PORT),
      ExposedPorts: {
        [exposed]: {},
        ...Object.fromEntries(extraExposed.map((p) => [p, {}])),
      },
      HostConfig: {
        Binds: [`${bindHostPath}:/workspace`],
        Memory: memory,
        MemorySwap: memory,
        ...(nanoCpus > 0 ? { NanoCpus: nanoCpus } : {}),
        AutoRemove: true,
        PortBindings: {
          [exposed]: [{ HostIp: '0.0.0.0', HostPort: '0' }],
          ...Object.fromEntries(extraExposed.map((p) => [p, [{ HostIp: '0.0.0.0', HostPort: runtime.backendPort }]])),
        },
        SecurityOpt: ['no-new-privileges:true'],
      },
      Labels: {
        'scholarverify.preview': '1',
        'scholarverify.session': session._id.toString(),
      },
    });
  } catch (e) {
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    session.status = 'failed';
    session.errorMessage = e.message || 'Docker create failed';
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    await session.save();
    const err = new Error(session.errorMessage);
    err.status = 500;
    throw err;
  }

  session.dockerContainerId = container.id;
  try {
    await container.start();
  } catch (e) {
    try {
      await container.remove({ force: true });
    } catch {
      /* */
    }
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    session.status = 'failed';
    session.errorMessage = e.message || 'Container start failed';
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    await session.save();
    const err = new Error(session.errorMessage);
    err.status = 500;
    throw err;
  }
  const inspect = await container.inspect();
  const ports = inspect.NetworkSettings?.Ports?.[exposed];
  const hostPort = ports?.[0]?.HostPort;
  if (!hostPort) {
    try {
      await container.stop({ t: 5 });
    } catch {
      /* */
    }
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    session.status = 'failed';
    session.errorMessage = 'Could not resolve published host port';
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    await session.save();
    const err = new Error(session.errorMessage);
    err.status = 500;
    throw err;
  }

  session.hostPort = hostPort;
  session.previewUrl = `${publicHost}:${hostPort}/`;
  appendLog(session, 'info', `Container started (${runtime.mode}); waiting for app readiness at ${session.previewUrl}`);
  await session.save();

  const ready = await waitForPreviewReady(container, session.previewUrl, PREVIEW_STARTUP_TIMEOUT_MS);
  if (!ready) {
    let tailLogs = '';
    try {
      const raw = await container.logs({ stdout: true, stderr: true, tail: 80 });
      tailLogs = raw?.toString?.() || '';
    } catch {
      tailLogs = '';
    }
    try {
      await container.stop({ t: 8 });
    } catch {
      /* ignore */
    }
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    session.status = 'failed';
    session.errorMessage = `Preview app did not become ready within ${Math.round(PREVIEW_STARTUP_TIMEOUT_MS / 1000)}s`;
    session.endedAt = new Date();
    appendLog(session, 'error', session.errorMessage);
    if (tailLogs.trim()) {
      appendLog(session, 'error', `Container logs (tail): ${tailLogs.slice(-2000)}`);
    }
    await session.save();
    const err = new Error(session.errorMessage);
    err.status = 504;
    throw err;
  }

  session.status = 'running';
  appendLog(session, 'info', `Preview ready and reachable at ${session.previewUrl}`);
  await session.save();

  const timer = setTimeout(async () => {
    try {
      const fresh = await PreviewSession.findById(session._id);
      if (fresh && fresh.status === 'running') {
        await cleanupSessionResources(fresh, getDocker(), 'expired', 'TTL elapsed; container stopped.');
      }
    } catch (err) {
      console.error('preview TTL cleanup', err);
    }
  }, ttl);
  activeTimers.set(session._id.toString(), timer);

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
