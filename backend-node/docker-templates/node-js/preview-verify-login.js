#!/usr/bin/env node
/**
 * POST test login against the student API inside the preview container.
 * Tries many path + body shapes; does not stop at the first 401.
 */
const http = require('http');

const email = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo')
  .toLowerCase()
  .trim();
const password = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!');
const port = Number(process.env.API_PORT || process.env.PORT || 5050);

const paths = [
  '/api/users/login',
  '/api/auth/login',
  '/api/user/login',
  '/api/login',
  '/users/login',
  '/auth/login',
  '/user/login',
  '/api/v1/auth/login',
];

const bodies = [
  { email, password },
  { Email: email, Password: password },
  { email, passcode: password },
  { username: email, password },
  { username: email.split('@')[0], password },
  { identifier: email, password },
  { login: email, password },
];

function post(path, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 8000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            path,
            body,
            raw: String(raw || '').slice(0, 200),
          });
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, status: 0, path, body, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, path, body, error: 'timeout' });
    });
    req.write(payload);
    req.end();
  });
}

(async () => {
  let sawAuthFailure = false;
  let lastFail = null;
  for (const path of paths) {
    for (const body of bodies) {
      // eslint-disable-next-line no-await-in-loop
      const result = await post(path, body);
      if (result.ok) {
        console.log(`[preview-login] OK ${path} status=${result.status}`);
        process.exitCode = 0;
        return;
      }
      if (result.status === 400 || result.status === 401 || result.status === 403) {
        sawAuthFailure = true;
        lastFail = result;
        continue;
      }
      if (result.status === 404 || result.status === 0) {
        continue;
      }
      lastFail = result;
    }
  }
  if (sawAuthFailure && lastFail) {
    console.log(
      `[preview-login] invalid credentials ${lastFail.path} status=${lastFail.status}` +
        (lastFail.raw ? ` body=${lastFail.raw}` : '')
    );
    process.exitCode = 1;
    return;
  }
  console.log('[preview-login] no working login route found');
  process.exitCode = 2;
})();
