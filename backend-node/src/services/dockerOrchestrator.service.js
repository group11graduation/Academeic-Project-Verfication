import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import net from 'net';
import os from 'os';
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
} from './previewMern.service.js';
import {
  patchPhpForPreview,
  discoverPhpLoginPath,
  previewMysqlHostName,
} from './previewPhp.service.js';
import { resolveFlutterNodePair, patchFlutterApiPort } from './previewFlutter.service.js';
import { resolveSpringReactPair, patchSpringForPreview, springReactDisplayLabel } from './previewSpring.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const TEMPLATES_ROOT = path.join(BACKEND_ROOT, 'docker-templates');

const PORT_RANGE_MIN = Number(process.env.PREVIEW_PORT_MIN || 8000);
const PORT_RANGE_MAX = Number(process.env.PREVIEW_PORT_MAX || 9000);
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

/** Host path for docker -v (Docker Desktop on Windows needs forward slashes). */
function dockerVolumePath(hostPath) {
  const resolved = path.resolve(hostPath);
  if (process.platform === 'win32') {
    return resolved.replace(/\\/g, '/');
  }
  return resolved;
}

function previewNodeTemplateDir(flutterPair) {
  return flutterPair ? 'node-js-flutter' : 'node-js';
}

function previewNodeBaseImageTag(flutterPair) {
  return flutterPair ? PREVIEW_NODE_FLUTTER_BASE_IMAGE : PREVIEW_NODE_BASE_IMAGE;
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

  const fallbackSrc = fsSync.existsSync(path.join(templateDir, 'preview-fallback'))
    ? path.join(templateDir, 'preview-fallback')
    : path.join(sharedNodeDir, 'preview-fallback');
  if (fsSync.existsSync(fallbackSrc)) {
    await fs.cp(fallbackSrc, path.join(stageDir, 'preview-fallback'), { recursive: true });
  }

  return stageDir;
}

/**
 * Build a small reusable preview image once (entrypoint + runtime only).
 * The student ZIP is bind-mounted at /app when the container starts.
 */
async function ensurePreviewNodeBaseImage(flutterPair, { forceRebuild = false } = {}) {
  const templateDirName = previewNodeTemplateDir(flutterPair);
  const imageTag = previewNodeBaseImageTag(flutterPair);
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { imageTag, reused: true };
  }

  const stageDir = await stagePreviewBaseBuildDir(templateDirName);
  try {
    await spawnProcess('docker', ['build', '-t', imageTag, '.'], {
      cwd: stageDir,
      timeoutMs: flutterPair ? FLUTTER_BUILD_TIMEOUT_MS : BUILD_TIMEOUT_MS,
    });
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
  return { imageTag, reused: false };
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
  if (splitPair?.frontendFramework || splitPair?.backendFramework) {
    return splitStackDisplayLabel(splitPair);
  }
  const map = {
    'node-js': 'Full-stack JavaScript',
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
  try {
    await spawnProcess('docker', ['build', '-t', imageTag, '.'], { cwd: stageDir, timeoutMs: BUILD_TIMEOUT_MS });
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
  return { imageTag, reused: false };
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
  throw lastErr;
}

async function ensurePreviewSpringReactBaseImage({ forceRebuild = false } = {}) {
  const imageTag = PREVIEW_SPRING_REACT_BASE_IMAGE;
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { imageTag, reused: true };
  }
  await ensurePreviewJavaBaseImage();
  const stageDir = await stagePreviewBaseBuildDir('java-spring-react');
  try {
    await spawnProcess('docker', ['build', '-t', imageTag, '.'], {
      cwd: stageDir,
      timeoutMs: SPRING_BUILD_TIMEOUT_MS,
    });
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
  return { imageTag, reused: false };
}

async function ensurePreviewJupyterBaseImage({ forceRebuild = false } = {}) {
  const imageTag = PREVIEW_JUPYTER_BASE_IMAGE;
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { imageTag, reused: true };
  }
  const stageDir = await stagePreviewBaseBuildDir('jupyter');
  try {
    await spawnProcess('docker', ['build', '-t', imageTag, '.'], { cwd: stageDir, timeoutMs: BUILD_TIMEOUT_MS });
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
  return { imageTag, reused: false };
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
  if (/spring\s*boot|springboot|java\s*\+\s*react|react\s*\+\s*spring/.test(text)) {
    return 'java-spring-react';
  }
  if (/react|node\.?js|vite|mern|next\.?js|vue|angular|frontend/.test(text)) {
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

      const full = path.join(dir, entry.name);
      const lower = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(full, depth + 1);
        continue;
      }

      scanned += 1;
      if (lower === 'package.json') signals.packageJsonPaths.push(full);
      if (lower === 'pom.xml') signals.pomXmlCount += 1;
      if (lower === 'build.gradle' || lower === 'build.gradle.kts') signals.gradleBuild = true;
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
  const hasSpring = signals.pomXmlCount > 0 || signals.gradleBuild || signals.springBootJava;

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
  } else if (
    hasSpring &&
    (hasNode || signals.jsxTsxFiles > 0 || reactStatic.reactStatic || signals.packageJsonPaths.length > 0)
  ) {
    stack = 'java-spring-react';
    reasons.push('Spring Boot Java backend with React/JavaScript frontend');
    if (signals.pomXmlCount) reasons.push(`${signals.pomXmlCount} pom.xml`);
    if (signals.gradleBuild) reasons.push('Gradle build');
    if (signals.springBootJava) reasons.push('@SpringBootApplication');
    if (signals.jsxTsxFiles) reasons.push(`${signals.jsxTsxFiles} JSX/TSX file(s)`);
    if (nodePkgCount) reasons.push(`${nodePkgCount} JavaScript package.json`);
    if (reactStatic.reactStatic) reasons.push(reactStatic.reason);
  } else if (hasNode && !hasPhp) {
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
    } else {
      stack = 'node-js';
      reasons.push('Node/React detected; ignoring stray .php files');
    }
  }

  if (!stack && hint && STACK_BLUEPRINTS[hint]) {
    stack = hint;
    reasons.push(`assignment hint (${hint}) — no strong file signals`);
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

  if (dockerNetwork) {
    args.push('--network', dockerNetwork);
  }

  if (apiHostPort && springPair) {
    args.push('-p', `${apiHostPort}:8080`);
    args.push('-e', 'API_PORT=8080');
    args.push('-e', `PREVIEW_API_HOST_PORT=${apiHostPort}`);
    args.push('-e', `VITE_API_URL=http://localhost:${apiHostPort}`);
    args.push('-e', `REACT_APP_API_URL=http://localhost:${apiHostPort}`);
    args.push('-e', `SPRING_SUBDIR=${springPair.springSubdir}`);
    args.push('-e', `FRONTEND_SUBDIR=${springPair.frontendSubdir}`);
    args.push('-e', 'PREVIEW_SPRING_MODE=1');
  } else if (apiHostPort) {
    args.push('-p', `${apiHostPort}:5000`);
    args.push('-e', 'API_PORT=5000');
    args.push('-e', `PREVIEW_API_HOST_PORT=${apiHostPort}`);
    args.push('-e', `VITE_API_URL=http://localhost:${apiHostPort}`);
    args.push('-e', `REACT_APP_API_URL=http://localhost:${apiHostPort}`);
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
    const previewBaseUrl = `${getPublicPreviewBase()}:${hostPort}/`;
    args.push('-e', `PREVIEW_BASE_URL=${previewBaseUrl}`);
    if (previewCredentialEnv?.DB_HOST) {
      args.push('-e', `DB_HOST=${previewCredentialEnv.DB_HOST}`);
      args.push('-e', `DB_NAME=${previewCredentialEnv.DB_NAME || PREVIEW_MYSQL_DATABASE}`);
      args.push('-e', `DB_USER=${previewCredentialEnv.DB_USER || PREVIEW_MYSQL_USER}`);
      args.push('-e', `DB_PASS=${previewCredentialEnv.DB_PASS || PREVIEW_MYSQL_PASSWORD}`);
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

/** Warm all reusable preview base images once at API startup. */
export async function warmPreviewBaseImages() {
  if (process.env.DOCKER_PREVIEW_ENABLED === 'false') return {};
  if (!(await dockerAvailable())) return {};
  const results = {};
  results.node = await ensurePreviewNodeBaseImage(null)
    .then((r) => r.reused ? 'ready' : 'built')
    .catch(() => 'failed');
  results.php = await ensurePreviewPhpBaseImage()
    .then((r) => (r.reused ? 'ready' : 'built'))
    .catch(() => 'failed');
  results.jupyter = await ensurePreviewJupyterBaseImage()
    .then((r) => (r.reused ? 'ready' : 'built'))
    .catch(() => 'failed');
  results.springReact = await ensurePreviewSpringReactBaseImage()
    .then((r) => (r.reused ? 'ready' : 'built'))
    .catch(() => 'failed');
  return results;
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

  if (stack === 'php-apache') {
    const previewBaseUrl = `${getPublicPreviewBase()}:${hostPort}/`;
    if (process.env.PREVIEW_SIDECAR_MYSQL !== 'false') {
      const sidecar = await startPreviewMysqlSidecar(projectId);
      previewDockerNetwork = sidecar.networkName;
      mergedCredentialEnv = {
        ...mergedCredentialEnv,
        DB_HOST: sidecar.mysqlName,
        DB_NAME: PREVIEW_MYSQL_DATABASE,
        DB_USER: PREVIEW_MYSQL_USER,
        DB_PASS: PREVIEW_MYSQL_PASSWORD,
      };
    }
    const patched = await patchPhpForPreview(buildContext, appSubdir, {
      baseUrl: previewBaseUrl,
      dbHost: mergedCredentialEnv.DB_HOST || 'host.docker.internal',
      dbName: mergedCredentialEnv.DB_NAME || PREVIEW_MYSQL_DATABASE,
      dbUser: mergedCredentialEnv.DB_USER || 'root',
      dbPass: mergedCredentialEnv.DB_PASS || '',
    });
    phpLoginPath = patched.loginPath || (await discoverPhpLoginPath(buildContext, appSubdir));
  }

  const splitStackPair = flutterPair || mernPair || springPair;
  if (splitStackPair) {
    apiHostPort = await allocateHostPort();
    while (apiHostPort === hostPort) {
      apiHostPort = await allocateHostPort();
    }

    if (springPair) {
      await patchSpringForPreview(buildContext, springPair.springSubdir, {
        apiHostPort,
        uiHostPort: hostPort,
      });
      await patchFrontendApiPort(buildContext, springPair.frontendSubdir, apiHostPort);
    } else {
      if (process.env.PREVIEW_SIDECAR_MONGO !== 'false') {
        const sidecar = await startPreviewMongoSidecar(projectId);
        previewDockerNetwork = sidecar.networkName;
        const mongoUri = buildPreviewMongoUri(projectId, { sidecarHost: sidecar.mongoName });
        mergedCredentialEnv = {
          ...mergedCredentialEnv,
          MONGO_URI: mongoUri,
          MONGODB_URI: mongoUri,
          DATABASE_URL: mongoUri,
          PREVIEW_SANDBOX: '1',
        };
      }

      if (flutterPair) {
        await patchFlutterApiPort(buildContext, flutterPair.flutterSubdir, apiHostPort);
      } else if (mernPair) {
        await patchFrontendApiPort(buildContext, mernPair.frontendSubdir, apiHostPort);
      }
      const mongoUri =
        mergedCredentialEnv.MONGO_URI ||
        mergedCredentialEnv.MONGODB_URI ||
        buildPreviewMongoUri(projectId);
      await patchBackendForPreview(buildContext, splitStackPair.backendSubdir, {
        mongoUri,
        hostPort,
        jwtSecret: mergedCredentialEnv.JWT_SECRET,
      });
    }
  }

  let imageReused = false;
  let projectMount = null;
  try {
    const baseMeta = await ensurePreviewBaseImage(stack, {
      flutterPair,
      forceRebuild: forceRebuild && process.env.PREVIEW_FORCE_REBUILD_BASE === 'true',
    });
    imageTag = baseMeta.imageTag;
    imageReused = Boolean(baseMeta.reused);
    projectMount = buildContext;
  } catch (e) {
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
        ? process.env.PREVIEW_SPRING_SANDBOX_MEMORY || '768m'
        : process.env.PREVIEW_SANDBOX_MEMORY || '256m',
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

async function fetchPreviewHttp(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (res && res.status >= 200 && res.status < 500) {
      return { ok: true, status: res.status, body: await res.text().catch(() => '') };
    }
  } catch {
    /* try manual redirect */
  }
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    if (res && res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status, body: '', redirect: true };
    }
  } catch {
    /* ignore */
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

  const urlsToTry = [previewUrl];
  if (stack === 'php-apache') {
    urlsToTry.push(`${previewUrl.replace(/\/$/, '')}/index.php`);
  }
  if (stack === 'node-js' || stack === 'static-html' || stack === 'static-html-js') {
    urlsToTry.push(`${previewUrl.replace(/\/$/, '')}/index.html`);
  }

  let uiReady = false;
  for (const url of urlsToTry) {
    const hit = await fetchPreviewHttp(url);
    if (!hit.ok) continue;
    if (hit.redirect) {
      uiReady = true;
      break;
    }
    if (hit.body.length > 0 && !isPreviewPlaceholderBody(hit.body)) {
      uiReady = true;
      break;
    }
  }

  if (!uiReady) {
    return { ready: false, reason: 'placeholder_or_empty' };
  }

  if (apiPreviewUrl) {
    const apiTarget = parseHostPortFromPreviewUrl(apiPreviewUrl);
    const apiCheckHost = apiTarget.host === 'localhost' ? '127.0.0.1' : apiTarget.host;
    const apiOpen = await isTcpPortOpen(apiCheckHost, apiTarget.port);
    if (!apiOpen) {
      return { ready: false, reason: 'api_port_closed' };
    }
    const healthUrl = `${apiPreviewUrl.replace(/\/$/, '')}/api/health`;
    const healthHit = await fetchPreviewHttp(healthUrl);
    if (healthHit.ok && healthHit.status < 500) {
      return { ready: true, reason: 'http_mern' };
    }
    const apiHit = await fetchPreviewHttp(apiPreviewUrl);
    if (apiHit.ok && apiHit.status < 500) {
      return { ready: true, reason: 'api_http' };
    }
    return { ready: false, reason: 'api_not_http' };
  }

  return { ready: true, reason: 'http' };
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
  const springTimeout = Number(process.env.PREVIEW_SPRING_STARTUP_TIMEOUT_MS || 900_000);
  const effectiveTimeout =
    stack === 'java-spring-react'
      ? Math.max(timeoutMs, springTimeout)
      : stack === 'node-js' || stack === 'static-html' || stack === 'static-html-js'
      ? Math.max(timeoutMs, nodeTimeout)
      : timeoutMs;
  const { host, port } = parseHostPortFromPreviewUrl(previewUrl);
  const checkHost = host === 'localhost' ? '127.0.0.1' : host;
  const apiTarget = apiPreviewUrl ? parseHostPortFromPreviewUrl(apiPreviewUrl) : null;
  const started = Date.now();
  let sawPortOpen = false;
  let sawApiPortOpen = false;

  while (Date.now() - started < effectiveTimeout) {
    if (containerName) {
      // eslint-disable-next-line no-await-in-loop
      const running = await isPreviewContainerRunning(containerName);
      if (!running) {
        return { ready: false, reason: 'container_exited' };
      }
    }

    // eslint-disable-next-line no-await-in-loop
    const portOpen = await isTcpPortOpen(checkHost, port);
    if (portOpen) sawPortOpen = true;

    if (apiTarget) {
      const apiCheckHost = apiTarget.host === 'localhost' ? '127.0.0.1' : apiTarget.host;
      // eslint-disable-next-line no-await-in-loop
      const apiOpen = await isTcpPortOpen(apiCheckHost, apiTarget.port);
      if (apiOpen) sawApiPortOpen = true;
    }

    const uiReady = portOpen && (!apiTarget || sawApiPortOpen);

    if (uiReady) {
      const probe = await checkPreviewAppHttpReady({
        previewUrl,
        apiPreviewUrl,
        stack,
      });
      if (probe.ready) {
        return { ready: true, reason: probe.reason };
      }

      if (sawPortOpen && stack !== 'node-js' && stack !== 'static-html' && stack !== 'static-html-js') {
        return { ready: true, reason: 'tcp' };
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(Number(process.env.PREVIEW_STARTUP_POLL_MS || 2000));
  }

  if (apiTarget && !sawApiPortOpen && sawPortOpen) {
    return { ready: false, reason: 'api_port_timeout' };
  }

  return { ready: false, reason: sawPortOpen ? 'http_timeout' : 'port_timeout' };
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
