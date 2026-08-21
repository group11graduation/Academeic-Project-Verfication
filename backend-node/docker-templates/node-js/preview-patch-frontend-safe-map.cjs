#!/usr/bin/env node
/**
 * ScholarVerify preview — harden student React frontends before Vite/CRA build.
 * Fixes common "x.map is not a function" crashes when APIs return objects
 * ({ data: [...] }, { users: [...] }) instead of bare arrays.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out']);

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

function patchContent(content) {
  let next = content;
  const before = content;

  // response.data.map( / res.data.map(
  next = next.replace(
    /\b((?:response|res|result|payload|json|body|r)\.data)\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );

  next = next.replace(
    /\b(users|items|rows|results|list|products|orders|posts|comments|notifications|appointments|patients|doctors|bookings|services|categories|projects|tasks|tickets|messages|invoices|payments|transactions|stats|books|bookList|allBooks|bookData|students|studentList)\.map\s*\(/g,
    (_, name) => `${ensureSafeArrayExpr(name)}.map(`
  );

  // identifier.data.map / foo.items.map
  next = next.replace(
    /\b([A-Za-z_$][\w$]*\.(?:data|items|users|students|results|list|rows|records|docs))\s*\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );

  // DropSafe blank page: students.length / data.length / res.data.length when undefined
  next = next.replace(
    /\b((?:students|studentList|users|items|rows|results|list|products|orders|categories|books|docs))\s*\.length\b/g,
    (_, name) => ensureSafeLengthExpr(name)
  );
  next = next.replace(
    /\b((?:response|res|result|payload|json|body|r)\.data)\s*\.length\b/g,
    (_, expr) => ensureSafeLengthExpr(expr)
  );
  next = next.replace(
    /\b([A-Za-z_$][\w$]*\.data)\s*\.length\b/g,
    (_, expr) => ensureSafeLengthExpr(expr)
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
  for (const k of ['data', 'items', 'users', 'results', 'rows', 'list', 'records', 'docs', 'books', 'products', 'orders']) {
    if (Array.isArray(v[k])) return v[k];
  }
  if (v.data && typeof v.data === 'object') {
    for (const k of ['items', 'users', 'results', 'rows', 'list']) {
      if (Array.isArray(v.data[k])) return v.data[k];
    }
  }
  return [];
}

export default svSafeArray;

try {
  if (typeof window !== 'undefined') {
    window.__svSafeArray = svSafeArray;
    // Soft-patch Array.prototype usage is too dangerous — instead patch axios if present after load
    const installAxios = () => {
      try {
        const ax = window.axios;
        if (!ax || ax.__svSafeArray) return;
        ax.interceptors.response.use((res) => {
          try {
            if (res && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
              const unwrapped = svSafeArray(res.data);
              // Only attach helper; don't replace data (would break object responses)
              res.data.__svList = unwrapped;
            }
          } catch (_e) {}
          return res;
        });
        ax.__svSafeArray = true;
      } catch (_e) {}
    };
    installAxios();
    setTimeout(installAxios, 0);
    setTimeout(installAxios, 500);
  }
} catch (_e) {}
`;

  fs.mkdirSync(path.dirname(helperPath), { recursive: true });
  fs.writeFileSync(helperPath, helper, 'utf8');

  // Import from main entry
  for (const entry of ['main.jsx', 'main.tsx', 'main.js', 'index.jsx', 'index.tsx', 'index.js', 'App.jsx', 'App.tsx']) {
    const p = path.join(srcDir, entry);
    if (!fs.existsSync(p)) continue;
    let body = fs.readFileSync(p, 'utf8');
    if (body.includes('sv-preview-safe-array')) return true;
    const importLine = `import './sv-preview-safe-array';\n`;
    body = importLine + body;
    fs.writeFileSync(p, body, 'utf8');
    return true;
  }
  return true;
}

function main() {
  const root = path.resolve(ROOT);
  if (!fs.existsSync(root)) {
    console.log('[preview-patch-frontend] skip: missing ' + root);
    process.exit(0);
  }

  injectRuntimeHelper(root);

  const files = walk(root);
  let patched = 0;
  for (const file of files) {
    if (file.includes('sv-preview-safe-array')) continue;
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!/\.map\s*\(/.test(content)) continue;
    const next = patchContent(content);
    if (next !== content) {
      fs.writeFileSync(file, next, 'utf8');
      patched += 1;
      console.log('[preview-patch-frontend] patched ' + path.relative(root, file));
    }
  }
  console.log(`[preview-patch-frontend] done — ${patched} file(s) in ${root}`);
}

main();
