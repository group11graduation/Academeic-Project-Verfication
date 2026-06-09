import fs from 'fs/promises';
import path from 'path';

const FLUTTER_DIR_NAMES = [
  'flutter',
  'Flutter',
  'mobile',
  'Mobile',
  'app',
  'App',
  'client',
  'Client',
  'frontend',
  'Frontend',
];
const BACKEND_DIR_NAMES = ['app-backend', 'backend', 'Backend', 'server', 'api', 'API'];
const DART_EXT = new Set(['.dart']);
const API_URL_PATTERNS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://localhost:5000',
  'http://10.0.2.2:5000',
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPackageMeta(pkgPath) {
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return {
      hasExpress: Boolean(deps.express),
      hasReact: Boolean(deps.react || deps['react-dom']),
    };
  } catch {
    return { hasExpress: false, hasReact: false };
  }
}

async function collectPubspecDirs(dir, buildContext, found, depth = 0) {
  if (depth > 6 || found.length > 20) return;
  if (await pathExists(path.join(dir, 'pubspec.yaml'))) {
    const rel = path.relative(buildContext, dir).replace(/\\/g, '/') || '.';
    if (!found.includes(rel)) found.push(rel);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'build') continue;
    // eslint-disable-next-line no-await-in-loop
    await collectPubspecDirs(path.join(dir, entry.name), buildContext, found, depth + 1);
  }
}

async function collectBackendPackages(dir, buildContext, found, depth = 0) {
  if (depth > 6 || found.length > 30) return;
  const pkgPath = path.join(dir, 'package.json');
  if (await pathExists(pkgPath)) {
    const rel = path.relative(buildContext, dir).replace(/\\/g, '/') || '.';
    if (!found.some((f) => f.rel === rel)) {
      const meta = await readPackageMeta(pkgPath);
      found.push({ rel, ...meta });
    }
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    // eslint-disable-next-line no-await-in-loop
    await collectBackendPackages(path.join(dir, entry.name), buildContext, found, depth + 1);
  }
}

/**
 * Detect Flutter app (pubspec.yaml) + Node/Express backend in the same ZIP.
 */
export async function resolveFlutterNodePair(buildContext) {
  const pubspecDirs = [];
  await collectPubspecDirs(buildContext, buildContext, pubspecDirs);
  if (pubspecDirs.length === 0) return null;

  const backends = [];
  await collectBackendPackages(buildContext, buildContext, backends);
  if (backends.length === 0) return null;

  let backend = backends.find(
    (b) => BACKEND_DIR_NAMES.some((n) => b.rel === n || b.rel.endsWith(`/${n}`)) && b.hasExpress
  );
  if (!backend) {
    backend = backends.filter((b) => b.hasExpress && !b.hasReact)[0];
  }
  if (!backend) {
    backend = backends.find((b) => !b.hasReact) || backends[0];
  }

  let flutterSubdir = pubspecDirs.find((rel) =>
    FLUTTER_DIR_NAMES.some((n) => rel === n || rel.endsWith(`/${n}`))
  );
  if (!flutterSubdir) {
    flutterSubdir = pubspecDirs.find((rel) => rel !== backend.rel) || pubspecDirs[0];
  }

  if (!backend || !flutterSubdir || flutterSubdir === backend.rel) return null;
  return { flutterSubdir, backendSubdir: backend.rel };
}

async function walkPatchDartApi(dir, apiHostPort, depth = 0) {
  if (depth > 10) return { files: 0 };
  let files = 0;
  const toUrl = `http://localhost:${apiHostPort}`;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'build' || entry.name === '.dart_tool') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const sub = await walkPatchDartApi(full, apiHostPort, depth + 1);
      files += sub.files;
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!DART_EXT.has(ext)) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    let changed = false;
    for (const from of API_URL_PATTERNS) {
      if (content.includes(from)) {
        content = content.split(from).join(toUrl);
        changed = true;
      }
    }
    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(full, content, 'utf8');
      files += 1;
    }
  }
  return { files };
}

/** Point Flutter API constants at the mapped preview API port on the host. */
export async function patchFlutterApiPort(buildContext, flutterSubdir, apiHostPort) {
  const root = path.join(buildContext, flutterSubdir);
  if (!(await pathExists(root))) return { files: 0 };
  return walkPatchDartApi(root, apiHostPort);
}
