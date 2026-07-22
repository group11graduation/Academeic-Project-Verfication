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

/** Same public preview host with a different allocated port (stale cached React builds). */
function publicHostPortOriginRe(targetApiUrl) {
  try {
    const u = new URL(String(targetApiUrl));
    if (!u.hostname || u.hostname === 'localhost' || u.hostname === '127.0.0.1') return null;
    const host = u.hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`https?:\\/\\/${host}:\\d+`, 'gi');
  } catch {
    return null;
  }
}

function replaceDevApiOrigins(content, targetApiUrl) {
  const toUrl = String(targetApiUrl || '').replace(/\/$/, '');
  if (!toUrl) return { content, changed: false };
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
  const publicRe = publicHostPortOriginRe(toUrl);
  if (publicRe) {
    next = next.replace(publicRe, () => {
      changed = true;
      return toUrl;
    });
  }
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

/** True when this folder is a Spring Boot module (not an Express/Node API). */
async function looksLikeSpringModule(absDir) {
  for (const name of ['pom.xml', 'build.gradle', 'build.gradle.kts']) {
    const p = path.join(absDir, name);
    // eslint-disable-next-line no-await-in-loop
    if (!(await pathExists(p))) continue;
    // eslint-disable-next-line no-await-in-loop
    const text = await fs.readFile(p, 'utf8').catch(() => '');
    if (/spring-boot|springframework|org\.springframework/i.test(text)) return true;
  }
  return false;
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
  if (/react/i.test(fe) && /express|node\s*api|nest/i.test(be)) {
    return 'React + Express';
  }
  return `${fe} + ${be}`;
}

/** Teacher-facing label for React + Express (Node) MERN-style pairs. */
export function reactExpressDisplayLabel(pair) {
  if (!pair) return 'React + Express';
  const base = splitStackDisplayLabel(pair) || 'React + Express';
  if (pair.frontendSubdir && pair.backendSubdir) {
    return `${base} (${pair.frontendSubdir} + ${pair.backendSubdir})`;
  }
  return base;
}

/**
 * Detect separate frontend + backend (any common framework / folder naming).
 * Skips Spring Boot modules so React+Spring ZIPs never resolve as React+Express.
 */
export async function resolveMernPair(buildContext) {
  const found = [];
  await collectPackages(buildContext, buildContext, found);
  if (found.length === 0) return null;

  const filtered = [];
  for (const pkg of found) {
    const abs = path.join(buildContext, pkg.rel === '.' ? '' : pkg.rel);
    // eslint-disable-next-line no-await-in-loop
    if (await looksLikeSpringModule(abs)) continue;
    filtered.push(pkg);
  }
  if (filtered.length === 0) return null;

  let frontend = pickBestFrontend(filtered);
  let backend = pickBestBackend(filtered, frontend?.rel);

  if (frontend?.role === 'fullstack' && !backend) {
    return null;
  }

  if (frontend && backend && frontend.rel !== backend.rel) {
    const frontendFramework = frontend.frontendFramework || 'Frontend';
    const backendFramework = backend.backendFramework || 'Express';
    return {
      frontendSubdir: frontend.rel,
      backendSubdir: backend.rel,
      frontendFramework,
      backendFramework,
      staticFrontend: false,
      detectionNote: `${reactExpressDisplayLabel({
        frontendFramework,
        backendFramework,
        frontendSubdir: frontend.rel,
        backendSubdir: backend.rel,
      })}`,
    };
  }

  if (filtered.length === 1 && filtered[0].role === 'backend') {
    const only = filtered[0];
    const companion = await findCompanionFrontendDir(buildContext, only.rel);
    if (companion) {
      const frontendFramework = companion.frontendFramework || 'Static build';
      const backendFramework = only.backendFramework || 'Express';
      return {
        frontendSubdir: companion.rel,
        backendSubdir: only.rel,
        frontendFramework,
        backendFramework,
        staticFrontend: true,
        detectionNote: reactExpressDisplayLabel({
          frontendFramework,
          backendFramework,
          frontendSubdir: companion.rel,
          backendSubdir: only.rel,
        }),
      };
    }
  }

  return null;
}

async function walkReplaceApiUrl(dir, targetApiUrl, depth = 0) {
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
      const sub = await walkReplaceApiUrl(full, targetApiUrl, depth + 1);
      files += sub.files;
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXT.has(ext) && !entry.name.startsWith('.env')) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    const replaced = replaceDevApiOrigins(content, targetApiUrl);
    content = replaced.content;
    if (replaced.changed) {
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
  {
    mongoUri,
    hostPort,
    publicUiUrl,
    jwtSecret = 'cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtZm9yLUhTNTEyLW5lZWRzLTY0LWJ5dGUta2V5LW1pbmltdW0hIQ==',
    loginApiPath = '',
  }
) {
  const backendRoot = path.join(extractDir, backendSubdir);
  if (!(await pathExists(backendRoot))) return { files: 0 };

  let files = 0;
  const envNames = ['.env', '.env.local', '.env.development'];
  for (const name of envNames) {
    const envPath = path.join(backendRoot, name);
    if (!(await pathExists(envPath))) continue;
    if (name === '.env') {
      const projectEnvPath = path.join(backendRoot, '.env.project');
      if (!(await pathExists(projectEnvPath))) {
        // eslint-disable-next-line no-await-in-loop
        await fs.copyFile(envPath, projectEnvPath);
      }
    }
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
  if (loginApiPath) {
    previewEnv.push(`PREVIEW_LOGIN_API_PATH=${loginApiPath}`);
  }
  if (publicUiUrl || hostPort) {
    const corsOrigin = publicUiUrl || `http://localhost:${hostPort}`;
    previewEnv.push(`CORS_ORIGIN=${corsOrigin}`);
    previewEnv.push(`FRONTEND_URL=${corsOrigin}`);
  }
  previewEnv.push('');

  await fs.writeFile(path.join(backendRoot, '.env'), `${previewEnv.join('\n')}`, 'utf8');
  files += 1;

  files += await patchMongoInBackendSources(backendRoot, mongoUri);

  files += await patchDbNoExitOnPreviewFail(backendRoot);
  files += await walkRelaxCors(backendRoot);

  // Remove legacy Express login aliases — they shadowed real routes (SYADA /auth/login),
  // poisoned route probes, and caused "Route not found" / empty-body 400s.
  // Login path fixes now use: source discovery + live probe + frontend rewrite + browser fallback.
  const removed = await removePreviewLoginPathAliases(extractDir, backendSubdir);
  files += removed.files || 0;

  return { files };
}

async function patchMongoInBackendSources(backendRoot, mongoUri, depth = 0) {
  if (depth > 8) return 0;
  let files = 0;
  let entries;
  try {
    entries = await fs.readdir(backendRoot, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(backendRoot, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      files += await patchMongoInBackendSources(full, mongoUri, depth + 1);
      continue;
    }
    if (!/\.(js|mjs|cjs|ts|json)$/i.test(entry.name)) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    const before = content;
    for (const pattern of LOCAL_MONGO_PATTERNS) {
      content = content.replace(pattern, mongoUri);
    }
    if (content !== before) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(full, content, 'utf8');
      files += 1;
    }
  }
  return files;
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

async function walkReplaceApiUrlInArtifacts(dir, targetApiUrl, depth = 0) {
  if (depth > 10) return { files: 0 };
  let files = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const sub = await walkReplaceApiUrlInArtifacts(full, targetApiUrl, depth + 1);
      files += sub.files;
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!['.js', '.css', '.html', '.map', '.json'].includes(ext)) continue;
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    const replaced = replaceDevApiOrigins(content, targetApiUrl);
    if (replaced.changed) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(full, replaced.content, 'utf8');
      files += 1;
    }
  }
  return { files };
}

/**
 * Rewrite wrong login path literals to the confirmed backend route.
 * Skips bare `/login` (SPA page). Avoids turning `/api/auth/login` into `/api/api/auth/login`.
 */
export function rewriteLoginPathLiterals(content, confirmedPath, candidatePaths = []) {
  const confirmed = String(confirmedPath || '').trim();
  if (!confirmed || confirmed === '/login') {
    return { content, changed: false };
  }
  const candidates = [
    ...new Set(
      [...(candidatePaths || []), ...LOGIN_PATH_REWRITE_CANDIDATES]
        .map((p) => String(p || '').trim())
        .filter((p) => p && p !== confirmed && p !== '/login')
    ),
  ].sort((a, b) => b.length - a.length);

  let next = String(content);
  let changed = false;

  for (const wrong of candidates) {
    for (const q of ['"', "'", '`']) {
      const from = `${q}${wrong}${q}`;
      const to = `${q}${confirmed}${q}`;
      if (next.includes(from)) {
        next = next.split(from).join(to);
        changed = true;
      }
    }
    // Unquoted URL path: only when wrong is not already prefixed (e.g. /auth/login vs /api/auth/login)
    if (confirmed.endsWith(wrong) && confirmed.length > wrong.length) {
      const prefix = confirmed.slice(0, confirmed.length - wrong.length);
      const escapedWrong = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<!${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})${escapedWrong}`, 'g');
      const replaced = next.replace(re, confirmed);
      if (replaced !== next) {
        next = replaced;
        changed = true;
      }
    }
  }
  return { content: next, changed };
}

const LOGIN_PATCH_ARTIFACT_EXT = new Set(['.js', '.css', '.html', '.map', '.json']);

async function walkReplaceLoginPaths(dir, confirmedPath, { depth = 0 } = {}) {
  if (depth > 10) return { files: 0 };
  let files = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Recurse everywhere (including dist/build) so built bundles get fixed too.
      // eslint-disable-next-line no-await-in-loop
      const sub = await walkReplaceLoginPaths(full, confirmedPath, { depth: depth + 1 });
      files += sub.files;
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXT.has(ext) && !LOGIN_PATCH_ARTIFACT_EXT.has(ext) && !entry.name.startsWith('.env')) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(full, 'utf8').catch(() => null);
    if (content == null) continue;
    const replaced = rewriteLoginPathLiterals(content, confirmedPath);
    if (replaced.changed) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(full, replaced.content, 'utf8');
      files += 1;
    }
  }
  return { files };
}

/**
 * After the real login API path is known, rewrite student frontend source + built bundles
 * so the browser stops POSTing a 404 path like /auth/login.
 * Pass frontendSubdir='' to patch the whole extract tree (e.g. Spring pair, unknown layout).
 */
export async function patchFrontendLoginApiPath(extractDir, frontendSubdir, confirmedPath) {
  const confirmed = String(confirmedPath || '').trim();
  if (!confirmed || confirmed === '/login') return { files: 0, confirmedPath: confirmed };
  const frontendRoot = path.join(extractDir, frontendSubdir || '');
  if (!(await pathExists(frontendRoot))) return { files: 0, confirmedPath: confirmed };

  const patched = await walkReplaceLoginPaths(frontendRoot, confirmed);
  return { files: patched.files, confirmedPath: confirmed };
}

const LOGIN_ALIAS_FILE = 'scholarverify-preview-login-aliases.cjs';
const LOGIN_ALIAS_MARKER = 'scholarverify-preview-login-aliases-v4';
const LOGIN_ALIAS_MARKER_LEGACY = 'scholarverify-preview-login-aliases';

function buildLoginAliasModule(realPath) {
  const real = String(realPath || '').replace(/\\/g, '/');
  const allPaths = [...LOGIN_PATH_REWRITE_CANDIDATES];
  return `/* ${LOGIN_ALIAS_MARKER} — auto-injected for ScholarVerify preview */
'use strict';
const http = require('http');
const { execFileSync } = require('child_process');

const PREFERRED = String(process.env.PREVIEW_LOGIN_API_PATH || ${JSON.stringify(real)} || '').trim();
const CANDIDATES = ${JSON.stringify(allPaths)};

function proxyOnce(port, path, payload, headers) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers },
      (pr) => {
        const chunks = [];
        pr.on('data', (c) => chunks.push(c));
        pr.on('end', () => {
          resolve({
            status: pr.statusCode || 502,
            headers: pr.headers || {},
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 502, headers: {}, body: Buffer.from(JSON.stringify({ message: err.message || 'proxy failed' })) }));
    req.write(payload);
    req.end();
  });
}

function bodyMatchesPreviewAdmin(body) {
  const email = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const pass = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '');
  if (!email || !pass || !body || typeof body !== 'object') return false;
  const gotEmail = String(body.email || body.username || body.identifier || body.login || body.userEmail || body.mail || '').toLowerCase().trim();
  const gotPass = String(body.password || body.passcode || body.pwd || body.pass || '');
  return gotEmail === email && gotPass === pass;
}

function reseedPreviewAdmin() {
  try {
    if (global.__svPreviewSeedAt && Date.now() - global.__svPreviewSeedAt < 45000) return true;
    execFileSync('node', ['/preview-seed-admin.js'], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 90000,
      stdio: 'ignore',
    });
    global.__svPreviewSeedAt = Date.now();
    console.log('[preview] login alias re-seeded preview admin');
    return true;
  } catch (err) {
    console.log('[preview] login alias re-seed failed:', (err && err.message) || err);
    return false;
  }
}

function installPreviewLoginAliases(app) {
  if (!app || typeof app.post !== 'function' || app.__scholarVerifyLoginAliases) return;
  app.__scholarVerifyLoginAliases = true;

  // Runs ahead of student login handlers: if the teacher uses preview admin
  // credentials, ensure that account exists in Mongo before auth runs.
  if (typeof app.use === 'function' && !app.__scholarVerifyLoginReseed) {
    app.__scholarVerifyLoginReseed = true;
    app.use((req, res, next) => {
      try {
        if (String(req.method || '').toUpperCase() !== 'POST') return next();
        const path = String(req.path || req.url || '').split('?')[0];
        if (!/\\/(api\\/)?(auth|users|user|v1\\/auth)?\\/?login\\/?$/i.test(path) && !CANDIDATES.includes(path)) {
          return next();
        }
        if (bodyMatchesPreviewAdmin(req.body)) reseedPreviewAdmin();
        return next();
      } catch (_e) {
        return next();
      }
    });
  }

  const handlers = [];
  // Do NOT run a second express.json() here — it can race/consume the body and
  // leave req.body empty for fallthrough handlers (SYADA "Empty body" 400).
  // IMPORTANT: must accept next — when this path IS the real login route (e.g. SYADA
  // POST /auth/login), we must fall through instead of swallowing it with 404.
  handlers.push(async (req, res, next) => {
    // Proxied follow-up: do not re-enter alias logic; let the project's handler run.
    if (String(req.headers['x-sv-login-proxy'] || '') === '1') {
      return next();
    }
    const incoming = String(req.path || req.url || '').split('?')[0];
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const hasCreds = Boolean(
      body.email || body.username || body.identifier || body.login || body.password || body.passcode
    );

    // If this request already targets the confirmed real route, never shadow it.
    if (PREFERRED && incoming === PREFERRED) {
      if (bodyMatchesPreviewAdmin(body)) reseedPreviewAdmin();
      return next();
    }

    // Empty body → do not proxy (wrong routes often reply 400 "email required").
    // Fall through so the real handler / client retry can run.
    if (!hasCreds) {
      console.log('[preview] login alias ' + incoming + ' → empty body, fallthrough');
      return next();
    }

    if (bodyMatchesPreviewAdmin(body)) reseedPreviewAdmin();

    const port = Number(process.env.PORT || process.env.API_PORT || 5000);
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'X-SV-Login-Proxy': '1',
      Accept: 'application/json',
    };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const ordered = [];
    const seen = new Set();
    for (const p of [PREFERRED, ...CANDIDATES]) {
      const path = String(p || '').trim();
      if (!path || path === incoming || seen.has(path)) continue;
      seen.add(path);
      ordered.push(path);
    }

    // Only treat these as "a real login handler answered". A 400 from a wrong
    // candidate (or empty-body validator) must NOT stop the search — that was
    // returning SYADA's "Empty body" error from a non-canonical path.
    const AUTH_HIT = new Set([200, 201, 204, 401, 403, 422]);
    for (const path of ordered) {
      // eslint-disable-next-line no-await-in-loop
      const result = await proxyOnce(port, path, payload, headers);
      if (result.status === 404 || result.status === 0) continue;
      if (!AUTH_HIT.has(result.status)) continue;
      console.log('[preview] login alias ' + incoming + ' → ' + path + ' (' + result.status + ')');
      res.status(result.status);
      if (result.headers['content-type']) res.setHeader('Content-Type', result.headers['content-type']);
      return res.send(result.body);
    }
    // No alternate worked — fall through to the project's own handler on this path.
    console.log('[preview] login alias ' + incoming + ' → fallthrough to app handler');
    return next();
  });
  for (const alias of CANDIDATES) {
    // Never mount an alias on the confirmed real login path — that would shadow
    // the student handler (exact bug that caused SYADA "Route not found").
    if (PREFERRED && alias === PREFERRED) continue;
    app.post(alias, ...handlers);
  }
  console.log('[preview] universal login aliases installed' + (PREFERRED ? (' preferred=' + PREFERRED) : ''));
}

module.exports = { installPreviewLoginAliases };
`;
}

function injectLoginAliasRequire(content, requirePath) {
  // Upgrade legacy alias inject points so reseed middleware sits after body parsers
  // and fallthrough next() is used (v3+).
  let next = content;
  if (
    /scholarverify-preview-login-aliases(?!-v4)/.test(next) &&
    !next.includes(LOGIN_ALIAS_MARKER)
  ) {
    next = next
      .replace(/import \{ createRequire as __svCreateRequire \} from 'node:module';\n?/g, '')
      .replace(
        /try \{ __svCreateRequire\(import\.meta\.url\)\([^)]+\)\.installPreviewLoginAliases\(app\); \} catch \(_sv\) \{ \/\*[^*]*\*\/ \}\n?/g,
        ''
      )
      .replace(
        /try \{ require\([^)]+\)\.installPreviewLoginAliases\(app\); \} catch \(_sv\) \{ \/\*[^*]*\*\/ \}\n?/g,
        ''
      );
  }
  if (next.includes(LOGIN_ALIAS_MARKER) && next.includes('installPreviewLoginAliases')) {
    return { content: next, changed: next !== content };
  }
  const isEsm =
    /\bimport\s+.+from\s+['"]/.test(next) ||
    /\bexport\s+(default|const|function|class|\{)/.test(next);

  let line;
  if (isEsm) {
    if (!/createRequire\s+as\s+__svCreateRequire/.test(next)) {
      next = `import { createRequire as __svCreateRequire } from 'node:module';\n${next}`;
    }
    line = `try { __svCreateRequire(import.meta.url)(${JSON.stringify(requirePath)}).installPreviewLoginAliases(app); } catch (_sv) { /* ${LOGIN_ALIAS_MARKER} */ }\n`;
  } else {
    line = `try { require(${JSON.stringify(requirePath)}).installPreviewLoginAliases(app); } catch (_sv) { /* ${LOGIN_ALIAS_MARKER} */ }\n`;
  }

  // Prefer right after body parsers so reseed middleware runs BEFORE student login routes.
  const jsonRe = /(app\.use\(\s*express\.json\([^)]*\)\s*\)\s*;?)/;
  if (jsonRe.test(next)) {
    return { content: next.replace(jsonRe, `$1\n${line}`), changed: true };
  }
  const urlencodedRe = /(app\.use\(\s*express\.urlencoded\([^)]*\)\s*\)\s*;?)/;
  if (urlencodedRe.test(next)) {
    return { content: next.replace(urlencodedRe, `$1\n${line}`), changed: true };
  }

  const notFoundRe = /(\n)((?:\/\/[^\n]*404[^\n]*\n)?)(app\.use\(\s*\(\s*req\s*,\s*res)/;
  if (notFoundRe.test(next)) {
    return { content: next.replace(notFoundRe, `$1${line}$2$3`), changed: true };
  }

  const listenRe = /(\n)((?:const|let|var)\s+\w+\s*=\s*)?app\.listen\(/;
  if (listenRe.test(next)) {
    return { content: next.replace(listenRe, `$1${line}$2app.listen(`), changed: true };
  }

  return { content: `${next}\n${line}`, changed: true };
}

async function findExpressEntryFiles(backendRoot) {
  const candidates = [
    'server.js',
    'index.js',
    'app.js',
    'src/server.js',
    'src/index.js',
    'src/app.js',
    'backend/server.js',
    'backend/index.js',
  ];
  const found = [];
  for (const rel of candidates) {
    const full = path.join(backendRoot, rel);
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(full)) found.push(full);
  }
  if (found.length) return found;

  // Fallback: shallow scan for app.listen
  const entries = await fs.readdir(backendRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(js|cjs)$/i.test(entry.name)) continue;
    const full = path.join(backendRoot, entry.name);
    // eslint-disable-next-line no-await-in-loop
    const text = await fs.readFile(full, 'utf8').catch(() => '');
    if (/\bapp\.listen\s*\(/.test(text) && /\bexpress\s*\(/.test(text)) found.push(full);
  }
  return found;
}

/**
 * Mount POST aliases for common wrong login paths onto the real Express route
 * (e.g. /auth/login → /api/auth/login) so student UIs stop getting "Route not found".
 * @deprecated Prefer removePreviewLoginPathAliases — aliases shadowed real routes.
 */
export async function installPreviewLoginPathAliases(extractDir, backendSubdir, realLoginPath) {
  const real = String(realLoginPath || '').trim();
  // Allow empty real path — smart aliases still try every common candidate.
  if (real === '/login') return { files: 0, realPath: real };
  const backendRoot = path.join(extractDir, backendSubdir || '');
  if (!(await pathExists(backendRoot))) return { files: 0, realPath: real };

  const aliasAbs = path.join(backendRoot, LOGIN_ALIAS_FILE);
  await fs.writeFile(aliasAbs, buildLoginAliasModule(real), 'utf8');
  let files = 1;

  const entries = await findExpressEntryFiles(backendRoot);
  for (const entryFile of entries) {
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(entryFile, 'utf8').catch(() => null);
    if (content == null || !/\bapp\b/.test(content)) continue;
    let rel = path.relative(path.dirname(entryFile), aliasAbs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    // Always require the .cjs helper so both CJS and ESM entry files can load it.
    const injected = injectLoginAliasRequire(content, rel);
    if (injected.changed) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(entryFile, injected.content, 'utf8');
      files += 1;
    }
  }
  return { files, realPath: real };
}

/**
 * Strip previously injected ScholarVerify login aliases from a student backend.
 * Safe to call repeatedly; required because aliases shadowed real routes like /auth/login.
 */
export async function removePreviewLoginPathAliases(extractDir, backendSubdir) {
  const backendRoot = path.join(extractDir, backendSubdir || '');
  if (!(await pathExists(backendRoot))) return { files: 0 };

  let files = 0;
  const aliasAbs = path.join(backendRoot, LOGIN_ALIAS_FILE);
  if (await pathExists(aliasAbs)) {
    await fs.unlink(aliasAbs).catch(() => {});
    files += 1;
  }

  const entries = await findExpressEntryFiles(backendRoot);
  for (const entryFile of entries) {
    // eslint-disable-next-line no-await-in-loop
    let content = await fs.readFile(entryFile, 'utf8').catch(() => null);
    if (content == null) continue;
    if (!/scholarverify-preview-login-aliases|installPreviewLoginAliases|__svCreateRequire/.test(content)) {
      continue;
    }
    const next = content
      .replace(/import \{ createRequire as __svCreateRequire \} from 'node:module';\n?/g, '')
      .replace(
        /try \{ __svCreateRequire\(import\.meta\.url\)\([^)]+\)\.installPreviewLoginAliases\(app\); \} catch \(_sv\) \{ \/\*[^*]*\*\/ \}\n?/g,
        ''
      )
      .replace(
        /try \{ require\([^)]+\)\.installPreviewLoginAliases\(app\); \} catch \(_sv\) \{ \/\*[^*]*\*\/ \}\n?/g,
        ''
      );
    if (next !== content) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(entryFile, next, 'utf8');
      files += 1;
    }
  }
  return { files };
}

export async function patchFrontendApiPort(
  extractDir,
  frontendSubdir,
  apiHostPort,
  { publicApiUrl, loginApiPath = '' } = {}
) {
  const frontendRoot = path.join(extractDir, frontendSubdir);
  if (!(await pathExists(frontendRoot))) return { files: 0 };

  const targetApiUrl = publicApiUrl || `http://localhost:${apiHostPort}`;

  const envLocal = path.join(frontendRoot, '.env.local');
  const envBlock = [
    '# ScholarVerify preview — API reachable from teacher browser',
    `VITE_API_URL=${targetApiUrl}`,
    `REACT_APP_API_URL=${targetApiUrl}`,
    `VITE_API_BASE_URL=${targetApiUrl}`,
    `NEXT_PUBLIC_API_URL=${targetApiUrl}`,
    `NUXT_PUBLIC_API_URL=${targetApiUrl}`,
    '',
  ].join('\n');
  if (await pathExists(path.join(frontendRoot, 'package.json'))) {
    await fs.writeFile(envLocal, envBlock, 'utf8');
  }

  const replaced = await walkReplaceApiUrl(frontendRoot, targetApiUrl);
  let artifactFiles = 0;
  for (const artifactDir of ['build', 'dist']) {
    const abs = path.join(frontendRoot, artifactDir);
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(abs)) {
      // eslint-disable-next-line no-await-in-loop
      const patched = await walkReplaceApiUrlInArtifacts(abs, targetApiUrl);
      artifactFiles += patched.files;
    }
  }

  let loginPathFiles = 0;
  if (loginApiPath) {
    const loginPatched = await patchFrontendLoginApiPath(extractDir, frontendSubdir, loginApiPath);
    loginPathFiles = loginPatched.files || 0;
  }

  return {
    files:
      replaced.files +
      artifactFiles +
      loginPathFiles +
      (await pathExists(path.join(frontendRoot, 'package.json')) ? 1 : 0),
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

const DEFAULT_LOGIN_PATHS = [
  '/auth/login',
  '/api/auth/login',
  '/api/user/login',
  '/api/users/login',
  '/users/login',
  '/api/login',
  '/api/v1/auth/login',
  '/login',
];

/** Candidates safe to rewrite in frontend JS (excludes bare /login SPA route). */
const LOGIN_PATH_REWRITE_CANDIDATES = DEFAULT_LOGIN_PATHS.filter((p) => p !== '/login');

const LOGIN_PATH_LITERAL_RE = /['"`](\/(?:api\/)?[^'"`]*login[^'"`]*)['"`]/gi;

/**
 * Pick the best login API path from source discovery / probe results.
 * Prefers the shared candidate order (api/auth/login before auth/login, etc.).
 */
export function preferLoginApiPath(discoveredPaths = []) {
  const found = new Set(
    (discoveredPaths || [])
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .map((p) => (p.startsWith('/') ? p : `/${p}`))
  );
  for (const candidate of DEFAULT_LOGIN_PATHS) {
    if (found.has(candidate)) return candidate;
  }
  for (const p of found) {
    if (/login/i.test(p) && p.includes('/api/')) return p;
  }
  for (const p of found) {
    if (/login/i.test(p) && p !== '/login') return p;
  }
  return '';
}

/**
 * Scan backend route files for login POST paths (e.g. /api/users/login).
 * Returns ONLY paths found in source — do not seed defaults (that falsely preferred /api/auth/login).
 */
export async function discoverLoginApiPaths(extractDir, backendSubdir = '') {
  const backendRoot = backendSubdir
    ? path.join(extractDir, backendSubdir.replace(/^\.\/?/, ''))
    : extractDir;
  const found = new Set();

  async function walk(dir, depth = 0) {
    if (depth > 8) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(full, depth + 1);
        continue;
      }
      if (!/\.(js|mjs|cjs|ts)$/i.test(entry.name)) continue;
      // eslint-disable-next-line no-await-in-loop
      const content = await fs.readFile(full, 'utf8').catch(() => '');
      if (!content) continue;
      let match;
      const re = new RegExp(LOGIN_PATH_LITERAL_RE.source, 'gi');
      while ((match = re.exec(content)) !== null) {
        const p = match[1];
        if (p && /login/i.test(p) && p !== '/login') {
          found.add(p.startsWith('/') ? p : `/${p}`);
        }
      }
      // app.use('/api/users', ...) + router.post('/login')
      const useMounts = content.matchAll(/app\.use\(\s*['"`](\/api\/[^'"`]+)['"`]\s*,/gi);
      for (const m of useMounts) {
        const base = m[1];
        if (
          base &&
          (/\.post\(\s*['"`]\/login['"`]/.test(content) ||
            /router\.post\(\s*['"`]\/login['"`]/.test(content) ||
            /Router\(\)[\s\S]{0,800}?\.post\(\s*['"`]\/login['"`]/.test(content))
        ) {
          found.add(`${base.replace(/\/$/, '')}/login`);
        }
      }
      // router mounts in separate files: export + '/users' style often paired with login
      if (/post\(\s*['"`]\/login['"`]/.test(content)) {
        const routerMountHints = content.matchAll(/['"`](\/api\/[a-z0-9_-]+)['"`]/gi);
        for (const hm of routerMountHints) {
          const base = hm[1];
          if (base && /user|auth|account|admin/i.test(base)) {
            found.add(`${base.replace(/\/$/, '')}/login`);
          }
        }
      }
    }
  }

  if (await pathExists(backendRoot)) {
    await walk(backendRoot);
  } else {
    await walk(extractDir);
  }

  return [...found];
}
