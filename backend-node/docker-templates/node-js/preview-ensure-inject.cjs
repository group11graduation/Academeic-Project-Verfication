#!/usr/bin/env node
/* Ensure scholarverify-preview-cors.cjs is required from Express entry files. */
'use strict';
const fs = require('fs');
const path = require('path');

const MARKER = 'scholarverify-preview-cors-v4';
const CORS_FILE = 'scholarverify-preview-cors.cjs';
const root = process.argv[2] || process.cwd();
const corsAbs = path.join(root, CORS_FILE);

if (!fs.existsSync(corsAbs)) {
  console.log('[preview-inject] no', CORS_FILE, '— skip');
  process.exit(0);
}

const candidates = [
  'server.js',
  'index.js',
  'app.js',
  'src/server.js',
  'src/index.js',
  'src/app.js',
  'backend/server.js',
  'backend/src/server.js',
];

function inject(content, requirePath) {
  let next = content;
  const hasInjectCall = /installPreviewCorsFix\s*\(\s*app\s*\)/.test(next);
  const isEsm =
    /\bimport\s+.+from\s+['"]/.test(next) ||
    /\bexport\s+(default|const|function|class|\{)/.test(next);

  if (hasInjectCall && next.includes(MARKER)) {
    if (isEsm && !/createRequire\s+as\s+__svCreateRequire/.test(next)) {
      next = `import { createRequire as __svCreateRequire } from 'node:module';\n${next}`;
      return { content: next, changed: true };
    }
    return { content: next, changed: false };
  }

  let line;
  if (isEsm) {
    if (!/createRequire\s+as\s+__svCreateRequire/.test(next)) {
      next = `import { createRequire as __svCreateRequire } from 'node:module';\n${next}`;
    }
    line = `try { __svCreateRequire(import.meta.url)(${JSON.stringify(requirePath)}).installPreviewCorsFix(app); } catch (_sv) { /* ${MARKER} */ }\n`;
  } else {
    line = `try { require(${JSON.stringify(requirePath)}).installPreviewCorsFix(app); } catch (_sv) { /* ${MARKER} */ }\n`;
  }

  const expressAppRe = /(const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/;
  if (expressAppRe.test(next)) {
    return { content: next.replace(expressAppRe, (m) => `${m}\n${line}`), changed: true };
  }
  const corsUseRe = /(app\.use\(\s*cors\s*\([^)]*\)\s*\)\s*;?)/;
  if (corsUseRe.test(next)) {
    return { content: next.replace(corsUseRe, `${line}$1`), changed: true };
  }
  const jsonRe = /(app\.use\(\s*express\.json\([^)]*\)\s*\)\s*;?)/;
  if (jsonRe.test(next)) {
    return { content: next.replace(jsonRe, `${line}$1`), changed: true };
  }
  const listenRe = /(\n)((?:const|let|var)\s+\w+\s*=\s*)?app\.listen\(/;
  if (listenRe.test(next)) {
    return { content: next.replace(listenRe, `$1${line}$2app.listen(`), changed: true };
  }
  if (/\bapp\b/.test(next)) {
    return { content: `${line}${next}`, changed: true };
  }
  return { content: next, changed: false };
}

let changedFiles = 0;
for (const rel of candidates) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  if (!/\bapp\b/.test(content) || !/\bexpress\b/.test(content)) continue;
  let reqPath = path.relative(path.dirname(abs), corsAbs).replace(/\\/g, '/');
  if (!reqPath.startsWith('.')) reqPath = `./${reqPath}`;
  const result = inject(content, reqPath);
  if (result.changed) {
    fs.writeFileSync(abs, result.content, 'utf8');
    changedFiles += 1;
    console.log('[preview-inject] injected into', rel);
  }
}

if (!changedFiles) {
  console.log('[preview-inject] inject already present or no express entry found');
}
