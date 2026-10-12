import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixArrayColumnsToJsonb1738033200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert instructions from text to jsonb
    await queryRunner.query(`
      ALTER TABLE recipe
      ALTER COLUMN instructions TYPE jsonb
      USING CASE
        WHEN instructions IS NULL THEN NULL
        WHEN instructions = '' THEN NULL
        ELSE ('["' || REPLACE(REPLACE(instructions, '"', '\\"'), ',', '","') || '"]')::jsonb
      END
    `);

    // Convert categories from text to jsonb
    await queryRunner.query(`
      ALTER TABLE recipe
      ALTER COLUMN categories TYPE jsonb
      USING CASE
        WHEN categories IS NULL THEN NULL
        WHEN categories = '' THEN NULL
        ELSE ('["' || REPLACE(REPLACE(categories, '"', '\\"'), ',', '","') || '"]')::jsonb
      END
    `);

    // Convert tags from text to jsonb
    await queryRunner.query(`
      ALTER TABLE recipe
      ALTER COLUMN tags TYPE jsonb
      USING CASE
        WHEN tags IS NULL THEN NULL
        WHEN tags = '' THEN NULL
        ELSE ('["' || REPLACE(REPLACE(tags, '"', '\\"'), ',', '","') || '"]')::jsonb
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert instructions back to text (simple-array format)
    await queryRunner.query(`
      ALTER TABLE recipe
      ALTER COLUMN instructions TYPE text
      USING CASE
        WHEN instructions IS NULL THEN NULL
        ELSE ARRAY_TO_STRING(ARRAY(SELECT jsonb_array_elements_text(instructions)), ',')
      END
    `);

    // Revert categories back to text
    await queryRunner.query(`
      ALTER TABLE recipe
      ALTER COLUMN categories TYPE text
      USING CASE
        WHEN categories IS NULL THEN NULL
        ELSE ARRAY_TO_STRING(ARRAY(SELECT jsonb_array_elements_text(categories)), ',')
      END
    `);

    // Revert tags back to text
    await queryRunner.query(`
      ALTER TABLE recipe
      ALTER COLUMN tags TYPE text
      USING CASE
        WHEN tags IS NULL THEN NULL
        ELSE ARRAY_TO_STRING(ARRAY(SELECT jsonb_array_elements_text(tags)), ',')
      END
    `);
  }
}
