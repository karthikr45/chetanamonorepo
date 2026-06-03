import { MigrationInterface, QueryRunner } from "typeorm";

// migration-allow: down() drops the two additive columns it created — expected rollback, no data loss in the forward path.
export class AddTenantConfigContainerAndReceiptLogo1780408306014 implements MigrationInterface {
    name = 'AddTenantConfigContainerAndReceiptLogo1780408306014'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenant_configurations" ADD "receipt_logo_url" text`);
        await queryRunner.query(`ALTER TABLE "tenant_configurations" ADD "storage_container_name" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenant_configurations" DROP COLUMN "storage_container_name"`);
        await queryRunner.query(`ALTER TABLE "tenant_configurations" DROP COLUMN "receipt_logo_url"`);
    }

}
