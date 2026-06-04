import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentGateway, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { FeesService } from '../fees/fees.service';
import { FeePayment, PaymentType as FeePaymentType } from '../fees/entities/fee-payment.entity';
import { CreateOrderDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentAuditService } from './payment-audit.service';
import { AuditAction } from './entities/payment-audit-log.entity';
import { TenantConfigsService } from '../tenant-configs/tenant-configs.service';
import { GatewayCredentials } from './gateways/payment-gateway.interface';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(FeePayment)
    private readonly feePaymentRepository: Repository<FeePayment>,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly auditService: PaymentAuditService,
    private readonly tenantConfigsService: TenantConfigsService,
    private readonly feesService: FeesService,
  ) {}

  /**
   * Records the FeePayment receipt row and updates the Fee balance
   * atomically — shared between verify-time and webhook paths so they
   * can't double-count. Idempotent by orderId: if a FeePayment row
   * already exists for this gateway order, we return it without
   * inserting again.
   *
   * Returns the FeePayment id so callers can hand it to the receipt
   * endpoint.
   */
  async recordOnlineFeePayment(
    tenantId: string,
    feeId: string,
    orderId: string,
    transactionId: string,
    amountPaidInRupees: number,
    gateway: PaymentGateway,
  ): Promise<FeePayment> {
    // Finalises the existing gateway-order row in `payments` into a settled
    // ledger entry. Idempotent by gatewayOrderId (a row that already carries
    // a receipt number is returned untouched), so verify-then-webhook (or
    // vice-versa) can't double-count.
    return this.feesService.recordOnlinePayment(tenantId, feeId, {
      amount: amountPaidInRupees,
      paymentType:
        gateway === PaymentGateway.CASHFREE
          ? FeePaymentType.CASHFREE
          : FeePaymentType.RAZORPAY,
      orderId,
      transactionId,
      recordedBy: null,
    });
  }

  /**
   * Resolves the gateway credentials for a tenant. Reads the active
   * TenantConfig — refuses to proceed if missing rather than silently
   * falling back to a wrong key. The `mode` flows from the config's
   * `payment_mode` so each tenant can independently go live or stay
   * piloting on sandbox keys.
   */
  private async credsForTenant(tenantId: string): Promise<GatewayCredentials> {
    const cfg = await this.tenantConfigsService.findActiveForTenant(tenantId);
    if (!cfg || !cfg.paymentClientId || !cfg.paymentSecretKey) {
      throw new InternalServerErrorException(
        'Payment gateway is not configured for this tenant. Add the ' +
          'gateway credentials under the tenant\'s Configuration tab.',
      );
    }
    return {
      clientId: cfg.paymentClientId,
      secretKey: cfg.paymentSecretKey,
      mode:
        cfg.paymentMode === 'production' ? 'production' : 'sandbox',
    };
  }

  /**
   * Public read of the gateway mode for the active TenantConfig.
   * Exposed so callers (PublicPayService, ParentPortalService) can
   * echo the same value back to the frontend without re-querying.
   */
  async getGatewayMode(
    tenantId: string,
  ): Promise<'sandbox' | 'production'> {
    const cfg = await this.tenantConfigsService.findActiveForTenant(tenantId);
    return cfg?.paymentMode === 'production' ? 'production' : 'sandbox';
  }

  /**
   * The online gateway a tenant has configured. This is the single source
   * of truth — callers (e.g. the parent portal) must not let the client
   * choose a gateway. Throws if online payment isn't set up.
   */
  async resolveActiveGateway(tenantId: string): Promise<PaymentGateway> {
    const cfg = await this.tenantConfigsService.findActiveForTenant(tenantId);
    if (!cfg || !cfg.gatewayType || !cfg.paymentClientId) {
      throw new BadRequestException(
        'Online payment is not configured for your school yet. ' +
          'Please contact the school office.',
      );
    }
    const map: Record<string, PaymentGateway> = {
      [PaymentGateway.RAZORPAY]: PaymentGateway.RAZORPAY,
      [PaymentGateway.CASHFREE]: PaymentGateway.CASHFREE,
    };
    const gateway = map[cfg.gatewayType];
    if (!gateway) {
      throw new BadRequestException(
        `Unsupported payment gateway "${cfg.gatewayType}" configured for this school.`,
      );
    }
    return gateway;
  }

  async createOrder(tenantId: string, dto: CreateOrderDto): Promise<{ payment: Payment; transaction: Transaction; gatewayResponse: Record<string, any>; cashfreeMode: 'sandbox' | 'production' }> {
    const notes = {
      admission: dto.ADMISSION,
      academicYear: dto.academicYear,
      term: dto.term,
      studentName: dto.studentName,
      email: dto.email,
      class: dto.class,
      section: dto.section,
      rollNo: dto.rollNo,
    };

    if (dto.paymentType === PaymentType.OFFLINE) {
      const payment = await this.paymentsRepository.save(
        this.paymentsRepository.create({
          tenantId,
          feeId: dto.feeId ?? null,
          paymentType: PaymentType.OFFLINE,
          gateway: null,
          status: PaymentStatus.PAID,
          gatewayOrderId: null,
          // `payments.amount` is in rupees; offline DTO amount is in paise.
          amount: (dto.amount / 100).toFixed(2),
          currency: dto.currency,
          notes: JSON.stringify(notes),
          chequeNumber: dto.chequeNumber ?? null,
          chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
          ddDate: dto.ddDate ? new Date(dto.ddDate) : null,
          paidAt: new Date(),
        }),
      );

      const transaction = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: TransactionType.ORDER_CREATED,
          gateway: PaymentGateway.RAZORPAY, // placeholder — no gateway for offline
          status: PaymentStatus.PAID,
          gatewayOrderId: payment.id, // use payment id as reference
          amount: dto.amount,
          currency: dto.currency,
          notes: JSON.stringify(notes),
          paymentDetails: {
            studentName: dto.studentName,
            email: dto.email,
            admission: dto.ADMISSION,
            academicYear: dto.academicYear,
            term: dto.term,
            chequeNumber: dto.chequeNumber,
            chequeDate: dto.chequeDate,
            ddDate: dto.ddDate,
          },
        }),
      );

      void this.auditService.log({
        tenantId,
        action: AuditAction.ORDER_CREATED,
        paymentId: payment.id,
        transactionId: transaction.id,
        gateway: undefined,
        gatewayOrderId: undefined,
        toStatus: PaymentStatus.PAID,
        actor: 'api',
        metadata: { amount: dto.amount, currency: dto.currency, notes, paymentType: 'offline' },
      });

      return {
        payment,
        transaction,
        gatewayResponse: {},
        cashfreeMode: await this.getGatewayMode(tenantId),
      };
    }

    // Online payment — call the gateway using THIS tenant's credentials.
    const gateway = this.gatewayFactory.get(dto.gateway!);
    const creds = await this.credsForTenant(tenantId);
    const result = await gateway.createOrder(creds, dto.amount, dto.currency, notes);

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        tenantId,
        feeId: dto.feeId ?? null,
        paymentType: PaymentType.ONLINE,
        gateway: dto.gateway!,
        status: PaymentStatus.CREATED,
        gatewayOrderId: result.gatewayOrderId,
        // `payments.amount` is rupees. Razorpay returns paise; Cashfree rupees.
        amount: (dto.gateway === PaymentGateway.CASHFREE
          ? result.amount
          : result.amount / 100
        ).toFixed(2),
        currency: result.currency,
        notes: JSON.stringify(notes),
        chequeNumber: null,
        chequeDate: null,
        ddDate: null,
      }),
    );

    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        tenantId,
        paymentId: payment.id,
        type: TransactionType.ORDER_CREATED,
        gateway: dto.gateway!,
        status: PaymentStatus.CREATED,
        gatewayOrderId: result.gatewayOrderId,
        amount: result.amount,
        currency: result.currency,
        notes: JSON.stringify(notes),
        paymentDetails: {
          ...result.raw,
          studentName: dto.studentName,
          email: dto.email,
          admission: dto.ADMISSION,
          academicYear: dto.academicYear,
          term: dto.term,
        },
      }),
    );

    void this.auditService.log({
      tenantId,
      action: AuditAction.ORDER_CREATED,
      paymentId: payment.id,
      transactionId: transaction.id,
      gateway: dto.gateway,
      gatewayOrderId: result.gatewayOrderId,
      toStatus: PaymentStatus.CREATED,
      actor: 'api',
      metadata: {
        amount: result.amount,
        currency: result.currency,
        notes,
        rawGatewayResponse: result.raw,
      },
    });

    return {
      payment,
      transaction,
      gatewayResponse: result.raw,
      cashfreeMode: await this.getGatewayMode(tenantId),
    };
  }

  async verifyPayment(
    tenantId: string,
    dto: VerifyPaymentDto,
  ): Promise<{
    payment: Payment;
    transaction: Transaction;
    paymentId: string | null;
  }> {
    const orderId   = dto.gatewayOrderId   ?? dto.razorpay_order_id;
    const paymentId = dto.gatewayPaymentId ?? dto.razorpay_payment_id;
    const signature = dto.signature        ?? dto.razorpay_signature ?? '';
    const resolvedGateway = dto.gateway ?? (dto.razorpay_order_id ? PaymentGateway.RAZORPAY : undefined);

    if (!orderId)          throw new BadRequestException('gatewayOrderId or razorpay_order_id is required');
    if (!paymentId)        throw new BadRequestException('gatewayPaymentId or razorpay_payment_id is required');
    if (!resolvedGateway)  throw new BadRequestException('gateway is required');

    const payment = await this.paymentsRepository.findOne({
      where: { gatewayOrderId: orderId, tenantId },
    });
    if (!payment) throw new NotFoundException(`Order ${orderId} not found`);

    if (payment.status === PaymentStatus.PAID) {
      const transaction = await this.transactionsRepository.findOne({
        where: { paymentId: payment.id, type: TransactionType.PAYMENT_SUCCESS },
      });
      return { payment, transaction: transaction!, paymentId: null };
    }

    const gateway = this.gatewayFactory.get(resolvedGateway);
    const creds = await this.credsForTenant(tenantId);
    const result = await gateway.verifyPayment(creds, {
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      signature,
    });
    console.log(result,"rrrrrrrrrrr",paymentId,signature,orderId,"gtt",resolvedGateway)

    const transactionType = result.success ? TransactionType.PAYMENT_SUCCESS : TransactionType.PAYMENT_FAILED;
    const paymentStatus = result.success ? PaymentStatus.PAID : PaymentStatus.FAILED;

    if (!result.success) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Signature verification failed';
      await this.paymentsRepository.save(payment);

      const failedTx = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: transactionType,
          gateway: resolvedGateway,
          status: paymentStatus,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          amount: Number(payment.amount),
          currency: payment.currency,
          notes: payment.notes,
          paymentDetails: {
            gatewayOrderId: orderId,
            gatewayPaymentId: paymentId,
            reason: 'Signature verification failed',
          },
        }),
      ) as unknown as Transaction;

      void this.auditService.log({
        tenantId,
        action: AuditAction.PAYMENT_VERIFY_FAILED,
        paymentId: payment.id,
        transactionId: failedTx.id,
        gateway: resolvedGateway,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        fromStatus: PaymentStatus.CREATED,
        toStatus: PaymentStatus.FAILED,
        actor: 'api',
        isError: true,
        errorMessage: 'Signature verification failed',
        metadata: {
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          rawGatewayResult: result,
        },
      });

      throw new BadRequestException('Payment verification failed');
    }

    const fromStatus = payment.status;
    payment.status = PaymentStatus.PAID;
    payment.gatewayPaymentId = result.gatewayPaymentId;
    payment.paidAt = new Date();
    const savedPayment = await this.paymentsRepository.save(payment);

    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        tenantId,
        paymentId: payment.id,
        type: transactionType,
        gateway: resolvedGateway,
        status: paymentStatus,
        gatewayOrderId: orderId,
        gatewayPaymentId: result.gatewayPaymentId,
        amount: Number(payment.amount),
        currency: payment.currency,
        notes: payment.notes,
        paymentDetails: {
          gatewayOrderId: orderId,
          gatewayPaymentId: result.gatewayPaymentId,
          signature,
          verifiedAt: new Date().toISOString(),
        },
      }),
    ) as unknown as Transaction;

    void this.auditService.log({
      tenantId,
      action: AuditAction.PAYMENT_VERIFIED,
      paymentId: savedPayment.id,
      transactionId: transaction.id,
      gateway: resolvedGateway,
      gatewayOrderId: orderId,
      gatewayPaymentId: result.gatewayPaymentId,
      fromStatus,
      toStatus: PaymentStatus.PAID,
      actor: 'api',
      metadata: {
        verifiedAt: savedPayment.paidAt,
        rawGatewayResult: result,
      },
    });

    // Create the receipt-bearing FeePayment row and update the Fee
    // balance — idempotent by gatewayOrderId, so verify-then-webhook
    // (or vice versa) won't double-count. Non-fatal: the webhook
    // reconciles if this fails.
    let recordedPaymentId: string | null = null;
    if (savedPayment.feeId) {
      try {
        const amountPaisePerUnit =
          resolvedGateway === PaymentGateway.CASHFREE ? 1 : 100;
        const fp = await this.recordOnlineFeePayment(
          tenantId,
          savedPayment.feeId,
          orderId,
          transaction.id,
          Number(savedPayment.amount) / amountPaisePerUnit,
          resolvedGateway,
        );
        recordedPaymentId = fp.id;
      } catch {
        /* webhook safety net */
      }
    }

    return { payment: savedPayment, transaction, paymentId: recordedPaymentId };
  }

  async findAll(tenantId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }

  async findTransactions(tenantId: string, paymentId: string): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: { paymentId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }
}
