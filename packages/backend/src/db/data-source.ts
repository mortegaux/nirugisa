import { DataSource } from 'typeorm';
import { config } from '../config';
import * as entities from './entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.name,
  synchronize: config.database.synchronize, // Controlled by DB_SYNCHRONIZE (see config); use migrations for managed prod DBs
  // When synchronize is off, build/upgrade the schema by running migrations on startup.
  migrationsRun: !config.database.synchronize,
  logging: config.env === 'development',
  entities: Object.values(entities),
  migrations: [
    config.env === 'production'
      ? 'dist/db/migrations/*.js'
      : 'src/db/migrations/*.ts',
  ],
  subscribers: [],
});
