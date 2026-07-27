/**
 * Regression: new mysqli("localhost", ...) must rewrite to the MySQL sidecar host.
 * Run: node scripts/test-php-mysqli-patch.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { patchPhpForPreview } from '../src/services/previewPhp.service.js';

const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sv-mysqli-'));
const cfgDir = path.join(tmp, 'config');
await fs.promises.mkdir(cfgDir);
await fs.promises.writeFile(
  path.join(cfgDir, 'db.php'),
  `<?php
$conn = new mysqli("localhost", "root", "", "event_management");
if ($conn->connect_error) {
    die("Connection failed");
}
`,
  'utf8',
);
await fs.promises.writeFile(path.join(tmp, 'index.php'), "<?php require 'config/db.php';\n", 'utf8');
await fs.promises.writeFile(
  path.join(tmp, 'database.sql'),
  'CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY);\n',
  'utf8',
);

const result = await patchPhpForPreview(tmp, '.', {
  baseUrl: 'http://example.test:8015/',
  dbHost: 'preview-mysql-test',
  dbUser: 'root',
  dbPass: 'preview-root',
});

const patched = await fs.promises.readFile(path.join(cfgDir, 'db.php'), 'utf8');
const okHost = patched.includes("new mysqli('preview-mysql-test'") || patched.includes('new mysqli("preview-mysql-test"');
const okPass = patched.includes('preview-root');
const okDb = result.dbName === 'event_management';

console.log({ files: result.files, dbName: result.dbName, okHost, okPass, okDb });
console.log(patched);

if (!okHost || !okPass || !okDb) {
  console.error('FAIL: mysqli patch regression');
  process.exit(1);
}
console.log('OK');
