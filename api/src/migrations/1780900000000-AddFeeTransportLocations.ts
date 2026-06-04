import { MigrationInterface, QueryRunner } from "typeorm";

// migration-allow: up() is purely additive (two nullable per-month
// boarding/drop columns on fees, so transport tenants can vary pickup/drop
// month-wise); only down() drops them — the expected rollback, no data loss
// in the forward path.
export class AddFeeTransportLocations1780900000000 implements MigrationInterface {
    name = 'AddFeeTransportLocations1780900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fees" ADD "pickup_location" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "fees" ADD "drop_location" character varying(200)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fees" DROP COLUMN "drop_location"`);
        await queryRunner.query(`ALTER TABLE "fees" DROP COLUMN "pickup_location"`);
    }

}
