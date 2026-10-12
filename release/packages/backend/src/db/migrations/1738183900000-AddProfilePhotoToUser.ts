import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddProfilePhotoToUser1738183900000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("users", new TableColumn({
            name: "profile_photo_url",
            type: "varchar",
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("users", "profile_photo_url");
    }
}
