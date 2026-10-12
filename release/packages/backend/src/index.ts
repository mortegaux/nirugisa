import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { AppDataSource } from './db/data-source';
import routes from './api/routes';
import { errorHandler } from './api/middleware';
import { AdminInitService } from './services/admin/admin-init.service';
import { TaxonomyService } from './services/taxonomy/taxonomy.service';
import { swaggerSpec } from './config/swagger';

async function bootstrap() {
  // Initialize database with retry logic
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await AppDataSource.initialize();
      console.log('✓ Database connected');
      break;
    } catch (error) {
      retries++;
      console.error(`Failed to connect to database (attempt ${retries}/${maxRetries}):`, error);

      if (retries === maxRetries) {
        console.error('Max retries reached. Exiting...');
        process.exit(1);
      }

      console.log(`Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Initialize admin account
  await AdminInitService.initializeAdminAccount();

  // Seed taxonomy data
  const taxonomyService = new TaxonomyService();
  await taxonomyService.seed();
  console.log('✓ Taxonomy data seeded');

  // Create Express app
  const app = express();

  // Middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded
  }));
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Swagger API documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Nommable API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  // API routes
  app.use('/api', routes);

  // Error handler (must be last)
  app.use(errorHandler);

  // Start server
  app.listen(config.port, config.host, () => {
    console.log(`✓ Server running on http://${config.host}:${config.port}`);
    console.log(`✓ Environment: ${config.env}`);
  });
}

bootstrap();
