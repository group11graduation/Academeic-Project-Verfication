/**
 * Build evidence for pre-upload consistency check (declared vs detected tech + README/routes/models).
 * Reuses filesystem walks; does not duplicate ZIP extraction.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'vendor',
  'target',
  'dist',
  'build',
  '.idea',
  '.vscode',
  '__pycache__',
  '.next',
  'coverage',
]);

const ROUTE_PATTERNS = [
  /\bapp\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/i,
  /\brouter\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/i,
  /@(Get|Post|Put|Patch|Delete|RequestMapping)\s*\(\s*(?:value\s*=\s*)?['"`]([^'"`]+)['"`]/i,
  /Route::(get|post|put|patch|delete|any|match)\s*\(\s*['"`]([^'"`]+)['"`]/i,
  /\@(app|bp)\.(route|get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/i,
];

const MODEL_PATTERNS = [
  /\b(mongoose\.)?Schema\s*\(/i,
  /\bmodel\s*\(\s*['"`]([^'"`]+)['"`]/i,
  /class\s+(\w+)\s+extends\s+Model\b/i,
  /@Entity\b/i,
  /class\s+(\w+)\s*\(.*Base\b/i,
  /Schema::create\s*\(\s*['"`]([^'"`]+)['"`]/i,
  /class\s+(\w+)\s+extends\s+Eloquent/i,
  /class\s+(\w+)\s*\(.*db\.Model\b/i,
];

const CODE_EXTS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.php',
  '.java',
  '.py',
  '.go',
  '.rb',
]);

async function walkFiles(root, { maxFiles = 120 } = {}) {
  const out = [];
  async function walk(dir) {
    if (out.length >= maxFiles) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (out.length >= maxFiles) return;
      const name = ent.name;
      if (name.startsWith('.') && name !== '.env.example') continue;
      if (ent.isDirectory()) {
        if (SKIP_DIR_NAMES.has(name.toLowerCase())) continue;
        await walk(path.join(dir, name));
        continue;
      }
      out.push(path.join(dir, name));
    }
  }
  await walk(root);
  return out;
}

function pushUnique(list, value, max = 80) {
  const v = String(value || '').trim();
  if (!v) return;
  const key = v.toLowerCase();
  if (list.some((x) => x.toLowerCase() === key)) return;
  if (list.length < max) list.push(v);
}

function parsePackageJsonDeps(raw) {
  const out = [];
  try {
    const pkg = JSON.parse(raw);
    for (const block of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
      if (!block || typeof block !== 'object') continue;
      for (const name of Object.keys(block)) pushUnique(out, name, 120);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function parseRequirementsTxt(raw) {
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
    const name = trimmed.split(/[<=>!~;\s\[]/)[0];
    pushUnique(out, name, 120);
  }
  return out;
}

function parseComposerJsonDeps(raw) {
  const out = [];
  try {
    const pkg = JSON.parse(raw);
    for (const block of [pkg.require, pkg['require-dev']]) {
      if (!block || typeof block !== 'object') continue;
      for (const name of Object.keys(block)) {
        if (name === 'php') continue;
        pushUnique(out, name, 120);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function parsePomXmlArtifacts(raw) {
  const out = [];
  const text = String(raw || '');
  const re = /<artifactId>\s*([^<]+)\s*<\/artifactId>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    pushUnique(out, m[1].trim(), 120);
  }
  return out;
}

/**
 * Flat dependency / tech tokens from common manifest files under extractDir.
 * @returns {Promise<string[]>}
 */
export async function extractDependencies(extractDir) {
  if (!extractDir || !fsSync.existsSync(extractDir)) return [];
  const files = await walkFiles(extractDir, { maxFiles: 200 });
  const deps = [];

  for (const abs of files) {
    const base = path.basename(abs).toLowerCase();
    let raw = '';
    try {
      if (base === 'package.json' || base === 'composer.json' || base === 'requirements.txt' || base === 'pom.xml') {
        raw = await fs.readFile(abs, 'utf8');
      } else {
        continue;
      }
    } catch {
      continue;
    }

    if (base === 'package.json') parsePackageJsonDeps(raw).forEach((d) => pushUnique(deps, d, 200));
    else if (base === 'requirements.txt') parseRequirementsTxt(raw).forEach((d) => pushUnique(deps, d, 200));
    else if (base === 'composer.json') parseComposerJsonDeps(raw).forEach((d) => pushUnique(deps, d, 200));
    else if (base === 'pom.xml') parsePomXmlArtifacts(raw).forEach((d) => pushUnique(deps, d, 200));
  }

  return deps;
}

async function readReadmeText(extractDir) {
  const files = await walkFiles(extractDir, { maxFiles: 80 });
  const readme = files.find((f) => /^readme(\.(md|txt|rst))?$/i.test(path.basename(f)));
  if (!readme) return '';
  try {
    const raw = await fs.readFile(readme, 'utf8');
    return raw.slice(0, 8000);
  } catch {
    return '';
  }
}

/**
 * @returns {Promise<{ readme_text: string, routes: string[], models: string[], detected_tech: string[] }>}
 */
export async function buildConsistencyEvidenceBundle(extractDir) {
  const detected_tech = await extractDependencies(extractDir);
  const readme_text = await readReadmeText(extractDir);
  const routes = [];
  const models = [];

  const files = await walkFiles(extractDir, { maxFiles: 100 });
  for (const abs of files) {
    const ext = path.extname(abs).toLowerCase();
    if (!CODE_EXTS.has(ext)) continue;
    let raw = '';
    try {
      const st = await fs.stat(abs);
      if (st.size > 80_000) continue;
      raw = await fs.readFile(abs, 'utf8');
    } catch {
      continue;
    }
    const sample = raw.slice(0, 40_000);
    for (const re of ROUTE_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(sample)) !== null) {
        pushUnique(routes, m[2] || m[0], 40);
      }
    }
    for (const re of MODEL_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(sample)) !== null) {
        pushUnique(models, m[1] || path.basename(abs, ext), 40);
      }
    }
  }

  return { detected_tech, readme_text, routes, models };
}
