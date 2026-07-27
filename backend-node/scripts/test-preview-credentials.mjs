/**
 * Regression tests: preview credentials must stay coherent for every future project.
 * Run: node scripts/test-preview-credentials.mjs
 */
import assert from 'node:assert/strict';
import {
  resolvePreviewLoginCredentials,
  coerceCoherentCredentialSet,
  applyCoherentLoginToSession,
  buildPreviewCredentialEnvVars,
} from '../src/services/previewCredentials.service.js';
import {
  parsePhpBootstrapCredentialsFromLog,
  isUsablePreviewPassword,
  looksLikeUnresolvedVariableToken,
} from '../src/services/previewPhp.service.js';

function ok(name) {
  console.log(`  ✓ ${name}`);
}

// --- Classic BBMS-style mismatch must never reappear ---
{
  const resolved = resolvePreviewLoginCredentials({
    discovered: {
      email: 'admin@bdms.com',
      username: 'previewadmin',
      password: 'Admin@123',
      phpUsername: 'admin',
      identifierType: 'username',
      identifierLabel: 'Username',
      hint: 'From setup_db.php',
    },
  });
  assert.equal(resolved.username, 'admin');
  assert.notEqual(resolved.username, 'previewadmin');
  assert.equal(resolved.password, 'Admin@123');
  assert.equal(resolved.email, 'admin@bdms.com');
  assert.equal(resolved.source, 'project_php_setup');
  ok('strips previewadmin when PHP pair is admin/Admin@123');
}

// --- Platform default beside project password ---
{
  const set = coerceCoherentCredentialSet({
    email: 'admin@preview.demo',
    username: 'previewadmin',
    password: 'Admin@123',
    source: 'project_files',
    identifierType: 'username',
    identifierLabel: 'Username',
  });
  assert.notEqual(set.username, 'previewadmin');
  assert.notEqual(set.email, 'admin@preview.demo');
  assert.equal(set.password, 'Admin@123');
  ok('coerce drops platform identity beside project password');
}

// --- MySQL sidecar password rejected ---
{
  assert.equal(isUsablePreviewPassword('preview-root'), false);
  const set = coerceCoherentCredentialSet({
    username: 'admin',
    password: 'preview-root',
    source: 'project_php_setup',
    identifierType: 'username',
  });
  assert.equal(set.password, '');
  ok('rejects preview-root as app password');
}

// --- PHP $pass tokens rejected ---
{
  assert.equal(looksLikeUnresolvedVariableToken('$pass'), true);
  assert.equal(looksLikeUnresolvedVariableToken('$pass\\n'), true);
  assert.equal(isUsablePreviewPassword('$pass'), false);
  assert.equal(isUsablePreviewPassword('pass'), false);
  ok('rejects unresolved PHP password tokens');
}

// --- Atomic session apply clears stale username ---
{
  const session = {
    previewLoginEmail: 'stale@old.com',
    previewLoginUsername: 'previewadmin',
    previewLoginPassword: 'old',
  };
  applyCoherentLoginToSession(session, {
    email: 'admin@bdms.com',
    username: 'admin',
    password: 'Admin@123',
    source: 'project_seed_fallback',
    identifierType: 'username',
    identifierLabel: 'Username',
  });
  assert.equal(session.previewLoginUsername, 'admin');
  assert.equal(session.previewLoginEmail, 'admin@bdms.com');
  assert.equal(session.previewLoginPassword, 'Admin@123');
  assert.equal(session.previewLoginFromProject, true);
  assert.notEqual(session.previewLoginUsername, 'previewadmin');
  ok('atomic apply clears stale previewadmin');
}

// --- Env builder must not invent previewadmin beside project password ---
{
  const env = buildPreviewCredentialEnvVars({
    email: 'admin@bdms.com',
    username: '',
    password: 'Admin@123',
    source: 'project_php_setup',
  });
  assert.notEqual(env.PREVIEW_SEED_USERNAME, 'previewadmin');
  assert.equal(env.PREVIEW_SEED_USERNAME, 'admin');
  assert.equal(env.PREVIEW_SEED_PASSWORD, 'Admin@123');
  assert.notEqual(env.PREVIEW_SEED_PASSWORD, 'preview-root');
  ok('env builder seeds admin not previewadmin for project password');
}

// --- Seed log with email between username and password ---
{
  const parsed = parsePhpBootstrapCredentialsFromLog(
    '[preview] ScholarVerify admin seeded in users: username=admin email=admin@bdms.com password=Admin@123\n'
  );
  assert.equal(parsed.username, 'admin');
  assert.equal(parsed.email, 'admin@bdms.com');
  assert.equal(parsed.password, 'Admin@123');
  assert.equal(parsed.source, 'preview_seed_admin');
  ok('parses seed log with same-row email');
}

// --- Mismatched email+username without phpUsername ---
{
  const resolved = resolvePreviewLoginCredentials({
    discovered: {
      email: 'other@example.com',
      username: 'previewadmin',
      password: 'Admin@123',
      identifierType: 'username',
      identifierLabel: 'Username',
    },
  });
  assert.notEqual(resolved.username, 'previewadmin');
  assert.equal(resolved.password, 'Admin@123');
  ok('mixed scrape without PHP pair still drops previewadmin');
}

console.log('\nAll preview credential regression tests passed.');
