/**
 * Central JWT / session secret configuration.
 * Secrets MUST come from persistent environment variables — never generated at runtime.
 */

const WEAK_SECRETS = new Set([
  'change-me-to-a-long-random-secret-in-production',
  'change-me-to-a-long-random-string',
  'change-me-refresh-secret',
  'preview-sandbox-jwt-secret-change-me',
  'secret',
  'jwt-secret',
]);

const MIN_SECRET_LENGTH = 32;

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `${name} is required. Set a persistent value in backend-node/.env (local) or the project root .env used by docker compose.`
    );
  }
  return String(value).trim();
}

function validateSecretStrength(name, secret) {
  const issues = [];
  if (secret.length < MIN_SECRET_LENGTH) {
    issues.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (WEAK_SECRETS.has(secret)) {
    issues.push(`${name} is a known placeholder — generate a long random string`);
  }
  return issues;
}

export function getJwtSecret() {
  return readRequiredEnv('JWT_SECRET');
}

export function getJwtRefreshSecret() {
  return readRequiredEnv('JWT_REFRESH_SECRET');
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

export function getJwtRefreshExpiresIn() {
  return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
}

/**
 * Fail fast on missing or placeholder secrets so tokens stay valid across container restarts.
 * Production (Docker) rejects weak placeholders; development logs a warning.
 */
export function validateAuthSecretsAtStartup() {
  const isProd = process.env.NODE_ENV === 'production';
  const issues = [];

  try {
    issues.push(...validateSecretStrength('JWT_SECRET', getJwtSecret()));
  } catch (err) {
    issues.push(err.message);
  }

  const refresh = process.env.JWT_REFRESH_SECRET;
  if (refresh && String(refresh).trim()) {
    issues.push(...validateSecretStrength('JWT_REFRESH_SECRET', String(refresh).trim()));
  } else if (isProd) {
    issues.push('JWT_REFRESH_SECRET is required in production');
  }

  if (issues.length === 0) return;

  const message = `Auth configuration:\n- ${issues.join('\n- ')}`;
  if (isProd) {
    throw new Error(message);
  }
  console.warn(`[auth] ${message}`);
}
