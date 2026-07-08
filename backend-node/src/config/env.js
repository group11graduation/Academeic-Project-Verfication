import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

/** Local MongoDB — `MONGO_URI` preferred; `MONGODB_URI` kept for backward compatibility. */
export const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/academic_verification';

/** Node API listen port when `PORT` is unset. */
export const DEFAULT_PORT = 3000;

/**
 * FastAPI AI service base URL when `AI_SERVICE_URL` is unset.
 * Override in `.env` (e.g. http://localhost:8000 for local Python service).
 */
export const DEFAULT_AI_SERVICE_URL = 'http://localhost:8000';

/** Relative default under backend root; override with absolute `UPLOAD_DIR` in Docker. */
export const DEFAULT_UPLOAD_DIR = path.join(backendRoot, 'uploads');

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
  return path.resolve(String(configured).trim());
}

/** Join paths under the configured upload root (student files, assignments, previews). */
export function uploadPath(...segments) {
  return path.join(getUploadDir(), ...segments);
}

export function getBackendRoot() {
  return backendRoot;
}
