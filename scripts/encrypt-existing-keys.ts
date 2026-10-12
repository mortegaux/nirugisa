import 'dotenv/config';
import { DataSource } from 'typeorm';
import { encrypt, isEncrypted } from '../packages/backend/src/utils/crypto';

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'nommable',
    username: process.env.DATABASE_USER || 'nommable',
    password: process.env.DATABASE_PASSWORD || 'nommable_password',
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const result = await dataSource.query(
    'SELECT id, api_key FROM ai_configs WHERE api_key IS NOT NULL'
  );

  let migrated = 0;
  let skipped = 0;

  for (const row of result) {
    if (isEncrypted(row.api_key)) {
      skipped++;
      continue;
    }

    const encrypted = encrypt(row.api_key);
    await dataSource.query('UPDATE ai_configs SET api_key = $1 WHERE id = $2', [
      encrypted,
      row.id,
    ]);
    migrated++;
  }

  console.log(`Migration complete: ${migrated} keys encrypted, ${skipped} already encrypted`);
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
