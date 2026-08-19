#!/usr/bin/env node
/**
 * Loaded via NODE_OPTIONS=--require before any student code.
 * Forces mongoose/MongoClient to use the preview sandbox Mongo URI (never Atlas).
 */
'use strict';

try {
  // Prefer the copy installed into the student project (same require graph as the app).
  const path = require('path');
  const fs = require('fs');
  const candidates = [
    path.join(process.cwd(), 'scholarverify-preview-cors.cjs'),
    '/preview-safety.cjs',
  ];
  let mod = null;
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        mod = require(p);
        break;
      }
    } catch (_e) {
      /* try next */
    }
  }
  if (mod && typeof mod.installPreviewRuntimeGuards === 'function') {
    mod.installPreviewRuntimeGuards();
    if (!global.__svMongoPreloadLogged) {
      global.__svMongoPreloadLogged = true;
      console.log('[preview] mongo sandbox preload active');
    }
  }
} catch (err) {
  console.warn(
    '[preview] mongo sandbox preload failed:',
    err && err.message ? err.message : err
  );
}
