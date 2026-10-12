import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageModelToAIConfig1787949824882 implements MigrationInterface {
  name = 'AddImageModelToAIConfig1787949824882';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_configs')) {
      await queryRunner.query(`ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "image_model" character varying;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_configs')) {
      await queryRunner.query(`ALTER TABLE "ai_configs" DROP COLUMN IF EXISTS "image_model";`);
    }
  }
}
