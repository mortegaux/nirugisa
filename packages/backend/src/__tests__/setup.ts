import { AppDataSource } from '../db/data-source';

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.synchronize(true);
});

afterEach(async () => {
  const entities = AppDataSource.entityMetadatas;
  const tableNames = entities.map((e) => `"${e.tableName}"`).join(', ');
  await AppDataSource.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE`).catch((err) => {
    console.error('TRUNCATE failed:', err.message);
    throw err;
  });
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});
