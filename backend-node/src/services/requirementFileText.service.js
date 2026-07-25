import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { getUploadDir } from '../config/env.js';
import { logger } from '../config/logger.js';

const TEXT_EXTS = new Set(['.txt', '.md', '.csv', '.json', '.text']);
const MAX_CHARS = Number(process.env.AI_REQUIREMENT_FILE_MAX_CHARS || 12000);

/**
 * Resolve teacher requirement file paths stored as:
 * - assignment-requirements/foo.docx
 * - /uploads/assignment-requirements/foo.docx
 * - uploads/assignment-requirements/foo.docx
 * - absolute paths under the real upload root
 *
 * IMPORTANT: DB paths often look like `/uploads/...`. On both Windows and Linux,
 * `path.isAbsolute('/uploads/...')` is true, so we must NOT treat those as OS roots —
 * they are web paths relative to UPLOAD_DIR.
 */
export function resolveRequirementFilePath(fileRef) {
  const raw = String(fileRef || '').trim();
  if (!raw) return null;

  const uploadRoot = path.resolve(getUploadDir());
  let cleaned = raw.replace(/\\/g, '/').trim();

  // Strip URL/query fragments if any.
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Web-style upload URLs → relative to upload root.
  cleaned = cleaned.replace(/^https?:\/\/[^/]+/i, '');
  if (cleaned.startsWith('/uploads/')) cleaned = cleaned.slice('/uploads/'.length);
  else if (cleaned.startsWith('uploads/')) cleaned = cleaned.slice('uploads/'.length);
  else if (cleaned === '/uploads' || cleaned === 'uploads') cleaned = '';

  cleaned = cleaned.replace(/^\/+/, '');

  // True absolute path (e.g. /app/uploads/... or D:\...\uploads\...)
  if (path.isAbsolute(raw.replace(/\\/g, '/'))) {
    const absRaw = path.resolve(raw);
    const rootWithSep = uploadRoot.endsWith(path.sep) ? uploadRoot : uploadRoot + path.sep;
    if (absRaw === uploadRoot || absRaw.startsWith(rootWithSep)) {
      return absRaw;
    }
    // Absolute but outside upload root and looks like a mistaken `/uploads/...` web path:
    // fall through and join cleaned relative segment under upload root.
  }

  if (!cleaned) return null;
  return path.resolve(uploadRoot, cleaned);
}

async function extractPdfText(absPath) {
  try {
    const mod = await import('pdf-parse');
    const pdfParse = mod.default || mod;
    const buf = await fs.readFile(absPath);
    const data = await pdfParse(buf);
    return String(data?.text || '').trim();
  } catch (e) {
    logger.warn(`[requirement-file] PDF extract failed for ${absPath}: ${e.message || e}`);
    return '';
  }
}

/**
 * Extract plain text from an uploaded requirements file (docx / txt / md / pdf).
 */
export async function extractRequirementFileText(fileRef) {
  const abs = resolveRequirementFilePath(fileRef);
  if (!abs) return '';

  try {
    await fs.access(abs);
  } catch {
    logger.warn(`[requirement-file] missing on disk: ${abs} (from ref: ${fileRef})`);
    return '';
  }

  const ext = path.extname(abs).toLowerCase();
  try {
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: abs });
      return String(result.value || '').trim().slice(0, MAX_CHARS);
    }
    if (TEXT_EXTS.has(ext)) {
      const text = await fs.readFile(abs, 'utf8');
      return String(text || '').trim().slice(0, MAX_CHARS);
    }
    if (ext === '.pdf') {
      return (await extractPdfText(abs)).slice(0, MAX_CHARS);
    }
    if (ext === '.doc') {
      logger.warn(
        `[requirement-file] legacy .doc not supported (${abs}); ask teacher to re-upload as .docx`
      );
      return '';
    }
    // Unknown binary — try utf8 as last resort (may be empty garbage).
    const raw = await fs.readFile(abs, 'utf8').catch(() => '');
    return String(raw || '').trim().slice(0, MAX_CHARS);
  } catch (e) {
    logger.warn(`[requirement-file] extract failed for ${abs}: ${e.message || e}`);
    return '';
  }
}

/**
 * Load FE + BE collaborative requirement file texts (and optional typed text).
 */
export async function loadCollaborativeRequirementFileTexts(assignment) {
  const fe = assignment?.frontendTechRequirements || {};
  const be = assignment?.backendTechRequirements || {};

  const [feFileText, beFileText] = await Promise.all([
    fe.requirementFile ? extractRequirementFileText(fe.requirementFile) : Promise.resolve(''),
    be.requirementFile ? extractRequirementFileText(be.requirementFile) : Promise.resolve(''),
  ]);

  const feTyped = [fe.requirementText, fe.description].map((x) => String(x || '').trim()).filter(Boolean).join('\n');
  const beTyped = [be.requirementText, be.description].map((x) => String(x || '').trim()).filter(Boolean).join('\n');

  return {
    frontendText: [feTyped, feFileText].filter(Boolean).join('\n\n').trim(),
    backendText: [beTyped, beFileText].filter(Boolean).join('\n\n').trim(),
    frontendFileLoaded: Boolean(fe.requirementFile),
    backendFileLoaded: Boolean(be.requirementFile),
    frontendFileEmpty: Boolean(fe.requirementFile) && !feFileText && !feTyped,
    backendFileEmpty: Boolean(be.requirementFile) && !beFileText && !beTyped,
  };
}
