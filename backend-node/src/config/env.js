import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** backend-node/ */
const backendRoot = path.resolve(__dirname, '../..');
/** Monorepo root (Verfication-Project-Using-Machine-Learning/) */
const monorepoRoot = path.resolve(backendRoot, '..');

/** Local MongoDB — `MONGO_URI` preferred; `MONGODB_URI` kept for backward compatibility. */
export const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/academic_verification';

/** Node API listen port when `PORT` is unset. */
export const DEFAULT_PORT = 3000;

/**
 * FastAPI AI service base URL when `AI_SERVICE_URL` is unset.
 * Override in `.env` (e.g. http://localhost:8000 for local Python service).
 */
export const DEFAULT_AI_SERVICE_URL = 'http://localhost:8000';

/**
 * Single shared uploads root for local + Docker.
 * Default: <repo>/uploads (same folder Compose mounts as ./uploads → /app/uploads).
 * Override with absolute `UPLOAD_DIR` in Docker (`/app/uploads`).
 */
export const DEFAULT_UPLOAD_DIR = path.join(monorepoRoot, 'uploads');

export function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || DEFAULT_MONGO_URI;
}

export function getPort() {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  return Number(raw);
}

export function getAiServiceUrl() {
  return String(process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL).replace(/\/$/, '');
}

export function getUploadDir() {
  const configured = process.env.UPLOAD_DIR;
  if (!configured || !String(configured).trim()) {
    return DEFAULT_UPLOAD_DIR;
  }
  const raw = String(configured).trim();
  if (path.isAbsolute(raw)) {
    return path.resolve(raw);
  }
  // Relative paths resolve from the monorepo root (not cwd), so local/Docker stay aligned.
  return path.resolve(monorepoRoot, raw);
}

/** Join paths under the configured upload root (student files, assignments, previews). */
export function uploadPath(...segments) {
  return path.join(getUploadDir(), ...segments);
}

export function getBackendRoot() {
  return backendRoot;
}

export function getMonorepoRoot() {
  return monorepoRoot;
}
