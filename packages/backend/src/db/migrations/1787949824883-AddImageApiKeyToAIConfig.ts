import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageApiKeyToAIConfig1787949824883 implements MigrationInterface {
  name = 'AddImageApiKeyToAIConfig1787949824883';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_configs')) {
      await queryRunner.query(`ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "image_api_key" character varying;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_configs')) {
      await queryRunner.query(`ALTER TABLE "ai_configs" DROP COLUMN IF EXISTS "image_api_key";`);
    }
  }
}
