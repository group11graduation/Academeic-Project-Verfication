import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDb } from './config/db.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'academic-verification-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/teacher', requireAuth, teacherRoutes);
app.use('/api/student', requireAuth, studentRoutes);

app.use(errorHandler);

const port = Number(process.env.PORT || 5000);

connectDb()
  .then(() => {
    app.listen(port, () => logger.info(`API listening on port ${port}`));
  })
  .catch((err) => {
    logger.error('Failed to start', err);
    process.exit(1);
  });
