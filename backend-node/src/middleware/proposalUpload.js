import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadPath } from '../config/env.js';

const staging = uploadPath('proposal-staging');

if (!fs.existsSync(staging)) {
  fs.mkdirSync(staging, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, staging),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.txt';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

export const uploadProposalFile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

