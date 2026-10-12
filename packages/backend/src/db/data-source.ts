import { DataSource } from 'typeorm';
import { config } from '../config';
import * as entities from './entities';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: config.database.path,
  synchronize: false, // Schema is built/upgraded by migrations on startup
  migrationsRun: true,
  logging: config.env === 'development',
  entities: Object.values(entities),
  migrations: [
    config.env === 'production'
      ? 'dist/db/migrations/*.js'
      : 'src/db/migrations/*.ts',
  ],
  subscribers: [],
});
