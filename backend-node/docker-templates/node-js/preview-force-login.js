#!/usr/bin/env node
/**
 * Gateway fallback when student Express rejects admin/admin123.
 * Reads login JSON from stdin, upserts preview admin in Mongo, prints login JSON.
 */
'use strict';

const path = require('path');
const Module = require('module');
const fs = require('fs');

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (_e) {
    body = {};
  }

  const searchDirs = [
    process.env.PREVIEW_BACKEND_CWD,
    process.env.BACKEND_CWD,
    process.cwd(),
    '/app/backend',
    '/app/server',
    '/app/Backend',
    '/app',
  ].filter(Boolean);

  for (const dir of searchDirs) {
    try {
      const pkg = path.join(dir, 'package.json');
      const nm = path.join(dir, 'node_modules');
      if (fs.existsSync(nm) || fs.existsSync(pkg)) {
        process.chdir(dir);
        const nodePath = [nm, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
        process.env.NODE_PATH = nodePath;
        Module._initPaths();
        break;
      }
    } catch (_e) {
      /* next */
    }
  }

  let safety;
  try {
    safety = require('/preview-safety.cjs');
  } catch (_e) {
    safety = require('./preview-safety.cjs');
  }
  if (!safety || typeof safety.forcePreviewLogin !== 'function') {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        status: 500,
        body: { message: 'forcePreviewLogin unavailable', error: 'no_export' },
      })
    );
    process.exit(0);
    return;
  }

  const result = await safety.forcePreviewLogin(body);
  process.stdout.write(JSON.stringify(result || { ok: false, status: 500, body: {} }));
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      status: 500,
      body: {
        message: 'Preview force login failed',
        detail: String((err && err.message) || err),
      },
    })
  );
});
