import { MigrationInterface, QueryRunner } from "typeorm";

// migration-allow: consolidates the fee-payment ledger into the single
// `payments` table. Expands `payments` with the ledger columns (method,
// receipt_number, clearance, cheque/DD/bank, recorded_by, …), switches money
// columns to rupees `numeric(12,2)`, then drops the now-redundant
// `fee_payments` table. Greenfield rollout — no data backfill. down()
// recreates `fee_payments` and reverts `payments` to its prior shape.
export class ConsolidatePaymentsLedger1780700000000 implements MigrationInterface {
    name = 'ConsolidatePaymentsLedger1780700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Drop the separate fee_payments table (greenfield, no backfill) ──
        await queryRunner.query(`ALTER TABLE "fee_payments" DROP CONSTRAINT IF EXISTS "FK_a6180a0dd34aa943649ac1df7eb"`);
        await queryRunner.query(`DROP TABLE "fee_payments"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."fee_payments_clearance_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."fee_payments_payment_type_enum"`);

        // ── Money columns → rupees numeric(12,2) ──
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "amount" TYPE numeric(12,2) USING ("amount"::numeric(12,2))`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "refundedAmount" TYPE numeric(12,2) USING ("refundedAmount"::numeric(12,2))`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "notes" TYPE text`);

        // ── New enums ──
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('RAZORPAY', 'CASHFREE', 'UPI', 'NETBANKING', 'CARD', 'CASH', 'CHEQUE', 'DD', 'POS', 'NEFT')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_clearance_status_enum" AS ENUM('PENDING', 'CLEARED', 'BOUNCED', 'NA')`);

        // ── Ledger columns on payments ──
        await queryRunner.query(`ALTER TABLE "payments" ADD "method" "public"."payments_method_enum"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "receipt_number" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "order_id" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "transaction_id" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "dd_number" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "bank_name" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "bank_branch" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "drawer_name" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "card_last4" character varying(4)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "clearance_status" "public"."payments_clearance_status_enum" NOT NULL DEFAULT 'NA'`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "recorded_by" uuid`);

        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "uq_payments_receipt_number" UNIQUE ("receipt_number")`);
        await queryRunner.query(`CREATE INDEX "idx_payments_tenant_paid_at" ON "payments" ("tenantId", "paidAt") `);
        await queryRunner.query(`CREATE INDEX "idx_payments_tenant_clearance" ON "payments" ("tenantId", "clearance_status") `);
        await queryRunner.query(`CREATE INDEX "idx_payments_fee" ON "payments" ("fee_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ── Revert payments ──
        await queryRunner.query(`DROP INDEX "public"."idx_payments_fee"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_tenant_clearance"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_tenant_paid_at"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "uq_payments_receipt_number"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "recorded_by"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "clearance_status"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "card_last4"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "drawer_name"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "bank_branch"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "bank_name"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "dd_number"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "transaction_id"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "order_id"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "receipt_number"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "method"`);
        await queryRunner.query(`DROP TYPE "public"."payments_clearance_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "notes" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "refundedAmount" TYPE integer USING ("refundedAmount"::integer)`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "amount" TYPE integer USING ("amount"::integer)`);

        // ── Recreate fee_payments (post-RemoveBranchColumns shape: no branch) ──
        await queryRunner.query(`CREATE TYPE "public"."fee_payments_payment_type_enum" AS ENUM('RAZORPAY', 'CASHFREE', 'UPI', 'NETBANKING', 'CARD', 'CASH', 'CHEQUE', 'DD', 'POS', 'NEFT')`);
        await queryRunner.query(`CREATE TYPE "public"."fee_payments_clearance_status_enum" AS ENUM('PENDING', 'CLEARED', 'BOUNCED', 'NA')`);
        await queryRunner.query(`CREATE TABLE "fee_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "fee_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "payment_type" "public"."fee_payments_payment_type_enum" NOT NULL, "receipt_number" character varying(50), "order_id" character varying(100), "transaction_id" character varying(100), "cheque_number" character varying(50), "cheque_date" date, "dd_number" character varying(50), "dd_date" date, "bank_name" character varying(100), "bank_branch" character varying(100), "drawer_name" character varying(150), "card_last4" character varying(4), "clearance_status" "public"."fee_payments_clearance_status_enum" NOT NULL DEFAULT 'NA', "notes" text, "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "recorded_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_fp_receipt_number" UNIQUE ("receipt_number"), CONSTRAINT "chk_fp_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_9bd9fdfc57a96cadaefe822956d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_fp_fee" ON "fee_payments" ("fee_id") `);
        await queryRunner.query(`CREATE INDEX "idx_fp_tenant_paid_at" ON "fee_payments" ("tenant_id", "paid_at") `);
        await queryRunner.query(`CREATE INDEX "idx_fp_clearance_pending" ON "fee_payments" ("tenant_id", "clearance_status") `);
        await queryRunner.query(`ALTER TABLE "fee_payments" ADD CONSTRAINT "FK_a6180a0dd34aa943649ac1df7eb" FOREIGN KEY ("fee_id") REFERENCES "fees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
