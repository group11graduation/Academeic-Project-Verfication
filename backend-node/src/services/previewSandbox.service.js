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

  const IMAGE = process.env.PREVIEW_IMAGE || 'python:3.12-alpine';
  const CONTAINER_PORT = String(process.env.PREVIEW_CONTAINER_PORT || '8080');
  const memory = Number(process.env.PREVIEW_MEMORY_BYTES || 268435456);
  const nanoCpus = Number(process.env.PREVIEW_NANO_CPUS || 500000000);
  const ttl = Number(process.env.PREVIEW_TTL_MS || 600000);
  const publicHost = (process.env.PREVIEW_PUBLIC_HOST || 'http://127.0.0.1').replace(/\/$/, '');

  const zipAbs = path.join(process.cwd(), 'uploads', submission.storedRelativePath);
  if (!fsSync.existsSync(zipAbs)) {
    const err = new Error('Stored archive missing on server');
    err.status = 500;
    throw err;
  }

  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scholar-preview-'));
  const bindHostPath =
    process.platform === 'win32' ? path.resolve(extractDir).replace(/\\/g, '/') : path.resolve(extractDir);

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
    previewImage: IMAGE,
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

  await ensureImage(docker, IMAGE);

  const containerName = `sv-preview-${session._id.toString().slice(-10)}`;
  const exposed = `${CONTAINER_PORT}/tcp`;

  let container;
  try {
    container = await docker.createContainer({
      name: containerName,
      Image: IMAGE,
      Cmd: [
        'python',
        '-m',
        'http.server',
        CONTAINER_PORT,
        '--bind',
        '0.0.0.0',
        '--directory',
        '/workspace',
      ],
      ExposedPorts: { [exposed]: {} },
      HostConfig: {
        Binds: [`${bindHostPath}:/workspace:ro`],
        Memory: memory,
        MemorySwap: memory,
        ...(nanoCpus > 0 ? { NanoCpus: nanoCpus } : {}),
        AutoRemove: true,
        PortBindings: { [exposed]: [{ HostIp: '0.0.0.0', HostPort: '0' }] },
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
  session.status = 'running';
  appendLog(session, 'info', `Container running; preview at ${session.previewUrl}`);
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
