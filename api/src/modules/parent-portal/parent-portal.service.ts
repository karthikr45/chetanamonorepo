import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import {
  ClearanceStatus,
  FeePayment,
} from '../fees/entities/fee-payment.entity';
import {
  Payment,
  PaymentGateway,
  PaymentType,
} from '../payments/entities/payment.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ParentsService } from '../parents/parents.service';
import { PaymentsService } from '../payments/payments.service';
import { TenantConfigsService } from '../tenant-configs/tenant-configs.service';
import { FeesService } from '../fees/fees.service';
import { ReceiptStorageService } from '../fees/receipt-storage.service';
import { StudentsService } from '../students/students.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import {
  TENANT_TYPE,
  TenantTypeValue,
} from '../../common/constants/tenant';

/** One row in the cross-tenant parent payment history. */
export interface PaymentHistoryRow {
  paymentId: string;
  tenantId: string;
  tenantName: string;
  studentName: string | null;
  admissionNumber: string | null;
  academicYear: string | null;
  term: string | null;
  amount: string;
  currency: string;
  method: string | null;
  status: string;
  clearanceStatus: string;
  receiptNumber: string | null;
  paidAt: string | null;
  createdAt: string;
}

@Injectable()
export class ParentPortalService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(FeePayment)
    private readonly feePaymentRepo: Repository<FeePayment>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ParentStudent)
    private readonly linkRepo: Repository<ParentStudent>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly parentsService: ParentsService,
    private readonly paymentsService: PaymentsService,
    private readonly tenantConfigsService: TenantConfigsService,
    private readonly feesService: FeesService,
    private readonly receiptStorage: ReceiptStorageService,
    private readonly studentsService: StudentsService,
    private readonly academicYearsService: AcademicYearsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async me(tenantId: string, parentId: string) {
    const parent = await this.parentsService.findOneOrFail(tenantId, parentId);
    return {
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phoneNumber: parent.phoneNumber,
      tenantId: parent.tenantId,
      isActive: parent.isActive,
    };
  }

  /**
   * Resolves the current-academic-year Student rows for every admission
   * the parent is linked to. Falls back to the latest year row if no
   * "current" academic year is configured for the tenant.
   */
  async listChildren(tenantId: string, parentId: string): Promise<Student[]> {
    const links = await this.linkRepo.find({
      where: { parentId, tenantId },
    });
    if (!links.length) return [];

    const currentYear = await this.academicYearsService
      .findCurrentYear(tenantId)
      .catch(() => null);

    if (currentYear) {
      const students = await this.studentRepo.find({
        where: links.map((l) => ({
          tenantId,
          admissionNumber: l.admissionNumber,
          academicYear: currentYear.academicYear,
        })),
      });
      if (students.length) return students;
    }

    // Fallback: pick the most recent row per admission
    const all = await this.studentRepo.find({
      where: links.map((l) => ({
        tenantId,
        admissionNumber: l.admissionNumber,
      })),
      order: { academicYear: 'DESC', createdAt: 'DESC' },
    });

    const byKey = new Map<string, Student>();
    for (const s of all) {
      const key = `${s.schoolCode}::${s.admissionNumber}`;
      if (!byKey.has(key)) byKey.set(key, s);
    }
    return [...byKey.values()];
  }

  async ensureChildBelongsToParent(
    tenantId: string,
    parentId: string,
    studentId: string,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, tenantId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }
    const link = await this.linkRepo.findOne({
      where: {
        parentId,
        tenantId,
        admissionNumber: student.admissionNumber,
      },
    });
    if (!link) {
      throw new ForbiddenException('You are not linked to this student');
    }
    return student;
  }

  /**
   * Cross-tenant variant: the student row may live in a sibling tenant
   * (hostel / transport) while the parent_student link lives in the
   * parent's home tenant. Authorise by matching (schoolCode +
   * admissionNumber) of the sibling-tenant student against the parent's
   * links in their own tenant.
   */
  async ensureChildBelongsToParentCrossTenant(
    parentHomeTenantId: string,
    parentId: string,
    studentTenantId: string,
    studentId: string,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, tenantId: studentTenantId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }
    const link = await this.linkRepo.findOne({
      where: {
        parentId,
        tenantId: parentHomeTenantId,
        admissionNumber: student.admissionNumber,
      },
    });
    if (!link) {
      throw new ForbiddenException('You are not linked to this student');
    }
    return student;
  }

  /**
   * One child's services (school / hostel / transport) and fees across
   * the sibling tenants. Authorises the child against the parent in the
   * parent's own tenant, then aggregates by the child's school code +
   * admission number — so a parent linked in the school tenant also sees
   * the hostel/transport bills for the same person.
   */
  async childServices(tenantId: string, parentId: string, studentId: string) {
    const child = await this.ensureChildBelongsToParent(
      tenantId,
      parentId,
      studentId,
    );
    return this.studentsService.getServicesForPerson(
      child.schoolCode,
      child.admissionNumber,
      child.academicYear,
    );
  }

  async listFees(
    tenantId: string,
    parentId: string,
    studentId?: string,
  ): Promise<(Fee & { paymentId: string | null })[]> {
    let fees: Fee[];
    if (studentId) {
      await this.ensureChildBelongsToParent(tenantId, parentId, studentId);
      fees = await this.feeRepo.find({
        where: { tenantId, studentId },
        order: { academicYear: 'DESC', term: 'ASC' },
      });
    } else {
      const children = await this.listChildren(tenantId, parentId);
      if (!children.length) return [];
      fees = await this.feeRepo.find({
        where: { tenantId, studentId: In(children.map((c) => c.id)) },
        order: { academicYear: 'DESC', term: 'ASC' },
      });
    }
    return this.attachLatestReceipt(tenantId, fees);
  }

  /**
   * Tag each fee with the id of its most recent FeePayment so the portal
   * can offer a "Download receipt" link — including for fees confirmed by
   * the gateway webhook (where the client-side verify never returned one).
   */
  private async attachLatestReceipt(
    tenantId: string,
    fees: Fee[],
  ): Promise<(Fee & { paymentId: string | null })[]> {
    if (!fees.length) return [];
    const payments = await this.feePaymentRepo.find({
      where: {
        tenantId,
        feeId: In(fees.map((f) => f.id)),
        receiptNumber: Not(IsNull()),
      },
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });
    const latestByFee = new Map<string, string>();
    for (const p of payments) {
      if (!p.feeId) continue;
      if (!latestByFee.has(p.feeId)) latestByFee.set(p.feeId, p.id);
    }
    return fees.map((f) => ({
      ...f,
      paymentId: latestByFee.get(f.id) ?? null,
    }));
  }

  async listPayments(tenantId: string, parentId: string): Promise<Payment[]> {
    const children = await this.listChildren(tenantId, parentId);
    if (!children.length) return [];
    const fees = await this.feeRepo.find({
      where: { tenantId, studentId: In(children.map((c) => c.id)) },
      select: ['id'],
    });
    if (!fees.length) return [];
    return this.paymentRepo.find({
      where: { tenantId, feeId: In(fees.map((f) => f.id)) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cross-tenant payment history for a parent, matched by email across
   * EVERY school the parent is registered in. A parent has one `parents`
   * row per tenant (unique on tenant+email), so we gather all rows for the
   * email, then their children → fees → recognised payments in each tenant,
   * and return one flat list (newest first) tagged with the school name.
   * Only settled ledger entries (receipt_number set) are included.
   */
  async paymentHistoryByEmail(email: string) {
    const normalized = (email ?? '').trim().toLowerCase();
    const empty = { email: normalized, totalPaid: '0.00', count: 0, payments: [] as PaymentHistoryRow[] };
    if (!normalized) return empty;

    const parents = await this.dataSource
      .getRepository(Parent)
      .find({ where: { email: normalized, isActive: true } });
    if (!parents.length) return empty;

    const rows: PaymentHistoryRow[] = [];
    for (const parent of parents) {
      const links = await this.linkRepo.find({
        where: { parentId: parent.id, tenantId: parent.tenantId },
      });
      if (!links.length) continue;

      const admissions = [...new Set(links.map((l) => l.admissionNumber))];
      const students = await this.studentRepo.find({
        where: { tenantId: parent.tenantId, admissionNumber: In(admissions) },
      });
      if (!students.length) continue;
      const studentById = new Map(students.map((s) => [s.id, s]));

      const fees = await this.feeRepo.find({
        where: { tenantId: parent.tenantId, studentId: In(students.map((s) => s.id)) },
      });
      if (!fees.length) continue;
      const feeById = new Map(fees.map((f) => [f.id, f]));

      const payments = await this.paymentRepo.find({
        where: {
          tenantId: parent.tenantId,
          feeId: In(fees.map((f) => f.id)),
          receiptNumber: Not(IsNull()),
        },
        order: { paidAt: 'DESC' },
      });
      if (!payments.length) continue;

      const tenant = await this.tenantRepo.findOne({ where: { id: parent.tenantId } });
      const tenantName = tenant?.tenantName ?? tenant?.name ?? 'School';

      for (const p of payments) {
        const fee = p.feeId ? feeById.get(p.feeId) : undefined;
        const student = fee ? studentById.get(fee.studentId) : undefined;
        rows.push({
          paymentId: p.id,
          tenantId: parent.tenantId,
          tenantName,
          studentName: student?.name ?? null,
          admissionNumber: student?.admissionNumber ?? null,
          academicYear: fee?.academicYear ?? null,
          term: fee?.term ?? null,
          amount: p.amount,
          currency: p.currency,
          method: p.method,
          status: p.status,
          clearanceStatus: p.clearanceStatus,
          receiptNumber: p.receiptNumber,
          paidAt: p.paidAt ? p.paidAt.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
        });
      }
    }

    rows.sort((a, b) => {
      const da = new Date(a.paidAt ?? a.createdAt).getTime();
      const db = new Date(b.paidAt ?? b.createdAt).getTime();
      return db - da;
    });

    const totalPaid = rows
      .filter((r) => r.clearanceStatus !== ClearanceStatus.BOUNCED)
      .reduce((s, r) => s + Number(r.amount), 0)
      .toFixed(2);

    return { email: normalized, totalPaid, count: rows.length, payments: rows };
  }

  async dashboard(tenantId: string, parentId: string) {
    const children = await this.listChildren(tenantId, parentId);
    if (!children.length) {
      return {
        children: [],
        summary: {
          totalDue: 0,
          totalPaid: 0,
          totalPenalty: 0,
          totalPendingClearance: 0,
        },
      };
    }

    const fees = await this.feeRepo.find({
      where: { tenantId, studentId: In(children.map((c) => c.id)) },
    });

    // Pending cheques/DDs — payments that don't yet count as paid
    // but are with the school awaiting bank clearance.
    const pendingClearance = await this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .select('COALESCE(SUM(fp.amount), 0)', 'total')
      .where('fp.tenantId = :tenantId', { tenantId })
      .andWhere('fp.feeId IN (:...feeIds)', {
        feeIds: fees.length ? fees.map((f) => f.id) : [''],
      })
      .andWhere('fp.clearanceStatus = :status', {
        status: ClearanceStatus.PENDING,
      })
      .getRawOne<{ total: string }>();

    const sum = (key: 'netAmount' | 'paidAmount' | 'totalPenalty') =>
      fees.reduce((acc, f) => acc + Number(f[key] ?? 0), 0);

    const totalNet = sum('netAmount');
    const totalPaid = sum('paidAmount');
    const totalPenalty = sum('totalPenalty');
    const totalPendingClearance = Number(pendingClearance?.total ?? 0);

    // Cross-tenant outstanding (school + hostel + transport) per child,
    // linked by school code + admission across the sibling tenants. The
    // tenant-scoped numbers above stay school-only; this adds the full
    // picture so the parent sees every service's dues in one place.
    const servicesOutstandingByChild = new Map<string, string>();
    let totalOutstandingAllServices = 0;
    for (const c of children) {
      const v = await this.studentsService.getServicesForPerson(
        c.schoolCode,
        c.admissionNumber,
        c.academicYear,
      );
      servicesOutstandingByChild.set(c.id, v.totalOutstanding);
      totalOutstandingAllServices += Number(v.totalOutstanding);
    }

    const perChild = children.map((c) => {
      const childFees = fees.filter((f) => f.studentId === c.id);
      const due = childFees.reduce(
        (a, f) => a + (Number(f.netAmount) - Number(f.paidAmount)),
        0,
      );
      return {
        student: {
          id: c.id,
          name: c.name,
          admissionNumber: c.admissionNumber,
          class: c.class,
          section: c.section,
          rollNo: c.rollNo,
          academicYear: c.academicYear,
          imgUrl: c.imgUrl,
        },
        feesCount: childFees.length,
        amountDue: Math.max(0, due),
        servicesOutstanding: servicesOutstandingByChild.get(c.id) ?? '0.00',
      };
    });

    return {
      children: perChild,
      summary: {
        totalDue: Math.max(0, totalNet - totalPaid),
        totalPaid,
        totalPenalty,
        totalPendingClearance,
        totalOutstandingAllServices: totalOutstandingAllServices.toFixed(2),
      },
    };
  }

  /**
   * Initiate an online payment for a fee against the parent's child.
   * Validates the fee belongs to a child this parent is linked to, then
   * delegates to the existing PaymentsService.createOrder.
   */
  /**
   * Gateway is read from the STUDENT'S tenant_configurations — not the
   * parent's home tenant. A parent linked in the school tenant may pay
   * hostel/transport fees that live in sibling tenants, and the money
   * must route to that sibling tenant's configured gateway.
   * Clients cannot pick a different gateway than the school admin
   * configured for the receiving tenant.
   */
  async initiatePayment(
    tenantId: string,
    parentId: string,
    feeId: string,
  ) {
    // Fee may live in a sibling tenant (hostel/transport). Look it up
    // without a tenant filter, then authorise via the cross-tenant link
    // on (schoolCode + admissionNumber).
    const fee = await this.feeRepo.findOne({ where: { id: feeId } });
    console.log('fee', fee);
    if (!fee) {
      throw new NotFoundException(`Fee ${feeId} not found`);
    }
    if (fee.paymentStatus === 'PAID') {
      throw new BadRequestException('This fee is already fully paid');
    }
    const balance = Number(fee.netAmount) - Number(fee.paidAmount);
    if (balance <= 0) {
      throw new BadRequestException('Nothing left to pay on this fee');
    }
    console.log('balance', balance);
    const student = await this.ensureChildBelongsToParentCrossTenant(
      tenantId,
      parentId,
      fee.tenantId,
      fee.studentId,
    );
    console.log('student', student);
    // Gateway is decided by the RECEIVING tenant's configuration —
    // the tenant that owns the fee, not the parent's home tenant.
    const resolvedGateway =
      await this.paymentsService.resolveActiveGateway(fee.tenantId);
    console.log('resolvedGateway', resolvedGateway);
    const order = await this.paymentsService.createOrder(fee.tenantId, {
      tenantId: fee.tenantId,
      feeId: fee.id,
      paymentType: PaymentType.ONLINE,
      gateway: resolvedGateway,
      amount: balance , // paise
      currency: 'INR',
      ADMISSION: student.admissionNumber,
      academicYear: student.academicYear,
      term: fee.term,
      studentName: student.name,
      class: student.class,
      section: student.section,
      rollNo: student.rollNo,
      email: student.email,
    });

    console.log('order', order);

    // Surface the RECEIVING tenant's public gateway key so the parent
    // client mounts the widget against the right merchant account. The
    // parent's own /tenant-configs/active-payment only knows the
    // parent's home tenant — which is wrong for sibling-tenant fees.
    const receivingCfg = await this.tenantConfigsService.findActiveForTenant(
      fee.tenantId,
    );
    return {
      ...order,
      gatewayType: receivingCfg?.gatewayType ?? resolvedGateway,
      gatewayPublicKey: receivingCfg?.paymentClientId ?? null,
      // Cashfree JS SDK must use the same mode the backend used; comes
      // from the receiving tenant's payment_mode, not env vars.
      cashfreeMode:
        receivingCfg?.paymentMode === 'production'
          ? 'production'
          : 'sandbox',
    };
  }

  /**
   * Confirms a payment after the gateway checkout closes. Validates the
   * order belongs to a fee for one of this parent's children before
   * delegating to the shared verify logic (which also re-checks the
   * gateway signature). The webhook stays the source of truth.
   */
  async verifyPayment(
    tenantId: string,
    parentId: string,
    args: {
      gatewayOrderId: string;
      gatewayPaymentId?: string;
      signature?: string;
    },
  ) {
    // Payment was created against the fee's tenant (could be a sibling
    // of the parent's home tenant). Don't filter by the parent's
    // tenantId — look it up by gatewayOrderId alone.
    const payment = await this.paymentRepo.findOne({
      where: { gatewayOrderId: args.gatewayOrderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment order not found');
    }
    if (!payment.feeId) {
      throw new BadRequestException('Order is not tied to a fee');
    }
    const fee = await this.feeRepo.findOne({
      where: { id: payment.feeId },
    });
    if (!fee) {
      throw new NotFoundException('Fee not found for this order');
    }
    await this.ensureChildBelongsToParentCrossTenant(
      tenantId,
      parentId,
      fee.tenantId,
      fee.studentId,
    );

    return this.paymentsService.verifyPayment(payment.tenantId, {
      tenantId: payment.tenantId,
      gateway: payment.gateway as PaymentGateway,
      gatewayOrderId: args.gatewayOrderId,
      gatewayPaymentId: args.gatewayPaymentId,
      signature: args.signature,
    });
  }

  // ─── Full overview: every kid, school + hostel + transport, all
  //     years/terms, payment history, receipts, TC status ──────────────

  private async buildCategory(
    categoryTenantId: string,
    tenantName: string,
    type: TenantTypeValue,
    studentRows: Student[],
  ) {
    const ids = studentRows.map((s) => s.id);
    if (!ids.length) return null;
    const fees = await this.feeRepo.find({
      where: { tenantId: categoryTenantId, studentId: In(ids) },
      order: { academicYear: 'DESC', term: 'ASC' },
    });
    if (!fees.length) return null;
    const payments = await this.feePaymentRepo.find({
      where: {
        tenantId: categoryTenantId,
        feeId: In(fees.map((f) => f.id)),
        receiptNumber: Not(IsNull()),
      },
      order: { paidAt: 'DESC' },
    });
    const feeTermById = new Map(fees.map((f) => [f.id, f.term]));
    const byYear = new Map<
      string,
      { terms: any[]; payments: any[] }
    >();
    for (const f of fees) {
      if (!byYear.has(f.academicYear)) {
        byYear.set(f.academicYear, { terms: [], payments: [] });
      }
      byYear.get(f.academicYear)!.terms.push({
        feeId: f.id,
        term: f.term,
        originalAmount: f.originalAmount,
        totalPenalty: f.totalPenalty,
        totalDiscount: f.totalDiscount,
        netAmount: f.netAmount,
        paidAmount: f.paidAmount,
        balance: (Number(f.netAmount) - Number(f.paidAmount)).toFixed(2),
        paymentStatus: f.paymentStatus,
      });
    }
    const yearOfFee = new Map(fees.map((f) => [f.id, f.academicYear]));
    for (const p of payments) {
      const yr = p.feeId ? yearOfFee.get(p.feeId) : undefined;
      if (!yr || !byYear.has(yr)) continue;
      byYear.get(yr)!.payments.push({
        paymentId: p.id,
        amount: p.amount,
        paymentType: p.method,
        paidAt: p.paidAt,
        receiptNumber: p.receiptNumber,
        clearanceStatus: p.clearanceStatus,
        bounced: p.clearanceStatus === ClearanceStatus.BOUNCED,
        term: (p.feeId ? feeTermById.get(p.feeId) : null) ?? null,
      });
    }
    const years = [...byYear.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([academicYear, v]) => ({ academicYear, ...v }));
    return { type, tenantId: categoryTenantId, tenantName, years };
  }

  /** Everything the parent portal needs per child, in one call. */
  async childrenOverview(tenantId: string, parentId: string) {
    const children = await this.listChildren(tenantId, parentId);
    if (!children.length) return { children: [] };

    const school = await this.tenantRepo.findOne({
      where: { id: tenantId },
    });
    const siblings = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.type IN (:...types)', {
        types: [TENANT_TYPE.HOSTEL, TENANT_TYPE.TRANSPORT],
      })
      .andWhere('t.id != :id', { id: tenantId })
      .getMany();

    const out: any[] = [];
    for (const child of children) {
      // All school enrolment rows for this admission across years.
      const schoolRows = await this.studentRepo.find({
        where: {
          tenantId,
          schoolCode: child.schoolCode,
          admissionNumber: child.admissionNumber,
        },
        order: { academicYear: 'DESC' },
      });
      const categories: any[] = [];
      const schoolCat = await this.buildCategory(
        tenantId,
        school?.tenantName ?? school?.name ?? TENANT_TYPE.SCHOOL,
        TENANT_TYPE.SCHOOL,
        schoolRows,
      );
      if (schoolCat) categories.push(schoolCat);

      for (const sib of siblings) {
        // Sibling records are linked by the canonical (school_code +
        // admission_number) pair, so only the same institution's
        // hostel/transport rows match — never a same-admission person
        // from another school.
        const sibRows = await this.studentRepo
          .createQueryBuilder('s')
          .where('s.tenant_id = :tid', { tid: sib.id })
          .andWhere('s.school_code = :sc', { sc: child.schoolCode })
          .andWhere('s.admission_number = :adm', {
            adm: child.admissionNumber,
          })
          .getMany();
        const cat = await this.buildCategory(
          sib.id,
          sib.tenantName ?? sib.name ?? sib.type,
          (sib.type === TENANT_TYPE.TRANSPORT
            ? TENANT_TYPE.TRANSPORT
            : TENANT_TYPE.HOSTEL) as TenantTypeValue,
          sibRows,
        );
        if (cat) categories.push(cat);
      }

      const latest = schoolRows[0] ?? child;
      out.push({
        student: {
          id: child.id,
          name: child.name,
          admissionNumber: child.admissionNumber,
          branch: child.schoolCode,
          class: child.class,
          section: child.section,
          rollNo: child.rollNo,
          academicYear: child.academicYear,
          imgUrl: child.imgUrl ?? null,
          pickupLocation: child.pickupLocation ?? null,
          dropLocation: child.dropLocation ?? null,
        },
        tc: {
          issued: !!latest.tcIssuedAt,
          issuedAt: latest.tcIssuedAt ?? null,
          reason: latest.tcReason ?? null,
          certificateNo: latest.tcCertificateNo ?? null,
        },
        categories,
      });
    }
    return { children: out };
  }

  /**
   * Authorises a fee_payment receipt for this parent — it must belong to
   * one of their children (school or sibling hostel/transport). Returns
   * the FeePayment (whose tenantId is the RECEIVING tenant) on success.
   */
  private async authorizeReceiptForParent(
    tenantId: string,
    parentId: string,
    paymentId: string,
  ): Promise<FeePayment> {
    const fp = await this.feePaymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!fp || !fp.feeId) throw new NotFoundException('Receipt not found');
    const fee = await this.feeRepo.findOne({
      where: { id: fp.feeId, tenantId: fp.tenantId },
    });
    if (!fee) throw new NotFoundException('Receipt not found');
    const student = await this.studentRepo.findOne({
      where: { id: fee.studentId, tenantId: fp.tenantId },
    });
    if (!student) throw new NotFoundException('Receipt not found');

    const children = await this.listChildren(tenantId, parentId);
    const ok = children.some(
      (c) =>
        c.admissionNumber === student.admissionNumber &&
        c.name.trim().toLowerCase() === student.name.trim().toLowerCase(),
    );
    if (!ok) {
      throw new ForbiddenException('This receipt is not for your child.');
    }
    return fp;
  }

  /**
   * Renders a printable receipt (HTML) for a fee_payment, only if it
   * belongs to one of this parent's children.
   */
  async renderReceiptForParent(
    tenantId: string,
    parentId: string,
    paymentId: string,
  ): Promise<string> {
    const fp = await this.authorizeReceiptForParent(
      tenantId,
      parentId,
      paymentId,
    );
    return this.feesService.renderReceipt(fp.tenantId, paymentId);
  }

  /**
   * Generates the PDF receipt, stores it in the receiving tenant's Azure
   * container, and returns its URL — only if it belongs to one of this
   * parent's children.
   */
  async getReceiptUrlForParent(
    tenantId: string,
    parentId: string,
    paymentId: string,
  ): Promise<{ url: string }> {
    const fp = await this.authorizeReceiptForParent(
      tenantId,
      parentId,
      paymentId,
    );
    // Use the receiving tenant (fp.tenantId) for both the receipt content
    // and its storage location — may be a sibling hostel/transport tenant.
    return this.receiptStorage.generateAndStore(fp.tenantId, paymentId);
  }
}
