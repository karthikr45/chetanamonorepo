import { MigrationInterface, QueryRunner } from "typeorm";

// migration-allow: deliberately drops the now-unused "branch" column from every
// table that carried it (and the two composite constraints/indexes that
// referenced it). The branch concept has been removed from the data model;
// schoolCode remains the institution identifier. down() restores the columns
// and constraints (best-effort — NOT NULL branches come back with DEFAULT '').
export class RemoveBranchColumns1780600000000 implements MigrationInterface {
    name = 'RemoveBranchColumns1780600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── fees ── replace the branch-keyed unique + index ──────────────
        await queryRunner.query(`ALTER TABLE "fees" DROP CONSTRAINT "uq_fees_tenant_branch_student_year_term"`);
        await queryRunner.query(`DROP INDEX "public"."idx_fees_tenant_branch_year"`);
        await queryRunner.query(`ALTER TABLE "fees" DROP COLUMN "branch"`);
        await queryRunner.query(`ALTER TABLE "fees" ADD CONSTRAINT "uq_fees_tenant_student_year_term" UNIQUE ("tenant_id", "student_id", "academic_year", "term")`);
        await queryRunner.query(`CREATE INDEX "idx_fees_tenant_year" ON "fees" ("tenant_id", "academic_year") `);

        // ── fee_payments ─────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "fee_payments" DROP COLUMN "branch"`);

        // ── parent_students ── replace the branch-keyed unique + index ───
        await queryRunner.query(`ALTER TABLE "parent_students" DROP CONSTRAINT "uq_parent_students_link"`);
        await queryRunner.query(`DROP INDEX "public"."idx_parent_students_lookup"`);
        await queryRunner.query(`ALTER TABLE "parent_students" DROP COLUMN "branch"`);
        await queryRunner.query(`ALTER TABLE "parent_students" ADD CONSTRAINT "uq_parent_students_link" UNIQUE ("parent_id", "tenant_id", "admission_number")`);
        await queryRunner.query(`CREATE INDEX "idx_parent_students_lookup" ON "parent_students" ("tenant_id", "admission_number") `);

        // ── plain column drops ───────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "penalty_rules" DROP COLUMN "branch"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "branch"`);
        await queryRunner.query(`ALTER TABLE "adjustment_approvals" DROP COLUMN "branch"`);
        await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN "branch"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ── plain column re-adds ─────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "admins" ADD "branch" character varying`);
        await queryRunner.query(`ALTER TABLE "adjustment_approvals" ADD "branch" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "media" ADD "branch" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "penalty_rules" ADD "branch" character varying(100)`);

        // ── parent_students ──────────────────────────────────────────────
        await queryRunner.query(`DROP INDEX "public"."idx_parent_students_lookup"`);
        await queryRunner.query(`ALTER TABLE "parent_students" DROP CONSTRAINT "uq_parent_students_link"`);
        await queryRunner.query(`ALTER TABLE "parent_students" ADD "branch" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "parent_students" ADD CONSTRAINT "uq_parent_students_link" UNIQUE ("parent_id", "tenant_id", "branch", "admission_number")`);
        await queryRunner.query(`CREATE INDEX "idx_parent_students_lookup" ON "parent_students" ("tenant_id", "branch", "admission_number") `);

        // ── fee_payments ─────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "fee_payments" ADD "branch" character varying(100) NOT NULL DEFAULT ''`);

        // ── fees ─────────────────────────────────────────────────────────
        await queryRunner.query(`DROP INDEX "public"."idx_fees_tenant_year"`);
        await queryRunner.query(`ALTER TABLE "fees" DROP CONSTRAINT "uq_fees_tenant_student_year_term"`);
        await queryRunner.query(`ALTER TABLE "fees" ADD "branch" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "fees" ADD CONSTRAINT "uq_fees_tenant_branch_student_year_term" UNIQUE ("tenant_id", "branch", "student_id", "academic_year", "term")`);
        await queryRunner.query(`CREATE INDEX "idx_fees_tenant_branch_year" ON "fees" ("tenant_id", "branch", "academic_year") `);
    }

}
