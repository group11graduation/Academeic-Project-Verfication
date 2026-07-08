import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDb } from './config/db.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { submissionErrorHandler } from './middleware/submissionErrorHandler.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';
import publicRoutes from './routes/public.routes.js';
import { getPort, getUploadDir } from './config/env.js';
import { validateAuthSecretsAtStartup } from './config/auth.js';

validateAuthSecretsAtStartup();

const app = express();

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);
const corsOrigins = [...new Set([...defaultDevOrigins, ...configuredOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser and same-origin requests that may not send Origin.
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    // Dev-friendly fallback: allow localhost / 127.0.0.1 from any port.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(getUploadDir()));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'academic-verification-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', uploadRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/teacher', requireAuth, teacherRoutes);
app.use('/api/student', requireAuth, studentRoutes);

app.use(submissionErrorHandler);
app.use(errorHandler);

const port = getPort();

connectDb()
  .then(() => {
    app.listen(port, () => logger.info(`API listening on port ${port}`));
    if (process.env.DOCKER_PREVIEW_ENABLED !== 'false') {
      import('./services/previewWorkspaceCache.service.js')
        .then(({ ensurePreviewDependencyCacheDirs }) =>
          ensurePreviewDependencyCacheDirs().catch(() => {})
        )
        .catch(() => {});
      import('./services/dockerOrchestrator.service.js')
        .then(({ ensurePreviewMongoImage, ensurePreviewMysqlImage, warmPreviewBaseImages, previewWarmBaseImagesEnabled }) => {
          if (process.env.PREVIEW_WARM_MONGO_IMAGE !== 'false') {
            ensurePreviewMongoImage()
              .then((r) => logger.info(r.pulled ? 'Preview MongoDB image downloaded' : 'Preview MongoDB image ready'))
              .catch((err) => logger.warn(`Preview MongoDB warm-up: ${err.message}`));
          }
          if (process.env.PREVIEW_WARM_MYSQL_IMAGE !== 'false') {
            ensurePreviewMysqlImage()
              .then((r) => logger.info(r.pulled ? 'Preview MariaDB image downloaded' : 'Preview MariaDB image ready'))
              .catch((err) => logger.warn(`Preview MariaDB warm-up: ${err.message}`));
          }
          if (previewWarmBaseImagesEnabled()) {
            warmPreviewBaseImages()
              .then((r) =>
                logger.info(
                  `Preview base images: node=${r.node}, flutter=${r.flutter}, php=${r.php}, jupyter=${r.jupyter}, spring=${r.springReact}`
                )
              )
              .catch((err) => logger.warn(`Preview base warm-up: ${err.message}`));
          }
        })
        .catch(() => {});
      import('./services/previewSandbox.service.js')
        .then(({ restoreRunningPreviewTtls }) =>
          restoreRunningPreviewTtls().catch((err) => logger.warn(`Preview TTL restore: ${err.message}`))
        )
        .catch(() => {});
    }
  })
  .catch((err) => {
    logger.error('Failed to start', err);
    process.exit(1);
  });
