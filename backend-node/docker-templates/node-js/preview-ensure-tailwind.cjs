#!/usr/bin/env node
/**
 * ScholarVerify preview — ensure Tailwind/PostCSS can produce CSS for Vite builds.
 * Universal for every student ZIP that uses Tailwind; no-ops for plain CSS projects.
 *
 * Common failure mode: UI renders but looks "unstyled" because:
 * - tailwind/postcss only in devDependencies and missing after install
 * - missing postcss.config / broken content paths → empty purged CSS
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || process.cwd());

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeIfMissing(filePath, contents) {
  if (fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, contents, 'utf8');
  return true;
}

function hasTailwindSignal(pkg) {
  if (!pkg) return false;
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (all.tailwindcss || all['@tailwindcss/vite'] || all['@tailwindcss/postcss']) return true;
  return false;
}

function cssMentionsTailwind() {
  for (const rel of ['src/index.css', 'src/App.css', 'src/styles.css', 'src/main.css', 'index.css']) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    try {
      const t = fs.readFileSync(p, 'utf8');
      if (/@tailwind|@import\s+['"]tailwindcss/.test(t)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function ensureCssHasTailwindDirectives() {
  const candidates = ['src/index.css', 'src/App.css', 'src/styles/index.css', 'index.css'];
  for (const rel of candidates) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    let t = fs.readFileSync(p, 'utf8');
    if (/@tailwind\s+base/.test(t) || /@import\s+['"]tailwindcss/.test(t)) return rel;
    // Prepend classic v3 directives — safe even if unused utilities exist elsewhere.
    t =
      '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + t;
    fs.writeFileSync(p, t, 'utf8');
    console.log('[preview-tailwind] prepended @tailwind directives to', rel);
    return rel;
  }
  // Create src/index.css if main entry imports it later; also try to hook main.jsx
  const cssPath = path.join(ROOT, 'src', 'index.css');
  if (!fs.existsSync(path.dirname(cssPath))) return null;
  fs.writeFileSync(
    cssPath,
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
    'utf8'
  );
  console.log('[preview-tailwind] created src/index.css with Tailwind directives');
  for (const entry of ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx', 'src/main.js']) {
    const ep = path.join(ROOT, entry);
    if (!fs.existsSync(ep)) continue;
    let body = fs.readFileSync(ep, 'utf8');
    if (/index\.css|App\.css|styles\.css/.test(body)) return 'src/index.css';
    body = `import './index.css';\n` + body;
    fs.writeFileSync(ep, body, 'utf8');
    console.log('[preview-tailwind] imported index.css from', entry);
    break;
  }
  return 'src/index.css';
}

function ensurePostcssConfig() {
  for (const name of ['postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.ts']) {
    if (fs.existsSync(path.join(ROOT, name))) return name;
  }
  const contents = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  writeIfMissing(path.join(ROOT, 'postcss.config.cjs'), contents);
  console.log('[preview-tailwind] wrote postcss.config.cjs');
  return 'postcss.config.cjs';
}

function ensureTailwindConfig() {
  for (const name of [
    'tailwind.config.js',
    'tailwind.config.cjs',
    'tailwind.config.mjs',
    'tailwind.config.ts',
  ]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    let t = fs.readFileSync(p, 'utf8');
    // Widen content globs if they look too narrow / wrong for Vite src layout.
    if (!/content\s*:/.test(t)) return name;
    if (!/\.\/src\//.test(t) && fs.existsSync(path.join(ROOT, 'src'))) {
      // Don't rewrite complex TS configs aggressively — only patch simple JS arrays.
      if (/content\s*:\s*\[([^\]]*)\]/.test(t) && !t.includes('tailwind.config.ts')) {
        t = t.replace(
          /content\s*:\s*\[([^\]]*)\]/,
          `content: ["./index.html","./src/**/*.{js,jsx,ts,tsx,vue}","./public/**/*.html"]`
        );
        fs.writeFileSync(p, t, 'utf8');
        console.log('[preview-tailwind] widened content paths in', name);
      }
    }
    return name;
  }
  const contents = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx,vue}",
    "./public/**/*.html",
  ],
  theme: { extend: {} },
  plugins: [],
};
`;
  writeIfMissing(path.join(ROOT, 'tailwind.config.cjs'), contents);
  console.log('[preview-tailwind] wrote tailwind.config.cjs');
  return 'tailwind.config.cjs';
}

function npmInstallPkgs(pkgs) {
  const r = spawnSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--legacy-peer-deps', ...pkgs],
    { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (r.status !== 0) {
    console.log('[preview-tailwind] npm install soft-fail', pkgs.join(' '));
    if (r.stderr) console.log(String(r.stderr).slice(0, 400));
    return false;
  }
  return true;
}

function main() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = readJson(pkgPath);
  if (!pkg) {
    console.log('[preview-tailwind] skip: no package.json');
    return;
  }

  const wants =
    hasTailwindSignal(pkg) ||
    cssMentionsTailwind() ||
    fs.existsSync(path.join(ROOT, 'tailwind.config.js')) ||
    fs.existsSync(path.join(ROOT, 'tailwind.config.cjs')) ||
    fs.existsSync(path.join(ROOT, 'tailwind.config.ts'));

  if (!wants) {
    console.log('[preview-tailwind] skip: not a Tailwind project');
    return;
  }

  console.log('[preview-tailwind] Tailwind project detected — ensuring build CSS works');

  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const need = [];
  if (!all.tailwindcss && !all['@tailwindcss/vite']) need.push('tailwindcss@3.4.17');
  if (!all.postcss) need.push('postcss@8.4.49');
  if (!all.autoprefixer) need.push('autoprefixer@10.4.20');
  if (need.length) {
    console.log('[preview-tailwind] installing', need.join(', '));
    npmInstallPkgs(need);
  }

  ensureTailwindConfig();
  ensurePostcssConfig();
  ensureCssHasTailwindDirectives();
  console.log('[preview-tailwind] ready');
}

main();
