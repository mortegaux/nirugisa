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
  synchronize: true, // Auto-sync database schema (safe for self-hosted use)
  logging: config.env === 'development',
  entities: Object.values(entities),
  migrations: ['src/db/migrations/*.ts'],
  subscribers: [],
});
