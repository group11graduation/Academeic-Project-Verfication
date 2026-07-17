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

/** True when value looks like an email address (must include @). */
function looksLikeEmail(value) {
  const v = String(value || '').trim();
  return Boolean(v && v.includes('@') && /^[^\s@]+@[^\s@]+$/.test(v));
}

/** Keep only real emails; demote username-like values to the username slot. */
function normalizeDiscoveredEmailUsername(email, username) {
  let nextEmail = String(email || '').trim();
  let nextUsername = String(username || '').trim();
  if (nextEmail && !looksLikeEmail(nextEmail)) {
    if (!nextUsername) nextUsername = nextEmail;
    nextEmail = '';
  }
  if (nextUsername && looksLikeEmail(nextUsername) && !nextEmail) {
    nextEmail = nextUsername;
    nextUsername = nextEmail.split('@')[0] || nextUsername;
  }
  return { email: nextEmail, username: nextUsername };
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
  // Strong HTML/JS signals first — weak /username/i must not beat type="email".
  {
    type: 'email',
    label: 'Email',
    score: 100,
    patterns: [
      /type\s*=\s*["']email["']/i,
      /name\s*=\s*["']email["']/i,
      /htmlFor\s*=\s*["']email["']/i,
      /id\s*=\s*["']email["']/i,
      /\$_POST\[['"]email['"]\]/i,
      /placeholder\s*=\s*["'][^"']*email[^"']*["']/i,
    ],
  },
  {
    type: 'username',
    label: 'Username',
    score: 90,
    patterns: [
      /type\s*=\s*["']text["'][^>]*(name|id)\s*=\s*["']username["']/i,
      /name\s*=\s*["']username["']/i,
      /htmlFor\s*=\s*["']username["']/i,
      /id\s*=\s*["']username["']/i,
      /\$_POST\[['"]username['"]\]/i,
      /placeholder\s*=\s*["'][^"']*username[^"']*["']/i,
    ],
  },
  {
    type: 'student_id',
    label: 'Student ID',
    score: 85,
    patterns: [/name\s*=\s*["']student[_-]?id["']/i, /student[_-]?id/i, /matric/i],
  },
  {
    type: 'employee_id',
    label: 'Employee ID',
    score: 85,
    patterns: [/name\s*=\s*["']employee[_-]?id["']/i, /employee[_-]?id/i, /staff[_-]?id/i],
  },
  {
    type: 'id',
    label: 'ID',
    score: 40,
    patterns: [/name\s*=\s*["']id["']/i, /\bidentifier\b/i],
  },
  // Weak fallbacks (last resort — many apps mention "username" in copy without using it)
  { type: 'email', label: 'Email', score: 20, patterns: [/\bemail address\b/i, /\bemail\b/i] },
  { type: 'username', label: 'Username', score: 15, patterns: [/\busername\b/i] },
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
    /(?:admin|default|demo|test|staff)\s*(?:user|account|login)?\s*(?:email)?\s*[:=]\s*([^\s<>"']+@[^\s<>"']+)/i
  );
  const passMatch = text.match(
    /(?:admin|default|demo|test|staff)\s*(?:user|account|login)?\s*password\s*[:=]\s*([^\s<>"'\n]+)/i
  );
  const userPassMatch = text.match(
    /(?:User|Username|Login)\s*[:=]\s*['"]?([^\s<>"',]+)['"]?[^\n]{0,50}(?:Pass|Password)\s*[:=]\s*['"]?([^\s<>"'\n]+)/i
  );
  // UI callouts: "admin@syada.org / 123456", "Default staff (fresh DB): admin@x / 123456"
  const slashCredMatch = text.match(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*\/\s*([^\s<>"'`,;]{4,64})/
  );
  const freshDbMatch = text.match(
    /(?:fresh\s*DB|default\s*staff|default\s*admin)[^@\n]{0,80}([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*\/\s*([^\s<>"'`,;]{4,64})/i
  );
  return {
    email: freshDbMatch?.[1]?.trim() || emailMatch?.[1]?.trim() || slashCredMatch?.[1]?.trim() || '',
    password:
      freshDbMatch?.[2]?.trim() ||
      passMatch?.[1]?.trim() ||
      userPassMatch?.[2]?.trim() ||
      slashCredMatch?.[2]?.trim() ||
      '',
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
 * Scores strong signals (type="email", name="username") above weak text mentions.
 */
export async function discoverProjectLoginFormField(extractDir, loginPath = '') {
  const files = await collectLoginCandidateFiles(extractDir, loginPath);
  let best = { identifierType: 'email', identifierLabel: 'Email', score: 0 };

  for (const filePath of files) {
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    for (const rule of LOGIN_FORM_FIELD_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(content))) continue;
      if (rule.score > best.score) {
        best = {
          identifierType: rule.type,
          identifierLabel: rule.label,
          score: rule.score,
        };
      }
    }
  }

  return {
    identifierType: best.identifierType,
    identifierLabel: best.identifierLabel,
  };
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
  if (type === 'email') {
    if (looksLikeEmail(discovered.email)) return discovered.email;
    if (looksLikeEmail(discovered.username)) return discovered.username;
    return '';
  }
  if (type === 'username' && (discovered.username || discovered.phpUsername)) {
    const candidate = discovered.username || discovered.phpUsername;
    // Prefer non-email username when the form wants username.
    if (candidate && !looksLikeEmail(candidate)) return candidate;
    return candidate || '';
  }
  if ((type === 'student_id' || type === 'employee_id' || type === 'id') && discovered.identifierId) {
    return discovered.identifierId;
  }
  if (discovered.username || discovered.phpUsername) {
    return discovered.username || discovered.phpUsername;
  }
  if (looksLikeEmail(discovered.email)) return discovered.email;
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
      const normalized = normalizeDiscoveredEmailUsername(picked.email, picked.username);
      if (normalized.email && !email && !isPlatformPlaceholderCredential(normalized.email, picked.password)) {
        email = normalized.email;
      }
      if (normalized.username && !username) username = normalized.username;
      if (picked.identifierId && !identifierId) identifierId = picked.identifierId;
      if (
        picked.password &&
        !password &&
        !isPlatformPlaceholderCredential(normalized.email || picked.email, picked.password)
      ) {
        password = picked.password;
      }
      if ((normalized.email || normalized.username || picked.password) && !hint) {
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

  // Pull email/password callouts from login UI source (e.g. "admin@syada.org / 123456").
  // Prefer these over .env username-only values when the UI documents staff login.
  {
    const loginFiles = await collectLoginCandidateFiles(extractDir, loginPath);
    for (const filePath of loginFiles.slice(0, 16)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const text = await fs.readFile(filePath, 'utf8');
        const picked = parseReadmeHints(text);
        if (picked.email && looksLikeEmail(picked.email)) {
          if (!email || !looksLikeEmail(email) || /fresh\s*DB|default\s*staff/i.test(text)) {
            email = picked.email;
            if (picked.password) password = picked.password;
            hint = `Found in ${path.basename(filePath)}`;
          }
        }
        if (picked.username && !username) username = picked.username;
        if (picked.password && !password) password = picked.password;
      } catch {
        /* ignore */
      }
    }
  }

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

  let password = discovered.password || '';
  let source = 'platform_default';
  let hint = discovered.hint || '';

  // Always prepare BOTH email and username so teachers / seeds work for either form type.
  let email =
    discovered.email ||
    discovered.seedScriptEmail ||
    (/@/.test(String(discovered.username || '')) ? discovered.username : '') ||
    '';
  let username =
    discovered.username ||
    discovered.phpUsername ||
    discovered.seedScriptUsername ||
    '';
  ({ email, username } = normalizeDiscoveredEmailUsername(email, username));

  if (teacherOverride) {
    const teacherId = String(teacherEmail || '').trim();
    if (looksLikeEmail(teacherId)) email = teacherId;
    else if (teacherId) username = teacherId;
    password = String(teacherPassword || password || defaults.password).trim();
    source = 'teacher_provided';
  } else if (springAdmin?.username && springAdmin?.password) {
    username = springAdmin.username;
    password = springAdmin.password;
    source = 'project_spring_seed';
    hint = hint || springAdmin.hint || 'Preview admin auto-seeded in Spring H2 database on first start.';
  } else if ((email || username) && password) {
    source = discovered.phpUsername ? 'project_php_setup' : 'project_files';
  } else if (email || username || password) {
    password = password || defaults.password;
    source = discovered.phpUsername ? 'project_php_setup' : 'project_files';
    hint = hint || 'Partial credentials found in project files; fill in missing value if login fails.';
  } else {
    password = defaults.password;
    hint =
      hint ||
      'Uses preview defaults for both email and username — enter whichever the student login form asks for.';
  }

  // Email field must always be a real address (student HTML type=email rejects "previewadmin").
  if (!looksLikeEmail(email)) email = defaults.email;
  if (!username) username = defaults.username;
  if (!password) password = defaults.password;

  // Primary identifier follows the detected form (email input → show email first).
  let identifier = pickIdentifierForForm({ ...discovered, email, username }, formField);
  if (!identifier) {
    identifier = formField.identifierType === 'username' ? username : email;
  }
  if (formField.identifierType === 'email' && !looksLikeEmail(identifier)) {
    identifier = email;
  }

  if (formField.identifierType === 'username' && looksLikeEmail(identifier) && username && !looksLikeEmail(username)) {
    identifier = username;
  } else if (looksLikeEmail(identifier) && formField.identifierType !== 'email' && !discovered.username) {
    formField.identifierType = 'email';
    formField.identifierLabel = 'Email';
  }

  if (!discovered.hint && source === 'platform_default') {
    hint =
      formField.identifierType === 'email'
        ? `Student login expects an email. Use Email=${email}. Username=${username} is also seeded.`
        : formField.identifierType === 'username'
          ? `Student login expects a username. Use Username=${username}. Email=${email} is also seeded.`
          : `Try ${formField.identifierLabel}=${identifier} on the student login page.`;
  } else if (!hint) {
    hint = `Preferred: ${formField.identifierLabel}=${identifier}. Email=${email}, Username=${username}.`;
  }

  return {
    identifier,
    password,
    identifierType: formField.identifierType,
    identifierLabel: formField.identifierLabel,
    source,
    hint,
    email,
    username,
  };
}

export function applyResolvedLoginCredentials(session, resolved) {
  if (!session || !resolved) return session;
  const defaults = platformDefaultLogin();
  let email = resolved.email || '';
  let username = resolved.username || '';
  ({ email, username } = normalizeDiscoveredEmailUsername(email, username));
  if (!looksLikeEmail(email)) email = defaults.email;
  if (!username) username = defaults.username;

  // Always store a real email separately from username.
  session.previewLoginEmail = email;
  session.previewLoginUsername = username;
  session.previewLoginPassword = resolved.password || defaults.password;
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
  const defaults = platformDefaultLogin();
  let seedEmail = String(email || '').trim();
  let seedUsername = String(username || '').trim();
  ({ email: seedEmail, username: seedUsername } = normalizeDiscoveredEmailUsername(seedEmail, seedUsername));
  if (!looksLikeEmail(seedEmail)) seedEmail = defaults.email;
  if (!seedUsername) seedUsername = defaults.username;
  const seedPassword = String(password || '').trim() || defaults.password;
  const pairs = {
    PREVIEW_ADMIN_EMAIL: seedEmail,
    PREVIEW_ADMIN_PASSWORD: seedPassword,
    PREVIEW_SEED_USERNAME: seedUsername,
    PREVIEW_SEED_PASSWORD: seedPassword,
    ADMIN_EMAIL: seedEmail,
    ADMIN_PASSWORD: seedPassword,
    ADMIN_USERNAME: seedUsername,
    LOGIN_USERNAME: seedUsername,
    LOGIN_EMAIL: seedEmail,
    SEED_ADMIN_EMAIL: seedEmail,
    SEED_ADMIN_PASSWORD: seedPassword,
    DEMO_ADMIN_EMAIL: seedEmail,
    DEMO_ADMIN_PASSWORD: seedPassword,
    DEFAULT_ADMIN_EMAIL: seedEmail,
    DEFAULT_ADMIN_PASSWORD: seedPassword,
    DEFAULT_ADMIN_USERNAME: seedUsername,
    // Common dev secrets so JWT auth can boot in sandbox
    // Standard Base64 ("preview-sandbox-jwt-secret-change-me-please") — jjwt-safe
    JWT_SECRET:
      process.env.PREVIEW_JWT_SECRET ||
      'cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtY2hhbmdlLW1lLXBsZWFzZQ==',
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
