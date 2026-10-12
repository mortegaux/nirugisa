import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddUserNames1738036800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("users", new TableColumn({
            name: "first_name",
            type: "varchar",
            isNullable: true,
        }));

        await queryRunner.addColumn("users", new TableColumn({
            name: "last_name",
            type: "varchar",
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("users", "first_name");
        await queryRunner.dropColumn("users", "last_name");
    }
}
