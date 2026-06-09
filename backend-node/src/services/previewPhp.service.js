import fs from 'fs/promises';
import path from 'path';

const LOGIN_CANDIDATES = [
  'auth/login.php',
  'login.php',
  'admin/login.php',
  'user/login.php',
  'pages/login.php',
];

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
    if (await pathExists(path.join(root, rel))) {
      return `/${rel.replace(/\\/g, '/')}`;
    }
  }
  return '/auth/login.php';
}

async function patchConfigPhp(filePath, { baseUrl, dbHost, dbName, dbUser, dbPass }) {
  let content = await fs.readFile(filePath, 'utf8');
  let changed = false;

  const setDefine = (name, value) => {
    const re = new RegExp(`define\\(\\s*['"]${name}['"]\\s*,\\s*['"][^'"]*['"]\\s*\\)`, 'g');
    if (re.test(content)) {
      content = content.replace(re, `define('${name}', '${value}')`);
      changed = true;
    } else {
      content += `\ndefine('${name}', '${value}');\n`;
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

  if (changed) {
    await fs.writeFile(filePath, content, 'utf8');
  }
  return changed ? 1 : 0;
}

/**
 * Patch common PHP config so redirects/links use preview host port (not localhost:80 subfolder).
 */
export async function patchPhpForPreview(extractDir, appSubdir, options = {}) {
  const {
    baseUrl,
    dbHost = 'host.docker.internal',
    dbName = 'bbms',
    dbUser = 'root',
    dbPass = '',
  } = options;

  const root = path.join(extractDir, appSubdir === '.' ? '' : appSubdir);
  if (!(await pathExists(root))) return { files: 0, loginPath: '/auth/login.php' };

  let files = 0;
  const configPaths = [
    path.join(root, 'includes', 'config.php'),
    path.join(root, 'config.php'),
    path.join(root, 'inc', 'config.php'),
  ];

  for (const cfg of configPaths) {
    if (await pathExists(cfg)) {
      // eslint-disable-next-line no-await-in-loop
      files += await patchConfigPhp(cfg, { baseUrl, dbHost, dbName, dbUser, dbPass });
    }
  }

  const loginPath = await discoverPhpLoginPath(extractDir, appSubdir);
  return { files, loginPath };
}
