import fs from 'fs/promises';
import path from 'path';

const FRONTEND_DIR_NAMES = ['frontend', 'Frontend', 'client', 'Client', 'web', 'ui'];
const BACKEND_DIR_NAMES = ['backend', 'Backend', 'server', 'api', 'API'];
const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.env', '.env.example', '.env.local']);

const API_URL_PATTERNS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://localhost:5000',
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPackageScore(pkgPath) {
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    let score = 0;
    if (deps.react || deps['react-dom']) score += 20;
    if (deps.vite || deps['@vitejs/plugin-react']) score += 18;
    if (deps.express && !deps.react) score -= 12;
    if (deps.mongoose) score -= 4;
    return { score, hasExpress: Boolean(deps.express), hasReact: Boolean(deps.react || deps['react-dom']) };
  } catch {
    return { score: 0, hasExpress: false, hasReact: false };
  }
}

async function collectPackages(buildContext, dir, found, depth = 0) {
  if (depth > 5 || found.length > 40) return;
  const pkgPath = path.join(dir, 'package.json');
  if (await pathExists(pkgPath)) {
    const rel = path.relative(buildContext, dir).replace(/\\/g, '/') || '.';
    if (!found.some((f) => f.rel === rel)) {
      const meta = await readPackageScore(pkgPath);
      found.push({ rel, ...meta });
    }
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    // eslint-disable-next-line no-await-in-loop
    await collectPackages(buildContext, path.join(dir, entry.name), found, depth + 1);
  }
}

/**
 * Detect separate frontend + backend folders (typical MERN capstone zip).
 */
export async function resolveMernPair(buildContext) {
  const found = [];
  await collectPackages(buildContext, buildContext, found);
  if (found.length < 2) return null;

  let frontend = found.find((f) => FRONTEND_DIR_NAMES.some((n) => f.rel === n || f.rel.endsWith(`/${n}`)) && f.hasReact);
  let backend = found.find(
    (f) => BACKEND_DIR_NAMES.some((n) => f.rel === n || f.rel.endsWith(`/${n}`)) && f.hasExpress
  );

  if (!frontend) {
    frontend = [...found].filter((f) => f.hasReact).sort((a, b) => b.score - a.score)[0];
  }
  if (!backend) {
    backend = [...found].filter((f) => f.hasExpress && !f.hasReact).sort((a, b) => a.score - b.score)[0];
  }

  if (!frontend || !backend || frontend.rel === backend.rel) return null;
  return { frontendSubdir: frontend.rel, backendSubdir: backend.rel };
}

async function walkReplaceApiUrl(dir, apiHostPort, depth = 0) {
  if (depth > 8) return { files: 0 };
  let files = 0;
  const toUrl = `http://localhost:${apiHostPort}`;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const sub = await walkReplaceApiUrl(full, apiHostPort, depth + 1);
      files += sub.files;
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXT.has(ext) && !entry.name.startsWith('.env')) continue;
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

const LOCAL_MONGO_PATTERNS = [
  /mongodb:\/\/localhost(:\d+)?/gi,
  /mongodb:\/\/127\.0\.0\.1(:\d+)?/gi,
  /mongodb:\/\/::1(:\d+)?/gi,
];

/**
 * Ensure student API boots inside Docker on :5000 with host MongoDB and permissive CORS for preview UI.
 */
export async function patchBackendForPreview(
  extractDir,
  backendSubdir,
  { mongoUri, hostPort, jwtSecret = 'preview-sandbox-jwt-secret-change-me' }
) {
  const backendRoot = path.join(extractDir, backendSubdir);
  if (!(await pathExists(backendRoot))) return { files: 0 };

  let files = 0;
  const envNames = ['.env', '.env.local', '.env.development'];
  for (const name of envNames) {
    const envPath = path.join(backendRoot, name);
    if (!(await pathExists(envPath))) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(envPath, 'utf8');
    for (const pattern of LOCAL_MONGO_PATTERNS) {
      content = content.replace(pattern, mongoUri);
    }
    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(envPath, content, 'utf8');
    files += 1;
  }

  const previewEnv = [
    '# ScholarVerify preview — do not use localhost Mongo inside Docker',
    'PORT=5000',
    'HOST=0.0.0.0',
    `MONGO_URI=${mongoUri}`,
    `MONGODB_URI=${mongoUri}`,
    `JWT_SECRET=${jwtSecret}`,
    'NODE_ENV=development',
    'PREVIEW_SANDBOX=1',
  ];
  if (hostPort) {
    previewEnv.push(`CORS_ORIGIN=http://localhost:${hostPort}`);
    previewEnv.push(`FRONTEND_URL=http://localhost:${hostPort}`);
  }
  previewEnv.push('');

  await fs.writeFile(path.join(backendRoot, '.env'), `${previewEnv.join('\n')}`, 'utf8');
  files += 1;

  files += await patchDbNoExitOnPreviewFail(backendRoot);
  files += await walkRelaxCors(backendRoot);

  return { files };
}

/** Student BMS uses MONGO_URI; keep API process alive if Mongo is slow so login returns JSON not ERR_EMPTY_RESPONSE. */
async function patchDbNoExitOnPreviewFail(backendRoot, depth = 0) {
  if (depth > 6) return 0;
  let files = 0;
  const dbPath = path.join(backendRoot, 'src', 'config', 'db.js');
  if (await pathExists(dbPath)) {
    let content = await fs.readFile(dbPath, 'utf8');
    if (!content.includes('PREVIEW_SANDBOX')) {
      const needle = 'process.exit(1);';
      const replacement = `if (process.env.PREVIEW_SANDBOX === '1') {
    console.warn('[preview] MongoDB unavailable — API stays up; ensure MongoDB runs on the host (port 27017)');
    return;
  }
  process.exit(1);`;
      if (content.includes(needle)) {
        content = content.replace(needle, replacement);
        await fs.writeFile(dbPath, content, 'utf8');
        files += 1;
      }
    }
  }
  return files;
}

async function walkRelaxCors(dir, depth = 0) {
  if (depth > 8) return 0;
  let files = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      files += await walkRelaxCors(full, depth + 1);
      continue;
    }
    if (!/\.(js|mjs|cjs|ts)$/.test(entry.name)) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    const before = content;
    content = content.replace(
      /origin\s*:\s*['"]http:\/\/localhost:5173['"]/g,
      'origin: true'
    );
    content = content.replace(
      /origin\s*:\s*['"]http:\/\/127\.0\.0\.1:5173['"]/g,
      'origin: true'
    );
    if (content !== before) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(full, content, 'utf8');
      files += 1;
    }
  }
  return files;
}

export async function patchFrontendApiPort(extractDir, frontendSubdir, apiHostPort) {
  const frontendRoot = path.join(extractDir, frontendSubdir);
  if (!(await pathExists(frontendRoot))) return { files: 0 };

  const envLocal = path.join(frontendRoot, '.env.local');
  const envBlock = [
    '# ScholarVerify preview — API on dedicated host port',
    `VITE_API_URL=http://localhost:${apiHostPort}`,
    `REACT_APP_API_URL=http://localhost:${apiHostPort}`,
    `VITE_API_BASE_URL=http://localhost:${apiHostPort}`,
    `NEXT_PUBLIC_API_URL=http://localhost:${apiHostPort}`,
    '',
  ].join('\n');
  await fs.writeFile(envLocal, envBlock, 'utf8');

  const replaced = await walkReplaceApiUrl(frontendRoot, apiHostPort);
  return { files: replaced.files + 1 };
}

export function previewMongoHostName(projectId) {
  const id = String(projectId || 'preview').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `preview-mongo-${id}`;
}

export function buildPreviewMongoUri(sessionId, { sidecarHost = null } = {}) {
  const suffix = String(sessionId || 'default').replace(/[^a-zA-Z0-9]/g, '').slice(-12) || 'preview';
  if (process.env.PREVIEW_MONGODB_URI) {
    return process.env.PREVIEW_MONGODB_URI;
  }
  const host =
    sidecarHost ||
    (process.env.PREVIEW_SIDECAR_MONGO === 'false' ? 'host.docker.internal' : previewMongoHostName(sessionId));
  return `mongodb://${host}:27017/scholarverify_preview_${suffix}`;
}
