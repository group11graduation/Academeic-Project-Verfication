import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadPath } from '../config/env.js';

const staging = uploadPath('project-code-staging');

if (!fs.existsSync(staging)) {
  fs.mkdirSync(staging, { recursive: true });
}

const maxBytes = Number(process.env.MAX_PROJECT_ZIP_BYTES || 52_428_800);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, staging),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.zip';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

export const uploadProjectZip = multer({
  storage,
  limits: { fileSize: maxBytes },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      name.endsWith('.zip') ||
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed';
    if (!ok) {
      return cb(new Error('Only .zip archives are allowed for project code.'));
    }
    cb(null, true);
  },
});
