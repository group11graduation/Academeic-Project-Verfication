import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** backend-node/ */
const backendRoot = path.resolve(__dirname, '../..');
/** monorepo root */
const monorepoRoot = path.resolve(backendRoot, '..');

function tryLoadEnvFile(filePath, { override = false } = {}) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return false;
  loadDotenv({ path: resolved, override });
  return true;
}

function applyFileBackedSecret(envName) {
  if (process.env[envName] && String(process.env[envName]).trim()) return;
  const filePath = process.env[`${envName}_FILE`];
  if (!filePath) return;
  try {
    const value = fs.readFileSync(filePath, 'utf8').trim();
    if (value) process.env[envName] = value;
  } catch {
    // Ignore invalid secret-file paths; auth validation will fail with a clear message.
  }
}

/**
 * Parse KEY=VALUE lines from a .env-style file (no expansion).
 * Used to fill empty EMAIL/SMTP keys even when compose injected blanks.
 */
function readEnvFileKeys(filePath) {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return {};
    const text = fs.readFileSync(resolved, 'utf8');
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Keys that must not stay empty when a local env file has them filled. */
const CRITICAL_EMAIL_KEYS = [
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_SECURE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_SECURE',
  'SMTP_FROM',
  'APP_NAME',
  'FRONTEND_URL',
];

/**
 * Fill empty / missing process.env email keys from any on-disk env file.
 * Fixes Docker/Coolify injecting SMTP_USER="" which would otherwise win forever.
 */
function fillEmptyCriticalKeysFromFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!filePath) continue;
    const parsed = readEnvFileKeys(filePath);
    for (const key of CRITICAL_EMAIL_KEYS) {
      const current = process.env[key];
      if (current !== undefined && String(current).trim() !== '') continue;
      if (parsed[key] !== undefined && String(parsed[key]).trim() !== '') {
        process.env[key] = String(parsed[key]).trim();
      }
    }
  }
}

const candidateEnvFiles = [
  process.env.DOTENV_CONFIG_PATH,
  path.join(backendRoot, 'runtime.env'),
  path.join(backendRoot, '.env'),
  '/app/.env',
  path.resolve(monorepoRoot, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend-node/.env'),
  path.resolve(process.cwd(), 'backend-node/runtime.env'),
];

// Load first existing file (standard dotenv), then layer more files without override.
let loadedAny = false;
for (const filePath of candidateEnvFiles) {
  if (!tryLoadEnvFile(filePath, { override: false })) continue;
  loadedAny = true;
}
// Always re-scan critical email keys so empty shell envs don't kill Gmail.
fillEmptyCriticalKeysFromFiles(candidateEnvFiles);

if (!loadedAny && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn('[env] No .env / runtime.env file found; relying on process environment only');
}

applyFileBackedSecret('JWT_SECRET');
applyFileBackedSecret('JWT_REFRESH_SECRET');

// Mirror EMAIL_* ↔ SMTP_* so either naming works everywhere.
if (!String(process.env.SMTP_HOST || '').trim() && process.env.EMAIL_HOST) {
  process.env.SMTP_HOST = process.env.EMAIL_HOST;
}
if (!String(process.env.SMTP_PORT || '').trim() && process.env.EMAIL_PORT) {
  process.env.SMTP_PORT = process.env.EMAIL_PORT;
}
if (!String(process.env.SMTP_USER || '').trim() && process.env.EMAIL_USER) {
  process.env.SMTP_USER = process.env.EMAIL_USER;
}
if (!String(process.env.SMTP_PASS || '').trim() && process.env.EMAIL_PASS) {
  process.env.SMTP_PASS = process.env.EMAIL_PASS;
}
if (!String(process.env.EMAIL_HOST || '').trim() && process.env.SMTP_HOST) {
  process.env.EMAIL_HOST = process.env.SMTP_HOST;
}
if (!String(process.env.EMAIL_PORT || '').trim() && process.env.SMTP_PORT) {
  process.env.EMAIL_PORT = process.env.SMTP_PORT;
}
if (!String(process.env.EMAIL_USER || '').trim() && process.env.SMTP_USER) {
  process.env.EMAIL_USER = process.env.SMTP_USER;
}
if (!String(process.env.EMAIL_PASS || '').trim() && process.env.SMTP_PASS) {
  process.env.EMAIL_PASS = process.env.SMTP_PASS;
}
