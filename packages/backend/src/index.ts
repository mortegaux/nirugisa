import { config } from './config';
import { AppDataSource } from './db/data-source';
import { AdminInitService } from './services/admin/admin-init.service';
import { TaxonomyService } from './services/taxonomy/taxonomy.service';
import { ImageStorageService } from './services/image-storage.service';
import { EmailService } from './services/email/email.service';
import { SystemSettingsService } from './services/settings/system-settings.service';
import { createApp } from './app';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

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

  // Initialize unified image storage (sync disk <-> PostgreSQL)
  await ImageStorageService.initialize();
  console.log('✓ Image storage initialized');

  // Initialize SMTP settings table
  await EmailService.initialize();
  console.log('✓ Email settings initialized');

  // Initialize system settings table (e.g., shared recipe catalog toggle)
  await SystemSettingsService.initialize();
  console.log('✓ System settings initialized');

  // Initialize admin account
  await AdminInitService.initializeAdminAccount();

  // Seed per-user taxonomy data (idempotent; covers existing users at every startup)
  const taxonomyService = new TaxonomyService();
  await taxonomyService.seedForAllUsers();
  console.log('✓ Taxonomy data seeded');

  const app = createApp();

  // Start server
  app.listen(config.port, config.host, () => {
    console.log(`✓ Server running on http://${config.host}:${config.port}`);
    console.log(`✓ Environment: ${config.env}`);
  });
}

bootstrap();
