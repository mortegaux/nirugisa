import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFeedbackReports1787949824884 implements MigrationInterface {
    name = 'CreateFeedbackReports1787949824884'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure feedback_reports table
        if (!(await queryRunner.hasTable("feedback_reports"))) {
            await queryRunner.query(`CREATE TABLE "feedback_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "summary" character varying(200) NOT NULL, "details" text, "route" character varying(500), "user_agent" text, "viewport" character varying(64), "app_version" character varying(64), "user_id" uuid, "status" character varying NOT NULL DEFAULT 'open', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_feedback_reports_id" PRIMARY KEY ("id"))`);
            await queryRunner.query(`ALTER TABLE "feedback_reports" ADD CONSTRAINT "FK_feedback_reports_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "feedback_reports"`);
    }
}
