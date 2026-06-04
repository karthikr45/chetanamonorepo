import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { Payment, PaymentGateway, PaymentType } from '../payments/entities/payment.entity';
import { FeePayment } from '../fees/entities/fee-payment.entity';
import { PaymentsService } from '../payments/payments.service';
import { ReceiptStorageService } from '../fees/receipt-storage.service';
import { TenantConfigsService } from '../tenant-configs/tenant-configs.service';
import { PublicInitiateDto, PublicVerifyDto } from './dto/public-pay.dto';

@Injectable()
export class PublicPayService {
  constructor(
    @InjectRepository(TenantConfig)
    private readonly cfgRepo: Repository<TenantConfig>,
    @InjectRepository(AcademicYear)
    private readonly yearRepo: Repository<AcademicYear>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(FeePayment)
    private readonly feePaymentRepo: Repository<FeePayment>,
    private readonly paymentsService: PaymentsService,
    private readonly receiptStorage: ReceiptStorageService,
    private readonly tenantConfigsService: TenantConfigsService,
  ) {}

  /**
   * Generate the PDF receipt for one FeePayment, store it in the tenant's
   * Azure container, and return its URL. Scoped to the calling host's
   * tenant so a stray id from a different school resolves to 404 (don't
   * leak which ids exist).
   */
  async getReceiptUrl(
    host: string,
    paymentId: string,
  ): Promise<{ url: string }> {
    const cfg = await this.resolveConfigByHost(host);
    if (!cfg) {
      throw new NotFoundException('No school is configured for this domain.');
    }
    return this.receiptStorage.generateAndStore(cfg.tenantId, paymentId);
  }

  /**
   * Resolve the tenant config whose configured domainUrl matches the
   * caller's Host. Delegates to TenantConfigsService so it's env-aware
   * (prefers the APP_ENV config) and consistent with the rest of the app.
   * Returns null when nothing matches — the controller turns that into a
   * 404 with a generic message (don't leak which hosts are valid).
   */
  private resolveConfigByHost(host: string): Promise<TenantConfig | null> {
    return this.tenantConfigsService.resolveActiveByHost(host);
  }

  /**
   * Public landing payload — drives the pay page chrome: school logo,
   * gateway public key, and the list of academic years to populate the
   * dropdown. No secrets leave the server.
   */
  async resolveTenant(host: string) {
    const cfg = await this.resolveConfigByHost(host);
    if (!cfg) {
      throw new NotFoundException(
        'No school is configured for this domain. Please use the correct school payment link.',
      );
    }
    if (!cfg.gatewayType || !cfg.paymentClientId) {
      throw new BadRequestException(
        'Online payment is not configured for this school yet.',
      );
    }
    const years = await this.yearRepo.find({
      where: { tenantId: cfg.tenantId },
      order: { academicYear: 'DESC' },
    });
    return {
      tenantId: cfg.tenantId,
      logoUrl: cfg.logoUrl ?? null,
      gatewayType: cfg.gatewayType,
      gatewayPublicKey: cfg.paymentClientId,
      academicYears: years
        .filter((y) => y.isActive !== false)
        .map((y) => ({
          academicYear: y.academicYear,
          isCurrent: !!y.isCurrentYear,
        })),
    };
  }

  /**
   * Resolve the student by (admissionNumber, academicYear) inside the
   * tenant of the calling host, then return their open fees for that
   * year. Returns an empty list (not 404) when the admission exists
   * but has nothing to pay — keeps the UI simple.
   */
  async listFees(host: string, admissionNumber: string, academicYear: string) {
    const cfg = await this.resolveConfigByHost(host);
    if (!cfg) {
      throw new NotFoundException('No school is configured for this domain.');
    }
    if (!admissionNumber?.trim() || !academicYear?.trim()) {
      throw new BadRequestException(
        'Admission number and academic year are required.',
      );
    }
    const student = await this.studentRepo.findOne({
      where: {
        tenantId: cfg.tenantId,
        admissionNumber: admissionNumber.trim(),
        academicYear: academicYear.trim(),
      },
    });
    if (!student) {
      throw new NotFoundException(
        'No student found for that admission number and academic year.',
      );
    }
    const fees = await this.feeRepo.find({
      where: { tenantId: cfg.tenantId, studentId: student.id },
      order: { term: 'ASC' },
    });

    // Latest receipt (FeePayment) per fee, so the UI can offer a
    // "Download receipt" link for already-paid fees — including those
    // confirmed by the webhook after a gateway redirect (where the
    // client-side verify never returned a paymentId).
    const latestReceiptByFee = new Map<string, string>();
    if (fees.length) {
      const payments = await this.feePaymentRepo.find({
        where: {
          tenantId: cfg.tenantId,
          feeId: In(fees.map((f) => f.id)),
          receiptNumber: Not(IsNull()),
        },
        order: { paidAt: 'DESC', createdAt: 'DESC' },
      });
      for (const p of payments) {
        if (!p.feeId) continue;
        if (!latestReceiptByFee.has(p.feeId)) {
          latestReceiptByFee.set(p.feeId, p.id);
        }
      }
    }

    return {
      student: {
        name: student.name,
        admissionNumber: student.admissionNumber,
        class: student.class,
        section: student.section,
        academicYear: student.academicYear,
      },
      fees: fees.map((f) => ({
        id: f.id,
        term: f.term,
        academicYear: f.academicYear,
        originalAmount: f.originalAmount,
        totalPenalty: f.totalPenalty,
        totalDiscount: f.totalDiscount,
        netAmount: f.netAmount,
        paidAmount: f.paidAmount,
        paymentStatus: f.paymentStatus,
        balance: (
          Number(f.netAmount) - Number(f.paidAmount)
        ).toFixed(2),
        paymentId: latestReceiptByFee.get(f.id) ?? null,
      })),
    };
  }

  /**
   * Create an order against the tenant resolved from Host. The fee row
   * carries the tenantId so we cross-check that the fee actually
   * belongs to the host's tenant — a stray feeId from a different
   * tenant must not be payable through this domain.
   */
  async initiate(dto: PublicInitiateDto) {
    const cfg = await this.resolveConfigByHost(dto.host);
    if (!cfg) {
      throw new NotFoundException('No school is configured for this domain.');
    }
    const fee = await this.feeRepo.findOne({ where: { id: dto.feeId } });
    if (!fee || fee.tenantId !== cfg.tenantId) {
      throw new NotFoundException('Fee not found for this school.');
    }
    if (fee.paymentStatus === 'PAID') {
      throw new BadRequestException('This fee is already fully paid.');
    }
    const balance = Number(fee.netAmount) - Number(fee.paidAmount);
    if (balance <= 0) {
      throw new BadRequestException('Nothing left to pay on this fee.');
    }
    const student = await this.studentRepo.findOne({
      where: { id: fee.studentId, tenantId: cfg.tenantId },
    });
    if (!student) {
      throw new NotFoundException('Student not found for this fee.');
    }

    const resolvedGateway = await this.paymentsService.resolveActiveGateway(
      cfg.tenantId,
    );
    const order = await this.paymentsService.createOrder(cfg.tenantId, {
      tenantId: cfg.tenantId,
      feeId: fee.id,
      paymentType: PaymentType.ONLINE,
      gateway: resolvedGateway,
      amount: balance,
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
    return {
      ...order,
      gatewayType: cfg.gatewayType,
      gatewayPublicKey: cfg.paymentClientId,
      // Cashfree JS SDK must be initialised in the same mode the order
      // was created in. Comes from this tenant's payment_mode.
      cashfreeMode:
        cfg.paymentMode === 'production' ? 'production' : 'sandbox',
    };
  }

  /**
   * Confirm a payment after the gateway widget closes. Looks up the
   * order by gatewayOrderId, re-checks it belongs to the host's
   * tenant, then delegates to PaymentsService (which re-verifies the
   * signature with the right per-tenant secret).
   */
  async verify(dto: PublicVerifyDto) {
    const cfg = await this.resolveConfigByHost(dto.host);
    if (!cfg) {
      throw new NotFoundException('No school is configured for this domain.');
    }
    const payment = await this.paymentRepo.findOne({
      where: { gatewayOrderId: dto.gatewayOrderId },
    });
    if (!payment || payment.tenantId !== cfg.tenantId) {
      throw new NotFoundException('Payment order not found.');
    }
    return this.paymentsService.verifyPayment(cfg.tenantId, {
      tenantId: cfg.tenantId,
      gateway: payment.gateway as PaymentGateway,
      gatewayOrderId: dto.gatewayOrderId,
      gatewayPaymentId: dto.gatewayPaymentId,
      signature: dto.signature,
    });
  }
}
