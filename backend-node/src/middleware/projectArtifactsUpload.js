import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staging = path.join(__dirname, '../../uploads/project-code-staging');

if (!fs.existsSync(staging)) {
  fs.mkdirSync(staging, { recursive: true });
}

const maxZipBytes = Number(process.env.MAX_PROJECT_ZIP_BYTES || 52_428_800);
const maxImageBytes = Number(process.env.MAX_PROJECT_SCREENSHOT_BYTES || 5_242_880);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, staging),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === 'projectScreenshot' ? '.png' : '.zip');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

export const uploadProjectArtifacts = multer({
  storage,
  limits: { fileSize: maxZipBytes },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (file.fieldname === 'codeArchive') {
      const ok =
        name.endsWith('.zip') ||
        file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed';
      if (!ok) return cb(new Error('Only .zip archives are allowed for project code.'));
      return cb(null, true);
    }
    if (file.fieldname === 'projectScreenshot') {
      if (!String(file.mimetype || '').startsWith('image/')) {
        return cb(new Error('Project screenshot must be an image (PNG, JPG, or WebP).'));
      }
      if (file.size && file.size > maxImageBytes) {
        return cb(new Error('Screenshot is too large (max 5 MB).'));
      }
      return cb(null, true);
    }
    return cb(new Error(`Unexpected upload field: ${file.fieldname}`));
  },
}).fields([
  { name: 'codeArchive', maxCount: 1 },
  { name: 'projectScreenshot', maxCount: 1 },
]);

export const uploadProjectScreenshotOnly = multer({
  storage,
  limits: { fileSize: maxImageBytes },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      return cb(new Error('Project screenshot must be an image (PNG, JPG, or WebP).'));
    }
    cb(null, true);
  },
}).single('projectScreenshot');
