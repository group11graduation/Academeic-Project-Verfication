import * as dockerOrchestrator from './dockerOrchestrator.service.js';

const LOGIN_PATHS = ['/api/users/login', '/api/auth/login', '/api/login', '/users/login', '/auth/login'];

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
} = {}) {
  if (!apiHostPort || !email || !password) {
    return { ok: false, reason: 'missing_credentials_or_port' };
  }
  const baseUrl = `http://${probeHost}:${apiHostPort}`;
  const bodies = loginBodies({ email, password, identifierType });
  let invalid = null;

  for (const loginPath of LOGIN_PATHS) {
    for (const body of bodies) {
      // eslint-disable-next-line no-await-in-loop
      const result = await postLogin(baseUrl, loginPath, body);
      if (result.ok) {
        return { ok: true, url: result.url, status: result.status };
      }
      if (result.status === 401 || result.status === 403) {
        invalid = { url: result.url, status: result.status };
      }
    }
  }
  if (invalid) {
    return { ok: false, reason: 'invalid_credentials', ...invalid };
  }
  return { ok: false, reason: 'login_endpoint_not_found' };
}

export async function reseedPreviewAdminInContainer(containerName, backendSubdir = 'backend') {
  const rel = String(backendSubdir || 'backend').replace(/"/g, '');
  const cmd = `cd "/app/${rel}" && node /preview-seed-admin.js 2>&1 | tail -20`;
  try {
    const out = await dockerOrchestrator.execInPreviewContainer(containerName, cmd, { timeoutMs: 120_000 });
    return { success: !/password verify:\s*FAILED/i.test(out), output: out };
  } catch (err) {
    return { success: false, output: err.message || String(err) };
  }
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
} = {}) {
  const probeHost = process.env.PREVIEW_PROBE_HOST || '127.0.0.1';
  let attempt = await tryPreviewLogin({
    apiHostPort,
    email,
    password,
    identifierType,
    probeHost,
  });
  if (attempt.ok) {
    return { ok: true, message: `Login verified at ${attempt.url}`, attempt };
  }
  if (attempt.reason !== 'invalid_credentials' || !containerName) {
    return {
      ok: false,
      message: attempt.reason === 'login_endpoint_not_found'
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
  });
  if (attempt.ok) {
    return {
      ok: true,
      message: `Login verified after admin re-seed at ${attempt.url}`,
      attempt,
      seedOutput: seed.output,
    };
  }

  const seedTail = String(seed.output || '')
    .split('\n')
    .filter((l) => l.includes('[preview-seed]'))
    .slice(-8)
    .join('\n');

  return {
    ok: false,
    message:
      'Preview UI is up but login returns 401 (invalid email/password). The student app may use different credentials than admin@preview.demo — check README/.env in the project ZIP.',
    attempt,
    seedOutput: seed.output,
    seedTail,
  };
}
