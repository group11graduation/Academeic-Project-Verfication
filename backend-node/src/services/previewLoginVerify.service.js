import * as dockerOrchestrator from './dockerOrchestrator.service.js';

const DEFAULT_LOGIN_PATHS = [
  '/api/users/login',
  '/api/auth/login',
  '/api/login',
  '/users/login',
  '/auth/login',
];

function loginBodies({ email, password, identifierType }) {
  const bodies = [
    { email, password },
    { email, passcode: password },
    { username: email, password },
    { identifier: email, password },
  ];
  if (identifierType === 'username' && email.includes('@')) {
    bodies.unshift({ username: email.split('@')[0], password });
  }
  return bodies;
}

function mergeLoginPaths(customPaths = []) {
  const merged = [...new Set([...(customPaths || []), ...DEFAULT_LOGIN_PATHS])];
  return merged.filter(Boolean);
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

export async function tryPreviewLogin({
  apiHostPort,
  email,
  password,
  identifierType = 'email',
  probeHost = '127.0.0.1',
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

export async function reseedPreviewAdminInContainer(containerName, backendSubdir = 'backend') {
  const cmd = `${backendExecDir(backendSubdir)} && node /preview-seed-admin.js 2>&1 | tail -30`;
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
 * After MERN preview is up, verify teacher login works; re-seed admin and retry once on 401.
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
} = {}) {
  const probeHost = process.env.PREVIEW_PROBE_HOST || '127.0.0.1';
  const paths = mergeLoginPaths(loginPaths);

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

  const seed = await reseedPreviewAdminInContainer(containerName, backendSubdir);
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
