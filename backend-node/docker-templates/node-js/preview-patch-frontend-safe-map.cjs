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
  return `(Array.isArray(${e})?${e}:(${e}&&(Array.isArray(${e}.data)?${e}.data:Array.isArray(${e}.items)?${e}.items:Array.isArray(${e}.users)?${e}.users:Array.isArray(${e}.results)?${e}.results:Array.isArray(${e}.rows)?${e}.rows:Array.isArray(${e}.list)?${e}.list:[]))||[])`;
}

function patchContent(content) {
  let next = content;
  const before = content;

  // response.data.map( / res.data.map( / data.map( when likely API payload
  next = next.replace(
    /\b((?:response|res|result|payload|json|body|r)\.data)\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );

  // setX(something); later x.map — hard; instead fix: users.map / items.map after common fetch assigns
  next = next.replace(
    /\b((?:users|items|rows|results|list|products|orders|posts|comments|notifications|appointments|patients|doctors|bookings|services|categories|projects|tasks|tickets|messages|invoices|payments|transactions|stats|charts|series|labels)\s*)\.map\s*\(/gi,
    (match, name) => {
      const n = name.trim();
      // Avoid double-wrapping
      if (match.includes('Array.isArray')) return match;
      return `${ensureSafeArrayExpr(n)}.map(`;
    }
  );

  // Optional chaining forms: data?.map( already safe-ish but data.map without ?
  // (await api.get(...)).data.map(
  next = next.replace(
    /\)\.data\.map\s*\(/g,
    `).(d=>${ensureSafeArrayExpr('d')}).map(`
  );
  // Fix botched replace above — `).(d=>...).map(` is wrong after `).data.map`
  // Revert that specific bad pattern if we introduced it incorrectly.
  // Better dedicated replace:
  next = before; // reset and apply carefully

  next = next.replace(
    /\b((?:response|res|result|payload|json|body|r)\.data)\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );

  next = next.replace(
    /\b(users|items|rows|results|list|products|orders|posts|comments|notifications|appointments|patients|doctors|bookings|services|categories|projects|tasks|tickets|messages|invoices|payments|transactions|stats)\.map\s*\(/g,
    (_, name) => `${ensureSafeArrayExpr(name)}.map(`
  );

  // Any identifier.data.map / foo.items.map
  next = next.replace(
    /\b([A-Za-z_$][\w$]*\.(?:data|items|users|results|list|rows|records))\s*\.map\s*\(/g,
    (_, expr) => `${ensureSafeArrayExpr(expr)}.map(`
  );

  // setX(await …) style: (await fetchJson()).map — rare
  next = next.replace(
    /(\w+)\s*=\s*(?:await\s+)?(?:res|response|result)\.data\b/g,
    (full) => full // keep assignment; map sites handled above
  );

  // setState(res.data) common — leave alone

  // Inject helper once near top if file uses .map and looks like a page/component
  if (next !== before && !next.includes('__svSafeArray') && /\breturn\s*\(|createElement|jsx|<[A-Z]/.test(next)) {
    const helper =
      "const __svSafeArray=(v)=>Array.isArray(v)?v:(v&&(Array.isArray(v.data)?v.data:Array.isArray(v.items)?v.items:Array.isArray(v.users)?v.users:Array.isArray(v.results)?v.results:Array.isArray(v.rows)?v.rows:Array.isArray(v.list)?v.list:[]))||[];\n";
    // Prefer after imports
    const importBlock = next.match(/^(?:import[\s\S]*?;\s*)+/m);
    if (importBlock) {
      const end = importBlock[0].length;
      next = next.slice(0, end) + helper + next.slice(end);
    } else {
      next = helper + next;
    }
    // Optionally rewrite ensureSafeArrayExpr usages to __svSafeArray(...) for readability — already inlined
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
  for (const k of ['data', 'items', 'users', 'results', 'rows', 'list', 'records', 'docs']) {
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
