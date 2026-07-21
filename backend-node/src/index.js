import './config/loadRuntimeEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDb } from './config/db.js';
import { buildCorsOptions } from './config/cors.js';
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
import notificationRoutes from './routes/notification.routes.js';
import { getPort, getUploadDir } from './config/env.js';
import { validateAuthSecretsAtStartup } from './config/auth.js';

validateAuthSecretsAtStartup();

const app = express();

const corsOptions = buildCorsOptions();

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
app.use('/api/notifications', notificationRoutes);

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
