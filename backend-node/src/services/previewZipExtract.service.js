import fsSync from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export const PREVIEW_MAX_EXTRACT_FILES = Number(process.env.PREVIEW_MAX_EXTRACT_FILES || 3000);
export const PREVIEW_MAX_EXTRACT_BYTES = Number(process.env.PREVIEW_MAX_EXTRACT_BYTES || 104_857_600);

const SKIP_DIR_SEGMENTS = new Set([
  'node_modules',
  '.git',
  '__macosx',
  'vendor',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.idea',
  '.vscode',
]);

const SKIP_FILE_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

/** Paths inside ZIP that are never needed for preview (saves file-count quota). */
export function shouldSkipZipEntry(entryName) {
  const cleaned = String(entryName).replace(/\\/g, '/').replace(/^\/+/, '');
  const lower = cleaned.toLowerCase();
  const base = path.posix.basename(lower);
  if (SKIP_FILE_NAMES.has(base)) return true;
  const parts = lower.split('/').filter(Boolean);
  return parts.some((seg) => SKIP_DIR_SEGMENTS.has(seg));
}

/**
 * Safely extract a student project ZIP for Docker preview.
 * Skips node_modules, .git, __MACOSX, etc. so HTML/CSS asset folders fit within limits.
 */
export function safeExtractProjectZip(zipAbs, destDir) {
  let zip;
  try {
    zip = new AdmZip(zipAbs);
  } catch (e) {
    const err = new Error(`Invalid or corrupt ZIP archive: ${e.message || 'unreadable'}`);
    err.status = 400;
    throw err;
  }

  let entries;
  try {
    entries = zip.getEntries();
  } catch (e) {
    const err = new Error(`Corrupt ZIP central directory: ${e.message || 'truncated archive'}`);
    err.status = 400;
    throw err;
  }
  let totalBytes = 0;
  let fileCount = 0;
  let skipped = 0;
  const destResolved = path.resolve(destDir);

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const raw = entry.entryName.replace(/\\/g, '/');
    if (shouldSkipZipEntry(raw)) {
      skipped += 1;
      continue;
    }

    fileCount += 1;
    if (fileCount > PREVIEW_MAX_EXTRACT_FILES) {
      const err = new Error(
        `Archive has too many files (${fileCount}+). Limit is ${PREVIEW_MAX_EXTRACT_FILES}. ` +
          'Remove node_modules, .git, or __MACOSX from the ZIP, or submit only HTML/CSS/assets needed for the site.'
      );
      err.status = 400;
      throw err;
    }

    if (raw.startsWith('/') || raw.includes('..')) {
      const err = new Error('Unsafe path in archive');
      err.status = 400;
      throw err;
    }

    const target = path.resolve(destDir, raw);
    if (!target.startsWith(destResolved + path.sep) && target !== destResolved) {
      const err = new Error('Path traversal blocked in archive');
      err.status = 400;
      throw err;
    }

    let data;
    try {
      data = entry.getData();
    } catch (e) {
      const err = new Error(`Corrupt file inside archive (${raw}): ${e.message || 'read failed'}`);
      err.status = 400;
      throw err;
    }
    totalBytes += data.length;
    if (totalBytes > PREVIEW_MAX_EXTRACT_BYTES) {
      const err = new Error(
        `Extracted size exceeds limit (${Math.round(PREVIEW_MAX_EXTRACT_BYTES / 1_048_576)} MB). ` +
          'Submit a smaller ZIP without node_modules or large unused assets.'
      );
      err.status = 400;
      throw err;
    }

    fsSync.mkdirSync(path.dirname(target), { recursive: true });
    fsSync.writeFileSync(target, data);
  }

  return { fileCount, skipped, totalBytes };
}
