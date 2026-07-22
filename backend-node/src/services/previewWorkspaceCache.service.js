import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');

const MANIFEST_NAME = '.scholarverify-preview-manifest.json';

/**
 * Bump this whenever the platform's project patchers change (seed classes, CORS/security
 * patches, login-path rewrites, …). Cached workspaces contain patched sources AND built
 * artifacts (Maven target/, npm build/), so stale patch output survives a normal cache hit
 * and the container skips rebuilds. A version mismatch forces a clean re-extract + rebuild.
 */
const PREVIEW_PATCHER_VERSION = 9;

function cacheEnabled() {
  return process.env.PREVIEW_WORKSPACE_CACHE !== 'false';
}

export function getPreviewCacheRoot() {
  return path.resolve(process.env.PREVIEW_CACHE_ROOT || path.join(BACKEND_ROOT, 'data', 'preview-cache'));
}

export function getWorkspaceRoot() {
  return path.join(getPreviewCacheRoot(), 'workspaces');
}

export function getSubmissionWorkspaceDir(submissionId) {
  const id = String(submissionId || '').replace(/[^a-zA-Z0-9]/g, '');
  return path.join(getWorkspaceRoot(), id || 'unknown');
}

export function getMavenCacheDir() {
  return path.resolve(process.env.PREVIEW_MAVEN_CACHE_DIR || path.join(getPreviewCacheRoot(), 'maven'));
}

export function getNpmCacheDir() {
  return path.resolve(process.env.PREVIEW_NPM_CACHE_DIR || path.join(getPreviewCacheRoot(), 'npm'));
}

export async function ensurePreviewDependencyCacheDirs() {
  const maven = getMavenCacheDir();
  const npm = getNpmCacheDir();
  await fs.mkdir(maven, { recursive: true });
  await fs.mkdir(npm, { recursive: true });
  return { maven, npm };
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function computeZipFingerprint(zipAbs) {
  const stat = await fs.stat(zipAbs);
  const sha256 = await sha256File(zipAbs);
  return {
    sha256,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

async function readManifest(workspaceDir) {
  try {
    const raw = await fs.readFile(path.join(workspaceDir, MANIFEST_NAME), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeWorkspaceManifest(workspaceDir, patch = {}) {
  const prev = (await readManifest(workspaceDir)) || {};
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(path.join(workspaceDir, MANIFEST_NAME), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function fingerprintMatches(manifest, fingerprint) {
  if (!manifest?.zipSha256 || !fingerprint?.sha256) return false;
  if ((manifest.patcherVersion || 0) !== PREVIEW_PATCHER_VERSION) return false;
  return manifest.zipSha256 === fingerprint.sha256 && manifest.zipSize === fingerprint.size;
}

/**
 * Resolve a persistent workspace for a submission ZIP.
 * Reuses extracted files + node_modules/Maven target on repeat preview starts.
 */
export async function prepareSubmissionWorkspace({ submissionId, zipAbs }) {
  const workspaceDir = getSubmissionWorkspaceDir(submissionId);
  const fingerprint = await computeZipFingerprint(zipAbs);

  if (!cacheEnabled()) {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(workspaceDir, { recursive: true });
    return {
      workspaceDir,
      cacheHit: false,
      buildCached: false,
      fingerprint,
      cleared: true,
    };
  }

  await fs.mkdir(path.dirname(workspaceDir), { recursive: true });
  const manifest = await readManifest(workspaceDir);
  const zipMatches = fingerprintMatches(manifest, fingerprint);
  const cacheHit = zipMatches && manifest.auditPassed === true;
  const buildCached = zipMatches && Boolean(manifest?.readyAt);

  if (cacheHit) {
    return {
      workspaceDir,
      cacheHit: true,
      buildCached,
      fingerprint,
      manifest,
      cleared: false,
    };
  }

  await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(workspaceDir, { recursive: true });
  await writeWorkspaceManifest(workspaceDir, {
    submissionId: String(submissionId),
    zipSha256: fingerprint.sha256,
    zipSize: fingerprint.size,
    zipMtimeMs: fingerprint.mtimeMs,
    patcherVersion: PREVIEW_PATCHER_VERSION,
    auditPassed: false,
    readyAt: null,
  });

  return {
    workspaceDir,
    cacheHit: false,
    buildCached: false,
    fingerprint,
    cleared: true,
  };
}

export async function markWorkspaceAuditPassed(workspaceDir, fingerprint) {
  if (!workspaceDir) return;
  await writeWorkspaceManifest(workspaceDir, {
    zipSha256: fingerprint?.sha256,
    zipSize: fingerprint?.size,
    zipMtimeMs: fingerprint?.mtimeMs,
    auditPassed: true,
  });
}

export async function markWorkspacePreviewReady(workspaceDir) {
  if (!workspaceDir) return;
  await writeWorkspaceManifest(workspaceDir, {
    readyAt: new Date().toISOString(),
  });
}

export function isPersistentWorkspaceDir(dir) {
  if (!dir) return false;
  const root = path.resolve(getWorkspaceRoot());
  const resolved = path.resolve(dir);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}
