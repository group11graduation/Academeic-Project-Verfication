#!/usr/bin/env node
/**
 * ScholarVerify preview — harden student React frontends before Vite/CRA build.
 * Fixes common "x.map is not a function" / ".length of undefined" crashes.
 *
 * CRITICAL: never rewrite the bare name inside `state.students.length` as
 * `state.(Array.isArray(students)?…).length` — that is invalid JSX and blanks
 * React-only Vite previews (Students.jsx / Exams.jsx 500 Expected ident).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out']);
const LIST_NAMES =
  'users|items|rows|results|list|products|orders|posts|comments|notifications|appointments|patients|doctors|bookings|services|categories|projects|tasks|tickets|messages|invoices|payments|transactions|stats|books|bookList|allBooks|bookData|students|studentList|docs';

function walk(dir, out = [], depth = 0) {
  if (depth > 10) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out, depth + 1);
    else if (/\.(jsx?|tsx?|mjs|cjs)$/i.test(ent.name)) out.push(full);
  }
  return out;
}

function ensureSafeArrayExpr(expr) {
  const e = String(expr).trim();
  return `(Array.isArray(${e})?${e}:(${e}&&(Array.isArray(${e}.data)?${e}.data:Array.isArray(${e}.items)?${e}.items:Array.isArray(${e}.users)?${e}.users:Array.isArray(${e}.students)?${e}.students:Array.isArray(${e}.results)?${e}.results:Array.isArray(${e}.rows)?${e}.rows:Array.isArray(${e}.list)?${e}.list:Array.isArray(${e}.docs)?${e}.docs:[]))||[])`;
}

function ensureSafeLengthExpr(expr) {
  return `((${ensureSafeArrayExpr(expr)}).length)`;
}

/** Undo corrupt rewrites from older patch versions. */
function repairBrokenSafeMap(content) {
  let next = String(content || '');
  next = next.replace(
    /(\w+)\.\(\(\(Array\.isArray\((students|users|items|rows|results|list|products|orders|categories|books|docs|studentList)\)[\s\S]*?\|\|\[\]\)\)\.length\)/g,
    (_, obj, key) => ensureSafeLengthExpr(`${obj}.${key}`)
  );
  next = next.replace(
    /(\w+)\.\(Array\.isArray\((students|users|items|rows|results|list|products|orders|categories|books|docs|studentList)\)[\s\S]*?\|\|\[\]\)\.map\s*\(/g,
    (_, obj, key) => `${ensureSafeArrayExpr(`${obj}.${key}`)}.map(`
  );
  next = next.replace(
    /\(\(\(Array\.isArray\((students|users|items|rows|results|list)\)[\s\S]*?\|\|\[\]\)\)\.length\)/g,
    (_, key) => ensureSafeLengthExpr(key)
  );
  return next;
}

function patchContent(content) {
  let next = repairBrokenSafeMap(content);
  const before = next;

  next = next.replace(
    new RegExp(
      `\\b((?:state|props|this\\.state|data|store|ctx|context)\\.(?:${LIST_NAMES}))\\s*\\.map\\s*\\(`,
      'g'
    ),
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );
  next = next.replace(
    new RegExp(
      `\\b((?:state|props|this\\.state|data|store|ctx|context)\\.(?:${LIST_NAMES}))\\s*\\.length\\b`,
      'g'
    ),
    (_, expr) => ensureSafeLengthExpr(expr)
  );

  next = next.replace(
    /\b((?:response|res|result|payload|json|body|r)\.data)\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );
  next = next.replace(
    /\b((?:response|res|result|payload|json|body|r)\.data)\s*\.length\b/g,
    (_, expr) => ensureSafeLengthExpr(expr)
  );

  next = next.replace(
    /\b([A-Za-z_$][\w$]*\.(?:data|items|users|students|results|list|rows|records|docs))\s*\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );
  next = next.replace(
    /\b([A-Za-z_$][\w$]*\.(?:data|items|users|students|results|list|rows|records|docs))\s*\.length\b/g,
    (_, expr) => ensureSafeLengthExpr(expr)
  );

  // Bare listName.map / .length — NOT when preceded by a dot (obj.students).
  next = next.replace(
    new RegExp(`(?<![.\\w$])(${LIST_NAMES})\\.map\\s*\\(`, 'g'),
    (_, name) => `${ensureSafeArrayExpr(name)}.map(`
  );
  next = next.replace(
    new RegExp(`(?<![.\\w$])(${LIST_NAMES})\\.length\\b`, 'g'),
    (_, name) => ensureSafeLengthExpr(name)
  );

  if (next !== before && !next.includes('__svSafeArray') && /\breturn\s*\(|createElement|jsx|<[A-Z]/.test(next)) {
    const helper =
      "const __svSafeArray=(v)=>Array.isArray(v)?v:(v&&(Array.isArray(v.data)?v.data:Array.isArray(v.items)?v.items:Array.isArray(v.users)?v.users:Array.isArray(v.students)?v.students:Array.isArray(v.results)?v.results:Array.isArray(v.rows)?v.rows:Array.isArray(v.list)?v.list:Array.isArray(v.docs)?v.docs:[]))||[];\n";
    const importBlock = next.match(/^(?:import[\s\S]*?;\s*)+/m);
    if (importBlock) {
      const end = importBlock[0].length;
      next = next.slice(0, end) + helper + next.slice(end);
    } else {
      next = helper + next;
    }
  }

  return next;
}

function injectRuntimeHelper(frontendRoot) {
  const helperPath = path.join(frontendRoot, 'src', 'sv-preview-safe-array.js');
  const srcDir = path.join(frontendRoot, 'src');
  if (!fs.existsSync(srcDir)) return false;

  const helper = `/* ScholarVerify preview helper — safe list unwrap */
export function svSafeArray(v) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  for (const k of ['data', 'items', 'users', 'students', 'results', 'rows', 'list', 'records', 'docs', 'books', 'products', 'orders']) {
    if (Array.isArray(v[k])) return v[k];
  }
  if (v.data && typeof v.data === 'object') {
    for (const k of ['items', 'users', 'students', 'results', 'rows', 'list']) {
      if (Array.isArray(v.data[k])) return v.data[k];
    }
  }
  return [];
}
export default svSafeArray;
`;

  fs.mkdirSync(path.dirname(helperPath), { recursive: true });
  fs.writeFileSync(helperPath, helper, 'utf8');

  for (const entry of ['main.jsx', 'main.tsx', 'main.js', 'index.jsx', 'index.tsx', 'index.js', 'App.jsx', 'App.tsx']) {
    const p = path.join(srcDir, entry);
    if (!fs.existsSync(p)) continue;
    let body = fs.readFileSync(p, 'utf8');
    if (body.includes('sv-preview-safe-array')) return true;
    body = `import './sv-preview-safe-array';\n` + body;
    fs.writeFileSync(p, body, 'utf8');
    return true;
  }
  return true;
}

function main() {
  const root = path.resolve(ROOT);
  if (!fs.existsSync(root)) {
    console.log('[preview-safe-map] skip — root missing', root);
    return;
  }
  const files = walk(root);
  let changed = 0;
  for (const file of files) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const next = patchContent(src);
    if (next !== src) {
      try {
        fs.writeFileSync(file, next, 'utf8');
        changed += 1;
        console.log('[preview-safe-map] patched', path.relative(root, file));
      } catch (_e) {
        /* ignore */
      }
    }
  }
  try {
    injectRuntimeHelper(root);
  } catch (_e) {
    /* ignore */
  }
  console.log('[preview-safe-map] done — files changed:', changed);
}

if (require.main === module) {
  main();
}

module.exports = { patchContent, repairBrokenSafeMap, ensureSafeArrayExpr };
