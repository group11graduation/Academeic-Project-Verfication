import fs from 'fs/promises';
import path from 'path';

const EMAIL_ENV_KEYS = [
  'ADMIN_EMAIL',
  'SEED_ADMIN_EMAIL',
  'DEFAULT_ADMIN_EMAIL',
  'DEMO_ADMIN_EMAIL',
  'SUPER_ADMIN_EMAIL',
  'TEST_ADMIN_EMAIL',
  'LOGIN_EMAIL',
];

const PASS_ENV_KEYS = [
  'ADMIN_PASSWORD',
  'SEED_ADMIN_PASSWORD',
  'DEFAULT_ADMIN_PASSWORD',
  'DEMO_ADMIN_PASSWORD',
  'SUPER_ADMIN_PASSWORD',
  'TEST_ADMIN_PASSWORD',
  'LOGIN_PASSWORD',
];

const ENV_FILE_NAMES = new Set(['.env', '.env.example', '.env.local', '.env.sample', 'env.example']);

function parseEnvFile(content) {
  const out = {};
  for (const line of String(content || '').split('\n')) {
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
}

function pickFromEnvMap(envMap) {
  let email = '';
  let password = '';
  for (const key of EMAIL_ENV_KEYS) {
    if (envMap[key]) {
      email = envMap[key];
      break;
    }
  }
  for (const key of PASS_ENV_KEYS) {
    if (envMap[key]) {
      password = envMap[key];
      break;
    }
  }
  return { email, password };
}

function parseReadmeHints(text) {
  const emailMatch = text.match(
    /(?:admin|default|demo|test)\s*(?:user|account|login)?\s*(?:email)?\s*[:=]\s*([^\s<>"']+@[^\s<>"']+)/i
  );
  const passMatch = text.match(
    /(?:admin|default|demo|test)\s*(?:user|account|login)?\s*password\s*[:=]\s*([^\s<>"']+)/i
  );
  return {
    email: emailMatch?.[1]?.trim() || '',
    password: passMatch?.[1]?.trim() || '',
  };
}

async function walkForEnvFiles(dir, found, depth = 0) {
  if (depth > 4 || found.length >= 12) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile() && ENV_FILE_NAMES.has(entry.name)) {
      found.push(full);
      continue;
    }
    if (entry.isDirectory() && depth < 4) {
      // eslint-disable-next-line no-await-in-loop
      await walkForEnvFiles(full, found, depth + 1);
    }
  }
}

/**
 * Scan extracted submission for common admin/demo credentials in .env* and README.
 */
export async function discoverPreviewCredentialsFromExtract(extractDir) {
  const envPaths = [];
  await walkForEnvFiles(extractDir, envPaths);

  let email = '';
  let password = '';
  let hint = '';

  for (const envPath of envPaths) {
    try {
      const content = await fs.readFile(envPath, 'utf8');
      const picked = pickFromEnvMap(parseEnvFile(content));
      if (picked.email && !email) email = picked.email;
      if (picked.password && !password) password = picked.password;
      if ((picked.email || picked.password) && !hint) {
        hint = `Found in ${path.basename(envPath)}`;
      }
    } catch {
      /* ignore */
    }
  }

  const readmeNames = ['README.md', 'readme.md', 'README.txt', 'SETUP.md'];
  for (const name of readmeNames) {
    const readmePath = path.join(extractDir, name);
    try {
      const text = await fs.readFile(readmePath, 'utf8');
      const picked = parseReadmeHints(text);
      if (picked.email && !email) email = picked.email;
      if (picked.password && !password) password = picked.password;
      if ((picked.email || picked.password) && !hint) hint = `Found in ${name}`;
    } catch {
      /* try nested once */
      try {
        const entries = await fs.readdir(extractDir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          const nested = path.join(extractDir, e.name, name);
          try {
            const text = await fs.readFile(nested, 'utf8');
            const picked = parseReadmeHints(text);
            if (picked.email && !email) email = picked.email;
            if (picked.password && !password) password = picked.password;
            if ((picked.email || picked.password) && !hint) hint = `Found in ${e.name}/${name}`;
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { email, password, hint };
}

export function resolvePreviewLoginCredentials({ teacherEmail, teacherPassword, discovered = {} } = {}) {
  const defaultEmail = process.env.PREVIEW_DEFAULT_ADMIN_EMAIL || 'admin@preview.demo';
  const defaultPassword = process.env.PREVIEW_DEFAULT_ADMIN_PASSWORD || 'Preview123!';

  const email = String(teacherEmail || discovered.email || defaultEmail).trim();
  const password = String(teacherPassword || discovered.password || defaultPassword).trim();

  let source = 'platform_default';
  if (teacherEmail || teacherPassword) source = 'teacher_provided';
  else if (discovered.email || discovered.password) source = 'project_files';

  const hint =
    discovered.hint ||
    (source === 'platform_default'
      ? 'Default preview login (override above or set PREVIEW_DEFAULT_ADMIN_* in server .env).'
      : '');

  return { email, password, source, hint };
}

/** Env vars injected into preview containers (many student apps read different names). */
export function buildPreviewCredentialEnvVars({ email, password, mongoUri = null }) {
  const pairs = {
    PREVIEW_ADMIN_EMAIL: email,
    PREVIEW_ADMIN_PASSWORD: password,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: password,
    DEMO_ADMIN_EMAIL: email,
    DEMO_ADMIN_PASSWORD: password,
    DEFAULT_ADMIN_EMAIL: email,
    DEFAULT_ADMIN_PASSWORD: password,
    // Common dev secrets so JWT auth can boot in sandbox
    JWT_SECRET: process.env.PREVIEW_JWT_SECRET || 'preview-sandbox-jwt-secret-change-me',
    NODE_ENV: 'development',
  };
  if (mongoUri) {
    pairs.MONGODB_URI = mongoUri;
    pairs.MONGO_URI = mongoUri;
    pairs.DATABASE_URL = mongoUri;
  }
  pairs.PREVIEW_SANDBOX = '1';
  return pairs;
}

export function buildPreviewLoginUrl(previewUrl) {
  const base = String(previewUrl || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/login`;
}
