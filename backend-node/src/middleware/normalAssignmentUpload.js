import fs from 'fs';
import path from 'path';
import multer from 'multer';

const baseDir = path.join(process.cwd(), 'uploads', 'normal-assignment-staging');
fs.mkdirSync(baseDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, baseDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

const allowedExt = new Set([
  '.pdf', '.txt', '.md', '.docx', '.json', '.csv', '.ipynb',
  '.js', '.jsx', '.ts', '.tsx', '.java', '.py', '.c', '.cpp', '.cs', '.go', '.php', '.rb',
]);

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!allowedExt.has(ext)) {
    const err = new Error(
      'Unsupported file type. Allowed: pdf, txt, md, docx, json, csv, ipynb, js/jsx/ts/tsx, java, py, c/cpp, cs, go, php, rb.'
    );
    err.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(err);
  }
  cb(null, true);
}

export const uploadNormalAssignmentFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});
