import { MigrationInterface, QueryRunner } from "typeorm";

// migration-allow: up() is purely additive (three nullable policy-URL
// columns); only down() drops them — the expected rollback, no data loss in
// the forward path.
export class AddTenantConfigPolicyUrls1780800000000 implements MigrationInterface {
    name = 'AddTenantConfigPolicyUrls1780800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenant_configurations" ADD "privacy_policy_url" text`);
        await queryRunner.query(`ALTER TABLE "tenant_configurations" ADD "terms_and_conditions_url" text`);
        await queryRunner.query(`ALTER TABLE "tenant_configurations" ADD "refund_policy_url" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenant_configurations" DROP COLUMN "refund_policy_url"`);
        await queryRunner.query(`ALTER TABLE "tenant_configurations" DROP COLUMN "terms_and_conditions_url"`);
        await queryRunner.query(`ALTER TABLE "tenant_configurations" DROP COLUMN "privacy_policy_url"`);
    }

}
