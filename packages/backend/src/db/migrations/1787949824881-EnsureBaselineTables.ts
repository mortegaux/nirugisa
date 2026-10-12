import { MigrationInterface, QueryRunner } from "typeorm";

export class EnsureBaselineTables1787949824881 implements MigrationInterface {
    name = 'EnsureBaselineTables1787949824881'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure user_invitations_role_enum exists
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."user_invitations_role_enum" AS ENUM('admin', 'user');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Ensure user_invitations table
        if (!(await queryRunner.hasTable("user_invitations"))) {
            await queryRunner.query(`CREATE TABLE "user_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "invited_by_id" uuid NOT NULL, "role" "public"."user_invitations_role_enum" NOT NULL DEFAULT 'user', "token" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "accepted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d818b0ebcc97ef5dfb67fb78674" UNIQUE ("email"), CONSTRAINT "UQ_1c885f83eb2a34fedd887e43e82" UNIQUE ("token"), CONSTRAINT "PK_c8005acb91c3ce9a7ae581eca8f" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "user_invitations" ADD CONSTRAINT "FK_8c86d668024ccbcc1701788daea" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure user_preferences table
        if (!(await queryRunner.hasTable("user_preferences"))) {
            await queryRunner.query(`CREATE TABLE "user_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "dietaryRestrictions" text, "allergies" text, "dislikes" text, "favorites" text, "preferredCuisines" text, "skillLevel" character varying(20), "maxCookingTime" integer, "householdSize" integer, "spiceTolerance" character varying(20), "budgetLevel" character varying(20), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e8cfb5b31af61cd363a6b6d7c25" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "user_preferences" ADD CONSTRAINT "FK_b6202d1cacc63a0b9c8dac2abd4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure user_stats table
        if (!(await queryRunner.hasTable("user_stats"))) {
            await queryRunner.query(`CREATE TABLE "user_stats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "totalPoints" integer NOT NULL DEFAULT '0', "currentStreak" integer NOT NULL DEFAULT '0', "longestStreak" integer NOT NULL DEFAULT '0', "lastCookingDate" date, "recipesCreated" integer NOT NULL DEFAULT '0', "mealsCooked" integer NOT NULL DEFAULT '0', "mealPlansCreated" integer NOT NULL DEFAULT '0', "cookingModeUsed" integer NOT NULL DEFAULT '0', "recipesShared" integer NOT NULL DEFAULT '0', "level" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1ef59671d5359ff63ae55ae4efa" UNIQUE ("userId"), CONSTRAINT "PK_f55fb5b508e96b05303efae93e5" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "user_stats" ADD CONSTRAINT "FK_1ef59671d5359ff63ae55ae4efa" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure user_achievements table
        if (!(await queryRunner.hasTable("user_achievements"))) {
            await queryRunner.query(`CREATE TABLE "user_achievements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "achievementKey" character varying(100) NOT NULL, "points" integer NOT NULL DEFAULT '0', "progress" integer NOT NULL DEFAULT '0', "target" integer NOT NULL DEFAULT '1', "completed" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3d94aba7e9ed55365f68b5e77fa" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "user_achievements" ADD CONSTRAINT "FK_3ac6bc9da3e8a56f3f7082012dd" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure meal_plan_templates table
        if (!(await queryRunner.hasTable("meal_plan_templates"))) {
            await queryRunner.query(`CREATE TABLE "meal_plan_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "duration" integer NOT NULL, "tags" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d6be9961e7ab6c491887e68fa8" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "meal_plan_templates" ADD CONSTRAINT "FK_8fc38837aa549c90d41fe8fff45" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure template_meals table
        if (!(await queryRunner.hasTable("template_meals"))) {
            await queryRunner.query(`CREATE TABLE "template_meals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "template_id" uuid NOT NULL, "day_offset" integer NOT NULL, "meal_type" character varying NOT NULL, "recipe_id" uuid NOT NULL, "servings" integer, "notes" text, CONSTRAINT "PK_4afe037d753b2822dac2237fdac" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "template_meals" ADD CONSTRAINT "FK_5728ca0ce7696be5bf856cc5d28" FOREIGN KEY ("template_id") REFERENCES "meal_plan_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "template_meals" ADD CONSTRAINT "FK_a9ffefa34c11d1e6cbb9f75cdb9" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure pantry_items table
        if (!(await queryRunner.hasTable("pantry_items"))) {
            await queryRunner.query(`CREATE TABLE "pantry_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "quantity" numeric(10,2) NOT NULL, "unit" character varying NOT NULL, "category" character varying NOT NULL, "location" character varying, "expiration_date" date, "purchase_date" date, "notes" text, "is_low_stock" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bb63c18ae1bc99152edd69c4a61" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "pantry_items" ADD CONSTRAINT "FK_ec53d8efe916b7c27605c885148" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure batch_cooking_plans table
        if (!(await queryRunner.hasTable("batch_cooking_plans"))) {
            await queryRunner.query(`CREATE TABLE "batch_cooking_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "recipeId" uuid NOT NULL, "name" character varying(200) NOT NULL, "description" text, "cookingDate" date NOT NULL, "batches" integer NOT NULL DEFAULT '1', "servingsPerBatch" integer NOT NULL DEFAULT '4', "storageMethod" character varying(50), "storageDuration" integer, "reheatingInstructions" text, "prepNotes" text, "status" character varying(20) NOT NULL DEFAULT 'planned', "prepChecklist" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_50a5da594cef5dcc41cc745cb79" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "batch_cooking_plans" ADD CONSTRAINT "FK_8405454646cd1386822829e48d8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "batch_cooking_plans" ADD CONSTRAINT "FK_039498c6e7e81c8f5e0862cb9c5" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        // Ensure taxonomies table
        if (!(await queryRunner.hasTable("taxonomies"))) {
            await queryRunner.query(`CREATE TABLE "taxonomies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" character varying NOT NULL, "color" character varying, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8c4ac74a3861553f82778224756" UNIQUE ("name", "type"), CONSTRAINT "PK_f8c39bce97175559a2223be37f6" PRIMARY KEY ("id"))`);
        }

        // Ensure recipe_ratings table
        if (!(await queryRunner.hasTable("recipe_ratings"))) {
            await queryRunner.query(`CREATE TABLE "recipe_ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "recipe_id" uuid NOT NULL, "rating" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b50783d5c7366d93807882fcdb9" UNIQUE ("user_id", "recipe_id"), CONSTRAINT "PK_7d54d15a0b04e9c0b0c8c6aa65d" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "recipe_ratings" ADD CONSTRAINT "FK_a3572274a6585cd5c39abdf2953" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "recipe_ratings" ADD CONSTRAINT "FK_381ec3f46df5c461be3a2e57db5" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }

        // Ensure recipe_collections table
        if (!(await queryRunner.hasTable("recipe_collections"))) {
            await queryRunner.query(`CREATE TABLE "recipe_collections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "is_favorites" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d3552c214a14bae1d49eb7afb69" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "recipe_collections" ADD CONSTRAINT "FK_4f9c6e670457365640f48bd1bd4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }

        // Ensure recipe_collection_items table
        if (!(await queryRunner.hasTable("recipe_collection_items"))) {
            await queryRunner.query(`CREATE TABLE "recipe_collection_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "collection_id" uuid NOT NULL, "recipe_id" uuid NOT NULL, "added_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8911e491689fdc6cfb0102bde48" UNIQUE ("collection_id", "recipe_id"), CONSTRAINT "PK_f1e3433a1ebb420ca08528911ba" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "recipe_collection_items" ADD CONSTRAINT "FK_8c5154fb97feaf59c2c628858d0" FOREIGN KEY ("collection_id") REFERENCES "recipe_collections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "recipe_collection_items" ADD CONSTRAINT "FK_2cc903e075100fac6bfefee43e6" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }

        // Ensure recipe_views table
        if (!(await queryRunner.hasTable("recipe_views"))) {
            await queryRunner.query(`CREATE TABLE "recipe_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "recipe_id" uuid NOT NULL, "viewed_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_14ea234f640b4df31b739bccd22" UNIQUE ("user_id", "recipe_id"), CONSTRAINT "PK_f372450f3e64a279c70582a8293" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_72fe03fa7e173d530cf5b44fa4" ON "recipe_views" ("user_id", "viewed_at")`);
            await queryRunner.query(`ALTER TABLE "recipe_views" ADD CONSTRAINT "FK_b88e6deff7cc6d012e73be02e12" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            await queryRunner.query(`ALTER TABLE "recipe_views" ADD CONSTRAINT "FK_294d74e87f765ff26faaed1f87b" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }

        // Ensure ai_configs table
        if (!(await queryRunner.hasTable("ai_configs"))) {
            await queryRunner.query(`CREATE TABLE "ai_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" character varying NOT NULL, "api_key" character varying, "model" character varying, "image_model" character varying, "image_api_key" character varying, "base_url" character varying, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e062638208222edc23b70e8c31b" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "ai_configs" ADD CONSTRAINT "FK_6b37dacc4bb9d4dd3b4f78b2cb1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Safe down migration: no destructive actions
    }
}
