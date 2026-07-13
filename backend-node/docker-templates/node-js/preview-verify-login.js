#!/usr/bin/env node
/**
 * POST test login against the student API inside the preview container.
 */
const http = require('http');

const email = String(process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo')
  .toLowerCase()
  .trim();
const password = String(process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!');
const port = Number(process.env.API_PORT || process.env.PORT || 5000);

const paths = [
  '/api/users/login',
  '/api/auth/login',
  '/api/login',
  '/users/login',
  '/auth/login',
];

const bodies = [
  { email, password },
  { email, passcode: password },
  { username: email, password },
  { identifier: email, password },
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
        res.resume();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, path });
      }
    );
    req.on('error', (err) => resolve({ ok: false, status: 0, path, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, path, error: 'timeout' });
    });
    req.write(payload);
    req.end();
  });
}

(async () => {
  for (const path of paths) {
    for (const body of bodies) {
      // eslint-disable-next-line no-await-in-loop
      const result = await post(path, body);
      if (result.ok) {
        console.log(`[preview-login] OK ${path} status=${result.status}`);
        return;
      }
      if (result.status === 400 || result.status === 401 || result.status === 403) {
        console.log(`[preview-login] invalid credentials ${path} status=${result.status}`);
        process.exitCode = 1;
        return;
      }
    }
  }
  console.log('[preview-login] no working login route found');
  process.exitCode = 2;
})();
