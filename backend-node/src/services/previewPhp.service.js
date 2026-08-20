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
  'src/db/config.php',
  'src/config/database.php',
  'includes/connection.php',
  'inc/connection.php',
  'app/config.php',
  'application/config/database.php',
];

const PHP_BOOTSTRAP_NAME_RE =
  /^(setup|install|migrate|migration|seed|reset|upgrade|init)[-_a-z0-9]*\.php$/i;

const DB_FILE_CONTENT_RE =
  /new\s+PDO|new\s+mysqli|mysqli_connect|mysql:host=|define\s*\(\s*['"]DB_HOST['"]|\$(?:host|dbhost|db_host|dbname|database)\s*=/i;

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

/**
 * Rewrite PDO DSNs and mysqli_connect / new mysqli(...) for the MySQL sidecar.
 *
 * IMPORTANT: Prefer getenv('DB_HOST') over baking the sidecar container name into
 * files. Preview caches reuse the same ZIP mount across restarts; a hardcoded
 * preview-mysql-<oldId> breaks DNS when the sidecar is recreated.
 */
function patchPdoDsnHosts(content, dbHost, dbName, { dbUser = null, dbPass = null } = {}) {
  let changed = false;
  const hostFallback = dbHost || 'localhost';

  // PDO DSN host: localhost OR stale preview-mysql-* → current sidecar (updated every start)
  const hostRe =
    /(mysql:host=)(localhost|127\.0\.0\.1|host\.docker\.internal|preview-mysql-[a-zA-Z0-9]+)(?=;|['"])/gi;
  if (hostRe.test(content)) {
    content = content.replace(hostRe, `$1${hostFallback}`);
    changed = true;
  }

  // mysqli_connect('host', ...) - any literal host including stale sidecar names
  content = content.replace(
    /mysqli_connect\s*\(\s*(['"])([^'"]*)\1/gi,
    (_m, _q, host) => {
      if (/^getenv\s*\(/i.test(host)) return _m;
      changed = true;
      return `mysqli_connect(getenv('DB_HOST') ?: 'localhost'`;
    },
  );

  // new mysqli("ANY_HOST", "user", "pass", "dbname") → getenv so restarts never go stale
  const mysqliNewRe =
    /new\s+mysqli\s*\(\s*(['"])([^'"]*)\1\s*,\s*(['"])([^'"]*)\3\s*,\s*(['"])([^'"]*)\5(\s*,\s*(['"])([^'"]*)\8)?/gi;
  content = content.replace(
    mysqliNewRe,
    (_m, _q1, host, q2, user, q3, pass, _rest, q4, name) => {
      if (/^getenv\s*\(/i.test(host)) return _m;
      changed = true;
      const nextUser = dbUser != null && dbUser !== '' ? dbUser : user;
      const nextPass = dbPass != null ? dbPass : pass;
      const nextName = dbName && name != null ? dbName : name;
      const userExpr = `getenv('DB_USER') ?: ${q2}${nextUser}${q2}`;
      const passExpr = `(getenv('DB_PASS') !== false ? getenv('DB_PASS') : ${q3}${nextPass}${q3})`;
      if (q4 != null && name != null) {
        const nameExpr = `getenv('DB_NAME') ?: ${q4}${nextName}${q4}`;
        return `new mysqli(getenv('DB_HOST') ?: 'localhost', ${userExpr}, ${passExpr}, ${nameExpr}`;
      }
      return `new mysqli(getenv('DB_HOST') ?: 'localhost', ${userExpr}, ${passExpr}`;
    },
  );

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

/** Infer DB name from new mysqli("host","user","pass","dbname") */
function inferMysqliDatabaseName(content) {
  const match = content.match(
    /new\s+mysqli\s*\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"](\w+)['"]/i,
  );
  return match ? match[1] : null;
}

function fixSetupDbUseStatements(content, dbName) {
  if (!dbName) return content;
  let next = content;
  // $pdo->exec("USE dbname") / ->query('USE dbname') - common in student setup scripts
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

/** Discover database.sql / schema.sql style dumps in a PHP project root. */
export async function discoverPhpSqlDumpFiles(root) {
  const found = new Set();
  const names = ['database.sql', 'db.sql', 'schema.sql', 'dump.sql', 'data.sql'];
  const dirs = [root, path.join(root, 'sql'), path.join(root, 'database'), path.join(root, 'db')];
  for (const dir of dirs) {
    for (const name of names) {
      const filePath = path.join(dir, name);
      // eslint-disable-next-line no-await-in-loop
      if (await pathExists(filePath)) found.add(filePath);
    }
  }
  for (const dir of [path.join(root, 'sql'), path.join(root, 'database')]) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.toLowerCase().endsWith('.sql')) found.add(path.join(dir, entry));
      }
    } catch {
      /* missing dir */
    }
  }
  return [...found];
}

/**
 * Split a student SQL dump into executable statements.
 * Strips CREATE DATABASE / USE (caller already selected the DB) and full-line comments.
 */
export function splitPhpSqlStatements(sqlText) {
  let sql = String(sqlText || '');
  sql = sql.replace(/DELIMITER\s+\S+/gi, '');
  sql = sql.replace(/CREATE\s+DEFINER=[^\s]+\s+/gi, 'CREATE ');
  sql = sql.replace(/^\s*CREATE\s+DATABASE\s+[^;]+;/gim, '');
  sql = sql.replace(/^\s*USE\s+[^;]+;/gim, '');
  return sql
    .split(';')
    .map((stmt) =>
      stmt
        .replace(/^\s*--[^\n]*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim(),
    )
    .filter(Boolean);
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
// ${PREVIEW_MARKER} - overrides XAMPP/localhost DB settings from Docker env
if (getenv('PREVIEW_SANDBOX') === '1' || getenv('DB_HOST')) {
  if ($__svHost = getenv('DB_HOST')) {
    $host = $__svHost; $dbhost = $__svHost; $db_host = $__svHost;
  }
  // Use db-specific names only - never overwrite $username/$password used for app login.
  if ($__svUser = getenv('DB_USER')) {
    $dbuser = $__svUser; $db_user = $__svUser; $dbusername = $__svUser; $db_username = $__svUser;
  }
  if (($__svPass = getenv('DB_PASS')) !== false) {
    $dbpass = $__svPass; $db_pass = $__svPass; $dbpassword = $__svPass; $db_password = $__svPass;
  }
  if ($__svName = getenv('DB_NAME')) {
    $dbname = $__svName; $database = $__svName; $db_name = $__svName;
  }
}
`;
}

/** Body only — no <?php opener (injected inside an existing PHP block). */
function buildPreviewEnvOverrideBlockBody() {
  return buildPreviewEnvOverrideBlock().replace(/^\uFEFF?<\?php\s*\r?\n/i, '');
}

const PHP_OPEN_TAG_RE = /^\uFEFF?[\s\r\n]*<\?php\b/i;

/**
 * Old injector prepended a full "<?php …" block before config files that already
 * started with <?php → "unexpected token <" parse error on line ~18.
 */
export function repairBrokenPreviewPhpInjection(content) {
  if (!content.includes(PREVIEW_MARKER)) return content;
  let next = content;
  next = next.replace(
    /(<\?php\s*\r?\n\s*\/\/ ScholarVerify preview sandbox[\s\S]*?\r?\n\})\s*\r?\n\s*<\?php\b\s*\r?\n/i,
    '$1\n',
  );
  next = next.replace(
    /(\/\/ ScholarVerify preview sandbox[\s\S]*?\r?\n\})\s*\r?\n\s*<\?php\b\s*\r?\n/i,
    '$1\n',
  );
  return next;
}

function injectPreviewEnvOverrides(content) {
  if (content.includes(PREVIEW_MARKER)) {
    const repaired = repairBrokenPreviewPhpInjection(content);
    return { content: repaired, changed: repaired !== content };
  }
  if (!DB_FILE_CONTENT_RE.test(content)) return { content, changed: false };

  const body = buildPreviewEnvOverrideBlockBody();
  const openMatch = content.match(PHP_OPEN_TAG_RE);
  if (openMatch) {
    const insertAt = openMatch.index + openMatch[0].length;
    const injected = `${content.slice(0, insertAt)}\n${body}${content.slice(insertAt)}`;
    return { content: injected, changed: true };
  }
  return { content: buildPreviewEnvOverrideBlock() + content, changed: true };
}

/**
 * Parse common default admin credentials from setup/seed PHP scripts.
 */
export async function discoverPhpAdminCredentials(root) {
  const scripts = await discoverPhpBootstrapScripts(root);
  let username = '';
  let password = '';
  let email = '';
  let hint = '';

  /**
   * Accept one coherent (username, password[, email]) from the SAME regex match / seed row.
   * Never stash password from one match and username from another.
   */
  const accept = (user, pass, why, pairedEmail = '') => {
    const u = String(user || '').trim();
    let p = String(pass || '').trim();
    // Strip accidental PHP source escape suffixes: "Admin@123\n" from echo "...$x\n"
    p = p.replace(/\\n$/i, '').replace(/\\r$/i, '').trim();
    if (!u || !p) return false;
    if (looksLikeUnresolvedVariableToken(u) || looksLikeUnresolvedVariableToken(p)) return false;
    if (!isUsablePreviewPassword(p)) return false;
    if (/^(root|mysql|mariadb)$/i.test(u)) return false;
    username = u;
    password = p;
    hint = why;
    const em = String(pairedEmail || '').trim();
    if (u.includes('@')) {
      email = u;
    } else if (em.includes('@') && !looksLikeUnresolvedVariableToken(em)) {
      email = em;
    } else {
      email = '';
    }
    return true;
  };

  for (const scriptPath of scripts) {
    try {
      const content = await fs.readFile(scriptPath, 'utf8');
      const base = path.basename(scriptPath);

      // Prefer literal password_hash('real-password') over echo "...$pass\n" source templates.
      const hashThenUser = content.match(
        /password_hash\s*\(\s*['"]([^'"]+)['"][\s\S]{0,500}?(?:execute|bindValue|bindParam)\s*\(\s*(?:\[[^\]]*?['"]([^'"]+)['"]|['"]([^'"]+)['"])/i
      );
      if (hashThenUser) {
        const user = hashThenUser[2] || hashThenUser[3];
        if (accept(user, hashThenUser[1], `From ${base} seed user`)) break;
      }

      const userThenHash = content.match(
        /(?:execute|bindValue|bindParam)\s*\(\s*(?:\[[^\]]*?['"]([^'"]+)['"]|['"]([^'"]+)['"])[\s\S]{0,500}?password_hash\s*\(\s*['"]([^'"]+)['"]/i
      );
      if (userThenHash) {
        const user = userThenHash[1] || userThenHash[2];
        if (accept(user, userThenHash[3], `From ${base} seed user`)) break;
      }

      // Prefer paired patterns above. Do NOT accept independent password_hash() +
      // execute(['user']) matches from distant parts of the file - that mixes rows.

      const insertMatch = content.match(
        /INSERT INTO\s+[`]?(?:users|admins|accounts|tbl_users)[`]?[\s\S]{0,400}?VALUES\s*\(\s*['"]([^'"]+)['"][\s\S]{0,160}?['"]([^'"]+)['"][\s\S]{0,120}?password_hash\s*\(\s*['"]([^'"]+)['"]/i
      );
      if (insertMatch) {
        const a = insertMatch[1];
        const b = insertMatch[2];
        const pass = insertMatch[3];
        // Same INSERT row: prefer username + optional email column in either order.
        const user = a.includes('@') && !b.includes('@') ? b : a;
        const rowEmail = a.includes('@') ? a : b.includes('@') ? b : '';
        if (accept(user, pass, `From ${base} INSERT`, rowEmail)) break;
      }

      const adminVars = content.match(
        /\$admin_(?:user|username|login|name)\s*=\s*['"]([^'"]+)['"][\s\S]{0,200}?\$admin_(?:pass|password|pwd)\s*=\s*['"]([^'"]+)['"]/i
      );
      if (adminVars && accept(adminVars[1], adminVars[2], `From ${base} $admin_* vars`)) break;

      const adminVarsRev = content.match(
        /\$admin_(?:pass|password|pwd)\s*=\s*['"]([^'"]+)['"][\s\S]{0,200}?\$admin_(?:user|username|login|name)\s*=\s*['"]([^'"]+)['"]/i
      );
      if (adminVarsRev && accept(adminVarsRev[2], adminVarsRev[1], `From ${base} $admin_* vars`)) break;

      const adminUsernameVar = content.match(
        /\$admin_username\s*=\s*['"]([^'"]+)['"][\s\S]{0,200}?\$admin_password\s*=\s*['"]([^'"]+)['"]/i
      );
      if (adminUsernameVar && accept(adminUsernameVar[1], adminUsernameVar[2], `From ${base} admin_username`)) break;

      const unamePass = content.match(
        /\$(?:uname|login_name)\s*=\s*['"]([^'"]+)['"][\s\S]{0,200}?\$(?:pass|passwd)\s*=\s*['"]([^'"]+)['"]/i
      );
      if (unamePass && accept(unamePass[1], unamePass[2], `From ${base} uname/pass`)) break;

      const defaultAdmin = content.match(
        /\$default_admin_(?:user|username)\s*=\s*['"]([^'"]+)['"][\s\S]{0,200}?\$default_admin_(?:pass|password)\s*=\s*['"]([^'"]+)['"]/i
      );
      if (defaultAdmin && accept(defaultAdmin[1], defaultAdmin[2], `From ${base} default admin`)) break;

      const superadmin = content.match(
        /['"](superadmin|admin|administrator)['"][\s\S]{0,200}?password_hash\s*\(\s*['"]([^'"]+)['"]/i
      );
      if (superadmin && accept(superadmin[1], superadmin[2], `From ${base} role seed`)) break;

      // Echo / "reset to:" lines last - source often contains "$pass\n" placeholders.
      const userPassEcho = content.match(
        /(?:User|Username|Login)\s*[:=]\s*['"]?([A-Za-z0-9._@-]+)['"]?[^\n]{0,80}(?:Pass|Password)\s*[:=]\s*['"]?([^'"<\s]+)/i
      );
      if (userPassEcho && accept(userPassEcho[1], userPassEcho[2], `From ${base}`)) break;

      const resetEcho = content.match(
        /password\s+reset\s+successfully\s+to\s*:\s*['"]?([^\s'"<]+)/i
      );
      if (resetEcho) {
        const pass = resetEcho[1];
        const userFromFile =
          content.match(/\$admin_username\s*=\s*['"]([^'"]+)['"]/i)?.[1] ||
          content.match(/\$username\s*=\s*['"]([^'"]+)['"]/i)?.[1] ||
          content.match(/(?:User|Username|Login)\s*[:=]\s*['"]([A-Za-z0-9._@-]+)['"]/i)?.[1] ||
          'admin';
        // If echo uses $pass, resolve from a nearby assignment: $pass = 'Admin@123';
        let resolvedPass = pass;
        if (looksLikeUnresolvedVariableToken(pass)) {
          const varName = pass.replace(/^\$/, '').replace(/\\n$/i, '');
          const assigned = content.match(
            new RegExp(`\\$${varName}\\s*=\\s*['"]([^'"]+)['"]`, 'i')
          );
          if (assigned) resolvedPass = assigned[1];
        }
        if (accept(userFromFile, resolvedPass, `From ${base} reset echo`)) break;
      }

      const echoCreds = content.match(
        /echo\s+['"][^'"]*(?:username|user|login)\s*[:=]\s*([A-Za-z0-9._@-]+)[^'"]*(?:password|pass)\s*[:=]\s*([^'"\s<]+)['"]/i
      );
      if (echoCreds && accept(echoCreds[1], echoCreds[2], `From ${base} echo`)) break;
    } catch {
      /* ignore */
    }
  }

  return { username, password, email, hint };
}

/**
 * Pick the database name the student app expects (setup script wins over config file).
 */
export async function resolvePreviewDatabaseName(root) {
  const all = await discoverAllPreviewDatabaseNames(root);
  if (all.length) return all[0];
  return process.env.PREVIEW_MYSQL_DATABASE || 'bbms';
}

/**
 * Every plausible MySQL database name referenced by the PHP project.
 * Used so we CREATE DATABASE for hostel AND any aliases — prevents
 * "Unknown database 'hostel'" when the sidecar was initialized as bbms.
 */
export async function discoverAllPreviewDatabaseNames(root) {
  const found = [];
  const seen = new Set();
  const push = (name) => {
    const n = String(name || '')
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, '');
    if (!n || n.length > 64) return;
    if (/^(test|mysql|information_schema|performance_schema|sys)$/i.test(n)) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(n);
  };

  const scripts = await discoverPhpBootstrapScripts(root);
  for (const scriptPath of scripts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const content = await fs.readFile(scriptPath, 'utf8');
      const fromSetup = inferSetupDatabaseName(content);
      if (fromSetup) push(fromSetup);
      for (const n of extractDatabaseNameCandidates(content)) push(n);
    } catch {
      /* ignore */
    }
  }

  const dbFiles = await discoverPhpDatabaseFiles(root);
  for (const filePath of dbFiles) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const content = await fs.readFile(filePath, 'utf8');
      const fromConfig = inferVariableDatabaseName(content);
      if (fromConfig) push(fromConfig);
      const fromMysqli = inferMysqliDatabaseName(content);
      if (fromMysqli) push(fromMysqli);
      const defineMatch = content.match(/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
      if (defineMatch) push(defineMatch[1]);
      const dsnMatch = content.match(/mysql:host=[^;'"]+;dbname=([^;'"]+)/i);
      if (dsnMatch) push(dsnMatch[1]);
      for (const n of extractDatabaseNameCandidates(content)) push(n);
    } catch {
      /* ignore */
    }
  }

  // Folder name often matches DB (…/hostel/includes/config.php → hostel)
  try {
    const base = path.basename(path.resolve(root));
    if (base && !/^(html|www|public|src|app|backend|api)$/i.test(base)) push(base);
  } catch {
    /* ignore */
  }

  return found;
}

/** Extra patterns for literal DB names in student PHP (mysqli 4th arg, PDO, etc.). */
function extractDatabaseNameCandidates(content) {
  const out = [];
  const text = String(content || '');
  const patterns = [
    /new\s+mysqli\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*['"](\w+)['"]/gi,
    /mysqli_connect\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*['"](\w+)['"]/gi,
    /(?:dbname|database|db_name)\s*=\s*['"](\w+)['"]/gi,
    /['"]database['"]\s*=>\s*['"](\w+)['"]/gi,
    /CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`'"]?(\w+)/gi,
    /USE\s+[`'"]?(\w+)[`'"]?\s*;/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      out.push(m[1]);
    }
  }
  return out;
}

async function patchPhpFile(filePath, options, { bootstrap = false, injectOverrides = true } = {}) {
  let content = await fs.readFile(filePath, 'utf8');
  const repaired = repairBrokenPreviewPhpInjection(content);
  if (repaired !== content) {
    content = repaired;
    await fs.writeFile(filePath, content, 'utf8');
  }
  let changed = repaired !== content;

  const definePatch = patchPhpDefines(content, options);
  content = definePatch.content;
  changed = changed || definePatch.changed;

  // Bootstrap/setup/seed scripts often use $username/$password for the APP admin
  // account. Never rewrite those to MySQL root/preview-root or login breaks
  // (BBMS-style apps) while UI still shows previewadmin.
  const dbVarAssignments = bootstrap
    ? [
        [['host', 'dbhost', 'db_host'], options.dbHost],
        [['dbuser', 'db_user', 'dbusername', 'db_username'], options.dbUser],
        [['dbpass', 'db_pass', 'dbpassword', 'db_password'], options.dbPass],
        [['dbname', 'database', 'db_name'], options.dbName],
      ]
    : [
        [['host', 'dbhost', 'db_host'], options.dbHost],
        [['dbuser', 'db_user', 'dbusername', 'db_username'], options.dbUser],
        [['dbpass', 'db_pass', 'dbpassword', 'db_password'], options.dbPass],
        // Legacy configs that use $username/$password for mysqli - patch only when clearly DB vars.
        [['username', 'user'], options.dbUser],
        [['password', 'pass'], options.dbPass],
        [['dbname', 'database', 'db_name'], options.dbName],
      ];
  const varPatch = patchPhpVariableAssignments(content, dbVarAssignments);
  content = varPatch.content;
  changed = changed || varPatch.changed;

  const dsnPatch = patchPdoDsnHosts(content, options.dbHost, options.dbName, {
    dbUser: options.dbUser,
    dbPass: options.dbPass,
  });
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

/**
 * Reject PHP/shell variable tokens accidentally scraped from source echo strings
 * like: echo "password reset to: $pass\n";
 */
export function looksLikeUnresolvedVariableToken(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  // "$pass", "$password", "$pass\n" (backslash-n from PHP source)
  if (v.startsWith('$')) return true;
  if (/\\n$/i.test(v) || v.endsWith('\\n')) return true;
  if (/^(pass|password|pwd|passwd|user|username|email|admin_password|admin_pass)$/i.test(v)) {
    return true;
  }
  return false;
}

export function isUsablePreviewPassword(value) {
  const p = String(value || '')
    .trim()
    .replace(/\\n$/i, '')
    .replace(/\\r$/i, '')
    .trim();
  if (!p || p.length < 3) return false;
  if (looksLikeUnresolvedVariableToken(p)) return false;
  if (isMysqlSidecarPassword(p)) return false;
  return true;
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

/** MySQL sidecar password - must never be treated as the student app login password. */
function isMysqlSidecarPassword(value) {
  const pass = String(value || '').trim();
  if (!pass) return false;
  const mysqlPass = String(
    process.env.PREVIEW_MYSQL_ROOT_PASSWORD || process.env.DB_PASS || 'preview-root'
  ).trim();
  return pass === mysqlPass || pass === 'preview-root';
}

/** Keep only the credential token - bootstrap logs often append HTML or punctuation after the value. */
function sanitizeBootstrapCredential(raw, kind = 'password') {
  let value = normalizeBootstrapLogLine(raw).replace(/^['"]+|['"]+$/g, '');
  if (!value) return '';
  // Never keep PHP source placeholders like "$pass\n"
  value = value.replace(/\\n$/i, '').replace(/\\r$/i, '').trim();
  if (looksLikeUnresolvedVariableToken(value)) return '';

  if (kind === 'email') {
    const m = value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0] : value.split(/[\s<(,;)]/)[0];
  }

  if (kind === 'username') {
    const m = value.match(/^[A-Za-z0-9._@-]+/);
    return m ? m[0] : value.split(/[\s<(,;)]/)[0];
  }

  // Allow common password specials; leading "$" already rejected above.
  const m = value.match(/^[A-Za-z0-9@#%^&*!\.\-_/+:=]+/);
  return m ? m[0] : value.split(/[\s<(,;)]/)[0].replace(/[),.;:]+$/g, '');
}

/**
 * Parse admin credentials echoed by student bootstrap scripts inside the preview container.
 * Bootstrap output is appended to /tmp/preview-mysql.log by the PHP entrypoint.
 */
export function parsePhpBootstrapCredentialsFromLog(logText = '') {
  if (!logText?.trim()) return null;

  const seeded = logText.match(
    /ScholarVerify(?:\s+Laravel)?\s+admin seeded[^:]*:\s*username=([^\s]+)(?:\s+email=([^\s]+))?\s+password=([^\s<]+)/i
  );
  if (seeded) {
    const username = sanitizeBootstrapCredential(seeded[1], 'username');
    const email = seeded[2] ? sanitizeBootstrapCredential(seeded[2], 'email') : '';
    const password = sanitizeBootstrapCredential(seeded[3], 'password');
    if (username && isUsablePreviewPassword(password)) {
      return {
        username,
        password,
        email: email && email.includes('@') ? email : undefined,
        identifierType: username.includes('@') ? 'email' : 'username',
        source: 'preview_seed_admin',
        usernameAssumed: false,
      };
    }
  }

  let username = '';
  let email = '';
  let password = '';

  const lines = logText.split(/\r?\n/);
  for (const raw of lines) {
    const line = normalizeBootstrapLogLine(raw);
    if (!line) continue;

    // Skip DB connection noise (host/user/pass for MySQL, not app login).
    if (
      /\b(DB_PASS|DB_PASSWORD|MYSQL_PASSWORD|mysqli_connect|new PDO|mysql:host)\b/i.test(line) ||
      /database\s+password|db\s+pass(?:word)?/i.test(line)
    ) {
      continue;
    }

    // Password reset echoes - last match wins (bootstrap scripts may run more than once).
    const passReset =
      line.match(/(?:admin\s+)?password\s+reset\s+successfully\s+to\s*:\s*['"]?([^\s'"<>,;)]+)/i) ||
      line.match(/reset\s+successfully\s+to\s*:\s*['"]?([^\s'"<>,;)]+)/i) ||
      line.match(/password\s+(?:reset|changed|is|set|updated)[^:\n]*:\s*['"]?([^\s'"<>,;)]+)/i) ||
      line.match(/admin\s+password[^:\n]*:\s*['"]?([^\s'"<>,;)]+)/i);
    if (passReset) {
      const cleaned = sanitizeBootstrapCredential(passReset[1], 'password');
      if (isUsablePreviewPassword(cleaned)) {
        password = cleaned;
      }
      continue;
    }

    if (!/password_hash|password_verify|password_reset_token|^hash:/i.test(line)) {
      const passKv = line.match(/(?:^|[^\w])(?:pass(?:word)?)\s*[:=]\s*['"]?([^\s'"<>,;)]+)/i);
      if (passKv) {
        const cleaned = sanitizeBootstrapCredential(passKv[1], 'password');
        if (isUsablePreviewPassword(cleaned)) {
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
      if (cleaned && !cleaned.includes('@') && cleaned.toLowerCase() !== 'root') {
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
      else if (id && id.toLowerCase() !== 'root') username = id;
      const pass = sanitizeBootstrapCredential(pair[2].trim(), 'password');
      if (isUsablePreviewPassword(pass)) password = pass;
    }
  }

  password = sanitizeBootstrapCredential(password, 'password');
  username = sanitizeBootstrapCredential(username, 'username');
  email = sanitizeBootstrapCredential(email, 'email');

  if (!isUsablePreviewPassword(password)) return null;

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
        `Login from bootstrap script output (password: ${bootstrapPass}, username assumed to be '${assumed}' - verify on the login page).`
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

  // Never mix username from one source with password from another.
  const projectUser = projectCredentials.username;
  const projectPass = projectCredentials.password;
  const setupUser = adminCredentials.username;
  const setupPass = adminCredentials.password;
  if (projectUser && projectPass) {
    if (phpCredentialsLookLikePlatformDefault(projectUser, projectPass)) {
      parts.push(
        `Default guess (may not match this project): ${projectUser} / ${projectPass}. If login fails, check the preview log for credentials printed by setup/reset scripts.`
      );
    } else {
      parts.push(`Try project login: ${projectUser} / ${projectPass}.`);
    }
  } else if (setupUser && setupPass) {
    if (phpCredentialsLookLikePlatformDefault(setupUser, setupPass)) {
      parts.push(
        `Default guess (may not match this project): ${setupUser} / ${setupPass}. If login fails, check the preview log for credentials printed by setup/reset scripts.`
      );
    } else {
      parts.push(`Try project login: ${setupUser} / ${setupPass}.`);
    }
  } else if (projectUser || setupUser) {
    parts.push(`Try username: ${projectUser || setupUser} (check README or setup script for password).`);
  } else {
    parts.push('Check README or setup_db.php for default admin username/password.');
  }

  return parts.join(' ');
}

const XAMPP_ASSET_SKIP = new Set([
  'var',
  'usr',
  'etc',
  'tmp',
  'home',
  'root',
  'app',
  'api',
  'auth',
  'admin',
  'user',
  'users',
  'public',
  'src',
  'vendor',
  'node_modules',
  'includes',
  'assets',
  'css',
  'js',
  'images',
  'img',
  'static',
  'uploads',
]);

/**
 * Student ZIPs often hard-code XAMPP folder URLs like /event-management-system/assets/style.css.
 * Preview serves the project at DocumentRoot /, so rewrite those prefixes to /.
 */
export function rewriteXamppAssetPrefixes(content) {
  let changed = false;
  const next = content.replace(
    /(["'])\/([A-Za-z0-9_-]+)\/(assets|css|js|images|img|static|uploads)\//gi,
    (match, quote, folder, kind) => {
      if (XAMPP_ASSET_SKIP.has(String(folder).toLowerCase())) return match;
      changed = true;
      return `${quote}/${kind}/`;
    },
  );
  return { content: next, changed };
}

async function patchXamppAssetFiles(root) {
  const files = [];
  await walkPhpFiles(root, files, 0);
  // Also pick up common header/footer HTML-ish PHP and a few static refs.
  let patched = 0;
  for (const filePath of files) {
    try {
      // eslint-disable-next-line no-await-in-loop
      let content = await fs.readFile(filePath, 'utf8');
      if (!/\/[A-Za-z0-9_-]+\/(assets|css|js|images|img|static|uploads)\//i.test(content)) continue;
      const result = rewriteXamppAssetPrefixes(content);
      if (!result.changed) continue;
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(filePath, result.content, 'utf8');
      patched += 1;
    } catch {
      /* ignore */
    }
  }
  return patched;
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

  files += await patchXamppAssetFiles(root);

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
