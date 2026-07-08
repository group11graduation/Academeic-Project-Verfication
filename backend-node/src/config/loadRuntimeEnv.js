import fs from 'fs';
import path from 'path';
import { config as loadDotenv } from 'dotenv';

function tryLoadEnvFile(filePath) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return false;
  loadDotenv({ path: resolved, override: false });
  return true;
}

function applyFileBackedSecret(envName) {
  if (process.env[envName] && String(process.env[envName]).trim()) return;
  const filePath = process.env[`${envName}_FILE`];
  if (!filePath) return;
  try {
    const value = fs.readFileSync(filePath, 'utf8').trim();
    if (value) process.env[envName] = value;
  } catch {
    // Ignore invalid secret-file paths; auth validation will fail with a clear message.
  }
}

const candidateEnvFiles = [
  process.env.DOTENV_CONFIG_PATH,
  '/app/.env',
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend-node/.env'),
];

for (const filePath of candidateEnvFiles) {
  if (tryLoadEnvFile(filePath)) break;
}

applyFileBackedSecret('JWT_SECRET');
applyFileBackedSecret('JWT_REFRESH_SECRET');
