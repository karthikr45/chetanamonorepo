import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ReceiptTemplate,
  ReceiptTemplateKind,
} from './entities/receipt-template.entity';
import {
  CreateReceiptTemplateDto,
  UpdateReceiptTemplateDto,
} from './dto/receipt-template.dto';
import { Fee } from '../fees/entities/fee.entity';
import { TermType } from '../fees/entities/fee.entity';
import {
  FeePayment,
  PaymentType,
} from '../fees/entities/fee-payment.entity';
import { Student } from '../students/entities/student.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SystemMetadata } from '../system-metadata/entities/system-metadata.entity';
import {
  formatINR,
  numberToINRWords,
  renderTemplate,
  type TemplateContext,
} from './template.renderer';

const ONLINE_TYPES = new Set<PaymentType>([
  PaymentType.RAZORPAY,
  PaymentType.CASHFREE,
  PaymentType.UPI,
  PaymentType.NETBANKING,
  PaymentType.CARD,
]);

/**
 * Section keys used to look up starter HTML in system_metadata.
 * The starter rows live as:
 *   system_metadata (type='receipt_template_starter',
 *                    value='header' | 'body' | 'footer',
 *                    description=<the HTML>)
 * Super-admin can edit those rows from the System Metadata UI, so
 * the per-school "starter" experience stays DB-driven.
 */
const STARTER_TYPE = 'receipt_template_starter';
type StarterKey = 'header' | 'body' | 'footer';

@Injectable()
export class ReceiptTemplatesService {
  constructor(
    @InjectRepository(ReceiptTemplate)
    private readonly tplRepo: Repository<ReceiptTemplate>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(FeePayment)
    private readonly paymentRepo: Repository<FeePayment>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(SystemMetadata)
    private readonly metaRepo: Repository<SystemMetadata>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Read the starter HTML for each section from system_metadata. Returns
   * the empty string when a section row isn't present — the admin can
   * always start blank and fill in their own. Super-admin can edit these
   * rows from System Metadata → receipt_template_starter.
   */
  async readStarterSections(): Promise<Record<StarterKey, string>> {
    const rows = await this.metaRepo.find({
      where: { type: STARTER_TYPE, isActive: true },
    });
    const out: Record<StarterKey, string> = { header: '', body: '', footer: '' };
    for (const r of rows) {
      const key = r.value as StarterKey;
      if (key === 'header' || key === 'body' || key === 'footer') {
        out[key] = r.description ?? '';
      }
    }
    return out;
  }

  /**
   * Ensures a tenant has at least one receipt template. Called by
   * TenantsService.create + the seed script. Idempotent — if the
   * tenant already has any template, returns it; otherwise clones the
   * starter sections from system_metadata into a new default.
   */
  async ensureStarterForTenant(tenantId: string): Promise<ReceiptTemplate> {
    const existing = await this.tplRepo.findOne({ where: { tenantId } });
    if (existing) return existing;
    const starter = await this.readStarterSections();
    const tpl = this.tplRepo.create({
      tenantId,
      name: 'Default School Receipt',
      kind: ReceiptTemplateKind.BOTH,
      headerHtml: starter.header,
      bodyHtml: starter.body,
      footerHtml: starter.footer,
      isDefault: true,
      isActive: true,
    });
    return this.tplRepo.save(tpl);
  }

  // ─── CRUD ────────────────────────────────────────────────────────

  async list(tenantId: string): Promise<ReceiptTemplate[]> {
    return this.tplRepo.find({
      where: { tenantId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<ReceiptTemplate> {
    const tpl = await this.tplRepo.findOne({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException(`Template ${id} not found`);
    return tpl;
  }

  async create(
    tenantId: string,
    dto: CreateReceiptTemplateDto,
  ): Promise<ReceiptTemplate> {
    const existing = await this.tplRepo.findOne({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `A template named "${dto.name}" already exists.`,
      );
    }
    // When the admin omits a section, fall back to the starter HTML from
    // system_metadata — never to a code constant.
    const starter = await this.readStarterSections();
    const tpl = this.tplRepo.create({
      tenantId,
      name: dto.name,
      kind: dto.kind ?? ReceiptTemplateKind.BOTH,
      headerHtml: dto.headerHtml ?? starter.header,
      bodyHtml: dto.bodyHtml ?? starter.body,
      footerHtml: dto.footerHtml ?? starter.footer,
      isDefault: !!dto.isDefault,
      isActive: dto.isActive ?? true,
    });
    if (tpl.isDefault) await this.clearOtherDefaults(tenantId, tpl.kind);
    return this.tplRepo.save(tpl);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateReceiptTemplateDto,
  ): Promise<ReceiptTemplate> {
    const tpl = await this.findOne(tenantId, id);
    if (dto.name !== undefined && dto.name !== tpl.name) {
      const conflict = await this.tplRepo.findOne({
        where: { tenantId, name: dto.name },
      });
      if (conflict && conflict.id !== tpl.id) {
        throw new ConflictException(
          `A template named "${dto.name}" already exists.`,
        );
      }
      tpl.name = dto.name;
    }
    if (dto.kind !== undefined) tpl.kind = dto.kind;
    if (dto.headerHtml !== undefined) tpl.headerHtml = dto.headerHtml;
    if (dto.bodyHtml !== undefined) tpl.bodyHtml = dto.bodyHtml;
    if (dto.footerHtml !== undefined) tpl.footerHtml = dto.footerHtml;
    if (dto.isActive !== undefined) tpl.isActive = dto.isActive;
    if (dto.isDefault === true) {
      tpl.isDefault = true;
      await this.clearOtherDefaults(tenantId, tpl.kind, tpl.id);
    } else if (dto.isDefault === false) {
      tpl.isDefault = false;
    }
    return this.tplRepo.save(tpl);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const tpl = await this.findOne(tenantId, id);
    await this.tplRepo.remove(tpl);
  }

  private async clearOtherDefaults(
    tenantId: string,
    kind: ReceiptTemplateKind,
    keepId?: string,
  ) {
    const qb = this.tplRepo
      .createQueryBuilder()
      .update(ReceiptTemplate)
      .set({ isDefault: false })
      .where('tenant_id = :tid', { tid: tenantId })
      .andWhere('kind IN (:...kinds)', {
        kinds:
          kind === ReceiptTemplateKind.BOTH
            ? [
                ReceiptTemplateKind.ONLINE,
                ReceiptTemplateKind.OFFLINE,
                ReceiptTemplateKind.BOTH,
              ]
            : [kind, ReceiptTemplateKind.BOTH],
      })
      .andWhere('is_default = TRUE');
    if (keepId) qb.andWhere('id != :keep', { keep: keepId });
    await qb.execute();
  }

  // ─── Rendering ───────────────────────────────────────────────────

  /**
   * Picks the active default template matching the requested kind
   * (online / offline). Falls back to BOTH, then null if nothing
   * configured (caller renders the built-in template).
   */
  async pickDefault(
    tenantId: string,
    forKind: ReceiptTemplateKind,
  ): Promise<ReceiptTemplate | null> {
    const matches = await this.tplRepo.find({
      where: {
        tenantId,
        isActive: true,
        isDefault: true,
      },
    });
    return (
      matches.find((t) => t.kind === forKind) ??
      matches.find((t) => t.kind === ReceiptTemplateKind.BOTH) ??
      null
    );
  }

  /**
   * Renders a template with real context. Resolution:
   *   - paymentId  → fetch payment + fee + student + tenant
   *   - feeId      → fetch fee + student + tenant (payment is sample)
   *   - sample=true→ everything is mock data, useful for the editor
   */
  async renderById(
    tenantId: string,
    templateId: string,
    args: { paymentId?: string; feeId?: string; sample?: boolean },
  ): Promise<{ html: string }> {
    const tpl = await this.findOne(tenantId, templateId);
    const ctx = await this.buildContext(tenantId, args);
    return { html: this.assemble(tpl, ctx) };
  }

  /** Render a NEW (unsaved) template directly — used by the live editor preview. */
  async renderPreview(
    tenantId: string,
    template: { headerHtml?: string; bodyHtml?: string; footerHtml?: string },
    args: { paymentId?: string; feeId?: string; sample?: boolean },
  ): Promise<{ html: string }> {
    const tplLike = {
      headerHtml: template.headerHtml ?? '',
      bodyHtml: template.bodyHtml ?? '',
      footerHtml: template.footerHtml ?? '',
    };
    const ctx = await this.buildContext(tenantId, args);
    return {
      html: this.assemble(
        { ...tplLike } as Pick<ReceiptTemplate, 'headerHtml' | 'bodyHtml' | 'footerHtml'>,
        ctx,
      ),
    };
  }

  private assemble(
    tpl: Pick<ReceiptTemplate, 'headerHtml' | 'bodyHtml' | 'footerHtml'>,
    ctx: TemplateContext,
  ): string {
    const header = renderTemplate(tpl.headerHtml || '', ctx);
    const body = renderTemplate(tpl.bodyHtml || '', ctx);
    const footer = renderTemplate(tpl.footerHtml || '', ctx);
    return `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt</title>
<style>
  body { margin:0; padding:24px; background:#f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#0f172a; }
  .receipt { max-width: 760px; margin: 0 auto; padding: 28px; background:#fff; border-radius:12px; box-shadow:0 4px 20px rgba(15,23,42,0.07); }
  table { border-collapse: collapse; }
  @media print { body { background:#fff; padding:0 } .receipt { box-shadow:none; max-width:none; } }
</style>
</head>
<body>
<div class="receipt">
  ${header}
  ${body}
  ${footer}
</div>
</body>
</html>`.trim();
  }

  // ─── Context builder ─────────────────────────────────────────────

  async buildContext(
    tenantId: string,
    args: { paymentId?: string; feeId?: string; sample?: boolean },
  ): Promise<TemplateContext> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });

    if (args.sample) return this.sampleContext(tenant);

    let payment: FeePayment | null = null;
    let fee: Fee | null = null;
    let student: Student | null = null;

    if (args.paymentId) {
      payment = await this.paymentRepo.findOne({
        where: { id: args.paymentId, tenantId },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      fee = await this.feeRepo.findOne({
        where: { id: payment.feeId, tenantId },
      });
    } else if (args.feeId) {
      fee = await this.feeRepo.findOne({
        where: { id: args.feeId, tenantId },
      });
      if (!fee) throw new NotFoundException('Fee not found');
    }

    if (fee) {
      student = await this.studentRepo.findOne({
        where: { id: fee.studentId, tenantId },
      });
    }

    if (!fee && !payment) {
      throw new BadRequestException(
        'Pass paymentId or feeId, or set sample=true.',
      );
    }

    return this.makeContext(tenant, fee, student, payment);
  }

  private sampleContext(tenant: Tenant | null): TemplateContext {
    const fakeFee: Partial<Fee> = {
      term: TermType.FIRST,
      academicYear: '2025-2026',
      originalAmount: '25000.00',
      totalPenalty: '0.00',
      totalDiscount: '2000.00',
      netAmount: '23000.00',
      paidAmount: '23000.00',
    };
    const fakeStudent: Partial<Student> = {
      name: 'Arjun Kumar',
      admissionNumber: '12345',
      email: 'arjun@example.com',
      phoneNumber: '+91 99999 90000',
      class: '7',
      section: 'A',
      rollNo: '12',
    };
    const fakePayment: Partial<FeePayment> = {
      receiptNumber: 'SVBK-2025-26-0042',
      amount: '23000.00',
      paymentType: PaymentType.CASH,
      paidAt: new Date(),
    };
    return this.makeContext(
      tenant,
      fakeFee as Fee,
      fakeStudent as Student,
      fakePayment as FeePayment,
    );
  }

  private makeContext(
    tenant: Tenant | null,
    fee: Fee | null,
    student: Student | null,
    payment: FeePayment | null,
  ): TemplateContext {
    const now = new Date();
    const paidAt = payment?.paidAt ?? now;
    const source = payment
      ? ONLINE_TYPES.has(payment.paymentType)
        ? 'Gateway'
        : 'Manual record'
      : '';
    const amountInWords = payment ? numberToINRWords(Number(payment.amount)) : '';
    return {
      tenant: tenant
        ? {
            name: tenant.name ?? '',
            tenantName: tenant.tenantName ?? '',
            code: tenant.code ?? '',
            tenantCode: tenant.tenantCode ?? '',
            address: tenant.address ?? '',
            city: tenant.city ?? '',
            state: tenant.state ?? '',
            country: tenant.country ?? '',
            medium: tenant.medium ?? '',
            boardType: tenant.boardType ?? '',
          }
        : {},
      student: student
        ? {
            name: student.name ?? '',
            admissionNumber: student.admissionNumber ?? '',
            email: student.email ?? '',
            phoneNumber: student.phoneNumber ?? '',
            class: student.class ?? '',
            section: student.section ?? '',
            rollNo: student.rollNo ?? '',
            branch: student.schoolCode ?? '',
          }
        : {},
      fee: fee
        ? {
            term: fee.term ?? '',
            academicYear: fee.academicYear ?? '',
            branch: fee.branch ?? '',
            originalAmount: fee.originalAmount ?? '0',
            totalPenalty: fee.totalPenalty ?? '0',
            totalDiscount: fee.totalDiscount ?? '0',
            netAmount: fee.netAmount ?? '0',
            paidAmount: fee.paidAmount ?? '0',
            balance: Math.max(
              0,
              Number(fee.netAmount) - Number(fee.paidAmount),
            ).toFixed(2),
            originalAmountInr: formatINR(Number(fee.originalAmount)),
            totalPenaltyInr: formatINR(Number(fee.totalPenalty)),
            totalDiscountInr: formatINR(Number(fee.totalDiscount)),
            netAmountInr: formatINR(Number(fee.netAmount)),
            paidAmountInr: formatINR(Number(fee.paidAmount)),
            balanceInr: formatINR(
              Math.max(0, Number(fee.netAmount) - Number(fee.paidAmount)),
            ),
          }
        : {},
      payment: payment
        ? {
            receiptNumber: payment.receiptNumber ?? '',
            amount: payment.amount ?? '0',
            amountInr: formatINR(Number(payment.amount)),
            amountInWords,
            paymentType: payment.paymentType ?? '',
            source,
            paidAt: paidAt.toISOString(),
            paidAtFormatted: paidAt.toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            chequeNumber: payment.chequeNumber ?? '',
            ddNumber: payment.ddNumber ?? '',
            bankName: (payment as any).bankName ?? '',
            transactionId: (payment as any).transactionId ?? '',
            notes: payment.notes ?? '',
          }
        : {},
      date: {
        now: now.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        year: String(now.getFullYear()),
      },
    };
  }

  /** Returns the full list of placeholder keys for the editor's "insert key" menu. */
  availableKeys(): { group: string; keys: { key: string; label: string }[] }[] {
    return [
      {
        group: 'Tenant',
        keys: [
          { key: 'tenant.tenantName', label: 'School name' },
          { key: 'tenant.address', label: 'Address' },
          { key: 'tenant.city', label: 'City' },
          { key: 'tenant.state', label: 'State' },
          { key: 'tenant.boardType', label: 'Board' },
          { key: 'tenant.medium', label: 'Medium' },
        ],
      },
      {
        group: 'Student',
        keys: [
          { key: 'student.name', label: 'Name' },
          { key: 'student.admissionNumber', label: 'Admission no.' },
          { key: 'student.class', label: 'Class' },
          { key: 'student.section', label: 'Section' },
          { key: 'student.rollNo', label: 'Roll' },
          { key: 'student.phoneNumber', label: 'Phone' },
          { key: 'student.email', label: 'Email' },
        ],
      },
      {
        group: 'Fee',
        keys: [
          { key: 'fee.term', label: 'Term' },
          { key: 'fee.academicYear', label: 'Academic year' },
          { key: 'fee.originalAmountInr', label: 'Original (₹)' },
          { key: 'fee.totalPenaltyInr', label: 'Penalty (₹)' },
          { key: 'fee.totalDiscountInr', label: 'Discount (₹)' },
          { key: 'fee.netAmountInr', label: 'Net (₹)' },
          { key: 'fee.paidAmountInr', label: 'Paid till now (₹)' },
          { key: 'fee.balanceInr', label: 'Balance (₹)' },
        ],
      },
      {
        group: 'Payment',
        keys: [
          { key: 'payment.receiptNumber', label: 'Receipt no.' },
          { key: 'payment.amountInr', label: 'Amount paid (₹)' },
          { key: 'payment.amountInWords', label: 'Amount in words' },
          { key: 'payment.paymentType', label: 'Mode' },
          { key: 'payment.source', label: 'Source (Manual/Gateway)' },
          { key: 'payment.paidAtFormatted', label: 'Paid at' },
          { key: 'payment.chequeNumber', label: 'Cheque no.' },
          { key: 'payment.ddNumber', label: 'DD no.' },
          { key: 'payment.bankName', label: 'Bank' },
          { key: 'payment.transactionId', label: 'Transaction id' },
          { key: 'payment.notes', label: 'Notes' },
        ],
      },
      {
        group: 'Date',
        keys: [
          { key: 'date.now', label: 'Current date+time' },
          { key: 'date.year', label: 'Current year' },
        ],
      },
    ];
  }

  /** Source helper for the renderer when deciding which template to pick automatically. */
  static kindForPayment(p: FeePayment): ReceiptTemplateKind {
    return ONLINE_TYPES.has(p.paymentType)
      ? ReceiptTemplateKind.ONLINE
      : ReceiptTemplateKind.OFFLINE;
  }
}
