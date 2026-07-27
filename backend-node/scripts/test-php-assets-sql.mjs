/**
 * Regression: XAMPP asset prefixes and SQL comment-aware import helpers.
 * Run: node scripts/test-php-assets-sql.mjs
 */
import assert from 'assert';
import { rewriteXamppAssetPrefixes, splitPhpSqlStatements } from '../src/services/previewPhp.service.js';

const css = rewriteXamppAssetPrefixes(
  '<link rel="stylesheet" href="/event-management-system/assets/style.css">',
);
assert.equal(css.changed, true);
assert.equal(css.content, '<link rel="stylesheet" href="/assets/style.css">');

const keep = rewriteXamppAssetPrefixes('<link href="/assets/style.css">');
assert.equal(keep.changed, false);

const dump = `CREATE DATABASE event_management;
USE event_management;

-- =========================
-- Users Table
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE events (
    id INT PRIMARY KEY
);
`;
const stmts = splitPhpSqlStatements(dump);
assert.ok(stmts.some((s) => /CREATE TABLE users/i.test(s)), 'users table kept');
assert.ok(stmts.some((s) => /CREATE TABLE events/i.test(s)), 'events table kept');
assert.ok(!stmts.some((s) => /CREATE DATABASE/i.test(s)), 'CREATE DATABASE stripped');
assert.equal(stmts.length, 2);

console.log('OK', { css: css.content, stmts: stmts.length });
