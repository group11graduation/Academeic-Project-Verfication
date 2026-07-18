import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import net from 'net';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { safeExtractProjectZip } from './previewZipExtract.service.js';
import {
  resolveMernPair,
  patchFrontendApiPort,
  patchBackendForPreview,
  previewMongoHostName,
  buildPreviewMongoUri,
  splitStackDisplayLabel,
  classifyPackageJson,
  discoverLoginApiPaths,
  preferLoginApiPath,
} from './previewMern.service.js';
import {
  patchPhpForPreview,
  discoverPhpLoginPath,
  previewMysqlHostName,
  resolvePreviewDatabaseName,
} from './previewPhp.service.js';
import { resolveFlutterNodePair, patchFlutterApiPort } from './previewFlutter.service.js';
import { resolveSpringReactPair, patchSpringForPreview, springReactDisplayLabel } from './previewSpring.service.js';
import { ensurePreviewDependencyCacheDirs } from './previewWorkspaceCache.service.js';
import { resolveDockerHostPath } from '../config/dockerPaths.js';
import { getPreviewProbeHost, previewProbeHostname, rewritePreviewUrlForProbe } from '../config/previewProbe.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const TEMPLATES_ROOT = path.join(BACKEND_ROOT, 'docker-templates');

const PORT_RANGE_MIN = Number(process.env.PREVIEW_PORT_MIN || 8000);
const PORT_RANGE_MAX = Number(process.env.PREVIEW_PORT_MAX || 9000);
const PREVIEW_PORT_PUBLISH_POLL_MS = Number(process.env.PREVIEW_PORT_PUBLISH_POLL_MS || 500);
const PREVIEW_PORT_PUBLISH_GRACE_MS = Number(process.env.PREVIEW_PORT_PUBLISH_GRACE_MS || 20_000);
const PREVIEW_STARTUP_POLL_MS = Number(process.env.PREVIEW_STARTUP_POLL_MS || 1000);
const BUILD_TIMEOUT_MS = Number(process.env.PREVIEW_BUILD_TIMEOUT_MS || 600_000);
const FLUTTER_BUILD_TIMEOUT_MS = Number(
  process.env.PREVIEW_FLUTTER_BUILD_TIMEOUT_MS || process.env.PREVIEW_BUILD_TIMEOUT_MS || 900_000
);
const SPRING_BUILD_TIMEOUT_MS = Number(
  process.env.PREVIEW_SPRING_BUILD_TIMEOUT_MS || process.env.PREVIEW_BUILD_TIMEOUT_MS || 900_000
);
const PREVIEW_JAVA_BASE_IMAGE = process.env.PREVIEW_JAVA_BASE_IMAGE || 'eclipse-temurin:17-jdk-jammy';
const PREVIEW_JAVA_PULL_TIMEOUT_MS = Number(process.env.PREVIEW_JAVA_PULL_TIMEOUT_MS || 600_000);
const PREVIEW_NODE_BASE_IMAGE = process.env.PREVIEW_NODE_BASE_IMAGE || 'scholarverify-preview-node:latest';
const PREVIEW_PHP_BASE_IMAGE = process.env.PREVIEW_PHP_BASE_IMAGE || 'scholarverify-preview-php:latest';
const PREVIEW_NODE_FLUTTER_BASE_IMAGE =
  process.env.PREVIEW_NODE_FLUTTER_BASE_IMAGE || 'scholarverify-preview-node-flutter:latest';
const PREVIEW_SPRING_REACT_BASE_IMAGE =
  process.env.PREVIEW_SPRING_REACT_BASE_IMAGE || 'scholarverify-preview-java-spring-react:latest';
const PREVIEW_JUPYTER_BASE_IMAGE = process.env.PREVIEW_JUPYTER_BASE_IMAGE || 'scholarverify-preview-jupyter:latest';
const MAX_SCAN_FILES = Number(process.env.PREVIEW_STACK_SCAN_MAX_FILES || 2000);

/** Host ports reserved by active preview deployments in this API process */
const allocatedPorts = new Set();

/**
 * Stack blueprint: template folder, container internal port, and Docker image name prefix.
 * Traffic flow: browser -> http://localhost:HOST_PORT -> docker -p HOST:INTERNAL -> app in container
 */
export const STACK_BLUEPRINTS = {
  'php-apache': {
    templateDir: 'php-apache',
    internalPort: 80,
    imagePrefix: 'sv-project-php',
  },
  'node-js': {
    templateDir: 'node-js',
    internalPort: 3000,
    imagePrefix: 'sv-project-node',
  },
  'static-html': {
    templateDir: 'node-js',
    internalPort: 3000,
    imagePrefix: 'sv-project-static-html',
  },
  'static-html-js': {
    templateDir: 'node-js',
    internalPort: 3000,
    imagePrefix: 'sv-project-static-html-js',
  },
  jupyter: {
    templateDir: 'jupyter',
    internalPort: 8888,
    imagePrefix: 'sv-project-jupyter',
  },
  'java-spring-react': {
    templateDir: 'java-spring-react',
    internalPort: 3000,
    imagePrefix: 'sv-project-spring-react',
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeDockerId(id) {
  return String(id).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48) || 'preview';
}

function buildImageTag(imageKey, stack) {
  const safeStack = sanitizeDockerId(stack || 'unknown');
  return `project-sub-${sanitizeDockerId(imageKey)}-${safeStack}`;
}

export function containerNameFor(projectId) {
  return `container-${sanitizeDockerId(projectId)}`;
}

function getPublicPreviewBase() {
  return (process.env.PREVIEW_PUBLIC_HOST || 'http://localhost').replace(/\/$/, '').replace('127.0.0.1', 'localhost');
}

function buildPublicPreviewOrigin(hostPort) {
  return `${getPublicPreviewBase()}:${hostPort}`;
}

/** Host path for docker -v (resolves container paths when API runs in Docker). */
function dockerVolumePath(hostPath) {
  return resolveDockerHostPath(hostPath);
}

function previewNodeTemplateDir(flutterPair) {
  return flutterPair ? 'node-js-flutter' : 'node-js';
}

function previewNodeBaseImageTag(flutterPair) {
  return flutterPair ? PREVIEW_NODE_FLUTTER_BASE_IMAGE : PREVIEW_NODE_BASE_IMAGE;
}

async function previewTemplateContentHash(templateDirName, extraFiles = []) {
  const templateDir = path.join(TEMPLATES_ROOT, templateDirName);
  const sharedNodeDir = path.join(TEMPLATES_ROOT, 'node-js');
  const files = [
    fsSync.existsSync(path.join(templateDir, 'entrypoint.sh'))
      ? path.join(templateDir, 'entrypoint.sh')
      : path.join(sharedNodeDir, 'entrypoint.sh'),
    path.join(templateDir, 'Dockerfile'),
    ...extraFiles,
  ];
  const hash = crypto.createHash('sha256');
  for (const filePath of files) {
    if (!fsSync.existsSync(filePath)) continue;
    hash.update(await fs.readFile(filePath));
  }
  return hash.digest('hex').slice(0, 12);
}

async function previewNodeTemplateContentHash(templateDirName) {
  const sharedNodeDir = path.join(TEMPLATES_ROOT, 'node-js');
  return previewTemplateContentHash(templateDirName, [
    path.join(sharedNodeDir, 'preview-seed-admin.js'),
    path.join(sharedNodeDir, 'preview-verify-login.js'),
  ]);
}

async function dockerImageLabel(imageTag, labelKey) {
  try {
    // Prefer execFile-style argv via spawnProcess to avoid shell quoting issues on Windows.
    const { stdout } = await spawnProcess(
      'docker',
      ['image', 'inspect', imageTag, '--format', `{{index .Config.Labels "${labelKey}"}}`],
      { timeoutMs: 15_000 }
    );
    const value = String(stdout || '').trim();
    // Docker prints <no value> when the label is missing.
    if (!value || value === '<no value>') return '';
    return value;
  } catch {
    return '';
  }
}

/**
 * If a content-hash rebuild fails but an older image still exists, keep previewing
 * with the stale image instead of blocking teachers with a hard 503.
 */
async function finishBaseImageBuildOrFallback({
  imageTag,
  hadExistingImage,
  buildResult,
  label,
}) {
  if (!buildResult?.failed) return buildResult;
  if (hadExistingImage && (await dockerImageExists(imageTag))) {
    logger.warn(
      `Preview base image rebuild failed (${label}): ${buildResult.error || 'unknown'}; reusing existing ${imageTag}`
    );
    return { imageTag, reused: true, stale: true, rebuildError: buildResult.error };
  }
  return buildResult;
}

async function stagePreviewBaseBuildDir(templateDirName) {
  const templateDir = path.join(TEMPLATES_ROOT, templateDirName);
  const sharedNodeDir = path.join(TEMPLATES_ROOT, 'node-js');
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sv-preview-base-'));

  await fs.copyFile(path.join(templateDir, 'Dockerfile'), path.join(stageDir, 'Dockerfile'));

  const dockerignoreSrc = path.join(templateDir, '.dockerignore');
  if (fsSync.existsSync(dockerignoreSrc)) {
    await fs.copyFile(dockerignoreSrc, path.join(stageDir, '.dockerignore'));
  }

  const entrypointSrc = fsSync.existsSync(path.join(templateDir, 'entrypoint.sh'))
    ? path.join(templateDir, 'entrypoint.sh')
    : path.join(sharedNodeDir, 'entrypoint.sh');
  const script = await fs.readFile(entrypointSrc, 'utf8');
  await fs.writeFile(path.join(stageDir, 'entrypoint.sh'), script.replace(/\r\n/g, '\n'));

  // Node Express/Flutter seed+verify scripts only — not Spring/PHP/Jupyter images.
  const needsNodePreviewScripts =
    templateDirName === 'node-js' || templateDirName === 'node-js-flutter';
  if (needsNodePreviewScripts) {
    const seedScriptSrc = path.join(sharedNodeDir, 'preview-seed-admin.js');
    if (fsSync.existsSync(seedScriptSrc)) {
      const seedScript = await fs.readFile(seedScriptSrc, 'utf8');
      await fs.writeFile(path.join(stageDir, 'preview-seed-admin.js'), seedScript.replace(/\r\n/g, '\n'));
    }

    const verifyScriptSrc = path.join(sharedNodeDir, 'preview-verify-login.js');
    if (fsSync.existsSync(verifyScriptSrc)) {
      const verifyScript = await fs.readFile(verifyScriptSrc, 'utf8');
      await fs.writeFile(path.join(stageDir, 'preview-verify-login.js'), verifyScript.replace(/\r\n/g, '\n'));
    }
  }

  const fallbackSrc = fsSync.existsSync(path.join(templateDir, 'preview-fallback'))
    ? path.join(templateDir, 'preview-fallback')
    : path.join(sharedNodeDir, 'preview-fallback');
  if (fsSync.existsSync(fallbackSrc)) {
    await fs.cp(fallbackSrc, path.join(stageDir, 'preview-fallback'), { recursive: true });
  }

  if (templateDirName === 'php-apache') {
    const bootstrapSrc = path.join(templateDir, 'preview-bootstrap.php');
    if (fsSync.existsSync(bootstrapSrc)) {
      await fs.copyFile(bootstrapSrc, path.join(stageDir, 'preview-bootstrap.php'));
    }
  }

  return stageDir;
}

function previewBaseImageFailureMessage(stack) {
  const messages = {
    'php-apache': 'PHP preview is temporarily unavailable',
    jupyter: 'Jupyter preview is temporarily unavailable',
    'java-spring-react': 'React + Spring Boot preview is temporarily unavailable',
    'node-js': 'React + Express preview is temporarily unavailable',
    'static-html': 'Static HTML preview is temporarily unavailable',
    'static-html-js': 'Static HTML preview is temporarily unavailable',
  };
  return messages[stack] || 'Project preview is temporarily unavailable';
}

async function runPreviewBaseImageBuild({ imageTag, stageDir, timeoutMs, label, contentHash = '' }) {
  try {
    const buildArgs = ['build', '-t', imageTag];
    if (contentHash) {
      buildArgs.push('--label', `sv.preview.hash=${contentHash}`);
    }
    buildArgs.push('.');
    await spawnProcess('docker', buildArgs, { cwd: stageDir, timeoutMs });
    return { imageTag, reused: false };
  } catch (err) {
    logger.warn(`Preview base image build failed (${label}): ${err.stderr || err.message}`);
    return { imageTag, reused: false, failed: true, error: err.message };
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Build a small reusable preview image once (entrypoint + runtime only).
 * The student ZIP is bind-mounted at /app when the container starts.
 */
async function ensurePreviewNodeBaseImage(flutterPair, { forceRebuild = false } = {}) {
  const templateDirName = previewNodeTemplateDir(flutterPair);
  const imageTag = previewNodeBaseImageTag(flutterPair);
  const contentHash = await previewNodeTemplateContentHash(templateDirName);
  const hadExistingImage = await dockerImageExists(imageTag);
  if (!forceRebuild && hadExistingImage) {
    const existingHash = await dockerImageLabel(imageTag, 'sv.preview.hash');
    // Only reuse when stamped hash matches (missing label → rebuild once to stamp it).
    if (existingHash && existingHash === contentHash) {
      return { imageTag, reused: true };
    }
  }

  const stageDir = await stagePreviewBaseBuildDir(templateDirName);
  const buildResult = await runPreviewBaseImageBuild({
    imageTag,
    stageDir,
    timeoutMs: flutterPair ? FLUTTER_BUILD_TIMEOUT_MS : BUILD_TIMEOUT_MS,
    label: templateDirName,
    contentHash,
  });
  return finishBaseImageBuildOrFallback({
    imageTag,
    hadExistingImage,
    buildResult,
    label: templateDirName,
  });
}

/**
 * Spawn a process with argv (avoids Windows shell quoting issues for docker run).
 */
function spawnProcess(binary, args, { cwd, timeoutMs = BUILD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: { ...process.env },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGTERM');
            const nameIdx = args.indexOf('--name');
            const containerName = nameIdx >= 0 ? args[nameIdx + 1] : null;
            if (binary === 'docker' && containerName) {
              runCommand(`docker rm -f ${containerName}`, { timeoutMs: 15_000 }).catch(() => {});
            }
            reject(new Error(`Process timed out after ${timeoutMs}ms: ${binary} ${args.join(' ')}`.slice(0, 200)));
          }, timeoutMs)
        : null;

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const err = new Error(stderr || stdout || `${binary} failed (exit ${code})`);
        err.exitCode = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

/**
 * Run a shell command with timeout; used for docker build/stop helpers.
 */
function runCommand(command, { cwd, timeoutMs = BUILD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = exec(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${timeoutMs}ms: ${command.slice(0, 120)}`));
          }, timeoutMs)
        : null;

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const err = new Error(stderr || stdout || `Command failed (exit ${code})`);
        err.exitCode = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

async function dockerAvailable() {
  try {
    await runCommand('docker version --format "{{.Server.Version}}"', { timeoutMs: 15_000 });
    return true;
  } catch {
    return false;
  }
}

function isPortFreeOnHost(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Pick an unused host port in [PORT_RANGE_MIN, PORT_RANGE_MAX] for -p HOST:INTERNAL binding.
 */
export async function allocateHostPort() {
  const attempts = Math.min(200, PORT_RANGE_MAX - PORT_RANGE_MIN + 1);
  for (let i = 0; i < attempts; i += 1) {
    const port =
      PORT_RANGE_MIN + Math.floor(Math.random() * (PORT_RANGE_MAX - PORT_RANGE_MIN + 1));
    if (allocatedPorts.has(port)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await isPortFreeOnHost(port))) continue;
    allocatedPorts.add(port);
    return port;
  }
  const err = new Error(`No free preview port in range ${PORT_RANGE_MIN}-${PORT_RANGE_MAX}`);
  err.status = 503;
  throw err;
}

export function releaseHostPort(port) {
  if (port) allocatedPorts.delete(Number(port));
}

/**
 * Enforce that projectPath stays inside an optional sandbox root (extract dir).
 */
export function assertSafeProjectPath(projectPath, allowedRoot = null) {
  const resolved = path.resolve(projectPath);
  if (!fsSync.existsSync(resolved)) {
    const err = new Error('Project path does not exist');
    err.status = 400;
    throw err;
  }
  if (allowedRoot) {
    const root = path.resolve(allowedRoot);
    const rel = path.relative(root, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const err = new Error('Project path is outside the allowed sandbox boundary');
      err.status = 403;
      throw err;
    }
  }
  return resolved;
}

function safeExtractZip(zipAbs, destDir) {
  safeExtractProjectZip(zipAbs, destDir);
}

/**
 * If input is a .zip, extract to a temp directory and return that path; otherwise return resolved directory.
 */
export async function resolveSubmissionPath(inputPath, { allowedRoot = null } = {}) {
  const resolved = assertSafeProjectPath(inputPath, allowedRoot);
  if (resolved.toLowerCase().endsWith('.zip')) {
    const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sv-preview-'));
    safeExtractZip(resolved, extractDir);
    return { projectPath: extractDir, extractedFromZip: true, tempDir: extractDir };
  }
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    const err = new Error('Submission path must be a directory or .zip archive');
    err.status = 400;
    throw err;
  }
  return { projectPath: resolved, extractedFromZip: false, tempDir: null };
}

/**
 * When students zip a single top-level folder, use it as the build context root.
 */
export async function resolveProjectRoot(projectPath) {
  const entries = await fs.readdir(projectPath, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) return projectPath;

  const onlyDir = path.join(projectPath, dirs[0].name);
  const hasRootPackage = fsSync.existsSync(path.join(projectPath, 'package.json'));
  const hasRootPhp = entries.some((e) => e.isFile() && e.name.endsWith('.php'));
  const hasRootIpynb = entries.some((e) => e.isFile() && e.name.endsWith('.ipynb'));

  if (!hasRootPackage && !hasRootPhp && !hasRootIpynb) {
    return onlyDir;
  }
  return projectPath;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function scoreNodePackageJson(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  let score = 0;
  if (deps.react || deps['react-dom']) score += 20;
  if (deps.vue || deps['@vue/cli-service'] || deps['@vitejs/plugin-vue']) score += 18;
  if (deps['@angular/core']) score += 18;
  if (deps.svelte || deps['@sveltejs/kit']) score += 16;
  if (deps.next) score += 16;
  if (deps.nuxt || deps.nuxt3) score += 16;
  if (deps.vite || deps['@vitejs/plugin-react']) score += 18;
  if (deps['react-scripts']) score += 16;
  if (deps.express && !deps.react && !deps.vue) score -= 15;
  if (deps.fastify || deps.koa || deps['@nestjs/core']) score -= 6;
  if (deps.mongoose && !deps.react && !deps.vue) score -= 8;
  const scripts = pkg.scripts || {};
  if (scripts.dev || scripts.start) score += 4;
  if (scripts.build) score += 2;
  return score;
}

async function collectNodePackageDirs(dir, buildContext, found, depth = 0) {
  if (depth > 5 || found.length > 30) return;

  const pkgPath = path.join(dir, 'package.json');
  if (await pathExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      const rel = path.relative(buildContext, dir).replace(/\\/g, '/') || '.';
      const classified = classifyPackageJson(pkg);
      if (!found.some((f) => f.rel === rel)) {
        found.push({
          rel,
          score: scoreNodePackageJson(pkg),
          role: classified.role,
          frontendScore: classified.frontendScore,
        });
      }
    } catch {
      /* ignore invalid json */
    }
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    // eslint-disable-next-line no-await-in-loop
    await collectNodePackageDirs(path.join(dir, entry.name), buildContext, found, depth + 1);
  }
}

/**
 * Resolve subdirectory where the app actually runs (nested package.json / PHP tree).
 * For MERN repos, prefer the React frontend over the Express backend.
 */
export async function resolveAppSubdir(buildContext, stack) {
  if (stack === 'node-js') {
    const found = [];
    await collectNodePackageDirs(buildContext, buildContext, found);
    if (found.length === 0) return '.';

    const uiCandidates = found.filter((f) => f.role !== 'backend' || f.frontendScore > 0);
    const pool = uiCandidates.length ? uiCandidates : found;

    pool.sort((a, b) => b.score - a.score || b.frontendScore - a.frontendScore);
    const best = pool[0];

    const preferred = ['frontend', 'Frontend', 'client', 'Client', 'web', 'app', 'ui', 'public'];
    for (const name of preferred) {
      const match = pool.find((f) => f.rel === name || f.rel.endsWith(`/${name}`));
      if (match && match.score >= best.score) return match.rel;
    }

    for (const rel of ['frontend/dist', 'client/dist', 'Frontend/dist', 'web/dist', 'frontend/build', 'client/build']) {
      if (await pathExists(path.join(buildContext, rel, 'index.html'))) {
        return rel;
      }
    }

    if (best.score > 0) return best.rel;

    for (const name of preferred) {
      const match = pool.find((f) => f.rel === name || f.rel.endsWith(`/${name}`));
      if (match) return match.rel;
    }
    return pool[0].rel;
  }

  if (stack === 'static-html' || stack === 'static-html-js') {
    if (await pathExists(path.join(buildContext, 'index.html'))) return '.';
    const entries = await fs.readdir(buildContext, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const sub = path.join(buildContext, entry.name);
      // eslint-disable-next-line no-await-in-loop
      if (await pathExists(path.join(sub, 'index.html'))) return entry.name;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const sub = path.join(buildContext, entry.name);
      const nested = await fs.readdir(sub, { withFileTypes: true }).catch(() => []);
      for (const child of nested) {
        if (!child.isDirectory()) continue;
        const rel = path.join(entry.name, child.name).replace(/\\/g, '/');
        // eslint-disable-next-line no-await-in-loop
        if (await pathExists(path.join(buildContext, rel, 'index.html'))) return rel;
      }
    }
    return '.';
  }

  if (stack === 'php-apache') {
    if (await pathExists(path.join(buildContext, 'index.php'))) return '.';
    const entries = await fs.readdir(buildContext, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(buildContext, entry.name);
      // eslint-disable-next-line no-await-in-loop
      if (await pathExists(path.join(sub, 'index.php'))) return entry.name;
    }
    return '.';
  }

  return '.';
}

/**
 * Infer stack from assignment title/description (e.g. "Final React Assignment").
 */
function usesVolumePreviewStack(stack) {
  return (
    stack === 'node-js' ||
    stack === 'static-html' ||
    stack === 'static-html-js' ||
    stack === 'php-apache' ||
    stack === 'jupyter' ||
    stack === 'java-spring-react'
  );
}

function previewProjectMountPath(stack) {
  if (stack === 'php-apache') return '/var/www/html';
  if (stack === 'jupyter') return '/workspace';
  return '/app';
}

/** Human-readable label for logs and teacher UI */
export function previewStackDisplayName(stack, splitPair = null) {
  if (stack === 'java-spring-react') {
    return 'React + Spring Boot';
  }
  if (stack === 'node-js') {
    if (splitPair?.frontendFramework || splitPair?.backendFramework) {
      return splitStackDisplayLabel(splitPair) || 'React + Express';
    }
    return 'React + Express';
  }
  if (splitPair?.frontendFramework || splitPair?.backendFramework) {
    return splitStackDisplayLabel(splitPair);
  }
  const map = {
    'node-js': 'React + Express',
    'php-apache': 'PHP / Apache',
    jupyter: 'Jupyter notebook',
    'static-html': 'HTML + CSS',
    'static-html-js': 'HTML + CSS + JavaScript',
    'java-spring-react': 'React + Spring Boot',
  };
  return map[stack] || stack || 'Unknown';
}

async function ensurePreviewPhpBaseImage({ forceRebuild = false } = {}) {
  const imageTag = PREVIEW_PHP_BASE_IMAGE;
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { imageTag, reused: true };
  }
  const stageDir = await stagePreviewBaseBuildDir('php-apache');
  return runPreviewBaseImageBuild({
    imageTag,
    stageDir,
    timeoutMs: BUILD_TIMEOUT_MS,
    label: 'php-apache',
  });
}

async function ensurePreviewJavaBaseImage() {
  try {
    await spawnProcess('docker', ['image', 'inspect', PREVIEW_JAVA_BASE_IMAGE], { timeoutMs: 20_000 });
    return { pulled: false };
  } catch {
    /* not local — pull below */
  }

  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await spawnProcess('docker', ['pull', PREVIEW_JAVA_BASE_IMAGE], {
        timeoutMs: PREVIEW_JAVA_PULL_TIMEOUT_MS,
      });
      return { pulled: true };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
    }
  }
  logger.warn(`Preview Java base image pull failed: ${lastErr?.stderr || lastErr?.message}`);
  return { pulled: false, failed: true, error: lastErr?.message };
}

async function ensurePreviewSpringReactBaseImage({ forceRebuild = false } = {}) {
  const imageTag = PREVIEW_SPRING_REACT_BASE_IMAGE;
  const contentHash = await previewTemplateContentHash('java-spring-react');
  const hadExistingImage = await dockerImageExists(imageTag);
  if (!forceRebuild && hadExistingImage) {
    const existingHash = await dockerImageLabel(imageTag, 'sv.preview.hash');
    // Only reuse when the stamped hash matches. Missing labels used to skip rebuilds
    // forever, so entrypoint.sh fixes never reached running containers.
    if (existingHash && existingHash === contentHash) {
      return { imageTag, reused: true };
    }
  }
  const javaMeta = await ensurePreviewJavaBaseImage();
  if (javaMeta.failed) {
    if (hadExistingImage) {
      logger.warn(
        `Preview Java base pull failed; reusing existing Spring image ${imageTag}: ${javaMeta.error || 'unknown'}`
      );
      return { imageTag, reused: true, stale: true, rebuildError: javaMeta.error };
    }
    return { imageTag, reused: false, failed: true, error: javaMeta.error };
  }
  const stageDir = await stagePreviewBaseBuildDir('java-spring-react');
  const buildResult = await runPreviewBaseImageBuild({
    imageTag,
    stageDir,
    timeoutMs: SPRING_BUILD_TIMEOUT_MS,
    label: 'java-spring-react',
    contentHash,
  });
  return finishBaseImageBuildOrFallback({
    imageTag,
    hadExistingImage,
    buildResult,
    label: 'java-spring-react',
  });
}

async function ensurePreviewJupyterBaseImage({ forceRebuild = false } = {}) {
  const imageTag = PREVIEW_JUPYTER_BASE_IMAGE;
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { imageTag, reused: true };
  }
  const stageDir = await stagePreviewBaseBuildDir('jupyter');
  return runPreviewBaseImageBuild({
    imageTag,
    stageDir,
    timeoutMs: BUILD_TIMEOUT_MS,
    label: 'jupyter',
  });
}

/**
 * Pick the pre-built Docker base image for a detected stack (ZIP mounted at runtime — no per-ZIP build).
 */
async function ensurePreviewBaseImage(stack, { flutterPair = null, forceRebuild = false } = {}) {
  if (stack === 'php-apache') {
    return ensurePreviewPhpBaseImage({ forceRebuild });
  }
  if (stack === 'jupyter') {
    return ensurePreviewJupyterBaseImage({ forceRebuild });
  }
  if (stack === 'java-spring-react') {
    return ensurePreviewSpringReactBaseImage({ forceRebuild });
  }
  if (stack === 'static-html' || stack === 'static-html-js' || stack === 'node-js') {
    return ensurePreviewNodeBaseImage(flutterPair, { forceRebuild });
  }
  const err = new Error(`No preview base image for stack: ${stack}`);
  err.status = 500;
  throw err;
}

export function inferStackHintFromAssignment(assignment) {
  const text = `${assignment?.title || ''} ${assignment?.description || ''}`.toLowerCase();
  if (/html\s*\+\s*css\s*\+\s*js|html.*css.*javascript|static\s+web|vanilla\s+js/.test(text)) {
    return 'static-html-js';
  }
  if (/html\s*\+\s*css|static\s+html|html\s*css\s*only|web\s+design/.test(text)) {
    return 'static-html';
  }
  // Spring before generic React so "React + Spring" never maps to Express/Node.
  if (
    /spring\s*boot|springboot|java\s*\+\s*react|react\s*\+\s*spring|react\s+with\s+spring|spring\s*\+\s*react/.test(
      text
    )
  ) {
    return 'java-spring-react';
  }
  if (/mern|express|react\s*\+\s*express|react\s+with\s+express|node\.?js|nest\.?js/.test(text)) {
    return 'node-js';
  }
  if (/react|vite|next\.?js|vue|angular|frontend/.test(text)) {
    return 'node-js';
  }
  if (/javascript/.test(text) && !/react|node|vue|angular/.test(text)) return 'static-html-js';
  if (/php|laravel|apache|mysql|xampp/.test(text)) return 'php-apache';
  if (/jupyter|ipython|\.ipynb|python\s+notebook/.test(text)) return 'jupyter';
  return null;
}

async function findReactStaticSignals(projectPath) {
  const htmlPaths = [];

  async function walk(dir, depth = 0) {
    if (depth > 6 || htmlPaths.length > 8) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      const lower = entry.name.toLowerCase();
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(full, depth + 1);
        continue;
      }
      if (lower === 'index.html') htmlPaths.push(full);
    }
  }

  await walk(projectPath);

  for (const htmlPath of htmlPaths) {
    try {
      const html = (await fs.readFile(htmlPath, 'utf8')).slice(0, 12_000).toLowerCase();
      if (html.includes('id="root"') || html.includes("id='root'")) {
        return { reactStatic: true, reason: 'index.html with #root (React/Vite)' };
      }
      if (/\/assets\/index-[\w-]+\.js/i.test(html) || html.includes('/static/js/')) {
        return { reactStatic: true, reason: 'built JS bundle in index.html' };
      }
      if (
        /\bfrom\s+['"]react['"]/i.test(html) ||
        /\breact-dom\b/i.test(html) ||
        html.includes('react-scripts') ||
        html.includes('@vitejs')
      ) {
        return { reactStatic: true, reason: 'React markers in index.html' };
      }
    } catch {
      /* ignore */
    }
  }

  return { reactStatic: false, reason: '' };
}

function isStrongReactStaticSignal(reactStatic) {
  if (!reactStatic?.reactStatic) return false;
  const r = reactStatic.reason || '';
  return (
    r.includes('#root') ||
    r.includes('built JS bundle') ||
    r.includes('/static/js/') ||
    r.includes('React markers')
  );
}

/** Student HTML/CSS sites often have js/ or assets/*.js — not a React build. */
function detectPlainStaticStack(signals, bestNodePkgScore, reactStatic) {
  if (!signals.indexHtml && signals.htmlFiles === 0) return null;
  if (signals.pubspecYaml || signals.composerJson || signals.artisanPhp || signals.indexPhp) return null;
  if (signals.viteConfig || signals.jsxTsxFiles > 0 || signals.vueSvelteFiles > 0) return null;
  if (isStrongReactStaticSignal(reactStatic)) return null;
  if (bestNodePkgScore >= 12) return null;

  const stack = signals.jsFiles > 0 ? 'static-html-js' : 'static-html';
  const reasons =
    stack === 'static-html-js'
      ? [
          'plain HTML/CSS/JavaScript website',
          `${signals.htmlFiles || 1} HTML file(s)`,
          `${signals.cssFiles} CSS file(s)`,
          `${signals.jsFiles} JavaScript file(s)`,
        ]
      : ['plain HTML/CSS website', `${signals.htmlFiles || 1} HTML file(s)`, `${signals.cssFiles} CSS file(s)`];
  return { stack, reasons };
}

/**
 * Scan submission files and pick the container type from evidence (not assignment title).
 */
export async function detectProjectStackWithMeta(projectPath, options = {}) {
  const signals = {
    packageJsonPaths: [],
    pubspecYaml: false,
    composerJson: false,
    artisanPhp: false,
    viteConfig: false,
    phpFiles: 0,
    jsxTsxFiles: 0,
    vueSvelteFiles: 0,
    ipynbFiles: 0,
    indexPhp: false,
    indexHtml: false,
    htmlFiles: 0,
    cssFiles: 0,
    jsFiles: 0,
    pomXmlCount: 0,
    gradleBuild: false,
    springBootJava: false,
    springBootPom: false,
    springBootGradle: false,
    javaSampled: 0,
  };
  let scanned = 0;

  async function walk(dir, depth = 0) {
    if (scanned >= MAX_SCAN_FILES || depth > 8) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (scanned >= MAX_SCAN_FILES) return;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      if (entry.name === 'vendor' && entry.isDirectory()) continue;
      if (entry.name === 'target' && entry.isDirectory()) continue;

      const full = path.join(dir, entry.name);
      const lower = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(full, depth + 1);
        continue;
      }

      scanned += 1;
      if (lower === 'package.json') signals.packageJsonPaths.push(full);
      if (lower === 'pom.xml') {
        signals.pomXmlCount += 1;
        try {
          const snippet = (await fs.readFile(full, 'utf8')).slice(0, 12_000);
          if (/spring-boot|springframework/i.test(snippet)) signals.springBootPom = true;
        } catch {
          /* ignore */
        }
      }
      if (lower === 'build.gradle' || lower === 'build.gradle.kts') {
        signals.gradleBuild = true;
        try {
          const snippet = (await fs.readFile(full, 'utf8')).slice(0, 12_000);
          if (/spring-boot|org\.springframework/i.test(snippet)) signals.springBootGradle = true;
        } catch {
          /* ignore */
        }
      }
      if (lower.endsWith('.java') && signals.javaSampled < 20) {
        signals.javaSampled += 1;
        try {
          const snippet = (await fs.readFile(full, 'utf8')).slice(0, 4000);
          if (/@SpringBootApplication/.test(snippet)) signals.springBootJava = true;
        } catch {
          /* ignore */
        }
      }
      if (lower === 'pubspec.yaml') signals.pubspecYaml = true;
      if (lower === 'composer.json') signals.composerJson = true;
      if (lower === 'artisan') signals.artisanPhp = true;
      if (lower.startsWith('vite.config.')) signals.viteConfig = true;
      if (lower.endsWith('.php')) signals.phpFiles += 1;
      if (lower === 'index.php') signals.indexPhp = true;
      if (lower.endsWith('.jsx') || lower.endsWith('.tsx')) signals.jsxTsxFiles += 1;
      if (lower.endsWith('.vue') || lower.endsWith('.svelte')) signals.vueSvelteFiles += 1;
      if (lower.endsWith('.ipynb')) signals.ipynbFiles += 1;
      if (lower === 'index.html') signals.indexHtml = true;
      if (lower.endsWith('.html') || lower.endsWith('.htm')) signals.htmlFiles += 1;
      if (lower.endsWith('.css')) signals.cssFiles += 1;
      if (lower.endsWith('.js') && !lower.endsWith('.jsx')) signals.jsFiles += 1;
    }
  }

  await walk(projectPath);

  const reactStatic = await findReactStaticSignals(projectPath);

  let bestNodePkgScore = 0;
  let nodePkgCount = 0;
  for (const pkgPath of signals.packageJsonPaths) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      const s = scoreNodePackageJson(pkg);
      nodePkgCount += 1;
      if (s > bestNodePkgScore) bestNodePkgScore = s;
    } catch {
      /* ignore */
    }
  }

  let hasNode =
    bestNodePkgScore >= 12 ||
    signals.viteConfig ||
    signals.jsxTsxFiles > 0 ||
    signals.vueSvelteFiles > 0 ||
    isStrongReactStaticSignal(reactStatic);

  let hasPhp =
    signals.composerJson ||
    signals.artisanPhp ||
    signals.indexPhp ||
    (signals.phpFiles >= 2 && bestNodePkgScore < 12 && !isStrongReactStaticSignal(reactStatic)) ||
    (signals.phpFiles >= 1 && !hasNode);

  if (isStrongReactStaticSignal(reactStatic) && !signals.composerJson && !signals.artisanPhp) {
    hasNode = true;
    if (signals.phpFiles <= 3 && !signals.indexPhp) {
      hasPhp = false;
    }
  }

  const hasJupyter = signals.ipynbFiles > 0;
  // Require Spring Boot markers — a stray pom.xml must not steal React+Express ZIPs.
  const hasStrongSpring =
    signals.springBootJava || signals.springBootPom || signals.springBootGradle;
  const hasReactOrJsFrontend =
    hasNode ||
    signals.jsxTsxFiles > 0 ||
    reactStatic.reactStatic ||
    signals.packageJsonPaths.length > 0 ||
    signals.viteConfig;

  const reasons = [];
  let stack = null;

  const hint = options.stackHint || null;
  const weakNode = bestNodePkgScore < 12;
  if (hint === 'static-html' && (signals.indexHtml || signals.htmlFiles > 0) && weakNode && !hasPhp) {
    return {
      stack: 'static-html',
      reasons: ['student declared HTML + CSS', `${signals.htmlFiles || 1} HTML file(s)`, `${signals.cssFiles} CSS file(s)`],
      signals: { packageJsonCount: nodePkgCount, phpFiles: signals.phpFiles, ipynbFiles: signals.ipynbFiles },
    };
  }
  if (
    hint === 'static-html-js' &&
    (signals.indexHtml || signals.htmlFiles > 0) &&
    weakNode &&
    !hasPhp
  ) {
    return {
      stack: 'static-html-js',
      reasons: [
        'student declared HTML + CSS + JavaScript',
        `${signals.htmlFiles || 1} HTML file(s)`,
        `${signals.jsFiles} JavaScript file(s)`,
      ],
      signals: { packageJsonCount: nodePkgCount, phpFiles: signals.phpFiles, ipynbFiles: signals.ipynbFiles },
    };
  }

  const plainStatic = detectPlainStaticStack(signals, bestNodePkgScore, reactStatic);
  if (plainStatic) {
    return {
      stack: plainStatic.stack,
      reasons: plainStatic.reasons,
      signals: {
        packageJsonCount: nodePkgCount,
        phpFiles: signals.phpFiles,
        ipynbFiles: signals.ipynbFiles,
        viteConfig: signals.viteConfig,
        jsxTsxFiles: signals.jsxTsxFiles,
      },
    };
  }

  // Jupyter only when notebooks are the primary artifact
  if (hasJupyter && !hasNode && !hasPhp) {
    stack = 'jupyter';
    reasons.push(`${signals.ipynbFiles} notebook(s)`);
  } else if (!hasNode && !hasPhp && !hasJupyter && (signals.indexHtml || signals.htmlFiles > 0)) {
    if (signals.jsFiles > 0) {
      stack = 'static-html-js';
      reasons.push('HTML + CSS + JavaScript static site');
      if (signals.htmlFiles) reasons.push(`${signals.htmlFiles} HTML file(s)`);
      if (signals.cssFiles) reasons.push(`${signals.cssFiles} CSS file(s)`);
      reasons.push(`${signals.jsFiles} JavaScript file(s)`);
    } else {
      stack = 'static-html';
      reasons.push('HTML + CSS static site');
      if (signals.htmlFiles) reasons.push(`${signals.htmlFiles} HTML file(s)`);
      if (signals.cssFiles) reasons.push(`${signals.cssFiles} CSS file(s)`);
    }
  } else if (hasStrongSpring && hasReactOrJsFrontend) {
    // React + Spring Boot — never treat as Express/Node even if FE has package.json.
    stack = 'java-spring-react';
    reasons.push('Spring Boot Java backend with React/JavaScript frontend');
    if (signals.pomXmlCount) reasons.push(`${signals.pomXmlCount} pom.xml`);
    if (signals.gradleBuild) reasons.push('Gradle build');
    if (signals.springBootJava) reasons.push('@SpringBootApplication');
    if (signals.springBootPom) reasons.push('spring-boot in pom.xml');
    if (signals.jsxTsxFiles) reasons.push(`${signals.jsxTsxFiles} JSX/TSX file(s)`);
    if (nodePkgCount) reasons.push(`${nodePkgCount} JavaScript package.json`);
    if (reactStatic.reactStatic) reasons.push(reactStatic.reason);
  } else if (hasNode && !hasPhp && !hasStrongSpring) {
    // React + Express / Node only when there is no Spring Boot backend.
    stack = 'node-js';
    if (nodePkgCount) reasons.push(`${nodePkgCount} package.json`);
    if (signals.pubspecYaml) reasons.push('pubspec.yaml (Flutter + Node)');
    if (signals.viteConfig) reasons.push('vite config');
    if (signals.jsxTsxFiles) reasons.push(`${signals.jsxTsxFiles} JSX/TSX file(s)`);
    if (signals.vueSvelteFiles) reasons.push(`${signals.vueSvelteFiles} Vue/Svelte file(s)`);
    if (reactStatic.reactStatic) reasons.push(reactStatic.reason);
  } else if (hasPhp && !hasNode) {
    stack = 'php-apache';
    if (signals.composerJson) reasons.push('composer.json');
    if (signals.indexPhp) reasons.push('index.php');
    reasons.push(`${signals.phpFiles} PHP file(s)`);
  } else if (hasNode && hasPhp) {
    // Laravel / mixed: composer + package.json → PHP; otherwise Node (MERN + stray .php)
    if (signals.composerJson || signals.artisanPhp) {
      stack = 'php-apache';
      reasons.push('PHP framework (composer/artisan) with npm assets');
    } else if (hasStrongSpring) {
      stack = 'java-spring-react';
      reasons.push('Spring Boot preferred over stray PHP beside React/Node frontend');
    } else {
      stack = 'node-js';
      reasons.push('Node/React detected; ignoring stray .php files');
    }
  }

  // ZIP file signals beat assignment hints: never force Node when Spring Boot is present.
  if (stack === 'node-js' && hasStrongSpring && hasReactOrJsFrontend) {
    stack = 'java-spring-react';
    reasons.push('overrode Node hint — Spring Boot + React frontend detected in ZIP');
  }
  if (hint === 'java-spring-react' && !stack && hasReactOrJsFrontend && (signals.pomXmlCount || signals.gradleBuild)) {
    stack = 'java-spring-react';
    reasons.push('assignment hint (java-spring-react) with Java build files');
  }

  if (!stack && hint && STACK_BLUEPRINTS[hint]) {
    // Generic "react" hint must not force Node when Spring files exist.
    if (hint === 'node-js' && hasStrongSpring && hasReactOrJsFrontend) {
      stack = 'java-spring-react';
      reasons.push('assignment hinted Node/React but ZIP has Spring Boot — using React + Spring Boot');
    } else {
      stack = hint;
      reasons.push(`assignment hint (${hint}) — no strong file signals`);
    }
  }

  if (!stack) {
    const err = new Error(
      'Could not detect project stack from files. Include index.html + CSS (HTML/CSS), index.html + CSS + .js (HTML/CSS/JS), package.json (Node), .php (PHP), or .ipynb (Jupyter).'
    );
    err.status = 400;
    throw err;
  }

  return {
    stack,
    reasons,
    signals: {
      packageJsonCount: nodePkgCount,
      phpFiles: signals.phpFiles,
      ipynbFiles: signals.ipynbFiles,
      viteConfig: signals.viteConfig,
      jsxTsxFiles: signals.jsxTsxFiles,
    },
  };
}

export async function detectProjectStack(projectPath, options = {}) {
  const meta = await detectProjectStackWithMeta(projectPath, options);
  return meta.stack;
}

/**
 * Copy Dockerfile (and optional .dockerignore) from docker-templates/{stack} into the project root.
 */
export async function materializeDockerTemplate(stack, projectPath, options = {}) {
  const blueprint = STACK_BLUEPRINTS[stack];
  if (!blueprint) {
    const err = new Error(`Unknown stack: ${stack}`);
    err.status = 400;
    throw err;
  }

  const templateDirName = options.templateDir || blueprint.templateDir;
  const templateDir = path.join(TEMPLATES_ROOT, templateDirName);
  const dockerfileSrc = path.join(templateDir, 'Dockerfile');
  const dockerignoreSrc = path.join(templateDir, '.dockerignore');
  const sharedNodeDir = path.join(TEMPLATES_ROOT, 'node-js');
  const entrypointSrc = fsSync.existsSync(path.join(templateDir, 'entrypoint.sh'))
    ? path.join(templateDir, 'entrypoint.sh')
    : path.join(sharedNodeDir, 'entrypoint.sh');

  if (!fsSync.existsSync(dockerfileSrc)) {
    const err = new Error(`Missing Dockerfile template for stack "${stack}"`);
    err.status = 500;
    throw err;
  }

  await fs.copyFile(dockerfileSrc, path.join(projectPath, 'Dockerfile'));

  if (fsSync.existsSync(dockerignoreSrc)) {
    await fs.copyFile(dockerignoreSrc, path.join(projectPath, '.dockerignore'));
  }

  if (fsSync.existsSync(entrypointSrc)) {
    const destEntry = path.join(projectPath, 'entrypoint.sh');
    const script = await fs.readFile(entrypointSrc, 'utf8');
    await fs.writeFile(destEntry, script.replace(/\r\n/g, '\n'), 'utf8');
    if (process.platform !== 'win32') {
      await fs.chmod(destEntry, 0o755);
    }
  }

  const fallbackSrc = fsSync.existsSync(path.join(templateDir, 'preview-fallback'))
    ? path.join(templateDir, 'preview-fallback')
    : path.join(sharedNodeDir, 'preview-fallback');
  if (fsSync.existsSync(fallbackSrc)) {
    const destFallback = path.join(projectPath, 'preview-fallback');
    await fs.rm(destFallback, { recursive: true, force: true });
    await fs.cp(fallbackSrc, destFallback, { recursive: true });
  }

  return blueprint;
}

/**
 * Build image with stack-specific args, then run container executing the template entrypoint.
 */
async function dockerImageExists(imageTag) {
  try {
    await spawnProcess('docker', ['image', 'inspect', imageTag], { timeoutMs: 20_000 });
    return true;
  } catch {
    return false;
  }
}

async function buildPreviewImage({
  imageTag,
  buildContext,
  appSubdir,
  forceRebuild = false,
  buildTimeoutMs = BUILD_TIMEOUT_MS,
}) {
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { reused: true };
  }
  const args = ['build', '-t', imageTag, '--build-arg', `APP_SUBDIR=${appSubdir}`, '.'];
  await spawnProcess('docker', args, { cwd: buildContext, timeoutMs: buildTimeoutMs });
  return { reused: false };
}

/**
 * Start detached container; ENTRYPOINT script runs install + server commands at runtime.
 */
async function runPreviewContainer({
  containerName,
  imageTag,
  hostPort,
  internalPort,
  stack,
  appSubdir,
  previewCredentialEnv = null,
  apiHostPort = null,
  mernPair = null,
  flutterPair = null,
  springPair = null,
  dockerNetwork = null,
  projectMount = null,
  memoryLimit = process.env.PREVIEW_SANDBOX_MEMORY || '256m',
  cpuLimit = process.env.PREVIEW_SANDBOX_CPUS || '0.5',
  initTimeoutMs = Number(process.env.PREVIEW_CONTAINER_INIT_TIMEOUT_MS || 30_000),
  workspaceCached = false,
}) {
  const portMapping = `${hostPort}:${internalPort}`;
  const args = [
    'run',
    '-d',
    '--name',
    containerName,
    '-p',
    portMapping,
    '--memory',
    memoryLimit,
    '--cpus',
    cpuLimit,
    '--label',
    'scholarverify.preview=1',
    '--add-host',
    'host.docker.internal:host-gateway',
  ];

  if (projectMount) {
    const mountPath = previewProjectMountPath(stack);
    args.push('-v', `${dockerVolumePath(projectMount)}:${mountPath}`);
  }

  const useDepCaches =
    stack === 'java-spring-react' ||
    stack === 'node-js' ||
    Boolean(mernPair) ||
    Boolean(flutterPair);
  if (useDepCaches && process.env.PREVIEW_DEPENDENCY_CACHE !== 'false') {
    const caches = await ensurePreviewDependencyCacheDirs();
    args.push('-v', `${dockerVolumePath(caches.maven)}:/root/.m2`);
    args.push('-v', `${dockerVolumePath(caches.npm)}:/root/.npm`);
  }

  if (workspaceCached) {
    args.push('-e', 'PREVIEW_WORKSPACE_CACHED=1');
  }

  if (dockerNetwork) {
    args.push('--network', dockerNetwork);
  }

  if (apiHostPort && springPair) {
    const publicApiUrl = buildPublicPreviewOrigin(apiHostPort);
    const publicUiUrl = buildPublicPreviewOrigin(hostPort);
    args.push('-p', `${apiHostPort}:8080`);
    args.push('-e', 'API_PORT=8080');
    args.push('-e', `PORT=${internalPort}`);
    args.push('-e', `PREVIEW_API_HOST_PORT=${apiHostPort}`);
    args.push('-e', `PREVIEW_PUBLIC_API_URL=${publicApiUrl}`);
    args.push('-e', `PREVIEW_PUBLIC_UI_URL=${publicUiUrl}`);
    args.push('-e', `CORS_ORIGIN=${publicUiUrl}`);
    args.push('-e', `VITE_API_URL=${publicApiUrl}`);
    args.push('-e', `REACT_APP_API_URL=${publicApiUrl}`);
    args.push('-e', `SPRING_SUBDIR=${springPair.springSubdir}`);
    args.push('-e', `FRONTEND_SUBDIR=${springPair.frontendSubdir}`);
    args.push('-e', 'PREVIEW_SPRING_MODE=1');
  } else if (apiHostPort) {
    const publicApiUrl = buildPublicPreviewOrigin(apiHostPort);
    const publicUiUrl = buildPublicPreviewOrigin(hostPort);
    args.push('-p', `${apiHostPort}:5000`);
    args.push('-e', 'API_PORT=5000');
    args.push('-e', `PREVIEW_API_HOST_PORT=${apiHostPort}`);
    args.push('-e', `PREVIEW_UI_HOST_PORT=${hostPort}`);
    args.push('-e', `PREVIEW_PUBLIC_API_URL=${publicApiUrl}`);
    args.push('-e', `PREVIEW_PUBLIC_UI_URL=${publicUiUrl}`);
    args.push('-e', `CORS_ORIGIN=${publicUiUrl}`);
    args.push('-e', `VITE_API_URL=${publicApiUrl}`);
    args.push('-e', `REACT_APP_API_URL=${publicApiUrl}`);
    args.push('-e', `VITE_API_BASE_URL=${publicApiUrl}`);
    if (mernPair?.backendSubdir) args.push('-e', `BACKEND_SUBDIR=${mernPair.backendSubdir}`);
    if (mernPair?.frontendSubdir) args.push('-e', `FRONTEND_SUBDIR=${mernPair.frontendSubdir}`);
    if (flutterPair?.backendSubdir) args.push('-e', `BACKEND_SUBDIR=${flutterPair.backendSubdir}`);
    if (flutterPair?.flutterSubdir) args.push('-e', `FLUTTER_SUBDIR=${flutterPair.flutterSubdir}`);
    if (flutterPair) {
      args.push('-e', 'PREVIEW_FLUTTER_MODE=1');
    } else if (mernPair) {
      args.push('-e', 'PREVIEW_MERN_MODE=1');
    }
  }

  if (stack === 'node-js' || stack === 'static-html' || stack === 'static-html-js') {
    args.push('-e', `PORT=${internalPort}`, '-e', `APP_SUBDIR=${appSubdir}`);
    if (stack === 'static-html' || stack === 'static-html-js') {
      args.push('-e', `PREVIEW_STATIC_STACK=${stack}`);
    }
  } else if (stack === 'php-apache') {
    args.push('-e', `APP_SUBDIR=${appSubdir}`);
    args.push('-e', 'PREVIEW_SANDBOX=1');
    const previewBaseUrl = `${getPublicPreviewBase()}:${hostPort}/`;
    args.push('-e', `PREVIEW_BASE_URL=${previewBaseUrl}`);
    const dbHost = previewCredentialEnv?.DB_HOST;
    if (dbHost) {
      args.push('-e', `DB_HOST=${dbHost}`);
      args.push('-e', `DB_NAME=${previewCredentialEnv.DB_NAME || PREVIEW_MYSQL_DATABASE}`);
      args.push('-e', `DB_USER=${previewCredentialEnv.DB_USER || 'root'}`);
      args.push('-e', `DB_PASS=${previewCredentialEnv.DB_PASS || PREVIEW_MYSQL_ROOT_PASSWORD}`);
    }
  } else if (stack === 'jupyter') {
    args.push('-e', `JUPYTER_PORT=${internalPort}`);
  }

  if (previewCredentialEnv && typeof previewCredentialEnv === 'object') {
    for (const [key, value] of Object.entries(previewCredentialEnv)) {
      if (value != null && String(value).length > 0) {
        args.push('-e', `${key}=${String(value)}`);
      }
    }
  }

  args.push(imageTag);

  try {
    const { stdout } = await spawnProcess('docker', args, { timeoutMs: initTimeoutMs });
    return stdout.split('\n').pop()?.trim() || stdout.trim();
  } catch (e) {
    await removeContainerIfExists(containerName).catch(() => {});
    throw e;
  }
}

/**
 * Stop and remove a container by name if it already exists (idempotent redeploy).
 */
export async function removeContainerIfExists(containerName) {
  try {
    await runCommand(`docker rm -f ${containerName}`, { timeoutMs: 60_000 });
  } catch (e) {
    const msg = (e.stderr || e.message || '').toLowerCase();
    if (msg.includes('no such container') || msg.includes('not found')) return;
    throw e;
  }
}

function previewNetworkName(projectId) {
  const id = String(projectId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `preview-net-${id}`;
}

async function ensureDockerNetwork(networkName) {
  try {
    await runCommand(`docker network inspect ${networkName}`, { timeoutMs: 15_000 });
  } catch {
    await runCommand(`docker network create ${networkName}`, { timeoutMs: 30_000 });
  }
}

const PREVIEW_MONGO_IMAGE = process.env.PREVIEW_MONGO_IMAGE || 'mongo:7';
const PREVIEW_MONGO_PULL_TIMEOUT_MS = Number(process.env.PREVIEW_MONGO_PULL_TIMEOUT_MS || 600_000);
const PREVIEW_MONGO_RUN_TIMEOUT_MS = Number(process.env.PREVIEW_MONGO_RUN_TIMEOUT_MS || 90_000);

/** Pull mongo image once (first preview can take several minutes on slow networks). */
/** Pre-build the small Node preview base image so the first teacher preview starts faster. */
export async function ensurePreviewNodeBaseImages() {
  if (process.env.DOCKER_PREVIEW_ENABLED === 'false') return { node: false, flutter: false };
  if (!(await dockerAvailable())) return { node: false, flutter: false };
  const node = await ensurePreviewNodeBaseImage(null).then(() => true).catch(() => false);
  return { node, flutter: false };
}

export function previewWarmBaseImagesEnabled() {
  if (process.env.PREVIEW_WARM_BASE_IMAGES === 'false') return false;
  if (process.env.PREVIEW_WARM_NODE_BASE_IMAGE === 'false') return false;
  return true;
}

/** Warm all reusable preview base images once at API startup. */
export async function warmPreviewBaseImages() {
  if (process.env.DOCKER_PREVIEW_ENABLED === 'false') return {};
  if (!(await dockerAvailable())) return {};
  const forceRebuild = process.env.PREVIEW_FORCE_REBUILD_BASE === 'true';
  const warmOpts = { forceRebuild };
  const toStatus = (promise) =>
    promise
      .then((r) => (r.reused ? 'ready' : 'built'))
      .catch(() => 'failed');

  const [node, flutter, php, jupyter, springReact] = await Promise.all([
    toStatus(ensurePreviewNodeBaseImage(null, warmOpts)),
    toStatus(ensurePreviewNodeBaseImage({ warm: true }, warmOpts)),
    toStatus(ensurePreviewPhpBaseImage(warmOpts)),
    toStatus(ensurePreviewJupyterBaseImage(warmOpts)),
    toStatus(ensurePreviewSpringReactBaseImage(warmOpts)),
  ]);

  return { node, flutter, php, jupyter, springReact };
}

export async function ensurePreviewMongoImage() {
  try {
    await spawnProcess('docker', ['image', 'inspect', PREVIEW_MONGO_IMAGE], { timeoutMs: 20_000 });
    return { pulled: false };
  } catch {
    /* not local — pull below */
  }
  await spawnProcess('docker', ['pull', PREVIEW_MONGO_IMAGE], { timeoutMs: PREVIEW_MONGO_PULL_TIMEOUT_MS });
  return { pulled: true };
}

/** Pull MariaDB image once so PHP previews skip the download wait. */
export async function ensurePreviewMysqlImage() {
  try {
    await spawnProcess('docker', ['image', 'inspect', PREVIEW_MYSQL_IMAGE], { timeoutMs: 20_000 });
    return { pulled: false };
  } catch {
    /* not local — pull below */
  }
  await spawnProcess('docker', ['pull', PREVIEW_MYSQL_IMAGE], {
    timeoutMs: PREVIEW_MONGO_PULL_TIMEOUT_MS,
  });
  return { pulled: true };
}

/**
 * MERN previews need MongoDB reachable from the app container. Host Mongo often binds 127.0.0.1 only,
 * so we start a dedicated mongo on the same Docker network as the preview app.
 */
async function startPreviewMongoSidecar(projectId) {
  const networkName = previewNetworkName(projectId);
  const mongoName = previewMongoHostName(projectId);
  await ensureDockerNetwork(networkName);
  await removeContainerIfExists(mongoName);

  await ensurePreviewMongoImage();

  try {
    await spawnProcess(
      'docker',
      [
        'run',
        '-d',
        '--name',
        mongoName,
        '--network',
        networkName,
        '--label',
        'scholarverify.preview=mongo',
        PREVIEW_MONGO_IMAGE,
      ],
      { timeoutMs: PREVIEW_MONGO_RUN_TIMEOUT_MS }
    );
  } catch (runErr) {
    const running = await isPreviewContainerRunning(mongoName);
    if (!running) {
      await removeContainerIfExists(mongoName);
      throw runErr;
    }
  }

  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const { stdout } = await runCommand(
        `docker exec ${mongoName} mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok"`,
        { timeoutMs: 8000 }
      );
      if (stdout.trim() === '1' || stdout.includes('1')) {
        return { networkName, mongoName };
      }
    } catch {
      /* mongo still starting */
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
  }

  const err = new Error('Preview MongoDB sidecar did not become ready in time');
  err.status = 500;
  throw err;
}

async function stopPreviewMongoSidecar(projectId) {
  await removeContainerIfExists(previewMongoHostName(projectId));
}

const PREVIEW_MYSQL_IMAGE = process.env.PREVIEW_MYSQL_IMAGE || 'mariadb:11';
const PREVIEW_MYSQL_ROOT_PASSWORD = process.env.PREVIEW_MYSQL_ROOT_PASSWORD || 'preview-root';
const PREVIEW_MYSQL_USER = process.env.PREVIEW_MYSQL_USER || 'preview';
const PREVIEW_MYSQL_PASSWORD = process.env.PREVIEW_MYSQL_PASSWORD || 'preview';
const PREVIEW_MYSQL_DATABASE = process.env.PREVIEW_MYSQL_DATABASE || 'bbms';

async function startPreviewMysqlSidecar(projectId) {
  const networkName = previewNetworkName(projectId);
  const mysqlName = previewMysqlHostName(projectId);
  await ensureDockerNetwork(networkName);
  await removeContainerIfExists(mysqlName);

  await spawnProcess(
    'docker',
    [
      'run',
      '-d',
      '--name',
      mysqlName,
      '--network',
      networkName,
      '--label',
      'scholarverify.preview=mysql',
      '-e',
      `MARIADB_ROOT_PASSWORD=${PREVIEW_MYSQL_ROOT_PASSWORD}`,
      '-e',
      `MARIADB_DATABASE=${PREVIEW_MYSQL_DATABASE}`,
      '-e',
      `MARIADB_USER=${PREVIEW_MYSQL_USER}`,
      '-e',
      `MARIADB_PASSWORD=${PREVIEW_MYSQL_PASSWORD}`,
      PREVIEW_MYSQL_IMAGE,
    ],
    { timeoutMs: PREVIEW_MONGO_RUN_TIMEOUT_MS }
  );

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await runCommand(
        `docker exec ${mysqlName} mariadb-admin ping -h 127.0.0.1 -u${PREVIEW_MYSQL_USER} -p${PREVIEW_MYSQL_PASSWORD} --silent`,
        { timeoutMs: 8000 }
      );
      return { networkName, mysqlName };
    } catch {
      /* mysql still starting */
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
  }

  const err = new Error('Preview MySQL sidecar did not become ready in time');
  err.status = 500;
  throw err;
}

async function ensurePreviewMysqlDatabase(mysqlName, dbName) {
  const safeDb = String(dbName || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!mysqlName || !safeDb) return;
  await spawnProcess(
    'docker',
    [
      'exec',
      mysqlName,
      'mariadb',
      '-uroot',
      `-p${PREVIEW_MYSQL_ROOT_PASSWORD}`,
      '-e',
      `CREATE DATABASE IF NOT EXISTS ${safeDb};`,
    ],
    { timeoutMs: 30_000 }
  );
}

async function stopPreviewMysqlSidecar(projectId) {
  await removeContainerIfExists(previewMysqlHostName(projectId));
}

async function stopPreviewSidecars(projectId) {
  await stopPreviewMongoSidecar(projectId);
  await stopPreviewMysqlSidecar(projectId);
  try {
    await runCommand(`docker network rm ${previewNetworkName(projectId)}`, { timeoutMs: 30_000 });
  } catch {
    /* network may still be in use */
  }
}

/**
 * Remove built image tag (best-effort).
 */
export async function removeImageIfExists(imageTag) {
  try {
    await runCommand(`docker rmi -f ${imageTag}`, { timeoutMs: 120_000 });
  } catch {
    /* image may be in use or already gone */
  }
}

function buildPreviewUrl(hostPort, stack) {
  const base = getPublicPreviewBase();
  // Jupyter serves from /tree or /lab; root often redirects — keep root for notebook listing
  return `${base}:${hostPort}/`;
}

/**
 * Core deployment: detect stack, write Dockerfile, build image, run container, return browser URL.
 *
 * @param {string} projectId - Stable id (e.g. preview session id) for image/container names
 * @param {string} projectPath - Directory or .zip path (must pass assertSafeProjectPath when sandboxed)
 * @param {{ allowedRoot?: string, stack?: string }} [options]
 * @returns {Promise<{
 *   previewUrl: string,
 *   hostPort: number,
 *   internalPort: number,
 *   stack: string,
 *   containerName: string,
 *   imageTag: string,
 *   containerId: string,
 *   projectPath: string,
 *   tempDir: string|null,
 * }>}
 */
export async function deployProjectPreview(projectId, projectPath, options = {}) {
  if (process.env.DOCKER_PREVIEW_ENABLED === 'false') {
    const err = new Error('Docker preview is disabled (DOCKER_PREVIEW_ENABLED=false)');
    err.status = 503;
    throw err;
  }

  if (!(await dockerAvailable())) {
    const err = new Error(
      'Docker daemon unreachable. Start Docker Desktop (Windows/Mac) or ensure /var/run/docker.sock is available.'
    );
    err.status = 503;
    throw err;
  }

  const {
    allowedRoot = null,
    stack: stackOverride = null,
    stackHint = null,
    imageKey = projectId,
    forceRebuild = false,
    previewCredentialEnv = null,
    workspaceCached = false,
  } = options;
  const { projectPath: resolvedInput, tempDir } = await resolveSubmissionPath(projectPath, { allowedRoot });
  const buildContext = await resolveProjectRoot(resolvedInput);
  assertSafeProjectPath(buildContext, tempDir || allowedRoot || null);

  const detection =
    stackOverride != null
      ? { stack: stackOverride, reasons: ['manual override'], signals: {} }
      : await detectProjectStackWithMeta(buildContext, { stackHint });

  const stack = detection.stack;
  let mernPair = null;
  let flutterPair = null;
  let springPair = null;
  if (stack === 'node-js') {
    flutterPair = await resolveFlutterNodePair(buildContext);
    if (!flutterPair) {
      mernPair = await resolveMernPair(buildContext);
    }
  }
  if (stack === 'java-spring-react') {
    springPair = await resolveSpringReactPair(buildContext);
    if (!springPair) {
      const err = new Error(
        'Could not find Spring Boot (pom.xml / mvnw / Gradle) and React (package.json) in separate folders. ' +
          'ZIP should contain e.g. backend/ with Java and frontend/ with React — not only one package.json.'
      );
      err.status = 400;
      throw err;
    }
  }
  const blueprint = STACK_BLUEPRINTS[stack];
  if (!blueprint) {
    const err = new Error(`Unsupported preview stack: ${stack}`);
    err.status = 400;
    throw err;
  }

  const appSubdir =
    flutterPair?.flutterSubdir ||
    mernPair?.frontendSubdir ||
    springPair?.frontendSubdir ||
    (await resolveAppSubdir(buildContext, stack));

  let imageTag = buildImageTag(imageKey, stack);
  const containerName = containerNameFor(projectId);
  const internalPort = blueprint.internalPort;

  await removeContainerIfExists(containerName);

  const hostPort = await allocateHostPort();
  let apiHostPort = null;
  let previewDockerNetwork = null;
  let mergedCredentialEnv = previewCredentialEnv ? { ...previewCredentialEnv } : {};
  let phpLoginPath = '/auth/login.php';
  let phpPatchMeta = null;
  let springPatchMeta = null;
  const previewBaseUrl =
    stack === 'php-apache' ? `${getPublicPreviewBase()}:${hostPort}/` : null;

  const baseMetaPromise = ensurePreviewBaseImage(stack, {
    flutterPair,
    forceRebuild: forceRebuild && process.env.PREVIEW_FORCE_REBUILD_BASE === 'true',
  });

  let sidecarPromise = null;
  if (stack === 'php-apache' && process.env.PREVIEW_SIDECAR_MYSQL !== 'false') {
    sidecarPromise = startPreviewMysqlSidecar(projectId);
  }

  const splitStackPair = flutterPair || mernPair || springPair;
  if (splitStackPair) {
    apiHostPort = await allocateHostPort();
    while (apiHostPort === hostPort) {
      apiHostPort = await allocateHostPort();
    }

    if (springPair) {
      const springRoot = path.join(buildContext, springPair.springSubdir);
      const frontendRoot = path.join(buildContext, springPair.frontendSubdir);
      if (!fsSync.existsSync(path.join(springRoot, 'pom.xml')) && !fsSync.existsSync(path.join(springRoot, 'build.gradle'))) {
        const err = new Error(
          `Spring folder not found at "${springPair.springSubdir}". Re-extract or fix ZIP layout.`
        );
        err.status = 400;
        throw err;
      }
      if (!fsSync.existsSync(path.join(frontendRoot, 'package.json')) && !fsSync.existsSync(path.join(frontendRoot, 'index.html'))) {
        const err = new Error(
          `React frontend not found at "${springPair.frontendSubdir}". Re-extract or fix ZIP layout.`
        );
        err.status = 400;
        throw err;
      }
      const publicApiUrl = buildPublicPreviewOrigin(apiHostPort);
      const publicUiUrl = buildPublicPreviewOrigin(hostPort);
      const [springPatch] = await Promise.all([
        patchSpringForPreview(buildContext, springPair.springSubdir, {
          apiHostPort,
          uiHostPort: hostPort,
          publicUiUrl,
        }),
        patchFrontendApiPort(buildContext, springPair.frontendSubdir, apiHostPort, { publicApiUrl }),
      ]);
      springPatchMeta = springPatch;
      if (springPatch?.seedCredentials?.username) {
        mergedCredentialEnv = {
          ...mergedCredentialEnv,
          PREVIEW_SEED_USERNAME: springPatch.seedCredentials.username,
          PREVIEW_SEED_PASSWORD: springPatch.seedCredentials.password,
          ADMIN_USERNAME: springPatch.seedCredentials.username,
          LOGIN_USERNAME: springPatch.seedCredentials.username,
          ADMIN_PASSWORD: springPatch.seedCredentials.password,
        };
      }
    } else if (process.env.PREVIEW_SIDECAR_MONGO !== 'false') {
      sidecarPromise = startPreviewMongoSidecar(projectId);
    }
  }

  if (sidecarPromise) {
    const sidecar = await sidecarPromise;
    previewDockerNetwork = sidecar.networkName;
    if (stack === 'php-apache') {
      const previewDbName = await resolvePreviewDatabaseName(
        path.join(buildContext, appSubdir === '.' ? '' : appSubdir)
      );
      mergedCredentialEnv = {
        ...mergedCredentialEnv,
        DB_HOST: sidecar.mysqlName,
        DB_NAME: previewDbName,
        DB_USER: 'root',
        DB_PASS: PREVIEW_MYSQL_ROOT_PASSWORD,
      };
      await ensurePreviewMysqlDatabase(sidecar.mysqlName, previewDbName);
    } else {
      const mongoUri = buildPreviewMongoUri(projectId, { sidecarHost: sidecar.mongoName });
      mergedCredentialEnv = {
        ...mergedCredentialEnv,
        MONGO_URI: mongoUri,
        MONGODB_URI: mongoUri,
        DATABASE_URL: mongoUri,
        PREVIEW_SANDBOX: '1',
      };
    }
  }

  if (stack === 'php-apache') {
    const patched = await patchPhpForPreview(buildContext, appSubdir, {
      baseUrl: previewBaseUrl,
      dbHost: mergedCredentialEnv.DB_HOST || 'host.docker.internal',
      dbName: mergedCredentialEnv.DB_NAME || PREVIEW_MYSQL_DATABASE,
      dbUser: mergedCredentialEnv.DB_USER || 'root',
      dbPass: mergedCredentialEnv.DB_PASS || PREVIEW_MYSQL_ROOT_PASSWORD,
    });
    if (patched.dbName) {
      mergedCredentialEnv.DB_NAME = patched.dbName;
      if (mergedCredentialEnv.DB_HOST) {
        await ensurePreviewMysqlDatabase(mergedCredentialEnv.DB_HOST, patched.dbName);
      }
    }
    phpLoginPath = patched.loginPath || (await discoverPhpLoginPath(buildContext, appSubdir));
    phpPatchMeta = {
      dbName: patched.dbName,
      bootstrapScripts: patched.bootstrapScripts || [],
      adminCredentials: patched.adminCredentials || {},
      patchedFiles: patched.files || 0,
    };
  }

  if (splitStackPair && !springPair) {
    const publicApiUrl = apiHostPort ? buildPublicPreviewOrigin(apiHostPort) : '';
    const publicUiUrl = buildPublicPreviewOrigin(hostPort);
    const discoveredLoginPaths = await discoverLoginApiPaths(
      buildContext,
      splitStackPair.backendSubdir || ''
    ).catch(() => []);
    const loginApiPath =
      preferLoginApiPath(discoveredLoginPaths) || '/api/auth/login';
    if (flutterPair) {
      await patchFlutterApiPort(buildContext, flutterPair.flutterSubdir, apiHostPort, { publicApiUrl });
    } else if (mernPair) {
      await patchFrontendApiPort(buildContext, mernPair.frontendSubdir, apiHostPort, {
        publicApiUrl,
        loginApiPath,
      });
    }
    const mongoUri =
      mergedCredentialEnv.MONGO_URI ||
      mergedCredentialEnv.MONGODB_URI ||
      buildPreviewMongoUri(projectId);
    await patchBackendForPreview(buildContext, splitStackPair.backendSubdir, {
      mongoUri,
      hostPort,
      publicUiUrl,
      jwtSecret: mergedCredentialEnv.JWT_SECRET,
      loginApiPath,
    });
  }

  let imageReused = false;
  let projectMount = null;
  try {
    const baseMeta = await baseMetaPromise;
    if (baseMeta?.failed) {
      const detail = String(baseMeta.error || '').trim().slice(0, 280);
      const err = new Error(
        detail
          ? `${previewBaseImageFailureMessage(stack)} (${detail})`
          : previewBaseImageFailureMessage(stack)
      );
      err.status = 503;
      throw err;
    }
    if (baseMeta?.stale) {
      logger.warn(
        `Using stale preview base image ${baseMeta.imageTag} after rebuild failure: ${baseMeta.rebuildError || 'unknown'}`
      );
    }
    imageTag = baseMeta.imageTag;
    imageReused = Boolean(baseMeta.reused);
    projectMount = buildContext;
  } catch (e) {
    releaseHostPort(hostPort);
    if (apiHostPort) releaseHostPort(apiHostPort);
    await stopPreviewSidecars(projectId).catch(() => {});
    if (e.status === 503) throw e;
    const err = new Error(`Docker build failed: ${e.stderr || e.message}`);
    err.status = 500;
    throw err;
  }

  // Port map: host PORT -> container INTERNAL; entrypoint.sh runs npm/apache/jupyter inside the container
  let containerId = '';
  try {
    containerId = await runPreviewContainer({
      containerName,
      imageTag,
      hostPort,
      internalPort,
      stack,
      appSubdir,
      previewCredentialEnv: mergedCredentialEnv,
      apiHostPort,
      mernPair,
      flutterPair,
      springPair,
      dockerNetwork: previewDockerNetwork,
      projectMount,
      memoryLimit: springPair
        ? process.env.PREVIEW_SPRING_SANDBOX_MEMORY || '1536m'
        : process.env.PREVIEW_SANDBOX_MEMORY || '256m',
      workspaceCached,
    });
  } catch (e) {
    releaseHostPort(hostPort);
    if (apiHostPort) releaseHostPort(apiHostPort);
    const err = new Error(`Docker run failed: ${e.stderr || e.message}`);
    err.status = 500;
    throw err;
  }

  const previewUrl = buildPreviewUrl(hostPort, stack);
  const previewApiUrl = apiHostPort ? buildPreviewUrl(apiHostPort, stack) : '';
  const stackDisplayName = springPair
    ? springReactDisplayLabel(springPair)
    : previewStackDisplayName(stack, mernPair);

  return {
    previewUrl,
    previewApiUrl,
    hostPort,
    apiHostPort,
    mernPair,
    flutterPair,
    springPair,
    internalPort,
    stack,
    stackDisplayName,
    containerName,
    imageTag,
    containerId,
    projectPath: buildContext,
    appSubdir,
    tempDir,
    imageReused,
    detectionReason: [
      ...detection.reasons,
      mernPair?.detectionNote,
      springPair?.detectionNote,
      flutterPair ? 'Flutter + Node split stack' : null,
    ]
      .filter(Boolean)
      .join(', '),
    detectionSignals: detection.signals,
    phpLoginPath,
    phpPatchMeta,
    springPatchMeta,
  };
}

/**
 * Stop container and release host port for a deployed preview.
 */
export async function stopProjectPreview(
  projectId,
  { hostPort = null, apiHostPort = null, removeImage = false, imageKey = projectId, stack = 'node-js' } = {}
) {
  const containerName = containerNameFor(projectId);
  const imageTag = buildImageTag(imageKey, stack);

  await removeContainerIfExists(containerName);
  await stopPreviewSidecars(projectId);
  if (removeImage) await removeImageIfExists(imageTag);
  if (hostPort) releaseHostPort(hostPort);
  if (apiHostPort) releaseHostPort(apiHostPort);
}

export function parseHostPortFromPreviewUrl(previewUrl) {
  try {
    const u = new URL(previewUrl);
    return { host: u.hostname || 'localhost', port: Number(u.port) || 80 };
  } catch {
    return { host: 'localhost', port: 80 };
  }
}

export function isTcpPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2500);
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
    socket.connect(port, host, () => done(true));
  });
}

/** TCP or HTTP GET — Windows Docker port maps sometimes fail raw TCP from the API host. */
export async function isPreviewPortReachable(previewUrl, host, port) {
  if (await isTcpPortOpen(host, port)) return true;
  if (!previewUrl) return false;
  const hit = await fetchPreviewHttp(previewUrl);
  return hit.ok;
}

/**
 * Poll until the mapped host port accepts traffic. Docker often needs several seconds
 * to publish -p bindings after `docker run` returns — a single TCP probe is too early.
 */
export async function waitForHostPortPublished({
  previewUrl = '',
  host,
  port,
  timeoutMs = PREVIEW_PORT_PUBLISH_GRACE_MS,
  pollMs = PREVIEW_PORT_PUBLISH_POLL_MS,
} = {}) {
  const parsed = previewUrl ? parseHostPortFromPreviewUrl(previewUrl) : { host: 'localhost', port: 80 };
  const resolvedHost = host || previewProbeHostname(parsed.host);
  const resolvedPort = port || parsed.port;
  const deadline = Date.now() + Math.max(0, timeoutMs);

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPreviewPortReachable(previewUrl, resolvedHost, resolvedPort)) {
      return true;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    // eslint-disable-next-line no-await-in-loop
    await sleep(Math.min(pollMs, remaining));
  }
  return false;
}

/** Poll raw TCP until the port opens or the grace window expires. */
export async function pollTcpPortOpen(
  host,
  port,
  { timeoutMs = PREVIEW_PORT_PUBLISH_GRACE_MS, pollMs = PREVIEW_PORT_PUBLISH_POLL_MS } = {}
) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await isTcpPortOpen(host, port)) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    // eslint-disable-next-line no-await-in-loop
    await sleep(Math.min(pollMs, remaining));
  }
  return false;
}

export async function isPreviewContainerRunning(containerName) {
  try {
    const { stdout } = await runCommand(
      `docker inspect -f "{{.State.Running}}" ${containerName}`,
      { timeoutMs: 10_000 }
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/** True when HTTP body is the built-in “still installing” holder page (not the student app). */
export function isPreviewPlaceholderBody(body = '') {
  const text = String(body);
  return (
    /scholarverify-preview-placeholder/i.test(text) ||
    text.includes('Preview container is running') ||
    text.includes('<title>Preview starting</title>')
  );
}

function normalizeProbeUrl(url) {
  return rewritePreviewUrlForProbe(url);
}

async function fetchPreviewHttp(url) {
  const candidates = [normalizeProbeUrl(url)];
  try {
    const parsed = new URL(url);
    const probeHost = getPreviewProbeHost();
    const alt = `http://${probeHost}:${parsed.port || '80'}${parsed.pathname || '/'}${parsed.search || ''}`;
    if (!candidates.includes(alt)) candidates.push(alt);
  } catch {
    /* ignore */
  }

  for (const target of candidates) {
    try {
      const res = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (res && res.status >= 200 && res.status < 500) {
        return { ok: true, status: res.status, body: await res.text().catch(() => ''), url: target };
      }
    } catch {
      /* try manual redirect */
    }
    try {
      const res = await fetch(target, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      if (res && res.status >= 200 && res.status < 400) {
        return { ok: true, status: res.status, body: '', redirect: true, url: target };
      }
    } catch {
      /* next candidate */
    }
  }
  return { ok: false, status: 0, body: '' };
}

/**
 * HTTP probe used by readiness polling and teacher session refresh.
 * Returns ready only when the student UI responds (not the Docker placeholder page).
 */
export async function checkPreviewAppHttpReady({
  previewUrl,
  apiPreviewUrl = '',
  stack = 'node-js',
} = {}) {
  if (!previewUrl) return { ready: false, reason: 'no_url' };

  const base = normalizeProbeUrl(previewUrl).replace(/\/$/, '');
  const urlsToTry = [normalizeProbeUrl(previewUrl), `${base}/`];
  if (stack === 'php-apache') {
    urlsToTry.push(`${base}/index.php`);
  }
  if (stack === 'node-js' || stack === 'static-html' || stack === 'static-html-js' || stack === 'java-spring-react') {
    urlsToTry.push(`${base}/index.html`);
  }

  let uiReady = false;
  const seenUrls = new Set();
  for (const url of urlsToTry) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const hit = await fetchPreviewHttp(url);
    if (!hit.ok) continue;
    if (hit.redirect || (hit.status >= 200 && hit.status < 400)) {
      if (hit.body.length === 0 || hit.redirect || !isPreviewPlaceholderBody(hit.body)) {
        uiReady = true;
        break;
      }
    }
  }

  if (!uiReady) {
    return { ready: false, reason: 'placeholder_or_empty' };
  }

  if (!apiPreviewUrl) {
    return { ready: true, reason: 'http' };
  }

  const apiTarget = parseHostPortFromPreviewUrl(apiPreviewUrl);
  const apiCheckHost = previewProbeHostname(apiTarget.host);
  const apiOpen = await isTcpPortOpen(apiCheckHost, apiTarget.port);

  // MERN / Node full-stack: UI ready is enough to unlock preview; API readiness tracked separately.
  if (stack === 'node-js') {
    return {
      ready: true,
      reason: apiOpen ? 'http_mern' : 'http_ui_api_pending',
      apiReady: apiOpen,
    };
  }

  if (!apiOpen) {
    // Unlock Open preview when the React UI is up; track API separately so teachers
    // are not stuck for hours while Maven/Spring boot. Login verify stays deferred.
    if (stack === 'java-spring-react' && uiReady) {
      return { ready: true, reason: 'http_ui_spring_api_pending', apiReady: false, uiReady: true };
    }
    return { ready: false, reason: 'api_port_closed' };
  }

  const healthPaths =
    stack === 'java-spring-react'
      ? ['/actuator/health', '/api/health', '/health', '']
      : ['/api/health', ''];
  for (const suffix of healthPaths) {
    const healthUrl = suffix
      ? `${apiPreviewUrl.replace(/\/$/, '')}${suffix}`
      : apiPreviewUrl.replace(/\/$/, '');
    // eslint-disable-next-line no-await-in-loop
    const healthHit = await fetchPreviewHttp(healthUrl);
    if (healthHit.ok && healthHit.status < 500) {
      return { ready: true, reason: stack === 'java-spring-react' ? 'http_spring' : 'http_mern', apiReady: true };
    }
  }
  const apiHit = await fetchPreviewHttp(apiPreviewUrl);
  if (apiHit.ok && apiHit.status < 500) {
    return { ready: true, reason: 'api_http', apiReady: true };
  }
  // Spring often returns 401/404 on `/` before actuator — TCP open + UI is enough.
  if (stack === 'java-spring-react' && uiReady) {
    return { ready: true, reason: 'http_spring_api_open', apiReady: true };
  }
  return { ready: false, reason: 'api_not_http' };
}

/**
 * Poll until the mapped host port accepts traffic and HTTP responds (or TCP open for slow SPAs).
 */
export async function waitForPreviewReady({
  previewUrl,
  apiPreviewUrl = '',
  containerName = '',
  stack = 'node-js',
  timeoutMs = Number(process.env.PREVIEW_STARTUP_TIMEOUT_MS || 300_000),
} = {}) {
  const nodeTimeout = Number(process.env.PREVIEW_NODE_STARTUP_TIMEOUT_MS || 600_000);
  const springTimeout = Number(process.env.PREVIEW_SPRING_STARTUP_TIMEOUT_MS || 1_800_000);
  const portPublishGraceMs = PREVIEW_PORT_PUBLISH_GRACE_MS;
  const baseEffectiveTimeout =
    stack === 'java-spring-react'
      ? Math.max(timeoutMs, springTimeout)
      : stack === 'node-js' || stack === 'static-html' || stack === 'static-html-js'
        ? Math.max(timeoutMs, nodeTimeout)
        : timeoutMs;
  const effectiveTimeout = Math.max(baseEffectiveTimeout, portPublishGraceMs);
  const { host, port } = parseHostPortFromPreviewUrl(previewUrl);
  const checkHost = previewProbeHostname(host);
  const apiTarget = apiPreviewUrl ? parseHostPortFromPreviewUrl(apiPreviewUrl) : null;
  const started = Date.now();
  let sawPortOpen = false;
  let sawApiPortOpen = false;
  let lastLogTail = '';

  async function probeUiPort() {
    const graceLeft = portPublishGraceMs - (Date.now() - started);
    if (!sawPortOpen && graceLeft > 0) {
      return waitForHostPortPublished({
        previewUrl,
        host: checkHost,
        port,
        timeoutMs: graceLeft,
        pollMs: PREVIEW_PORT_PUBLISH_POLL_MS,
      });
    }
    return isPreviewPortReachable(previewUrl, checkHost, port);
  }

  async function probeApiPort() {
    if (!apiTarget) return false;
    const apiCheckHost = previewProbeHostname(apiTarget.host);
    const graceLeft = portPublishGraceMs - (Date.now() - started);
    if (!sawApiPortOpen && graceLeft > 0) {
      return pollTcpPortOpen(apiCheckHost, apiTarget.port, {
        timeoutMs: graceLeft,
        pollMs: PREVIEW_PORT_PUBLISH_POLL_MS,
      });
    }
    return isTcpPortOpen(apiCheckHost, apiTarget.port);
  }

  while (Date.now() - started < effectiveTimeout) {
    if (containerName) {
      // eslint-disable-next-line no-await-in-loop
      const running = await isPreviewContainerRunning(containerName);
      if (!running) {
        return { ready: false, reason: 'container_exited', logs: lastLogTail };
      }

      // eslint-disable-next-line no-await-in-loop
      lastLogTail = await getContainerLogs(containerName, 120);
      const logError = parsePreviewContainerErrors(lastLogTail);
      if (logError) {
        return { ready: false, reason: 'container_error', logError, logs: lastLogTail };
      }

      const logReady = detectPreviewReadyFromLogs(lastLogTail, stack);
      if (logReady?.ready) {
        // Spring UI logs unlock preview immediately; keep a short API wait first when possible.
        if (stack === 'java-spring-react' && apiTarget && !sawApiPortOpen && logReady.apiReady !== true) {
          const uiGraceMs = Number(process.env.PREVIEW_SPRING_UI_READY_GRACE_MS || 120_000);
          if (Date.now() - started < uiGraceMs) {
            // keep polling API briefly after UI appears
          } else {
            return {
              ready: true,
              reason: logReady.reason || 'log_spring_ui_api_pending',
              logs: lastLogTail,
              apiReady: false,
            };
          }
        } else {
          return {
            ready: true,
            reason: logReady.reason,
            logs: lastLogTail,
            apiReady: logReady.apiReady !== false && sawApiPortOpen,
          };
        }
      }
    }

    // eslint-disable-next-line no-await-in-loop
    let portOpen = await probeUiPort();
    if (portOpen) sawPortOpen = true;

    if (apiTarget) {
      // eslint-disable-next-line no-await-in-loop
      const apiOpen = await probeApiPort();
      if (apiOpen) sawApiPortOpen = true;
    }

    const uiProbeAllowed =
      portOpen &&
      (stack === 'node-js' ||
        stack === 'static-html' ||
        stack === 'static-html-js' ||
        stack === 'java-spring-react' ||
        !apiTarget ||
        sawApiPortOpen);

    if (uiProbeAllowed) {
      const probe = await checkPreviewAppHttpReady({
        previewUrl,
        apiPreviewUrl,
        stack,
      });
      if (probe.ready) {
        return { ready: true, reason: probe.reason, apiReady: probe.apiReady !== false };
      }

      if (
        sawPortOpen &&
        stack !== 'node-js' &&
        stack !== 'static-html' &&
        stack !== 'static-html-js' &&
        stack !== 'java-spring-react'
      ) {
        return { ready: true, reason: 'tcp' };
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(PREVIEW_STARTUP_POLL_MS);
  }

  if (!sawPortOpen) {
    const graceLeft = portPublishGraceMs - (Date.now() - started);
    if (graceLeft > 0) {
      const opened = await waitForHostPortPublished({
        previewUrl,
        host: checkHost,
        port,
        timeoutMs: graceLeft,
        pollMs: PREVIEW_PORT_PUBLISH_POLL_MS,
      });
      if (opened) {
        sawPortOpen = true;
        const probe = await checkPreviewAppHttpReady({
          previewUrl,
          apiPreviewUrl,
          stack,
        });
        if (probe.ready) {
          return { ready: true, reason: probe.reason, apiReady: probe.apiReady !== false };
        }
      }
    }
  }

  // After full Spring timeout: unlock UI if it is up, but flag API as not ready.
  if (stack === 'java-spring-react' && sawPortOpen && apiTarget && !sawApiPortOpen) {
    return {
      ready: true,
      reason: 'http_ui_spring_api_timeout',
      apiReady: false,
      sawPortOpen,
      sawApiPortOpen,
      logs: lastLogTail,
    };
  }

  if (apiTarget && !sawApiPortOpen && sawPortOpen) {
    return { ready: false, reason: 'api_port_timeout', sawPortOpen, sawApiPortOpen };
  }

  return { ready: false, reason: sawPortOpen ? 'http_timeout' : 'port_timeout', sawPortOpen, sawApiPortOpen, logs: lastLogTail };
}

/**
 * Detect UI readiness from docker logs (serve access log, static server started).
 * Used when host HTTP probes fail on Windows Docker but the container is clearly serving.
 */
export function detectPreviewReadyFromLogs(logText, stack = 'node-js') {
  if (!logText?.trim()) return null;

  if (stack === 'java-spring-react') {
    if (/\[preview\]\s*Spring API is listening/i.test(logText)) {
      return { ready: true, reason: 'log_spring_api_listening', apiReady: true };
    }
    // UI serve / HTTP 200 unlocks Open preview; API may still be compiling.
    if (/\[preview\]\s*serve static:/i.test(logText) && /Accepting connections|Returned\s+200/i.test(logText)) {
      return { ready: true, reason: 'log_serve_listening', apiReady: false };
    }
    // CRA finished building — Open preview should unlock even if HTTP probe from
    // the API container can't reach the published host port (Coolify networking).
    if (
      /The build folder is ready to be deployed/i.test(logText) ||
      (/\[preview\]\s*serve static:/i.test(logText) && /build folder is ready|Compiled successfully|File sizes after gzip/i.test(logText))
    ) {
      return { ready: true, reason: 'log_cra_build_ready', apiReady: false };
    }
    if (/\[preview\]\s*reusing cached React build/i.test(logText) || /\[preview\]\s*serve static:/i.test(logText)) {
      return { ready: true, reason: 'log_serve_static_started', apiReady: false };
    }
    const lines = logText.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/GET\s+\/\s*(HTTP|$)/i.test(line) && !/\bGET\s+\/\s*$/.test(line.trim())) continue;
      for (let j = i; j < Math.min(i + 4, lines.length); j += 1) {
        if (/Returned\s+200/i.test(lines[j])) {
          return { ready: true, reason: 'log_http_200', apiReady: false };
        }
      }
    }
    return null;
  }

  if (/\[preview\]\s*serve static:/i.test(logText) && /Accepting connections/i.test(logText)) {
    return { ready: true, reason: 'log_serve_listening' };
  }

  if (/\[preview\]\s*serve static:/i.test(logText) && /Returned\s+200/i.test(logText)) {
    return { ready: true, reason: 'log_serve_static' };
  }

  const lines = logText.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/GET\s+\/\s*(HTTP|$)/i.test(line) && !/\bGET\s+\/\s*$/.test(line.trim())) continue;
    for (let j = i; j < Math.min(i + 4, lines.length); j += 1) {
      if (/Returned\s+200/i.test(lines[j])) {
        return { ready: true, reason: 'log_http_200' };
      }
    }
  }

  if (
    (stack === 'node-js' || stack.startsWith('static')) &&
    /Accepted/i.test(logText) &&
    /Returned\s+200/i.test(logText)
  ) {
    return { ready: true, reason: 'log_serve_200' };
  }

  return null;
}

/**
 * Build teacher-facing failure details from wait result + container logs (fast, specific).
 */
export function diagnosePreviewFailure({ wait, session = {}, logs = '' } = {}) {
  const logError = parsePreviewContainerErrors(logs);
  if (logError) {
    return {
      failed: true,
      message: `Preview failed: ${logError}`,
      failures: [{ rule: 'container_runtime', message: logError }],
    };
  }

  if (detectPreviewReadyFromLogs(logs, session.previewStack || 'node-js')) {
    return { failed: false, ready: true, reason: 'log_serve_200' };
  }

  if (wait?.reason === 'container_exited') {
    return {
      failed: true,
      message:
        'Preview container stopped unexpectedly. Common causes: npm/Maven build error, missing index.html, or wrong project folder.',
      failures: [
        {
          rule: 'container_exited',
          message: 'Docker container exited before the app finished starting. See container log below.',
        },
      ],
    };
  }

  if (wait?.reason === 'api_port_timeout') {
    const msg = describePreviewWaitFailure(wait, session);
    return {
      failed: true,
      message: msg,
      failures: [
        {
          rule: 'api_not_ready',
          message: `Student backend API on port ${session.previewApiHostPort || '?'} did not start. Check MongoDB sidecar and backend entry file (server.js).`,
        },
      ],
    };
  }

  if (/npm ERR!/i.test(logs)) {
    return {
      failed: true,
      message: 'Preview failed: npm install or build error inside Docker. See log below.',
      failures: [{ rule: 'npm_error', message: 'npm install/build failed in the student project.' }],
    };
  }

  if (/index\.html not found/i.test(logs)) {
    return {
      failed: true,
      message: 'Preview failed: student project is missing index.html (required for the UI).',
      failures: [{ rule: 'missing_index_html', message: 'Missing index.html in the frontend or static build output.' }],
    };
  }

  if (/ERROR:.*backend/i.test(logs) || /student API did not open port/i.test(logs)) {
    return {
      failed: true,
      message: 'Preview failed: student backend (Express/API) did not start. See backend log in container output below.',
      failures: [{ rule: 'backend_start_failed', message: 'Backend API failed to start — check server.js, package.json scripts, and MongoDB.' }],
    };
  }

  return {
    failed: true,
    message: describePreviewWaitFailure(wait, session),
    failures: [],
  };
}

/** Teacher-facing message when waitForPreviewReady times out or fails. */
export function describePreviewWaitFailure(wait, session = {}) {
  const uiPort = session.hostPort || '?';
  const apiPort = session.previewApiHostPort || '?';

  if (wait?.reason === 'api_port_timeout') {
    return `Frontend may be up on port ${uiPort}, but the student API on port ${apiPort} did not start in time. Check MongoDB sidecar, backend npm logs, and that server.js/index.js exists.`;
  }
  if (wait?.reason === 'http_timeout') {
    if (wait.sawPortOpen && session.previewApiHostPort) {
      return `Port ${uiPort} responded but the app did not pass readiness (missing index.html or still building). See container log below.`;
    }
    return `Preview UI on port ${uiPort} did not return a valid page in time. The student frontend may be missing index.html or the build failed.`;
  }
  if (wait?.reason === 'port_timeout') {
    return `Preview port ${uiPort} never opened on the host. Docker may still be building — if the log shows HTTP 200, click Start preview again.`;
  }
  return `Preview did not become ready in time (port ${uiPort}). See container log below.`;
}

/** @deprecated Use waitForPreviewReady */
export async function waitForPreviewUrl(previewUrl, timeoutMs) {
  const result = await waitForPreviewReady({ previewUrl, timeoutMs });
  return result.ready;
}

export async function getContainerLogs(containerName, tail = 80) {
  try {
    const { stdout } = await runCommand(`docker logs --tail ${tail} ${containerName}`, { timeoutMs: 30_000 });
    return stdout;
  } catch {
    return '';
  }
}

/** Read a file from a running preview container (e.g. PHP bootstrap output log). */
export async function readFileFromPreviewContainer(containerName, filePath, maxBytes = 64_000) {
  if (!containerName || !filePath) return '';
  const safeName = String(containerName).replace(/[^a-zA-Z0-9_.-]/g, '');
  const safePath = String(filePath).replace(/[^a-zA-Z0-9_./-]/g, '');
  if (!safeName || !safePath) return '';
  try {
    const { stdout } = await runCommand(
      `docker exec ${safeName} sh -c "if [ -f '${safePath}' ]; then head -c ${maxBytes} '${safePath}'; fi"`,
      { timeoutMs: 15_000 }
    );
    return stdout || '';
  } catch {
    return '';
  }
}

export async function readPreviewMysqlBootstrapLog(containerName) {
  return readFileFromPreviewContainer(containerName, '/tmp/preview-mysql.log');
}

export async function execInPreviewContainer(containerName, shellCommand, { timeoutMs = 60_000 } = {}) {
  const safeName = String(containerName || '').replace(/[^a-zA-Z0-9_.-]/g, '');
  const cmd = String(shellCommand || '').trim();
  if (!safeName || !cmd) return '';
  const { stdout, stderr } = await runCommand(`docker exec ${safeName} sh -c ${JSON.stringify(cmd)}`, {
    timeoutMs,
  });
  return `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim();
}

export async function readPreviewBackendLog(containerName, maxLines = 80) {
  const springRaw = await readFileFromPreviewContainer(containerName, '/tmp/preview-spring.log', 120_000);
  const backendRaw = await readFileFromPreviewContainer(containerName, '/tmp/preview-backend.log', 120_000);
  const raw = [springRaw, backendRaw].filter(Boolean).join('\n');
  if (!raw) return '';
  return raw.split('\n').slice(-maxLines).join('\n');
}

const PREVIEW_LOG_ERROR_PATTERNS = [
  /\[preview\]\s*ERROR:\s*(.+)/i,
  /index\.html not found/i,
  /no backend start script found/i,
  /Flutter web build failed/i,
  /Maven build failed/i,
  /npm ERR!/i,
  /Cannot find module ['"][^'"]+['"]/i,
  /ENOENT.*package\.json/i,
  /error TS\d+:/i,
  /Module not found:/i,
  /backend start failed/i,
  /student API did not listen/i,
  /MongooseServerSelectionError/i,
  /ECONNREFUSED.*27017/i,
  /MongoNetworkError/i,
  /EADDRINUSE/i,
];

/**
 * Extract teacher-facing error lines from docker preview container logs.
 */
export function parsePreviewContainerErrors(logText) {
  if (!logText?.trim()) return null;
  const hits = [];
  const seen = new Set();
  for (const rawLine of logText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const pattern of PREVIEW_LOG_ERROR_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;
      const msg = (match[1] || line).replace(/^\[preview\]\s*/i, '').trim();
      const key = msg.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        hits.push(msg);
      }
      break;
    }
  }
  if (!hits.length) return null;
  return hits.slice(-3).join(' · ');
}
