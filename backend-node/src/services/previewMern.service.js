import fs from 'fs/promises';
import path from 'path';

const FRONTEND_DIR_HINTS = [
  'frontend',
  'Frontend',
  'client',
  'Client',
  'web',
  'ui',
  'app',
  'portal',
  'dashboard',
  'webapp',
  'web-app',
  'user-interface',
  'userinterface',
];

const BACKEND_DIR_HINTS = [
  'backend',
  'Backend',
  'server',
  'api',
  'API',
  'services',
  'service',
  'rest',
  'rest-api',
  'api-server',
  'apiserver',
];

const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.env', '.env.example', '.env.local']);

const API_URL_LITERALS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://localhost:5000',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'https://localhost:8000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

/** Any localhost/127.0.0.1 dev API port baked into student source or bundles */
const LOCALHOST_DEV_ORIGIN_RE = /https?:\/\/(localhost|127\.0\.0\.1):\d+/gi;

function replaceDevApiOrigins(content, apiHostPort) {
  const toUrl = `http://localhost:${apiHostPort}`;
  let next = content;
  let changed = false;
  for (const from of API_URL_LITERALS) {
    if (next.includes(from)) {
      next = next.split(from).join(toUrl);
      changed = true;
    }
  }
  next = next.replace(LOCALHOST_DEV_ORIGIN_RE, () => {
    changed = true;
    return toUrl;
  });
  return { content: next, changed };
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function dirNameHintScore(rel, hints) {
  const base = rel.split('/').pop()?.toLowerCase() || '';
  const full = rel.toLowerCase();
  for (const hint of hints) {
    const h = hint.toLowerCase();
    if (base === h || full.endsWith(`/${h}`)) return 12;
    if (base.includes(h) || full.includes(h)) return 6;
  }
  return 0;
}

/**
 * Classify a package.json as frontend, backend, fullstack, or unknown.
 * Supports React, Vue, Angular, Svelte, Next, Vite + Express, Fastify, Koa, Nest.
 */
export function classifyPackageJson(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = pkg.scripts || {};

  const frontendFlags = {
    react: Boolean(deps.react || deps['react-dom'] || deps['react-scripts']),
    vue: Boolean(deps.vue || deps['@vue/cli-service'] || deps['@vitejs/plugin-vue']),
    angular: Boolean(deps['@angular/core']),
    svelte: Boolean(deps.svelte || deps['@sveltejs/kit']),
    next: Boolean(deps.next),
    nuxt: Boolean(deps.nuxt || deps.nuxt3),
    vite: Boolean(deps.vite),
  };

  const backendFlags = {
    express: Boolean(deps.express),
    fastify: Boolean(deps.fastify),
    koa: Boolean(deps.koa),
    nest: Boolean(deps['@nestjs/core']),
    hapi: Boolean(deps['@hapi/hapi']),
  };

  const hasFrontend = Object.values(frontendFlags).some(Boolean);
  const hasBackend = Object.values(backendFlags).some(Boolean);
  const hasDb = Boolean(deps.mongoose || deps.mysql || deps.mysql2 || deps.pg || deps.sequelize || deps.prisma);

  let role = 'unknown';
  if (hasFrontend && hasBackend) role = 'fullstack';
  else if (hasFrontend) role = 'frontend';
  else if (hasBackend || hasDb) role = 'backend';

  let frontendFramework = '';
  if (frontendFlags.next) frontendFramework = 'Next.js';
  else if (frontendFlags.nuxt) frontendFramework = 'Nuxt';
  else if (frontendFlags.vue) frontendFramework = 'Vue';
  else if (frontendFlags.angular) frontendFramework = 'Angular';
  else if (frontendFlags.svelte) frontendFramework = 'Svelte';
  else if (frontendFlags.react) frontendFramework = 'React';
  else if (frontendFlags.vite) frontendFramework = 'Vite';

  let backendFramework = '';
  if (backendFlags.nest) backendFramework = 'NestJS';
  else if (backendFlags.express) backendFramework = 'Express';
  else if (backendFlags.fastify) backendFramework = 'Fastify';
  else if (backendFlags.koa) backendFramework = 'Koa';
  else if (backendFlags.hapi) backendFramework = 'Hapi';
  else if (hasDb && role === 'backend') backendFramework = 'Node API';

  let frontendScore = 0;
  if (frontendFlags.react) frontendScore += 24;
  if (frontendFlags.vue) frontendScore += 22;
  if (frontendFlags.angular) frontendScore += 22;
  if (frontendFlags.svelte) frontendScore += 20;
  if (frontendFlags.next) frontendScore += 26;
  if (frontendFlags.nuxt) frontendScore += 24;
  if (frontendFlags.vite) frontendScore += 16;
  if (scripts.dev || scripts.start) frontendScore += 4;
  if (scripts.build) frontendScore += 3;

  let backendScore = 0;
  if (backendFlags.express) backendScore += 20;
  if (backendFlags.fastify) backendScore += 18;
  if (backendFlags.koa) backendScore += 16;
  if (backendFlags.nest) backendScore += 22;
  if (backendFlags.hapi) backendScore += 16;
  if (hasDb) backendScore += 8;
  if (scripts.dev || scripts.start) backendScore += 4;

  return {
    role,
    frontendFramework,
    backendFramework,
    frontendScore,
    backendScore,
    hasFrontend,
    hasBackend,
    hasExpress: backendFlags.express,
    hasReact: frontendFlags.react,
  };
}

async function readPackageMeta(pkgPath) {
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    return classifyPackageJson(pkg);
  } catch {
    return classifyPackageJson({});
  }
}

export async function collectPackages(buildContext, dir, found, depth = 0) {
  if (depth > 6 || found.length > 50) return;
  const pkgPath = path.join(dir, 'package.json');
  if (await pathExists(pkgPath)) {
    const rel = path.relative(buildContext, dir).replace(/\\/g, '/') || '.';
    if (!found.some((f) => f.rel === rel)) {
      const meta = await readPackageMeta(pkgPath);
      found.push({
        rel,
        ...meta,
        score: meta.frontendScore + meta.backendScore,
      });
    }
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    // eslint-disable-next-line no-await-in-loop
    await collectPackages(buildContext, path.join(dir, entry.name), found, depth + 1);
  }
}

async function hasStaticWebRoot(absDir) {
  if (!(await pathExists(absDir))) return false;
  const checks = ['index.html', 'dist/index.html', 'build/index.html', 'public/index.html'];
  for (const rel of checks) {
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(path.join(absDir, rel))) return true;
  }
  return false;
}

/**
 * Backend-only ZIPs often ship a sibling folder with built/static UI (no package.json).
 */
async function findCompanionFrontendDir(buildContext, backendRel) {
  const backendAbs = path.join(buildContext, backendRel);
  const parentAbs = path.dirname(backendAbs);
  const parentRel = path.relative(buildContext, parentAbs).replace(/\\/g, '/') || '.';

  const tryRel = async (rel) => {
    const abs = path.join(buildContext, rel);
    if (rel === backendRel) return null;
    // eslint-disable-next-line no-await-in-loop
    if (await hasStaticWebRoot(abs)) return rel;
    return null;
  };

  for (const hint of FRONTEND_DIR_HINTS) {
    const rel = parentRel === '.' ? hint : `${parentRel}/${hint}`;
    // eslint-disable-next-line no-await-in-loop
    const hit = await tryRel(rel);
    if (hit) return { rel: hit, staticOnly: true, frontendFramework: 'Static build' };
  }

  if (parentRel === '.') {
    const entries = await fs.readdir(buildContext, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const rel = entry.name;
      if (rel === backendRel) continue;
      // eslint-disable-next-line no-await-in-loop
      const hit = await tryRel(rel);
      if (hit) return { rel: hit, staticOnly: true, frontendFramework: 'Static build' };
    }
  }

  return null;
}

function pickBestFrontend(found) {
  const candidates = found.filter((f) => f.role === 'frontend' || f.role === 'fullstack');
  if (!candidates.length) {
    return found.filter((f) => f.hasFrontend).sort((a, b) => b.frontendScore - a.frontendScore)[0] || null;
  }
  return [...candidates].sort((a, b) => {
    const aScore = a.frontendScore + dirNameHintScore(a.rel, FRONTEND_DIR_HINTS);
    const bScore = b.frontendScore + dirNameHintScore(b.rel, FRONTEND_DIR_HINTS);
    return bScore - aScore;
  })[0];
}

function pickBestBackend(found, excludeRel = null) {
  const candidates = found.filter(
    (f) => (f.role === 'backend' || f.role === 'fullstack') && f.rel !== excludeRel
  );
  if (!candidates.length) {
    return (
      found
        .filter((f) => f.hasBackend && !f.hasFrontend && f.rel !== excludeRel)
        .sort((a, b) => b.backendScore - a.backendScore)[0] || null
    );
  }
  return [...candidates].sort((a, b) => {
    const aScore = a.backendScore + dirNameHintScore(a.rel, BACKEND_DIR_HINTS);
    const bScore = b.backendScore + dirNameHintScore(b.rel, BACKEND_DIR_HINTS);
    return bScore - aScore;
  })[0];
}

export function splitStackDisplayLabel(pair) {
  if (!pair) return '';
  const fe = pair.frontendFramework || 'Frontend';
  const be = pair.backendFramework || 'API';
  if (pair.staticFrontend) return `${fe} + ${be}`;
  return `${fe} + ${be}`;
}

/**
 * Detect separate frontend + backend (any common framework / folder naming).
 */
export async function resolveMernPair(buildContext) {
  const found = [];
  await collectPackages(buildContext, buildContext, found);
  if (found.length === 0) return null;

  let frontend = pickBestFrontend(found);
  let backend = pickBestBackend(found, frontend?.rel);

  if (frontend?.role === 'fullstack' && !backend) {
    return null;
  }

  if (frontend && backend && frontend.rel !== backend.rel) {
    return {
      frontendSubdir: frontend.rel,
      backendSubdir: backend.rel,
      frontendFramework: frontend.frontendFramework || 'Frontend',
      backendFramework: backend.backendFramework || 'Node API',
      staticFrontend: false,
      detectionNote: `${splitStackDisplayLabel({
        frontendFramework: frontend.frontendFramework,
        backendFramework: backend.backendFramework,
      })} (${frontend.rel} + ${backend.rel})`,
    };
  }

  if (found.length === 1 && found[0].role === 'backend') {
    const only = found[0];
    const companion = await findCompanionFrontendDir(buildContext, only.rel);
    if (companion) {
      return {
        frontendSubdir: companion.rel,
        backendSubdir: only.rel,
        frontendFramework: companion.frontendFramework || 'Static build',
        backendFramework: only.backendFramework || 'Node API',
        staticFrontend: true,
        detectionNote: `${companion.frontendFramework || 'Static UI'} + ${only.backendFramework || 'API'} (${companion.rel} + ${only.rel})`,
      };
    }
  }

  return null;
}

async function walkReplaceApiUrl(dir, apiHostPort, depth = 0) {
  if (depth > 8) return { files: 0 };
  let files = 0;
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
    const replaced = replaceDevApiOrigins(content, apiHostPort);
    content = replaced.content;
    changed = replaced.changed;
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

async function walkReplaceApiUrlInArtifacts(dir, apiHostPort, depth = 0) {
  if (depth > 10) return { files: 0 };
  let files = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const sub = await walkReplaceApiUrlInArtifacts(full, apiHostPort, depth + 1);
      files += sub.files;
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!['.js', '.css', '.html', '.map', '.json'].includes(ext)) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    const replaced = replaceDevApiOrigins(content, apiHostPort);
    if (replaced.changed) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(full, replaced.content, 'utf8');
      files += 1;
    }
  }
  return { files };
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
    `NUXT_PUBLIC_API_URL=http://localhost:${apiHostPort}`,
    '',
  ].join('\n');
  if (await pathExists(path.join(frontendRoot, 'package.json'))) {
    await fs.writeFile(envLocal, envBlock, 'utf8');
  }

  const replaced = await walkReplaceApiUrl(frontendRoot, apiHostPort);
  let artifactFiles = 0;
  for (const artifactDir of ['build', 'dist']) {
    const abs = path.join(frontendRoot, artifactDir);
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(abs)) {
      // eslint-disable-next-line no-await-in-loop
      const patched = await walkReplaceApiUrlInArtifacts(abs, apiHostPort);
      artifactFiles += patched.files;
    }
  }
  return {
    files: replaced.files + artifactFiles + (await pathExists(path.join(frontendRoot, 'package.json')) ? 1 : 0),
  };
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
