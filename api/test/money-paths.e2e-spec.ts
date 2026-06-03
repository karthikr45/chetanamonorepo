/**
 * Money-path integration tests against a real Postgres.
 *
 * Opt-in: set RUN_DB_E2E=true with a reachable DB (the docker-compose
 * stack, a CI postgres service, or local dev). Without it the suite is
 * skipped so the default `pnpm test` / CI never needs a database.
 *
 *   RUN_DB_E2E=true DB_HOST=localhost ... pnpm test:e2e
 *
 * Covers the highest-risk flows: offline payment application, balance +
 * status transitions, overpayment rejection, cheque clearance/bounce,
 * online payment recording, and receipt-number sequencing/format.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { FeesService } from '../src/modules/fees/fees.service';
import {
  Tenant,
  ReceiptResetPolicy,
} from '../src/modules/tenants/entities/tenant.entity';
import { Student } from '../src/modules/students/entities/student.entity';
import { Fee, PaymentStatus, TermType } from '../src/modules/fees/entities/fee.entity';
import {
  FeePayment,
  ClearanceStatus,
  PaymentType,
} from '../src/modules/fees/entities/fee-payment.entity';

const run = process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

run('Money paths (e2e, Postgres)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let fees: FeesService;
  let tenantId: string;
  let studentId: string;

  const BRANCH = 'E2E-MAIN';
  const AY = '2025-2026';

  async function newFee(net: number): Promise<string> {
    const fee = await ds.getRepository(Fee).save(
      ds.getRepository(Fee).create({
        tenantId,
        academicYear: AY,
        studentId,
        term: TermType.FIRST,
        originalAmount: net.toFixed(2),
        netAmount: net.toFixed(2),
        paidAmount: '0.00',
        paymentStatus: PaymentStatus.UNPAID,
      }),
    );
    return fee.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    ds = app.get(DataSource);
    fees = app.get(FeesService);

    const tenant = await ds.getRepository(Tenant).save(
      ds.getRepository(Tenant).create({
        name: 'E2E School',
        tenantCode: `E2E-${Date.now()}`,
        tenantName: 'E2E School',
        clientId: `e2e-client-${Date.now()}`,
        secretKey: 'e2e-secret',
        receiptPrefix: 'SVBKTEST',
        receiptResetPolicy: ReceiptResetPolicy.ACADEMIC_YEAR,
        receiptStartNumber: 1,
      }),
    );
    tenantId = tenant.id;

    const student = await ds.getRepository(Student).save(
      ds.getRepository(Student).create({
        tenantId,
        schoolCode: BRANCH,
        admissionNumber: 'E2E-0001',
        academicYear: AY,
        name: 'Test Child',
        email: 'child@e2e.test',
        phoneNumber: '9999999999',
        class: 'I',
        section: 'A',
        rollNo: '1',
      }),
    );
    studentId = student.id;
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.getRepository(FeePayment).delete({ tenantId });
      await ds.getRepository(Fee).delete({ tenantId });
      await ds.getRepository(Student).delete({ tenantId });
      await ds.getRepository(Tenant).delete({ id: tenantId });
    }
    await app?.close();
  });

  it('applies a partial cash payment and moves UNPAID → PARTIAL', async () => {
    const feeId = await newFee(1000);
    const fp = await fees.recordOfflinePayment(tenantId, feeId, {
      amount: 400,
      paymentType: PaymentType.CASH,
      recordedBy: null,
    });
    expect(fp.receiptNumber).toMatch(/^SVBKTEST-2025-26-\d{4}$/);

    const fee = await ds.getRepository(Fee).findOneByOrFail({ id: feeId });
    expect(Number(fee.paidAmount)).toBe(400);
    expect(fee.paymentStatus).toBe(PaymentStatus.PARTIAL);
  });

  it('settles the remaining balance and moves PARTIAL → PAID', async () => {
    const feeId = await newFee(1000);
    await fees.recordOfflinePayment(tenantId, feeId, {
      amount: 300,
      paymentType: PaymentType.CASH,
      recordedBy: null,
    });
    await fees.recordOfflinePayment(tenantId, feeId, {
      amount: 700,
      paymentType: PaymentType.CASH,
      recordedBy: null,
    });
    const fee = await ds.getRepository(Fee).findOneByOrFail({ id: feeId });
    expect(Number(fee.paidAmount)).toBe(1000);
    expect(fee.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('rejects a payment that exceeds the remaining balance', async () => {
    const feeId = await newFee(1000);
    await expect(
      fees.recordOfflinePayment(tenantId, feeId, {
        amount: 2000,
        paymentType: PaymentType.CASH,
        recordedBy: null,
      }),
    ).rejects.toThrow(/exceeds remaining balance/i);
  });

  it('keeps a pending cheque out of paid_amount until it clears', async () => {
    const feeId = await newFee(1000);
    const fp = await fees.recordOfflinePayment(tenantId, feeId, {
      amount: 1000,
      paymentType: PaymentType.CHEQUE,
      chequeNumber: 'CHQ-1',
      recordedBy: null,
    });
    expect(fp.clearanceStatus).toBe(ClearanceStatus.PENDING);

    let fee = await ds.getRepository(Fee).findOneByOrFail({ id: feeId });
    expect(Number(fee.paidAmount)).toBe(0);
    expect(fee.paymentStatus).toBe(PaymentStatus.UNPAID);

    await fees.updateClearance(tenantId, fp.id, ClearanceStatus.CLEARED);
    fee = await ds.getRepository(Fee).findOneByOrFail({ id: feeId });
    expect(Number(fee.paidAmount)).toBe(1000);
    expect(fee.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('a bounced cheque never adds to paid_amount', async () => {
    const feeId = await newFee(1000);
    const fp = await fees.recordOfflinePayment(tenantId, feeId, {
      amount: 1000,
      paymentType: PaymentType.CHEQUE,
      chequeNumber: 'CHQ-2',
      recordedBy: null,
    });
    await fees.updateClearance(tenantId, fp.id, ClearanceStatus.BOUNCED);
    const fee = await ds.getRepository(Fee).findOneByOrFail({ id: feeId });
    expect(Number(fee.paidAmount)).toBe(0);
    expect(fee.paymentStatus).toBe(PaymentStatus.UNPAID);
  });

  it('records an online payment and increments the balance', async () => {
    const feeId = await newFee(1000);
    await fees.recordOnlinePayment(tenantId, feeId, {
      amount: 1000,
      paymentType: PaymentType.RAZORPAY,
      orderId: 'order_e2e_1',
      transactionId: 'pay_e2e_1',
      recordedBy: null,
    });
    const fee = await ds.getRepository(Fee).findOneByOrFail({ id: feeId });
    expect(Number(fee.paidAmount)).toBe(1000);
    expect(fee.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('issues sequential, unique receipt numbers within a period', async () => {
    const a = await fees.recordOfflinePayment(tenantId, await newFee(100), {
      amount: 100,
      paymentType: PaymentType.CASH,
      recordedBy: null,
    });
    const b = await fees.recordOfflinePayment(tenantId, await newFee(100), {
      amount: 100,
      paymentType: PaymentType.CASH,
      recordedBy: null,
    });
    expect(a.receiptNumber).not.toEqual(b.receiptNumber);
    const seqA = Number(a.receiptNumber!.split('-').pop());
    const seqB = Number(b.receiptNumber!.split('-').pop());
    expect(seqB).toBe(seqA + 1);
  });
});
