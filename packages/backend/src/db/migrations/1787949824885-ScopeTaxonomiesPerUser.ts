import { MigrationInterface, QueryRunner } from "typeorm";

export class ScopeTaxonomiesPerUser1787949824885 implements MigrationInterface {
    name = 'ScopeTaxonomiesPerUser1787949824885'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add a nullable user_id column so existing rows can be backfilled first.
        await queryRunner.query(`ALTER TABLE "taxonomies" ADD "user_id" uuid`);

        // 2. Drop the old global UNIQUE(name, type) constraint BEFORE duplicating
        //    rows — otherwise the backfill INSERT below violates it.
        await queryRunner.query(`ALTER TABLE "taxonomies" DROP CONSTRAINT IF EXISTS "UQ_8c4ac74a3861553f82778224756"`);

        // 3. Duplicate each taxonomy row once per user whose recipes reference it.
        //    Recipes carry categories/tags as jsonb string arrays, so ownership is
        //    attributed via recipes.user_id (there is no recipe/tag join table).
        //    A tag used by several users' recipes gets one copy per user.
        await queryRunner.query(`
            INSERT INTO "taxonomies" ("name", "type", "color", "sort_order", "user_id", "created_at", "updated_at")
            SELECT DISTINCT t."name", t."type", t."color", t."sort_order", r."user_id", t."created_at", t."updated_at"
            FROM "taxonomies" t
            JOIN "recipes" r ON (
                (t."type" = 'category' AND r."categories" IS NOT NULL AND jsonb_typeof(r."categories") = 'array' AND r."categories" @> jsonb_build_array(t."name"))
                OR
                (t."type" = 'tag' AND r."tags" IS NOT NULL AND jsonb_typeof(r."tags") = 'array' AND r."tags" @> jsonb_build_array(t."name"))
            )
            WHERE t."user_id" IS NULL
        `);

        // 4. Drop the original global rows that now have per-user copies.
        await queryRunner.query(`
            DELETE FROM "taxonomies" t
            WHERE t."user_id" IS NULL
              AND EXISTS (
                SELECT 1 FROM "taxonomies" c
                WHERE c."user_id" IS NOT NULL
                  AND c."name" = t."name"
                  AND c."type" = t."type"
              )
        `);

        // 5. Taxonomies that no recipe references (e.g. the curated seed defaults)
        //    are attributed to the earliest-created user (normally the system admin)
        //    so they are preserved. On a brand-new database with no users yet there
        //    is nobody to attribute them to; they are dropped and the startup
        //    seeder recreates the defaults once the admin account exists.
        await queryRunner.query(`
            UPDATE "taxonomies" t
            SET "user_id" = (SELECT u."id" FROM "users" u ORDER BY u."created_at" ASC LIMIT 1)
            WHERE t."user_id" IS NULL
              AND EXISTS (SELECT 1 FROM "users")
        `);
        await queryRunner.query(`DELETE FROM "taxonomies" WHERE "user_id" IS NULL`);

        // 6. Enforce per-user ownership and composite uniqueness.
        await queryRunner.query(`ALTER TABLE "taxonomies" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "taxonomies" ADD CONSTRAINT "FK_taxonomies_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "taxonomies" ADD CONSTRAINT "UQ_taxonomies_user_id_name_type" UNIQUE ("user_id", "name", "type")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "taxonomies" DROP CONSTRAINT "UQ_taxonomies_user_id_name_type"`);
        await queryRunner.query(`ALTER TABLE "taxonomies" DROP CONSTRAINT "FK_taxonomies_user_id"`);
        // Collapse back to a single global row per (name, type), keeping the
        // lowest id as the survivor (arbitrary but deterministic).
        await queryRunner.query(`
            DELETE FROM "taxonomies" a
            USING "taxonomies" b
            WHERE a."name" = b."name"
              AND a."type" = b."type"
              AND a."id" > b."id"
        `);
        await queryRunner.query(`ALTER TABLE "taxonomies" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "taxonomies" ADD CONSTRAINT "UQ_8c4ac74a3861553f82778224756" UNIQUE ("name", "type")`);
    }

}
