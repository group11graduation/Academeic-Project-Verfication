#!/usr/bin/env node
/* Ensure scholarverify-preview-cors.cjs is required from Express entry files. */
'use strict';
const fs = require('fs');
const path = require('path');

const MARKER = 'scholarverify-preview-cors-v9';
const GUARD_MARKER = 'scholarverify-mongo-guard-v7';
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
  'backend/index.js',
  'backend/src/server.js',
  'Backend/server.js',
  'Backend/index.js',
  'Backend/src/server.js',
];

function injectGuardsAtTop(content, requirePath) {
  if (content.includes(GUARD_MARKER)) {
    return { content, changed: false };
  }
  const isEsm =
    /\bimport\s+.+from\s+['"]/.test(content) ||
    /\bexport\s+(default|const|function|class|\{)/.test(content);

  let line;
  if (isEsm) {
    let next = content;
    if (!/createRequire\s+as\s+__svCreateRequire/.test(next)) {
      next = `import { createRequire as __svCreateRequire } from 'node:module';\n${next}`;
    }
    line = `try { __svCreateRequire(import.meta.url)(${JSON.stringify(requirePath)}).installPreviewRuntimeGuards(); } catch (_sv) { /* ${GUARD_MARKER} */ }\n`;
    return { content: line + next, changed: true };
  }
  line = `try { require(${JSON.stringify(requirePath)}).installPreviewRuntimeGuards(); } catch (_sv) { /* ${GUARD_MARKER} */ }\n`;
  return { content: line + content, changed: true };
}

function inject(content, requirePath) {
  let next = content;
  const hasInjectCall = /installPreviewCorsFix\s*\(\s*app\s*\)/.test(next);
  const isEsm =
    /\bimport\s+.+from\s+['"]/.test(next) ||
    /\bexport\s+(default|const|function|class|\{)/.test(next);

  if (hasInjectCall) {
    let upgraded = next;
    if (/scholarverify-preview-cors-v\d+/.test(upgraded) && !upgraded.includes(MARKER)) {
      upgraded = upgraded.replace(/scholarverify-preview-cors-v\d+/g, MARKER);
    }
    if (isEsm && !/createRequire\s+as\s+__svCreateRequire/.test(upgraded)) {
      upgraded = `import { createRequire as __svCreateRequire } from 'node:module';\n${upgraded}`;
    }
    return { content: upgraded, changed: upgraded !== content };
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
  let reqPath = path.relative(path.dirname(abs), corsAbs).replace(/\\/g, '/');
  if (!reqPath.startsWith('.')) reqPath = `./${reqPath}`;

  // Always try to install mongo guards at file top (even without express).
  const guard = injectGuardsAtTop(content, reqPath);
  content = guard.content;
  if (guard.changed) {
    changedFiles += 1;
    console.log('[preview-inject] mongo guards →', rel);
  }

  if (!/\bapp\b/.test(content) || !/\bexpress\b/.test(content)) {
    if (guard.changed) {
      try {
        fs.writeFileSync(abs, content, 'utf8');
      } catch (_e) {
        /* ignore */
      }
    }
    continue;
  }

  const result = inject(content, reqPath);
  if (result.changed || guard.changed) {
    fs.writeFileSync(abs, result.changed ? result.content : content, 'utf8');
    if (result.changed) {
      changedFiles += 1;
      console.log('[preview-inject] injected into', rel);
    }
  }
}

if (!changedFiles) {
  console.log('[preview-inject] inject already present or no express entry found');
}
