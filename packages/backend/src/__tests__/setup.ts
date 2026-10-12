import fs from 'fs';
import { AppDataSource } from '../db/data-source';
import { getAuthDb } from '../lib/auth';
import { config } from '../config';

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

afterEach(async () => {
  const entities = AppDataSource.entityMetadatas;
  await AppDataSource.query('PRAGMA foreign_keys = OFF');
  try {
    for (const entity of entities) {
      await AppDataSource.query(`DELETE FROM "${entity.tableName}"`);
    }
    for (const authTable of ['session', 'account', 'verification', 'user']) {
      await AppDataSource.query(`DELETE FROM "${authTable}"`).catch(() => {});
    }
  } finally {
    await AppDataSource.query('PRAGMA foreign_keys = ON');
  }
});

afterAll(async () => {
  try {
    getAuthDb().close();
  } catch {
    // Ignore if already closed
  }
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  if (config.database.path && config.database.path !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.unlinkSync(`${config.database.path}${suffix}`);
      } catch {
        // Ignore if file does not exist
      }
    }
  }
});
