import { MigrationInterface, QueryRunner } from "typeorm";

export class AddByokToAIConfig1787949824886 implements MigrationInterface {
    name = 'AddByokToAIConfig1787949824886'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Distinguish the single instance-wide (admin-managed) AI config from per-user BYOK rows.
        await queryRunner.query(`ALTER TABLE "ai_configs" ADD "is_global" boolean NOT NULL DEFAULT false`);
        // Admin-configurable key distribution mode ('shared' | 'per-user'); only read from the global row.
        await queryRunner.query(`ALTER TABLE "ai_configs" ADD "ai_mode" character varying NOT NULL DEFAULT 'shared'`);
        // Backfill: the earliest config row is the pre-existing admin global config.
        // (The admin panel's 409 guard meant existing instances have exactly one row.)
        await queryRunner.query(`UPDATE "ai_configs" SET "is_global" = true WHERE "id" = (SELECT "id" FROM "ai_configs" ORDER BY "created_at" ASC LIMIT 1)`);
        // One personal key per user; the global row is exempt from this constraint.
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_ai_configs_user_personal" ON "ai_configs" ("user_id") WHERE "is_global" = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_ai_configs_user_personal"`);
        await queryRunner.query(`ALTER TABLE "ai_configs" DROP COLUMN "ai_mode"`);
        await queryRunner.query(`ALTER TABLE "ai_configs" DROP COLUMN "is_global"`);
    }
}
