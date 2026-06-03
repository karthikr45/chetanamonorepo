import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentGateway } from '../entities/payment.entity';
import { Transaction, TransactionType } from '../entities/transaction.entity';
import { RazorpayWebhookDto, CashfreeWebhookDto } from '../dto/webhook.dto';
import { PaymentAuditService } from '../payment-audit.service';
import { AuditAction } from '../entities/payment-audit-log.entity';
import { Fee, PaymentStatus as FeePaymentStatus } from '../../fees/entities/fee.entity';
import { PaymentsService } from '../payments.service';

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(Fee)
    private readonly feeRepository: Repository<Fee>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly auditService: PaymentAuditService,
  ) {}

  /**
   * Records the FeePayment + fee balance update via the shared
   * idempotent path. If the verify endpoint already created the
   * FeePayment for this gatewayOrderId, this is a no-op — preventing
   * the historical double-count bug.
   */
  private async applyFeeUpdate(
    tenantId: string,
    feeId: string,
    orderId: string,
    transactionId: string,
    amountPaidInRupees: number,
    gateway: PaymentGateway,
  ): Promise<void> {
    try {
      await this.paymentsService.recordOnlineFeePayment(
        tenantId,
        feeId,
        orderId,
        transactionId,
        amountPaidInRupees,
        gateway,
      );
    } catch (err) {
      this.logger.warn(
        `Webhook fee update failed for ${feeId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Legacy fee updater — kept only so existing call sites still
   * compile while we migrate. Forwards to applyFeeUpdate. New code
   * should call applyFeeUpdate directly.
   */
  private async updateFeeOnPayment(feeId: string, amountPaidInRupees: number): Promise<void> {
    const fee = await this.feeRepository.findOne({ where: { id: feeId } });
    if (!fee) {
      this.logger.warn(`Fee ${feeId} not found — skipping fee update`);
      return;
    }

    const totalOwed =
      parseFloat(fee.originalAmount) +
      parseFloat(fee.totalPenalty) -
      parseFloat(fee.totalDiscount);

    const newPaidAmount = parseFloat(fee.paidAmount) + amountPaidInRupees;
    const remaining = totalOwed - newPaidAmount;

    let paidAmount: string;
    let netAmount: string;
    let paymentStatus: FeePaymentStatus;

    if (remaining <= 0) {
      paidAmount = totalOwed.toFixed(2);
      netAmount = '0.00';
      paymentStatus = FeePaymentStatus.PAID;
    } else {
      paidAmount = newPaidAmount.toFixed(2);
      netAmount = remaining.toFixed(2);
      paymentStatus = FeePaymentStatus.PARTIAL;
    }

    // UPDATE only these 3 columns — no other columns are touched
    await this.feeRepository.update(feeId, { paidAmount, netAmount, paymentStatus });
    this.logger.log(
      `Fee ${feeId} updated — paid: ${paidAmount}, remaining: ${netAmount}, status: ${paymentStatus}`,
    );
  }

  async handleRazorpayWebhook(dto: RazorpayWebhookDto): Promise<Payment> {
    const { event, payload } = dto;
    const orderId = payload.order?.id;
    const paymentId = payload.payment.id;

    if (!orderId) throw new NotFoundException('Order ID not found in webhook payload');

    let payment = await this.paymentsRepository.findOne({
      where: { gatewayOrderId: orderId },
    });
    const tenantId = payment?.tenantId ?? 'unknown';

    if (!payment) {
      this.logger.warn(`Payment order ${orderId} not found in DB for Razorpay webhook`);
      void this.auditService.log({
        tenantId,
        action: AuditAction.WEBHOOK_ORDER_NOT_FOUND,
        gateway: PaymentGateway.RAZORPAY,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType: event,
        actor: 'webhook',
        isError: true,
        errorMessage: `Order ${orderId} not found`,
        metadata: { rawWebhookPayload: { event, payment: payload.payment, order: payload.order } },
      });
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Prevent duplicate processing — check if transaction already exists for this payment event
    const existingTransaction = await this.transactionsRepository.findOne({
      where: { paymentId: payment.id, gatewayPaymentId: paymentId },
    });

    if (existingTransaction) {
      this.logger.log(`Webhook already processed for payment ${paymentId}`);
      void this.auditService.log({
        tenantId,
        action: AuditAction.WEBHOOK_DUPLICATE,
        paymentId: payment.id,
        gateway: PaymentGateway.RAZORPAY,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType: event,
        actor: 'webhook',
        metadata: { rawWebhookPayload: { event, payment: payload.payment, order: payload.order } },
      });
      return payment;
    }

    if (event === 'payment.authorized' && payload.payment.status === 'captured') {
      const fromStatus = payment.status;
      payment.status = PaymentStatus.PAID;
      payment.gatewayPaymentId = paymentId;
      payment.paidAt = new Date();
      payment = await this.paymentsRepository.save(payment);

      const tx = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: TransactionType.PAYMENT_SUCCESS,
          gateway: PaymentGateway.RAZORPAY,
          status: PaymentStatus.PAID,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          amount: payload.payment.amount,
          currency: payload.payment.currency,
          notes: payment.notes,
          paymentDetails: {
            event,
            paymentStatus: payload.payment.status,
            method: payload.payment.method,
            amount: payload.payment.amount,
            fee: payload.payment.fee,
            tax: payload.payment.tax,
            acquiredAt: new Date().toISOString(),
          },
        }),
      ) as unknown as Transaction;

      if (payment.feeId) {
        // Razorpay sends amount in paise — convert to rupees.
        // Idempotent by gatewayOrderId — won't double-count if the
        // /verify endpoint already ran first.
        await this.applyFeeUpdate(
          tenantId,
          payment.feeId,
          orderId,
          tx.id,
          payload.payment.amount / 100,
          PaymentGateway.RAZORPAY,
        );
      }

      void this.auditService.log({
        tenantId,
        action: AuditAction.PAYMENT_STATUS_CHANGED,
        paymentId: payment.id,
        transactionId: tx.id,
        gateway: PaymentGateway.RAZORPAY,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType: event,
        fromStatus,
        toStatus: PaymentStatus.PAID,
        actor: 'webhook',
        metadata: { rawWebhookPayload: { event, payment: payload.payment, order: payload.order } },
      });

      this.logger.log(`Razorpay payment ${paymentId} marked as PAID`);
    } else if (
      event === 'payment.failed' ||
      (event === 'payment.authorized' && payload.payment.status === 'failed')
    ) {
      const fromStatus = payment.status;
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = `${payload.payment.error_code ?? ''}: ${payload.payment.error_description ?? ''}`.trim();
      payment = await this.paymentsRepository.save(payment);

      const tx = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: TransactionType.PAYMENT_FAILED,
          gateway: PaymentGateway.RAZORPAY,
          status: PaymentStatus.FAILED,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          amount: payload.payment.amount,
          currency: payload.payment.currency,
          notes: payment.notes,
          paymentDetails: {
            event,
            paymentStatus: payload.payment.status,
            errorCode: payload.payment.error_code,
            errorDescription: payload.payment.error_description,
            failedAt: new Date().toISOString(),
          },
        }),
      ) as unknown as Transaction;

      void this.auditService.log({
        tenantId,
        action: AuditAction.PAYMENT_STATUS_CHANGED,
        paymentId: payment.id,
        transactionId: tx.id,
        gateway: PaymentGateway.RAZORPAY,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType: event,
        fromStatus,
        toStatus: PaymentStatus.FAILED,
        actor: 'webhook',
        isError: true,
        errorMessage: payment.failureReason,
        metadata: { rawWebhookPayload: { event, payment: payload.payment, order: payload.order } },
      });

      this.logger.warn(`Razorpay payment ${paymentId} marked as FAILED: ${payload.payment.error_code}`);
    }

    return payment;
  }

  async handleCashfreeWebhook(dto: CashfreeWebhookDto): Promise<Payment> {
    const { eventType, data } = dto;
    console.log(eventType, data, "cashfree webhook payload") // Debug log to inspect incoming webhook data
    const orderId = data.order?.order_id;
    const paymentId = data.payment?.cf_payment_id?.toString();

    if (!orderId) throw new NotFoundException('Order ID not found in webhook payload');

    let payment = await this.paymentsRepository.findOne({
      where: { gatewayOrderId: orderId },
    });
    const tenantId = payment?.tenantId ?? 'unknown';

    if (!payment) {
      this.logger.warn(`Payment order ${orderId} not found in DB for Cashfree webhook`);
      void this.auditService.log({
        tenantId,
        action: AuditAction.WEBHOOK_ORDER_NOT_FOUND,
        gateway: PaymentGateway.CASHFREE,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType,
        actor: 'webhook',
        isError: true,
        errorMessage: `Order ${orderId} not found`,
        metadata: { rawWebhookPayload: { eventType, data } },
      });
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Prevent duplicate processing
    if (paymentId) {
      const existingTransaction = await this.transactionsRepository.findOne({
        where: { paymentId: payment.id, gatewayPaymentId: paymentId },
      });

      if (existingTransaction) {
        this.logger.log(`Webhook already processed for payment ${paymentId}`);
        void this.auditService.log({
          tenantId,
          action: AuditAction.WEBHOOK_DUPLICATE,
          paymentId: payment.id,
          gateway: PaymentGateway.CASHFREE,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          eventType,
          actor: 'webhook',
          metadata: { rawWebhookPayload: { eventType, data } },
        });
        return payment;
      }
    }

    if (eventType === 'PAYMENT_SUCCESS' || eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      const fromStatus = payment.status;
      payment.status = PaymentStatus.PAID;
      if (paymentId) payment.gatewayPaymentId = paymentId;
      payment.paidAt = new Date();
      payment = await this.paymentsRepository.save(payment);

      const tx = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: TransactionType.PAYMENT_SUCCESS,
          gateway: PaymentGateway.CASHFREE,
          status: PaymentStatus.PAID,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          amount: data.order?.order_amount,
          currency: data.order?.order_currency,
          notes: payment.notes,
          paymentDetails: {
            eventType,
            orderStatus: data.order?.order_status,
            paymentMethod: data.payment?.payment_method,
            amount: data.order?.order_amount,
            paymentAmount: data.payment?.payment_amount,
            successAt: new Date().toISOString(),
          },
        }),
      ) as unknown as Transaction;

      if (payment.feeId) {
        // Cashfree amounts are in rupees. Idempotent by gatewayOrderId.
        const amountInRupees =
          data.payment?.payment_amount ?? data.order?.order_amount ?? 0;
        await this.applyFeeUpdate(
          tenantId,
          payment.feeId,
          orderId,
          tx.id,
          amountInRupees,
          PaymentGateway.CASHFREE,
        );
      }

      void this.auditService.log({
        tenantId,
        action: AuditAction.PAYMENT_STATUS_CHANGED,
        paymentId: payment.id,
        transactionId: tx.id,
        gateway: PaymentGateway.CASHFREE,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType,
        fromStatus,
        toStatus: PaymentStatus.PAID,
        actor: 'webhook',
        metadata: { rawWebhookPayload: { eventType, data } },
      });

      this.logger.log(`Cashfree payment ${paymentId} marked as PAID`);
    } else if (eventType === 'PAYMENT_FAILURE' || eventType === 'PAYMENT_FAILED_WEBHOOK' || eventType === 'PAYMENT_FAILURE_WEBHOOK') {
      const fromStatus = payment.status;
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = data.order?.order_status ?? 'Payment failed';
      payment = await this.paymentsRepository.save(payment);

      const tx = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: TransactionType.PAYMENT_FAILED,
          gateway: PaymentGateway.CASHFREE,
          status: PaymentStatus.FAILED,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          amount: data.order?.order_amount,
          currency: data.order?.order_currency,
          notes: payment.notes,
          paymentDetails: {
            eventType,
            orderStatus: data.order?.order_status,
            failureReason: data.order?.order_status,
            failedAt: new Date().toISOString(),
          },
        }),
      ) as unknown as Transaction;

      void this.auditService.log({
        tenantId,
        action: AuditAction.PAYMENT_STATUS_CHANGED,
        paymentId: payment.id,
        transactionId: tx.id,
        gateway: PaymentGateway.CASHFREE,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        eventType,
        fromStatus,
        toStatus: PaymentStatus.FAILED,
        actor: 'webhook',
        isError: true,
        errorMessage: payment.failureReason,
        metadata: { rawWebhookPayload: { eventType, data } },
      });

      this.logger.warn(`Cashfree payment failed for order ${orderId}`);
    }

    return payment;
  }
}
