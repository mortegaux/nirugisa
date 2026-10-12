import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import routes from './api/routes';
import { errorHandler } from './api/middleware';
import { swaggerSpec } from './config/swagger';
import { ImageStorageService } from './services/image-storage.service';

export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded
    })
  );
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Global rate limit: 100 req/min per IP
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  app.use(globalLimiter);

  // Serve uploaded files (from resolved upload dir, /app/uploads, and local ./uploads)
  app.use('/uploads', express.static(config.upload.dir));
  if (config.upload.dir !== '/app/uploads' && fs.existsSync('/app/uploads')) {
    app.use('/uploads', express.static('/app/uploads'));
  }
  if (config.upload.dir !== path.join(process.cwd(), 'uploads')) {
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  }

  // Fallback: if an image file is missing on disk (e.g. after container rebuild),
  // restore and serve it from PostgreSQL `stored_images`
  app.get('/uploads/:subdir/:filename', async (req, res) => {
    const { subdir, filename } = req.params;
    const restored = await ImageStorageService.getAndRestoreImage(subdir, filename);
    if (!restored) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    res.setHeader('Content-Type', restored.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(restored.buffer);
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Swagger API documentation
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Nommable API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
    })
  );

  // API routes
  app.use('/api', routes);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
