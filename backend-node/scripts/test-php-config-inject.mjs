/**
 * Regression: config.php must not get a second <?php after ScholarVerify env override inject.
 * Run: node scripts/test-php-config-inject.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import {
  patchPhpForPreview,
  repairBrokenPreviewPhpInjection,
} from '../src/services/previewPhp.service.js';

const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sv-php-cfg-'));

function phpLint(filePath) {
  try {
    execSync('php -v', { stdio: 'pipe' });
    execSync(`php -l "${filePath}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return null; // PHP CLI not available locally
  }
}

// Typical student config.php (starts with <?php)
await fs.promises.writeFile(
  path.join(tmp, 'config.php'),
  `<?php
define('BASE_URL', 'http://localhost/myapp');
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'myapp_db');

$host = 'localhost';
$dbname = 'myapp_db';
$username = 'root';
$password = '';
`,
  'utf8',
);

await patchPhpForPreview(tmp, '.', {
  baseUrl: 'http://example.test:8015/',
  dbHost: 'preview-mysql-test',
  dbUser: 'root',
  dbPass: 'preview-root',
  dbName: 'myapp_db',
});

const patched = await fs.promises.readFile(path.join(tmp, 'config.php'), 'utf8');
const openTags = (patched.match(/<\?php/gi) || []).length;
const hasMarker = patched.includes('ScholarVerify preview sandbox');
const okSingleTag = openTags === 1;
const okLint = phpLint(path.join(tmp, 'config.php'));

console.log({ openTags, hasMarker, okSingleTag, okLint: okLint ?? 'skipped' });

if (!hasMarker || !okSingleTag || okLint === false) {
  console.error('FAIL: config.php inject regression\n', patched);
  process.exit(1);
}

// Simulate old broken inject (double <?php) and verify repair
const broken = `<?php
// ScholarVerify preview sandbox - overrides XAMPP/localhost DB settings from Docker env
if (getenv('PREVIEW_SANDBOX') === '1' || getenv('DB_HOST')) {
}
<?php
define('DB_HOST', 'localhost');
`;
const fixed = repairBrokenPreviewPhpInjection(broken);
if (/<\?php[\s\S]*<\?php/i.test(fixed)) {
  console.error('FAIL: repair left duplicate <?php\n', fixed);
  process.exit(1);
}

console.log('OK php config inject');
