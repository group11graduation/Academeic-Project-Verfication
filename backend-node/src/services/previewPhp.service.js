import fs from 'fs/promises';
import path from 'path';

const PREVIEW_MARKER = 'ScholarVerify preview sandbox';

const LOGIN_CANDIDATES = [
  'auth/login.php',
  'login.php',
  'admin/login.php',
  'user/login.php',
  'pages/login.php',
  'signin.php',
  'index.php',
];

const PHP_CONFIG_REL_PATHS = [
  'includes/config.php',
  'config.php',
  'inc/config.php',
  'config/database.php',
  'includes/database.php',
  'includes/db.php',
  'database.php',
  'db.php',
  'config/db.php',
  'config/db_config.php',
  'config/connection.php',
  'includes/connection.php',
  'inc/connection.php',
  'app/config.php',
  'application/config/database.php',
];

const PHP_BOOTSTRAP_NAME_RE =
  /^(setup|install|migrate|migration|seed|reset|upgrade|init)[-_a-z0-9]*\.php$/i;

const DB_FILE_CONTENT_RE =
  /new\s+PDO|mysqli_connect|mysql:host=|define\s*\(\s*['"]DB_HOST['"]|\$(?:host|dbhost|db_host|dbname|database)\s*=/i;

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'vendor',
  'assets',
  'uploads',
  'cache',
  'tmp',
  'temp',
  'images',
  'img',
  'css',
  'js',
  'fonts',
]);

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function previewMysqlHostName(projectId) {
  const id = String(projectId || 'preview').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `preview-mysql-${id}`;
}

export function buildPreviewMysqlUri(sessionId) {
  if (process.env.PREVIEW_MYSQL_URI) return process.env.PREVIEW_MYSQL_URI;
  const host = previewMysqlHostName(sessionId);
  const db = process.env.PREVIEW_MYSQL_DATABASE || 'bbms';
  return `mysql://${host}:3306/${db}`;
}

/**
 * Find the login page path inside a PHP zip (relative to app root).
 */
export async function discoverPhpLoginPath(extractDir, appSubdir = '.') {
  const root = path.join(extractDir, appSubdir === '.' ? '' : appSubdir);
  for (const rel of LOGIN_CANDIDATES) {
    if (rel === 'index.php') continue;
    if (await pathExists(path.join(root, rel))) {
      return `/${rel.replace(/\\/g, '/')}`;
    }
  }
  for (const rel of ['auth/login.php', 'login.php', 'admin/login.php']) {
    if (await pathExists(path.join(root, rel))) {
      return `/${rel.replace(/\\/g, '/')}`;
    }
  }
  return '/auth/login.php';
}

async function walkPhpFiles(dir, found, depth = 0) {
  if (depth > 5 || found.length >= 80) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.php')) {
      found.push(full);
      continue;
    }
    if (entry.isDirectory() && depth < 5) {
      // eslint-disable-next-line no-await-in-loop
      await walkPhpFiles(full, found, depth + 1);
    }
  }
}

/**
 * Discover PHP files that configure MySQL/PDO (known paths + content scan).
 */
export async function discoverPhpDatabaseFiles(root) {
  const files = new Set();
  for (const rel of PHP_CONFIG_REL_PATHS) {
    const filePath = path.join(root, rel);
    if (await pathExists(filePath)) files.add(filePath);
  }

  const scanRoots = [
    root,
    path.join(root, 'config'),
    path.join(root, 'includes'),
    path.join(root, 'inc'),
    path.join(root, 'app'),
    path.join(root, 'application'),
  ];
  for (const scanRoot of scanRoots) {
    if (!(await pathExists(scanRoot))) continue;
    const phpFiles = [];
    // eslint-disable-next-line no-await-in-loop
    await walkPhpFiles(scanRoot, phpFiles, scanRoot === root ? 0 : 1);
    for (const filePath of phpFiles) {
      if (isPhpBootstrapScript(filePath)) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        const content = await fs.readFile(filePath, 'utf8');
        if (DB_FILE_CONTENT_RE.test(content)) files.add(filePath);
      } catch {
        /* ignore */
      }
    }
  }
  return [...files];
}

/**
 * Discover setup/install/seed scripts that bootstrap MySQL schema or admin users.
 */
export async function discoverPhpBootstrapScripts(root) {
  const scripts = new Set();
  for (const rel of [
    'setup_db.php',
    'upgrade_db.php',
    'reset_admin.php',
    'install.php',
    'database/setup.php',
    'scripts/setup.php',
    'sql/setup.php',
  ]) {
    const filePath = path.join(root, rel);
    if (await pathExists(filePath)) scripts.add(filePath);
  }

  const phpFiles = [];
  await walkPhpFiles(root, phpFiles, 0);
  for (const filePath of phpFiles) {
    const base = path.basename(filePath);
    if (!PHP_BOOTSTRAP_NAME_RE.test(base)) continue;
    try {
      const content = await fs.readFile(filePath, 'utf8');
      if (/CREATE TABLE|CREATE DATABASE|INSERT INTO|password_hash|mysqli_connect|new PDO/i.test(content)) {
        scripts.add(filePath);
      }
    } catch {
      /* ignore */
    }
  }
  return [...scripts].sort((a, b) => a.length - b.length);
}

function escapePhpString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function patchPhpVariableAssignments(content, assignments) {
  let changed = false;
  for (const [names, value] of assignments) {
    if (value == null || value === '') continue;
    for (const name of names) {
      const re = new RegExp(`(\\$${name}\\s*=\\s*['"])[^'"]*(['"])`, 'gi');
      if (re.test(content)) {
        content = content.replace(re, `$1${escapePhpString(value)}$2`);
        changed = true;
      }
    }
  }
  return { content, changed };
}

function patchPhpDefines(content, { baseUrl, dbHost, dbName, dbUser, dbPass }) {
  let changed = false;
  const setDefine = (name, value) => {
    if (value == null || value === '') return;
    const re = new RegExp(`define\\(\\s*['"]${name}['"]\\s*,\\s*['"][^'"]*['"]\\s*\\)`, 'g');
    if (re.test(content)) {
      content = content.replace(re, `define('${name}', '${escapePhpString(value)}')`);
      changed = true;
    }
  };

  if (baseUrl) setDefine('BASE_URL', baseUrl);
  if (dbHost) setDefine('DB_HOST', dbHost);
  if (dbName) setDefine('DB_NAME', dbName);
  if (dbUser) setDefine('DB_USER', dbUser);
  if (dbPass != null) setDefine('DB_PASS', dbPass);

  const localPatterns = [
    /http:\/\/localhost\/[^/'"\s]+/gi,
    /http:\/\/127\.0\.0\.1\/[^/'"\s]+/gi,
    /https:\/\/localhost\/[^/'"\s]+/gi,
  ];
  if (baseUrl) {
    for (const pattern of localPatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, baseUrl.replace(/\/$/, ''));
        changed = true;
      }
    }
  }

  return { content, changed };
}

function patchPdoDsnHosts(content, dbHost, dbName) {
  let changed = false;
  if (dbHost) {
    const hostRe =
      /(mysql:host=)(localhost|127\.0\.0\.1|host\.docker\.internal)(?=;|['"])/gi;
    if (hostRe.test(content)) {
      content = content.replace(hostRe, `$1${dbHost}`);
      changed = true;
    }
    const mysqliRe =
      /(mysqli_connect\s*\(\s*['"])(localhost|127\.0\.0\.1)(['"])/gi;
    if (mysqliRe.test(content)) {
      content = content.replace(mysqliRe, `$1${dbHost}$3`);
      changed = true;
    }
  }
  if (dbName) {
    const dbRe = /(mysql:host=[^;'"]+;dbname=)([^;'"]+)/gi;
    if (dbRe.test(content)) {
      content = content.replace(dbRe, `$1${dbName}`);
      changed = true;
    }
  }
  return { content, changed };
}

function inferSetupDatabaseName(content) {
  const match = content.match(/CREATE DATABASE IF NOT EXISTS\s+[`'"]?(\w+)[`'"]?/i);
  return match ? match[1] : null;
}

function inferVariableDatabaseName(content) {
  const match = content.match(/\$(?:dbname|database|db_name)\s*=\s*['"]([^'"]+)['"]/i);
  return match ? match[1] : null;
}

function fixSetupDbUseStatements(content, dbName) {
  if (!dbName) return content;
  let next = content;
  // $pdo->exec("USE dbname") / ->query('USE dbname') — common in student setup scripts
  next = next.replace(
    /((?:->exec|->query|\bexec|\bquery)\s*\(\s*["']USE\s+)\s*([A-Za-z0-9_]+)(["']\s*\))/gi,
    `$1${dbName}$3`
  );
  // Standalone USE dbname;
  next = next.replace(/\bUSE\s+[`'"]?[A-Za-z0-9_]+[`'"]?\s*;/gi, `USE ${dbName};`);
  return next;
}

function isPhpBootstrapScript(filePath) {
  const base = path.basename(filePath);
  if (PHP_BOOTSTRAP_NAME_RE.test(base)) return true;
  return ['setup_db.php', 'upgrade_db.php', 'reset_admin.php', 'install.php'].includes(base);
}

function syncCreateDatabaseStatement(content, dbName) {
  if (!dbName) return content;
  return content.replace(
    /CREATE DATABASE IF NOT EXISTS\s+([`'"]?)(\w+)\1/gi,
    `CREATE DATABASE IF NOT EXISTS $1${dbName}$1`
  );
}

function buildPreviewEnvOverrideBlock() {
  return `<?php
// ${PREVIEW_MARKER} — overrides XAMPP/localhost DB settings from Docker env
if (getenv('PREVIEW_SANDBOX') === '1' || getenv('DB_HOST')) {
  if ($__svHost = getenv('DB_HOST')) {
    $host = $__svHost; $dbhost = $__svHost; $db_host = $__svHost;
  }
  if ($__svUser = getenv('DB_USER')) {
    $username = $__svUser; $user = $__svUser; $dbuser = $__svUser; $db_user = $__svUser;
  }
  if (($__svPass = getenv('DB_PASS')) !== false) {
    $password = $__svPass; $pass = $__svPass; $dbpass = $__svPass; $db_pass = $__svPass;
  }
  if ($__svName = getenv('DB_NAME')) {
    $dbname = $__svName; $database = $__svName; $db_name = $__svName;
  }
}
`;
}

function injectPreviewEnvOverrides(content) {
  if (content.includes(PREVIEW_MARKER)) return { content, changed: false };
  if (!DB_FILE_CONTENT_RE.test(content)) return { content, changed: false };

  const block = buildPreviewEnvOverrideBlock();
  if (content.startsWith('<?php')) {
    const afterTag = content.indexOf('<?php') + 5;
    const injected = `${content.slice(0, afterTag)}\n${block.slice(5)}${content.slice(afterTag)}`;
    return { content: injected, changed: true };
  }
  return { content: block + content, changed: true };
}

/**
 * Parse common default admin credentials from setup/seed PHP scripts.
 */
export async function discoverPhpAdminCredentials(root) {
  const scripts = await discoverPhpBootstrapScripts(root);
  let username = '';
  let password = '';
  let hint = '';

  for (const scriptPath of scripts) {
    try {
      const content = await fs.readFile(scriptPath, 'utf8');
      const userPassEcho = content.match(
        /(?:User|Username|Login)\s*[:=]\s*['"]?(\w+)['"]?[^\n]{0,40}(?:Pass|Password)\s*[:=]\s*['"]?([^'"<\s]+)/i
      );
      if (userPassEcho) {
        username = userPassEcho[1];
        password = userPassEcho[2];
        hint = `From ${path.basename(scriptPath)}`;
        break;
      }

      const plainPass = content.match(/password_hash\s*\(\s*['"]([^'"]+)['"]/i);
      const execUser = content.match(/execute\s*\(\s*\[\s*['"]([^'"]+)['"]/i);
      if (plainPass && execUser) {
        password = plainPass[1];
        username = execUser[1];
        hint = `From ${path.basename(scriptPath)} seed user`;
        break;
      }

      const hashMatch = content.match(
        /password_hash\s*\(\s*['"]([^'"]+)['"][\s\S]{0,400}?execute\s*\(\s*\[\s*['"]([^'"]+)['"]/
      );
      if (hashMatch) {
        password = hashMatch[1];
        username = hashMatch[2];
        hint = `From ${path.basename(scriptPath)} seed user`;
        break;
      }

      const insertMatch = content.match(
        /INSERT INTO\s+users[\s\S]{0,300}?VALUES\s*\(\s*['"]([^'"]+)['"][\s\S]{0,120}?['"]([^'"]+)['"][\s\S]{0,80}?password_hash\s*\(\s*['"]([^'"]+)['"]/i
      );
      if (insertMatch) {
        username = insertMatch[1];
        password = insertMatch[3];
        hint = `From ${path.basename(scriptPath)} INSERT`;
        break;
      }
    } catch {
      /* ignore */
    }
  }

  return { username, password, hint };
}

/**
 * Pick the database name the student app expects (setup script wins over config file).
 */
export async function resolvePreviewDatabaseName(root) {
  const scripts = await discoverPhpBootstrapScripts(root);
  for (const scriptPath of scripts) {
    try {
      const content = await fs.readFile(scriptPath, 'utf8');
      const fromSetup = inferSetupDatabaseName(content);
      if (fromSetup) return fromSetup;
    } catch {
      /* ignore */
    }
  }

  const dbFiles = await discoverPhpDatabaseFiles(root);
  for (const filePath of dbFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fromConfig = inferVariableDatabaseName(content);
      if (fromConfig) return fromConfig;
      const defineMatch = content.match(/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
      if (defineMatch) return defineMatch[1];
      const dsnMatch = content.match(/mysql:host=[^;'"]+;dbname=([^;'"]+)/i);
      if (dsnMatch) return dsnMatch[1];
    } catch {
      /* ignore */
    }
  }

  return process.env.PREVIEW_MYSQL_DATABASE || 'bbms';
}

async function patchPhpFile(filePath, options, { bootstrap = false, injectOverrides = true } = {}) {
  let content = await fs.readFile(filePath, 'utf8');
  let changed = false;

  const definePatch = patchPhpDefines(content, options);
  content = definePatch.content;
  changed = changed || definePatch.changed;

  const varPatch = patchPhpVariableAssignments(content, [
    [['host', 'dbhost', 'db_host'], options.dbHost],
    [['username', 'user', 'dbuser', 'db_user'], options.dbUser],
    [['password', 'pass', 'dbpass', 'db_pass'], options.dbPass],
    [['dbname', 'database', 'db_name'], options.dbName],
  ]);
  content = varPatch.content;
  changed = changed || varPatch.changed;

  const dsnPatch = patchPdoDsnHosts(content, options.dbHost, options.dbName);
  content = dsnPatch.content;
  changed = changed || dsnPatch.changed;

  if (bootstrap && options.dbName) {
    let fixed = fixSetupDbUseStatements(content, options.dbName);
    fixed = syncCreateDatabaseStatement(fixed, options.dbName);
    if (fixed !== content) {
      content = fixed;
      changed = true;
    }
  }

  if (injectOverrides && !bootstrap) {
    const injected = injectPreviewEnvOverrides(content);
    content = injected.content;
    changed = changed || injected.changed;
  }

  if (changed) {
    await fs.writeFile(filePath, content, 'utf8');
  }
  return changed ? 1 : 0;
}

function platformDefaultPhpCredentials() {
  return {
    email: process.env.PREVIEW_DEFAULT_ADMIN_EMAIL || 'admin@preview.demo',
    username: process.env.PREVIEW_DEFAULT_ADMIN_USERNAME || 'previewadmin',
    password: process.env.PREVIEW_DEFAULT_ADMIN_PASSWORD || 'Preview123!',
  };
}

function phpCredentialsLookLikePlatformDefault(user, pass) {
  const defaults = platformDefaultPhpCredentials();
  return pass === defaults.password && (user === defaults.email || user === defaults.username);
}

/** Strip HTML tags and collapse whitespace from bootstrap script echo output. */
function normalizeBootstrapLogLine(line) {
  return String(line || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keep only the credential token — bootstrap logs often append HTML or punctuation after the value. */
function sanitizeBootstrapCredential(raw, kind = 'password') {
  let value = normalizeBootstrapLogLine(raw).replace(/^['"]+|['"]+$/g, '');
  if (!value) return '';

  if (kind === 'email') {
    const m = value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0] : value.split(/[\s<(,;]/)[0];
  }

  if (kind === 'username') {
    const m = value.match(/^[A-Za-z0-9._@-]+/);
    return m ? m[0] : value.split(/[\s<(,;]/)[0];
  }

  const m = value.match(/^[A-Za-z0-9@#$%^&*!\.\-_/+:=]+/);
  return m ? m[0] : value.split(/[\s<(,]/)[0].replace(/[),.;:]+$/g, '');
}

/**
 * Parse admin credentials echoed by student bootstrap scripts inside the preview container.
 * Bootstrap output is appended to /tmp/preview-mysql.log by the PHP entrypoint.
 */
export function parsePhpBootstrapCredentialsFromLog(logText = '') {
  if (!logText?.trim()) return null;

  let username = '';
  let email = '';
  let password = '';

  const lines = logText.split(/\r?\n/);
  for (const raw of lines) {
    const line = normalizeBootstrapLogLine(raw);
    if (!line) continue;

    // Password reset echoes — last match wins (bootstrap scripts may run more than once).
    const passReset =
      line.match(/(?:admin\s+)?password\s+reset\s+successfully\s+to\s*:\s*['"]?([^\s'"<>,;)]+)/i) ||
      line.match(/reset\s+successfully\s+to\s*:\s*['"]?([^\s'"<>,;)]+)/i) ||
      line.match(/password\s+(?:reset|changed|is|set|updated)[^:\n]*:\s*['"]?([^\s'"<>,;)]+)/i) ||
      line.match(/admin\s+password[^:\n]*:\s*['"]?([^\s'"<>,;)]+)/i);
    if (passReset) {
      password = sanitizeBootstrapCredential(passReset[1], 'password');
      continue;
    }

    if (!/password_hash|password_verify|password_reset_token|^hash:/i.test(line)) {
      const passKv = line.match(/(?:^|[^\w])(?:pass(?:word)?)\s*[:=]\s*['"]?([^\s'"<>,;)]+)/i);
      if (passKv) {
        const cleaned = sanitizeBootstrapCredential(passKv[1], 'password');
        if (cleaned.length >= 3) {
          password = cleaned;
        }
      }
    }

    const emailKv = line.match(/(?:admin\s+)?e-?mail\s*(?:is\s*)?[:=]\s*['"]?([^\s'"<>,;)]+)/i);
    if (emailKv) {
      const cleaned = sanitizeBootstrapCredential(emailKv[1], 'email');
      if (cleaned.includes('@')) {
        email = cleaned;
      }
    }

    const userKv = line.match(
      /(?:default\s+)?(?:admin\s+)?(?:user(?:name)?|login\s+id)\s*(?:is\s*)?[:=]\s*['"]?([^\s'"<>,;)]+)/i
    );
    if (userKv) {
      const cleaned = sanitizeBootstrapCredential(userKv[1], 'username');
      if (cleaned && !cleaned.includes('@')) {
        username = cleaned;
      }
    }

    const pair =
      line.match(/(?:credentials?|login)\s*[:=]\s*['"]?([^/'"\s<>,;)]+)\s*\/\s*([^\s'"<>,;)]+)/i) ||
      line.match(
        /(?:user(?:name)?|login)\s*[:=]\s*['"]?([^'"\n<>,;)]+)['"]?\s*[,;]\s*(?:pass(?:word)?)\s*[:=]\s*['"]?([^\s'"<>,;)]+)/i
      );
    if (pair) {
      const id = sanitizeBootstrapCredential(pair[1].trim(), pair[1].includes('@') ? 'email' : 'username');
      if (id.includes('@')) email = id;
      else if (id) username = id;
      const pass = sanitizeBootstrapCredential(pair[2].trim(), 'password');
      if (pass) password = pass;
    }
  }

  password = sanitizeBootstrapCredential(password, 'password');
  username = sanitizeBootstrapCredential(username, 'username');
  email = sanitizeBootstrapCredential(email, 'email');

  if (!password) return null;

  const identifier = email || username;
  if (!identifier) {
    return {
      username: 'admin',
      password,
      identifierType: 'username',
      source: 'bootstrap_log',
      usernameAssumed: true,
      assumedUsername: 'admin',
    };
  }

  return {
    username: identifier,
    password,
    identifierType: email ? 'email' : 'username',
    source: 'bootstrap_log',
    usernameAssumed: false,
  };
}

export function buildPhpPreviewLoginHint({
  previewLoginUrl = '',
  hostPort = '',
  dbName = '',
  adminCredentials = {},
  projectCredentials = {},
  bootstrapCredentials = null,
} = {}) {
  const parts = [];
  if (previewLoginUrl) {
    parts.push(`Open ${previewLoginUrl} (port :${hostPort || 'see URL'}, not localhost/80).`);
  }
  if (dbName) {
    parts.push(`Preview database: ${dbName} (MariaDB sidecar).`);
  }

  const bootstrapUser = bootstrapCredentials?.username;
  const bootstrapPass = bootstrapCredentials?.password;
  if (bootstrapPass) {
    if (bootstrapCredentials?.usernameAssumed) {
      const assumed = bootstrapCredentials.assumedUsername || bootstrapUser || 'admin';
      parts.push(
        `Login from bootstrap script output (password: ${bootstrapPass}, username assumed to be '${assumed}' — verify on the login page).`
      );
      return parts.join(' ');
    }
    if (bootstrapUser) {
      const idLabel = bootstrapCredentials.identifierType === 'email' ? 'Email' : 'Username';
      parts.push(
        `Login from bootstrap script output (${idLabel}: ${bootstrapUser}, password: ${bootstrapPass}).`
      );
      return parts.join(' ');
    }
  }

  const user = projectCredentials.username || adminCredentials.username;
  const pass = projectCredentials.password || adminCredentials.password;
  if (user && pass) {
    if (phpCredentialsLookLikePlatformDefault(user, pass)) {
      parts.push(
        `Default guess (may not match this project): ${user} / ${pass}. If login fails, check the preview log for credentials printed by setup/reset scripts.`
      );
    } else {
      parts.push(`Try project login: ${user} / ${pass}.`);
    }
  } else if (user) {
    parts.push(`Try username: ${user} (check README or setup script for password).`);
  } else {
    parts.push('Check README or setup_db.php for default admin username/password.');
  }

  return parts.join(' ');
}

/**
 * Patch PHP project for preview: DB sidecar host, BASE_URL, bootstrap scripts, and env overrides.
 */
export async function patchPhpForPreview(extractDir, appSubdir, options = {}) {
  const {
    baseUrl,
    dbHost = 'host.docker.internal',
    dbUser = 'root',
    dbPass = process.env.PREVIEW_MYSQL_ROOT_PASSWORD || 'preview-root',
    dbName: dbNameOverride = null,
  } = options;

  const root = path.join(extractDir, appSubdir === '.' ? '' : appSubdir);
  if (!(await pathExists(root))) {
    return { files: 0, loginPath: '/auth/login.php', dbName: dbNameOverride, bootstrapScripts: [] };
  }

  const resolvedDbName = dbNameOverride || (await resolvePreviewDatabaseName(root));
  const patchOptions = { baseUrl, dbHost, dbName: resolvedDbName, dbUser, dbPass };

  let files = 0;
  const dbFiles = await discoverPhpDatabaseFiles(root);
  for (const cfg of dbFiles) {
    // eslint-disable-next-line no-await-in-loop
    files += await patchPhpFile(cfg, patchOptions);
  }

  const bootstrapScripts = await discoverPhpBootstrapScripts(root);
  for (const script of bootstrapScripts) {
    const isSetup = /setup|install|upgrade|reset|seed|migrate|init/i.test(path.basename(script));
    // eslint-disable-next-line no-await-in-loop
    files += await patchPhpFile(script, patchOptions, {
      bootstrap: isSetup,
      injectOverrides: false,
    });
  }

  const loginPath = await discoverPhpLoginPath(extractDir, appSubdir);
  const adminCredentials = await discoverPhpAdminCredentials(root);

  return {
    files,
    loginPath,
    dbName: resolvedDbName,
    bootstrapScripts: bootstrapScripts.map((p) => path.relative(root, p).replace(/\\/g, '/')),
    adminCredentials,
  };
}
