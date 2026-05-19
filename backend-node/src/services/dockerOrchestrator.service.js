import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import net from 'net';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../..');
const TEMPLATES_ROOT = path.join(BACKEND_ROOT, 'docker-templates');

const PORT_RANGE_MIN = Number(process.env.PREVIEW_PORT_MIN || 8000);
const PORT_RANGE_MAX = Number(process.env.PREVIEW_PORT_MAX || 9000);
const BUILD_TIMEOUT_MS = Number(process.env.PREVIEW_BUILD_TIMEOUT_MS || 300_000);
const MAX_SCAN_FILES = Number(process.env.PREVIEW_STACK_SCAN_MAX_FILES || 2000);
const MAX_EXTRACT_FILES = Number(process.env.PREVIEW_MAX_EXTRACT_FILES || 500);
const MAX_EXTRACT_BYTES = Number(process.env.PREVIEW_MAX_EXTRACT_BYTES || 52_428_800);

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
  jupyter: {
    templateDir: 'jupyter',
    internalPort: 8888,
    imagePrefix: 'sv-project-jupyter',
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

function containerNameFor(projectId) {
  return `container-${sanitizeDockerId(projectId)}`;
}

function getPublicPreviewBase() {
  return (process.env.PREVIEW_PUBLIC_HOST || 'http://localhost').replace(/\/$/, '').replace('127.0.0.1', 'localhost');
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
  const zip = new AdmZip(zipAbs);
  const entries = zip.getEntries();
  let totalBytes = 0;
  let fileCount = 0;
  const destResolved = path.resolve(destDir);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    fileCount += 1;
    if (fileCount > MAX_EXTRACT_FILES) {
      throw new Error(`Archive exceeds file limit (${MAX_EXTRACT_FILES})`);
    }
    const raw = entry.entryName.replace(/\\/g, '/');
    if (raw.startsWith('/') || raw.includes('..')) {
      throw new Error('Unsafe path in archive');
    }
    const target = path.resolve(destDir, raw);
    if (!target.startsWith(destResolved + path.sep) && target !== destResolved) {
      throw new Error('Path traversal blocked in archive');
    }
    const data = entry.getData();
    totalBytes += data.length;
    if (totalBytes > MAX_EXTRACT_BYTES) {
      throw new Error('Extracted size exceeds configured limit');
    }
    fsSync.mkdirSync(path.dirname(target), { recursive: true });
    fsSync.writeFileSync(target, data);
  }
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
  if (deps.vite || deps['@vitejs/plugin-react']) score += 18;
  if (deps['react-scripts']) score += 16;
  if (deps.next) score += 14;
  if (deps.vue) score += 12;
  if (deps.express && !deps.react) score -= 15;
  if (deps.mongoose && !deps.react) score -= 8;
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
      if (!found.some((f) => f.rel === rel)) {
        found.push({ rel, score: scoreNodePackageJson(pkg) });
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

    found.sort((a, b) => b.score - a.score);
    const best = found[0];
    if (best.score > 0) return best.rel;

    const preferred = ['frontend', 'Frontend', 'client', 'Client', 'web', 'app', 'ui', 'public'];
    for (const name of preferred) {
      if (found.some((f) => f.rel === name || f.rel.endsWith(`/${name}`))) {
        return found.find((f) => f.rel === name || f.rel.endsWith(`/${name}`)).rel;
      }
    }
    return found[0].rel;
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
export function inferStackHintFromAssignment(assignment) {
  const text = `${assignment?.title || ''} ${assignment?.description || ''}`.toLowerCase();
  if (/react|node\.?js|vite|mern|next\.?js|vue|angular|frontend|javascript/.test(text)) {
    return 'node-js';
  }
  if (/php|laravel|apache|mysql|xampp/.test(text)) return 'php-apache';
  if (/jupyter|ipython|\.ipynb|python\s+notebook/.test(text)) return 'jupyter';
  return null;
}

async function findReactStaticSignals(projectPath) {
  const htmlPaths = [];
  let hasJsAssets = false;

  async function walk(dir, depth = 0) {
    if (depth > 6 || htmlPaths.length > 8) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      const lower = entry.name.toLowerCase();
      if (entry.isDirectory()) {
        if (['assets', 'static', 'dist', 'build', 'public'].includes(lower)) {
          // eslint-disable-next-line no-await-in-loop
          const sub = await fs.readdir(full, { withFileTypes: true });
          if (sub.some((f) => f.isFile() && /\.(js|mjs|cjs)$/i.test(f.name))) {
            hasJsAssets = true;
          }
        }
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
      if (html.includes('react') && (html.includes('type="module"') || html.includes('.js'))) {
        return { reactStatic: true, reason: 'React markers in index.html' };
      }
    } catch {
      /* ignore */
    }
  }

  if (hasJsAssets && htmlPaths.length > 0) {
    return { reactStatic: true, reason: 'index.html + assets/*.js (frontend build)' };
  }

  return { reactStatic: false, reason: '' };
}

/**
 * Scan submission files and pick the container type from evidence (not assignment title).
 */
export async function detectProjectStackWithMeta(projectPath, options = {}) {
  const signals = {
    packageJsonPaths: [],
    composerJson: false,
    artisanPhp: false,
    viteConfig: false,
    phpFiles: 0,
    jsxTsxFiles: 0,
    vueSvelteFiles: 0,
    ipynbFiles: 0,
    indexPhp: false,
    indexHtml: false,
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
      if (lower === 'composer.json') signals.composerJson = true;
      if (lower === 'artisan') signals.artisanPhp = true;
      if (lower.startsWith('vite.config.')) signals.viteConfig = true;
      if (lower.endsWith('.php')) signals.phpFiles += 1;
      if (lower === 'index.php') signals.indexPhp = true;
      if (lower.endsWith('.jsx') || lower.endsWith('.tsx')) signals.jsxTsxFiles += 1;
      if (lower.endsWith('.vue') || lower.endsWith('.svelte')) signals.vueSvelteFiles += 1;
      if (lower.endsWith('.ipynb')) signals.ipynbFiles += 1;
      if (lower === 'index.html') signals.indexHtml = true;
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
    nodePkgCount > 0 ||
    signals.viteConfig ||
    signals.jsxTsxFiles > 0 ||
    signals.vueSvelteFiles > 0 ||
    reactStatic.reactStatic;

  let hasPhp =
    signals.composerJson ||
    signals.artisanPhp ||
    signals.indexPhp ||
    (signals.phpFiles >= 2 && nodePkgCount === 0 && !reactStatic.reactStatic) ||
    (signals.phpFiles >= 1 && !hasNode);

  if (reactStatic.reactStatic && !signals.composerJson && !signals.artisanPhp) {
    hasNode = true;
    if (signals.phpFiles <= 3 && !signals.indexPhp) {
      hasPhp = false;
    }
  }

  const hasJupyter = signals.ipynbFiles > 0;

  const reasons = [];
  let stack = null;

  // Jupyter only when notebooks are the primary artifact
  if (hasJupyter && !hasNode && !hasPhp) {
    stack = 'jupyter';
    reasons.push(`${signals.ipynbFiles} notebook(s)`);
  } else if (hasNode && !hasPhp) {
    stack = 'node-js';
    if (nodePkgCount) reasons.push(`${nodePkgCount} package.json`);
    if (signals.viteConfig) reasons.push('vite config');
    if (signals.jsxTsxFiles) reasons.push(`${signals.jsxTsxFiles} JSX/TSX file(s)`);
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

  const hint = options.stackHint || null;
  if (!stack && hint && STACK_BLUEPRINTS[hint]) {
    stack = hint;
    reasons.push(`assignment hint (${hint}) — no strong file signals`);
  }

  if (!stack) {
    const err = new Error(
      'Could not detect project stack from files. Include package.json (Node), .php/composer.json (PHP), or .ipynb (Jupyter).'
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
export async function materializeDockerTemplate(stack, projectPath) {
  const blueprint = STACK_BLUEPRINTS[stack];
  if (!blueprint) {
    const err = new Error(`Unknown stack: ${stack}`);
    err.status = 400;
    throw err;
  }

  const templateDir = path.join(TEMPLATES_ROOT, blueprint.templateDir);
  const dockerfileSrc = path.join(templateDir, 'Dockerfile');
  const dockerignoreSrc = path.join(templateDir, '.dockerignore');
  const entrypointSrc = path.join(templateDir, 'entrypoint.sh');

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

async function buildPreviewImage({ imageTag, buildContext, appSubdir, forceRebuild = false }) {
  if (!forceRebuild && (await dockerImageExists(imageTag))) {
    return { reused: true };
  }
  const args = ['build', '-t', imageTag, '--build-arg', `APP_SUBDIR=${appSubdir}`, '.'];
  await spawnProcess('docker', args, { cwd: buildContext, timeoutMs: BUILD_TIMEOUT_MS });
  return { reused: false };
}

/**
 * Start detached container; ENTRYPOINT script runs install + server commands at runtime.
 */
async function runPreviewContainer({ containerName, imageTag, hostPort, internalPort, stack, appSubdir }) {
  const portMapping = `${hostPort}:${internalPort}`;
  const args = [
    'run',
    '-d',
    '--name',
    containerName,
    '-p',
    portMapping,
    '--label',
    'scholarverify.preview=1',
  ];

  if (stack === 'node-js') {
    args.push('-e', `PORT=${internalPort}`, '-e', `APP_SUBDIR=${appSubdir}`);
  } else if (stack === 'php-apache') {
    args.push('-e', `APP_SUBDIR=${appSubdir}`);
  } else if (stack === 'jupyter') {
    args.push('-e', `JUPYTER_PORT=${internalPort}`);
  }

  args.push(imageTag);

  const { stdout } = await spawnProcess('docker', args, { timeoutMs: 120_000 });
  return stdout.split('\n').pop()?.trim() || stdout.trim();
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
  } = options;
  const { projectPath: resolvedInput, tempDir } = await resolveSubmissionPath(projectPath, { allowedRoot });
  const buildContext = await resolveProjectRoot(resolvedInput);
  assertSafeProjectPath(buildContext, tempDir || allowedRoot || null);

  const detection =
    stackOverride != null
      ? { stack: stackOverride, reasons: ['manual override'], signals: {} }
      : await detectProjectStackWithMeta(buildContext, { stackHint });

  const stack = detection.stack;
  const blueprint = await materializeDockerTemplate(stack, buildContext);
  const appSubdir = await resolveAppSubdir(buildContext, stack);

  const imageTag = buildImageTag(imageKey, stack);
  const containerName = containerNameFor(projectId);
  const internalPort = blueprint.internalPort;

  await removeContainerIfExists(containerName);

  let imageReused = false;
  try {
    const buildMeta = await buildPreviewImage({ imageTag, buildContext, appSubdir, forceRebuild });
    imageReused = Boolean(buildMeta.reused);
  } catch (e) {
    const err = new Error(`Docker build failed: ${e.stderr || e.message}`);
    err.status = 500;
    throw err;
  }

  const hostPort = await allocateHostPort();

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
    });
  } catch (e) {
    releaseHostPort(hostPort);
    const err = new Error(`Docker run failed: ${e.stderr || e.message}`);
    err.status = 500;
    throw err;
  }

  const previewUrl = buildPreviewUrl(hostPort, stack);

  return {
    previewUrl,
    hostPort,
    internalPort,
    stack,
    containerName,
    imageTag,
    containerId,
    projectPath: buildContext,
    appSubdir,
    tempDir,
    imageReused,
    detectionReason: detection.reasons.join(', '),
    detectionSignals: detection.signals,
  };
}

/**
 * Stop container and release host port for a deployed preview.
 */
export async function stopProjectPreview(
  projectId,
  { hostPort = null, removeImage = false, imageKey = projectId, stack = 'node-js' } = {}
) {
  const containerName = containerNameFor(projectId);
  const imageTag = buildImageTag(imageKey, stack);

  await removeContainerIfExists(containerName);
  if (removeImage) await removeImageIfExists(imageTag);
  if (hostPort) releaseHostPort(hostPort);
}

function parseHostPortFromPreviewUrl(previewUrl) {
  try {
    const u = new URL(previewUrl);
    return { host: u.hostname || 'localhost', port: Number(u.port) || 80 };
  } catch {
    return { host: 'localhost', port: 80 };
  }
}

function isTcpPortOpen(host, port) {
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

/**
 * Poll until the mapped host port accepts traffic and HTTP responds (or TCP open for slow SPAs).
 */
export async function waitForPreviewReady({
  previewUrl,
  containerName = '',
  stack = 'node-js',
  timeoutMs = Number(process.env.PREVIEW_STARTUP_TIMEOUT_MS || 300_000),
} = {}) {
  const nodeTimeout = Number(process.env.PREVIEW_NODE_STARTUP_TIMEOUT_MS || 600_000);
  const effectiveTimeout = stack === 'node-js' ? Math.max(timeoutMs, nodeTimeout) : timeoutMs;
  const { host, port } = parseHostPortFromPreviewUrl(previewUrl);
  const checkHost = host === 'localhost' ? '127.0.0.1' : host;
  const started = Date.now();
  let sawPortOpen = false;

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

    if (portOpen) {
      const urlsToTry = [previewUrl];
      if (stack === 'php-apache') {
        urlsToTry.push(`${previewUrl.replace(/\/$/, '')}/index.php`);
      }
      if (stack === 'node-js') {
        urlsToTry.push(`${previewUrl.replace(/\/$/, '')}/index.html`);
      }

      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, { method: 'GET', redirect: 'follow' });
          if (res && res.status >= 200 && res.status < 500) {
            return { ready: true, reason: 'http' };
          }
        } catch {
          /* try next */
        }
        try {
          const res = await fetch(url, { method: 'GET', redirect: 'manual' });
          if (res && res.status >= 200 && res.status < 400) {
            return { ready: true, reason: 'http_redirect' };
          }
        } catch {
          /* try next */
        }
      }

      if (sawPortOpen) {
        return { ready: true, reason: 'tcp' };
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(Number(process.env.PREVIEW_STARTUP_POLL_MS || 2000));
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
