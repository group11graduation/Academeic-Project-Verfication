import fs from 'fs/promises';
import path from 'path';
import { discoverPhpAdminCredentials, discoverPhpLoginPath } from './previewPhp.service.js';

const EMAIL_ENV_KEYS = [
  'ADMIN_EMAIL',
  'SEED_ADMIN_EMAIL',
  'DEFAULT_ADMIN_EMAIL',
  'DEMO_ADMIN_EMAIL',
  'SUPER_ADMIN_EMAIL',
  'TEST_ADMIN_EMAIL',
  'LOGIN_EMAIL',
];

const USERNAME_ENV_KEYS = [
  'ADMIN_USERNAME',
  'DEFAULT_ADMIN_USERNAME',
  'LOGIN_USERNAME',
  'ADMIN_USER',
  'USERNAME',
];

const ID_ENV_KEYS = ['STUDENT_ID', 'EMPLOYEE_ID', 'USER_ID', 'LOGIN_ID'];

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

const SEED_SCRIPT_NAMES = new Set([
  'createadmin.js',
  'seed.js',
  'seedusers.js',
  'seeddata.js',
  'initialseed.js',
  'bootstrap.js',
]);

function platformDefaultLogin() {
  return {
    email: process.env.PREVIEW_DEFAULT_ADMIN_EMAIL || 'admin@preview.demo',
    username: process.env.PREVIEW_DEFAULT_ADMIN_USERNAME || 'previewadmin',
    password: process.env.PREVIEW_DEFAULT_ADMIN_PASSWORD || 'Preview123!',
  };
}

function isPlatformPlaceholderCredential(email, password) {
  const defaults = platformDefaultLogin();
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const normalizedDefaultEmail = defaults.email.toLowerCase().trim();
  if (!normalizedEmail && !password) return false;
  if (normalizedEmail === normalizedDefaultEmail && (!password || password === defaults.password)) return true;
  if (normalizedEmail === normalizedDefaultEmail && password === defaults.password) return true;
  return false;
}

function parseSeedScriptCredentials(content) {
  const text = String(content || '');
  let email =
    text.match(/email:\s*["']([^"']+@[^"']+)["']/i)?.[1]?.trim() ||
    text.match(/findOne\(\s*\{\s*email:\s*["']([^"']+@[^"']+)["']/i)?.[1]?.trim() ||
    '';
  let password =
    text.match(/(?:password|passcode):\s*["']([^"']{3,})["']/i)?.[1]?.trim() ||
    text.match(/bcrypt(?:js)?\.hash\(\s*["']([^"']{3,})["']/i)?.[1]?.trim() ||
    text.match(/hash\(\s*["']([^"']{3,})["']\s*,\s*(?:10|12)/i)?.[1]?.trim() ||
    '';
  if (!email) {
    const userMatch = text.match(/username:\s*["']([^"']{3,})["']/i);
    if (userMatch && !userMatch[1].includes('@')) {
      return { email: '', username: userMatch[1].trim(), password };
    }
  }
  return { email, username: '', password };
}

async function walkForSeedScripts(dir, found, depth = 0) {
  if (depth > 6 || found.length >= 16) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (
        SEED_SCRIPT_NAMES.has(lower) ||
        /createadmin|seeduser|seedadmin|bootstrap.*admin/i.test(lower)
      ) {
        found.push(full);
      }
      continue;
    }
    if (entry.isDirectory() && depth < 6) {
      const lower = entry.name.toLowerCase();
      if (lower === 'seeders' || lower === 'seeds' || lower === 'scripts') {
        // eslint-disable-next-line no-await-in-loop
        await walkForSeedScripts(full, found, depth + 1);
      } else if (depth < 4) {
        // eslint-disable-next-line no-await-in-loop
        await walkForSeedScripts(full, found, depth + 1);
      }
    }
  }
}

/**
 * Parse hardcoded admin credentials from student seed/createAdmin scripts.
 */
export async function discoverSeedScriptCredentials(extractDir) {
  const files = [];
  await walkForSeedScripts(extractDir, files);
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = parseSeedScriptCredentials(content);
      if ((parsed.email || parsed.username) && parsed.password) {
        const rel = path.relative(extractDir, filePath).replace(/\\/g, '/');
        return {
          email: parsed.email || '',
          username: parsed.username || '',
          password: parsed.password,
          hint: `Found in ${rel}`,
        };
      }
    } catch {
      /* ignore */
    }
  }
  return { email: '', username: '', password: '', hint: '' };
}

const LOGIN_FORM_FIELD_RULES = [
  { type: 'student_id', label: 'Student ID', patterns: [/student[_-]?id/i, /student[_-]?number/i, /matric/i] },
  { type: 'employee_id', label: 'Employee ID', patterns: [/employee[_-]?id/i, /staff[_-]?id/i, /emp[_-]?id/i] },
  { type: 'username', label: 'Username', patterns: [/username/i, /\buser_name\b/i, /\blogin_name\b/i] },
  { type: 'email', label: 'Email', patterns: [/type=["']email["']/i, /\bemail\b/i] },
  { type: 'id', label: 'ID', patterns: [/name=["']id["']/i, /\bidentifier\b/i, /\buser_id\b/i] },
];

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
  let username = '';
  let identifierId = '';
  let password = '';
  for (const key of EMAIL_ENV_KEYS) {
    if (envMap[key]) {
      email = envMap[key];
      break;
    }
  }
  for (const key of USERNAME_ENV_KEYS) {
    if (envMap[key]) {
      username = envMap[key];
      break;
    }
  }
  for (const key of ID_ENV_KEYS) {
    if (envMap[key]) {
      identifierId = envMap[key];
      break;
    }
  }
  for (const key of PASS_ENV_KEYS) {
    if (envMap[key]) {
      password = envMap[key];
      break;
    }
  }
  return { email, username, identifierId, password };
}

function parseReadmeHints(text) {
  const emailMatch = text.match(
    /(?:admin|default|demo|test)\s*(?:user|account|login)?\s*(?:email)?\s*[:=]\s*([^\s<>"']+@[^\s<>"']+)/i
  );
  const passMatch = text.match(
    /(?:admin|default|demo|test)\s*(?:user|account|login)?\s*password\s*[:=]\s*([^\s<>"'\n]+)/i
  );
  const userPassMatch = text.match(
    /(?:User|Username|Login)\s*[:=]\s*['"]?([^\s<>"',]+)['"]?[^\n]{0,50}(?:Pass|Password)\s*[:=]\s*['"]?([^\s<>"'\n]+)/i
  );
  return {
    email: emailMatch?.[1]?.trim() || '',
    password: passMatch?.[1]?.trim() || userPassMatch?.[2]?.trim() || '',
    username: userPassMatch?.[1]?.trim() || '',
  };
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
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

async function walkForAuthPages(dir, found, depth = 0) {
  if (depth > 5 || found.length >= 10) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile() && /^(auth|Auth|Login|login)\.(jsx|tsx|js|vue|php|html)$/i.test(entry.name)) {
      found.push(full);
      continue;
    }
    if (entry.isDirectory() && depth < 5) {
      // eslint-disable-next-line no-await-in-loop
      await walkForAuthPages(full, found, depth + 1);
    }
  }
}

async function collectLoginCandidateFiles(extractDir, loginPath = '') {
  const relPaths = new Set();
  if (loginPath) relPaths.add(String(loginPath).replace(/^\//, ''));
  for (const rel of [
    'auth/login.php',
    'login.php',
    'admin/login.php',
    'pages/login.php',
    'src/pages/Login.jsx',
    'src/pages/Login.tsx',
    'src/Pages/auth.jsx',
    'src/Pages/Auth.jsx',
    'src/pages/auth.jsx',
    'src/pages/Auth.jsx',
    'src/components/Login.jsx',
    'frontend/src/pages/Login.jsx',
    'client/src/pages/Login.jsx',
    'login.html',
    'index.html',
  ]) {
    relPaths.add(rel);
  }
  if (!loginPath) {
    const phpLogin = await discoverPhpLoginPath(extractDir);
    if (phpLogin) relPaths.add(phpLogin.replace(/^\//, ''));
  }

  const files = [];
  for (const rel of relPaths) {
    const full = path.join(extractDir, rel);
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(full)) files.push(full);
  }
  const authPages = [];
  await walkForAuthPages(extractDir, authPages);
  for (const authPath of authPages) {
    if (!files.includes(authPath)) files.unshift(authPath);
  }
  return files;
}

/**
 * Detect whether the student login form expects email, username, student ID, etc.
 */
export async function discoverProjectLoginFormField(extractDir, loginPath = '') {
  const files = await collectLoginCandidateFiles(extractDir, loginPath);
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      for (const rule of LOGIN_FORM_FIELD_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(content))) {
          return { identifierType: rule.type, identifierLabel: rule.label };
        }
      }
      if (/\$_POST\[['"]username['"]\]/i.test(content) || /name=["']username["']/i.test(content)) {
        return { identifierType: 'username', identifierLabel: 'Username' };
      }
      if (/\$_POST\[['"]email['"]\]/i.test(content) || /name=["']email["']/i.test(content)) {
        return { identifierType: 'email', identifierLabel: 'Email' };
      }
    } catch {
      /* ignore */
    }
  }
  return { identifierType: 'email', identifierLabel: 'Email' };
}

function isExplicitTeacherOverride(teacherEmail, teacherPassword) {
  const defaults = platformDefaultLogin();
  return (
    (teacherEmail && teacherEmail.trim() && teacherEmail.trim() !== defaults.email) ||
    (teacherPassword && teacherPassword !== defaults.password)
  );
}

function pickIdentifierForForm(discovered, formField) {
  const type = formField.identifierType || 'email';
  if (type === 'email' && discovered.email) return discovered.email;
  if (type === 'username' && (discovered.username || discovered.phpUsername)) {
    return discovered.username || discovered.phpUsername;
  }
  if ((type === 'student_id' || type === 'employee_id' || type === 'id') && discovered.identifierId) {
    return discovered.identifierId;
  }
  if (discovered.username || discovered.phpUsername) return discovered.username || discovered.phpUsername;
  if (discovered.email) return discovered.email;
  if (discovered.identifierId) return discovered.identifierId;
  return '';
}

/**
 * Scan extracted submission for admin/demo credentials in project files and setup scripts.
 */
export async function discoverPreviewCredentialsFromExtract(extractDir, { loginPath = '' } = {}) {
  const envPaths = [];
  await walkForEnvFiles(extractDir, envPaths);
  envPaths.sort((a, b) => {
    const score = (p) => {
      if (p.includes('.env.project')) return 0;
      if (p.endsWith('.env.example') || p.endsWith('.env.sample')) return 2;
      if (p.endsWith('.env')) return 1;
      return 3;
    };
    return score(a) - score(b);
  });

  let email = '';
  let username = '';
  let identifierId = '';
  let password = '';
  let hint = '';

  const seedCreds = await discoverSeedScriptCredentials(extractDir);

  for (const envPath of envPaths) {
    try {
      const content = await fs.readFile(envPath, 'utf8');
      const picked = pickFromEnvMap(parseEnvFile(content));
      if (picked.email && !email && !isPlatformPlaceholderCredential(picked.email, picked.password)) {
        email = picked.email;
      }
      if (picked.username && !username) username = picked.username;
      if (picked.identifierId && !identifierId) identifierId = picked.identifierId;
      if (
        picked.password &&
        !password &&
        !isPlatformPlaceholderCredential(picked.email, picked.password)
      ) {
        password = picked.password;
      }
      if ((picked.email || picked.username || picked.password) && !hint) {
        hint = `Found in ${path.basename(envPath)}`;
      }
    } catch {
      /* ignore */
    }
  }

  const readmeNames = ['README.md', 'readme.md', 'README.txt', 'SETUP.md'];
  for (const name of readmeNames) {
    const tryRead = async (readmePath, label) => {
      try {
        const text = await fs.readFile(readmePath, 'utf8');
        const picked = parseReadmeHints(text);
        if (picked.email && !email) email = picked.email;
        if (picked.username && !username) username = picked.username;
        if (picked.password && !password) password = picked.password;
        if ((picked.email || picked.username || picked.password) && !hint) hint = label;
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line no-await-in-loop
    await tryRead(path.join(extractDir, name), `Found in ${name}`);
    try {
      const entries = await fs.readdir(extractDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        // eslint-disable-next-line no-await-in-loop
        await tryRead(path.join(extractDir, e.name, name), `Found in ${e.name}/${name}`);
      }
    } catch {
      /* ignore */
    }
  }

  const phpAdmin = await discoverPhpAdminCredentials(extractDir);
  if (phpAdmin.username && !username) username = phpAdmin.username;
  if (phpAdmin.username && phpAdmin.username.includes('@') && !email) email = phpAdmin.username;
  if (phpAdmin.password && !password) password = phpAdmin.password;
  if (phpAdmin.hint && !hint) hint = phpAdmin.hint;

  const formField = await discoverProjectLoginFormField(extractDir, loginPath);

  return {
    email,
    username,
    identifierId,
    password,
    hint,
    phpUsername: phpAdmin.username || '',
    identifierType: formField.identifierType,
    identifierLabel: formField.identifierLabel,
    seedScriptEmail: seedCreds.email || '',
    seedScriptUsername: seedCreds.username || '',
    seedScriptPassword: seedCreds.password || '',
    seedScriptHint: seedCreds.hint || '',
  };
}

export function resolvePreviewLoginCredentials({
  teacherEmail,
  teacherPassword,
  discovered = {},
  springAdmin = null,
} = {}) {
  const defaults = platformDefaultLogin();
  const teacherOverride = isExplicitTeacherOverride(teacherEmail, teacherPassword);
  const formField = {
    identifierType: discovered.identifierType || 'email',
    identifierLabel: discovered.identifierLabel || 'Email',
  };

  if (springAdmin?.username) {
    discovered = {
      ...discovered,
      username: springAdmin.username,
      password: springAdmin.password || discovered.password,
      hint: springAdmin.hint || discovered.hint,
    };
  }

  let identifier = pickIdentifierForForm(discovered, formField);
  let password = discovered.password || '';
  let source = 'platform_default';
  let hint = discovered.hint || '';

  if (teacherOverride) {
    identifier = String(teacherEmail || identifier || defaults.email).trim();
    password = String(teacherPassword || password || defaults.password).trim();
    source = 'teacher_provided';
  } else if (springAdmin?.username && springAdmin?.password) {
    identifier = springAdmin.username;
    password = springAdmin.password;
    source = 'project_spring_seed';
    hint = hint || springAdmin.hint || 'Preview admin auto-seeded in Spring H2 database on first start.';
  } else if (identifier && password) {
    source = discovered.phpUsername ? 'project_php_setup' : 'project_files';
  } else if (identifier || password) {
    identifier =
      identifier ||
      (formField.identifierType === 'username' ? defaults.username : defaults.email);
    password = password || defaults.password;
    source = discovered.phpUsername ? 'project_php_setup' : 'project_files';
    hint = hint || 'Partial credentials found in project files; fill in missing value if login fails.';
  } else {
    identifier = formField.identifierType === 'username' ? defaults.username : defaults.email;
    password = defaults.password;
    hint =
      hint ||
      (formField.identifierType === 'username'
        ? 'Default preview username (set PREVIEW_DEFAULT_ADMIN_USERNAME in server .env to change).'
        : 'Default preview login (set PREVIEW_DEFAULT_ADMIN_* in server .env to change platform default).');
  }

  if (formField.identifierType === 'username' && /@/.test(identifier)) {
    identifier = discovered.username || defaults.username;
  } else if (formField.identifierType !== 'email' && !/@/.test(identifier)) {
    /* keep username / student id label from discovery */
  } else if (/@/.test(identifier) && formField.identifierType !== 'email' && !discovered.username) {
    formField.identifierType = 'email';
    formField.identifierLabel = 'Email';
  }

  return {
    identifier,
    password,
    identifierType: formField.identifierType,
    identifierLabel: formField.identifierLabel,
    source,
    hint,
    email: identifier,
  };
}

export function applyResolvedLoginCredentials(session, resolved) {
  if (!session || !resolved) return session;
  session.previewLoginEmail = resolved.identifier || resolved.email || '';
  session.previewLoginPassword = resolved.password || '';
  session.previewLoginIdentifierType = resolved.identifierType || 'email';
  session.previewLoginIdentifierLabel = resolved.identifierLabel || 'Email';
  session.previewLoginSource = resolved.source || session.previewLoginSource || '';
  if (resolved.hint) session.previewLoginHint = resolved.hint;
  return session;
}

export async function buildPreviewLoginCredentials({
  extractDir,
  loginPath = '',
  teacherEmail = '',
  teacherPassword = '',
  phpAdmin = null,
  springAdmin = null,
} = {}) {
  const discovered = await discoverPreviewCredentialsFromExtract(extractDir, { loginPath });
  if (phpAdmin?.username) {
    discovered.username = phpAdmin.username;
    if (phpAdmin.username.includes('@')) discovered.email = phpAdmin.username;
    if (phpAdmin.password) discovered.password = phpAdmin.password;
    if (phpAdmin.hint) discovered.hint = phpAdmin.hint;
    discovered.phpUsername = phpAdmin.username;
  }
  return resolvePreviewLoginCredentials({
    teacherEmail,
    teacherPassword,
    discovered,
    springAdmin,
  });
}

/** Env vars injected into preview containers (many student apps read different names). */
export function buildPreviewCredentialEnvVars({ email, password, username, mongoUri = null }) {
  const seedUsername = username || process.env.PREVIEW_DEFAULT_ADMIN_USERNAME || 'previewadmin';
  const pairs = {
    PREVIEW_ADMIN_EMAIL: email,
    PREVIEW_ADMIN_PASSWORD: password,
    PREVIEW_SEED_USERNAME: seedUsername,
    PREVIEW_SEED_PASSWORD: password,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    ADMIN_USERNAME: seedUsername,
    LOGIN_USERNAME: seedUsername,
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: password,
    DEMO_ADMIN_EMAIL: email,
    DEMO_ADMIN_PASSWORD: password,
    DEFAULT_ADMIN_EMAIL: email,
    DEFAULT_ADMIN_PASSWORD: password,
    DEFAULT_ADMIN_USERNAME: seedUsername,
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

export function buildPreviewLoginUrl(previewUrl, loginPath = '/login') {
  const base = String(previewUrl || '').replace(/\/$/, '');
  if (!base) return '';
  const rel = String(loginPath || '/login');
  const normalized = rel.startsWith('/') ? rel : `/${rel}`;
  return `${base}${normalized}`;
}
