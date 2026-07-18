import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import { getPreviewProbeHost } from '../config/previewProbe.js';

/**
 * Common Express/MERN (and Spring) login POST paths, ordered by how often
 * student projects use them. Used for live route detection and credential verify.
 */
export const LOGIN_ROUTE_PROBE_CANDIDATES = [
  '/api/auth/login',
  '/auth/login',
  '/api/login',
  '/login',
  '/api/users/login',
  '/users/login',
  '/api/user/login',
  '/api/v1/auth/login',
];

const DEFAULT_LOGIN_PATHS = LOGIN_ROUTE_PROBE_CANDIDATES;

const LOGIN_ROUTE_MISS_HINT =
  "Could not auto-detect the login route on this project's backend — check the student's Express route definitions directly (look for app.post inside their routes/ or controllers/ folder).";

const LOGIN_ROUTE_MISS_HINT_SPRING =
  "Could not auto-detect the login route on this project's backend — check the student's Spring controllers for @PostMapping / @RequestMapping login endpoints.";

function loginBodies({ email, password, identifierType }) {
  const bodies = [
    { email, password },
    { email, passcode: password },
    { username: email, password },
    { identifier: email, password },
  ];
  if (identifierType === 'username') {
    bodies.unshift({ username: email, password });
    if (email.includes('@')) {
      bodies.unshift({ username: email.split('@')[0], password });
    }
  }
  return bodies;
}

function mergeLoginPaths(customPaths = []) {
  const merged = [...new Set([...(customPaths || []), ...DEFAULT_LOGIN_PATHS])];
  return merged.filter(Boolean);
}

function orderedProbePaths(extraPaths = []) {
  const ordered = [];
  const seen = new Set();
  for (const p of [...LOGIN_ROUTE_PROBE_CANDIDATES, ...(extraPaths || [])]) {
    const path = String(p || '').trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    ordered.push(path.startsWith('/') ? path : `/${path}`);
  }
  return ordered;
}

async function postLogin(baseUrl, loginPath, body) {
  const url = `${String(baseUrl).replace(/\/$/, '')}${loginPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, url };
  } catch (err) {
    return { ok: false, status: 0, url, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// Statuses that clearly mean "a login handler processed this request and rejected
// the throwaway credentials" — not just a security filter denying an unknown path.
const LOGIN_PROBE_STRONG_STATUSES = new Set([400, 401, 415, 422]);

/**
 * Probe the running API with throwaway credentials to find which login route exists.
 * 404 → route missing. 400/401/415/422 → a login handler rejected the probe (strong match).
 * Other statuses (e.g. 403) count as weak matches — but if EVERY candidate returns the
 * same weak status, the backend is blanket-rejecting (Spring Security often 403s unknown
 * paths instead of 404), so the result is inconclusive and we must not patch anything.
 */
export async function detectPreviewLoginApiRoute({
  apiHostPort,
  probeHost = getPreviewProbeHost(),
  extraPaths = [],
} = {}) {
  if (!apiHostPort) {
    return { found: false, path: '', status: 0, reason: 'missing_api_port' };
  }
  const baseUrl = `http://${probeHost}:${apiHostPort}`;
  const body = { email: '__probe__', password: '__probe__' };
  const paths = orderedProbePaths(extraPaths);

  const results = [];
  for (const loginPath of paths) {
    // eslint-disable-next-line no-await-in-loop
    const result = await postLogin(baseUrl, loginPath, body);
    results.push({ path: loginPath, status: result.status, url: result.url });
    if (LOGIN_PROBE_STRONG_STATUSES.has(result.status)) {
      return { found: true, path: loginPath, status: result.status, probeUrl: result.url };
    }
  }

  const weak = results.filter((r) => r.status !== 404 && r.status !== 0);
  if (!weak.length) {
    return { found: false, path: '', status: 0, reason: 'all_candidates_404' };
  }
  const reachable = results.filter((r) => r.status !== 0);
  const uniformStatuses = new Set(weak.map((r) => r.status));
  const blanketReject =
    weak.length > 1 && weak.length === reachable.length && uniformStatuses.size === 1;
  if (blanketReject) {
    return {
      found: false,
      path: '',
      status: weak[0].status,
      reason: `blanket_status_${weak[0].status}`,
    };
  }
  const best = weak[0];
  return { found: true, path: best.path, status: best.status, probeUrl: best.url };
}

/**
 * Teacher-facing hint for Node/MERN (and Spring) — mirrors buildPhpPreviewLoginHint().
 */
export function buildApiLoginRouteHint({
  previewApiUrl = '',
  apiHostPort = '',
  detectedPath = '',
  found = false,
  stack = 'node-js',
} = {}) {
  if (found && detectedPath) {
    const base =
      String(previewApiUrl || '')
        .replace(/\/$/, '')
        .trim() || (apiHostPort ? `http://localhost:${apiHostPort}` : '');
    return `Login endpoint detected: POST ${base}${detectedPath}`;
  }
  return stack === 'java-spring-react' ? LOGIN_ROUTE_MISS_HINT_SPRING : LOGIN_ROUTE_MISS_HINT;
}

/** Merge stack description with the confirmed (or fallback) login-route hint. */
export function mergePreviewLoginRouteHint(existingHint, routeHint) {
  const route = String(routeHint || '').trim();
  if (!route) return String(existingHint || '').trim();
  let base = String(existingHint || '').trim();
  base = base
    .replace(/\s*Login endpoint detected: POST \S+/gi, '')
    .replace(
      /\s*Could not auto-detect the login route on this project's backend[\s\S]*?(?:folder|endpoints)\./gi,
      ''
    )
    .trim();
  return base ? `${base} ${route}` : route;
}

export async function tryPreviewLogin({
  apiHostPort,
  email,
  password,
  identifierType = 'email',
  probeHost = getPreviewProbeHost(),
  loginPaths = [],
} = {}) {
  if (!apiHostPort || !email || !password) {
    return { ok: false, reason: 'missing_credentials_or_port' };
  }
  const baseUrl = `http://${probeHost}:${apiHostPort}`;
  const bodies = loginBodies({ email, password, identifierType });
  const paths = mergeLoginPaths(loginPaths);
  let invalid = null;

  for (const loginPath of paths) {
    for (const body of bodies) {
      // eslint-disable-next-line no-await-in-loop
      const result = await postLogin(baseUrl, loginPath, body);
      if (result.ok) {
        return { ok: true, url: result.url, status: result.status, email, password };
      }
      if (result.status === 400 || result.status === 401 || result.status === 403) {
        invalid = { url: result.url, status: result.status };
      }
    }
  }
  if (invalid) {
    return { ok: false, reason: 'invalid_credentials', ...invalid, email, password };
  }
  return { ok: false, reason: 'login_endpoint_not_found' };
}

function backendExecDir(backendSubdir) {
  const rel = String(backendSubdir ?? 'backend').replace(/"/g, '').trim();
  if (!rel || rel === '.') return 'cd "/app"';
  return `cd "/app/${rel}"`;
}

export async function reseedPreviewAdminInContainer(
  containerName,
  backendSubdir = 'backend',
  { email = '', password = '' } = {}
) {
  const envParts = [];
  if (email) {
    envParts.push(`PREVIEW_ADMIN_EMAIL=${JSON.stringify(String(email))}`);
    envParts.push(`ADMIN_EMAIL=${JSON.stringify(String(email))}`);
    envParts.push(`SEED_ADMIN_EMAIL=${JSON.stringify(String(email))}`);
  }
  if (password) {
    envParts.push(`PREVIEW_ADMIN_PASSWORD=${JSON.stringify(String(password))}`);
    envParts.push(`ADMIN_PASSWORD=${JSON.stringify(String(password))}`);
    envParts.push(`SEED_ADMIN_PASSWORD=${JSON.stringify(String(password))}`);
  }
  const envPrefix = envParts.length ? `${envParts.join(' ')} ` : '';
  const cmd = `${backendExecDir(backendSubdir)} && ${envPrefix}node /preview-seed-admin.js 2>&1 | tail -30`;
  try {
    const out = await dockerOrchestrator.execInPreviewContainer(containerName, cmd, { timeoutMs: 120_000 });
    return { success: !/password verify:\s*FAILED/i.test(out), output: out };
  } catch (err) {
    return { success: false, output: err.message || String(err) };
  }
}

export function buildFallbackPreviewCredentials(discovered = {}) {
  const fallbacks = [];
  const push = (email, password, label) => {
    if (!email || !password) return;
    fallbacks.push({ email, password, label });
  };
  push(discovered.seedScriptEmail, discovered.seedScriptPassword, discovered.seedScriptHint || 'seed script');
  push(discovered.email, discovered.password, discovered.hint || 'project files');
  push(discovered.username, discovered.password, 'project username');
  const seen = new Set();
  return fallbacks.filter((item) => {
    const key = `${item.email}:${item.password}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * After preview is up, verify teacher login works.
 * For Express/MERN: re-seed admin via /preview-seed-admin.js and retry once on 401/403.
 * For Spring Boot: never run the Node mongoose seeder (script is not in the Spring image).
 */
export async function verifyAndFixMernPreviewLogin({
  containerName,
  apiHostPort,
  backendSubdir,
  email,
  password,
  identifierType,
  loginPaths = [],
  fallbackCredentials = [],
  stack = 'node-js',
} = {}) {
  const probeHost = getPreviewProbeHost();
  const paths = mergeLoginPaths(loginPaths);
  const isSpring = stack === 'java-spring-react';

  let attempt = await tryPreviewLogin({
    apiHostPort,
    email,
    password,
    identifierType,
    probeHost,
    loginPaths: paths,
  });
  if (attempt.ok) {
    return { ok: true, message: `Login verified at ${attempt.url}`, attempt };
  }

  // Prefer project-documented credentials (e.g. admin@syada.org / 123456) before reseeding.
  if (attempt.reason === 'invalid_credentials' && fallbackCredentials?.length) {
    const earlyFallback = await tryFallbackLogins({
      apiHostPort,
      identifierType,
      probeHost,
      loginPaths: paths,
      fallbackCredentials,
      skipKeys: new Set([`${email}:${password}`]),
    });
    if (earlyFallback.ok) {
      return {
        ok: true,
        message: `Login verified with project credentials (${earlyFallback.label}) at ${earlyFallback.attempt.url}`,
        attempt: earlyFallback.attempt,
        workingCredentials: { email: earlyFallback.email, password: earlyFallback.password },
      };
    }
  }

  if (attempt.reason !== 'invalid_credentials' || !containerName) {
    const fallback = await tryFallbackLogins({
      apiHostPort,
      identifierType,
      probeHost,
      loginPaths: paths,
      fallbackCredentials,
      skipKeys: new Set([`${email}:${password}`]),
    });
    if (fallback.ok) {
      return {
        ok: true,
        message: `Login verified with project credentials (${fallback.label}) at ${fallback.attempt.url}`,
        attempt: fallback.attempt,
        workingCredentials: { email: fallback.email, password: fallback.password },
      };
    }
    return {
      ok: false,
      message:
        attempt.reason === 'login_endpoint_not_found'
          ? 'Could not find a working login API route on the student backend.'
          : `Login check failed (${attempt.reason || 'unknown'}).`,
      attempt,
    };
  }

  // Spring H2 seeding is done by ScholarVerifyPreviewSeed.java at boot — not Node mongoose seed.
  if (isSpring) {
    const fallback = await tryFallbackLogins({
      apiHostPort,
      identifierType,
      probeHost,
      loginPaths: paths,
      fallbackCredentials,
      skipKeys: new Set([`${email}:${password}`]),
    });
    if (fallback.ok) {
      return {
        ok: true,
        message: `Login verified with project credentials (${fallback.label}) at ${fallback.attempt.url}`,
        attempt: fallback.attempt,
        workingCredentials: { email: fallback.email, password: fallback.password },
      };
    }
    return {
      ok: false,
      message: `Preview UI is up but Spring login returned ${attempt.status || 401} (invalid username/password). Preview seeds previewadmin into H2 when UserService hooks are detected — check /tmp/preview-spring.log if login still fails.`,
      attempt,
    };
  }

  const seed = await reseedPreviewAdminInContainer(containerName, backendSubdir, { email, password });
  await new Promise((r) => setTimeout(r, 2500));
  attempt = await tryPreviewLogin({
    apiHostPort,
    email,
    password,
    identifierType,
    probeHost,
    loginPaths: paths,
  });
  if (attempt.ok) {
    return {
      ok: true,
      message: `Login verified after admin re-seed at ${attempt.url}`,
      attempt,
      seedOutput: seed.output,
    };
  }

  // Re-seed using each project credential pair, then retry that pair.
  for (const cred of fallbackCredentials || []) {
    if (!cred?.email || !cred?.password) continue;
    if (`${cred.email}:${cred.password}` === `${email}:${password}`) continue;
    // eslint-disable-next-line no-await-in-loop
    const altSeed = await reseedPreviewAdminInContainer(containerName, backendSubdir, {
      email: cred.email,
      password: cred.password,
    });
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1500));
    // eslint-disable-next-line no-await-in-loop
    const altAttempt = await tryPreviewLogin({
      apiHostPort,
      email: cred.email,
      password: cred.password,
      identifierType,
      probeHost,
      loginPaths: paths,
    });
    if (altAttempt.ok) {
      return {
        ok: true,
        message: `Login verified with project credentials (${cred.label}) after re-seed at ${altAttempt.url}`,
        attempt: altAttempt,
        seedOutput: altSeed.output || seed.output,
        workingCredentials: { email: cred.email, password: cred.password },
      };
    }
  }

  const fallback = await tryFallbackLogins({
    apiHostPort,
    identifierType,
    probeHost,
    loginPaths: paths,
    fallbackCredentials,
    skipKeys: new Set([`${email}:${password}`]),
  });
  if (fallback.ok) {
    return {
      ok: true,
      message: `Preview admin seed did not work; use project credentials (${fallback.label}) at ${fallback.attempt.url}`,
      attempt: fallback.attempt,
      seedOutput: seed.output,
      workingCredentials: { email: fallback.email, password: fallback.password },
    };
  }

  const seedTail = String(seed.output || '')
    .split('\n')
    .filter((l) => l.includes('[preview-seed]'))
    .slice(-8)
    .join('\n');

  const seedHint = fallbackCredentials.length
    ? ' Try credentials from the student README or createAdmin/seed script if shown above.'
    : ' Check README/.env in the project ZIP.';

  return {
    ok: false,
    message: `Preview UI is up but login returns ${attempt.status || 401} (invalid email/password).${seedHint}`,
    attempt,
    seedOutput: seed.output,
    seedTail,
  };
}

async function tryFallbackLogins({
  apiHostPort,
  identifierType,
  probeHost,
  loginPaths,
  fallbackCredentials,
  skipKeys,
}) {
  for (const cred of fallbackCredentials || []) {
    const key = `${cred.email}:${cred.password}`;
    if (skipKeys.has(key)) continue;
    // eslint-disable-next-line no-await-in-loop
    const attempt = await tryPreviewLogin({
      apiHostPort,
      email: cred.email,
      password: cred.password,
      identifierType,
      probeHost,
      loginPaths,
    });
    if (attempt.ok) {
      return { ok: true, attempt, email: cred.email, password: cred.password, label: cred.label };
    }
  }
  return { ok: false };
}
