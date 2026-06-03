import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookGatewayDetectorService, PaymentWebhookGateway } from './webhook-gateway-detector.service';
import { WebhookVerificationService } from './webhook-verification.service';
import { WebhookHandlerService } from './webhook-handler.service';
import { RazorpayWebhookDto, CashfreeWebhookDto } from '../dto/webhook.dto';
import { PaymentAuditService } from '../payment-audit.service';
import { AuditAction } from '../entities/payment-audit-log.entity';
import { Payment } from '../entities/payment.entity';
import { TenantConfig } from '../../tenant-configs/entities/tenant-config.entity';

@Injectable()
export class UnifiedWebhookService {
  private readonly logger = new Logger(UnifiedWebhookService.name);

  constructor(
    private readonly detectorService: WebhookGatewayDetectorService,
    private readonly verificationService: WebhookVerificationService,
    private readonly handlerService: WebhookHandlerService,
    private readonly auditService: PaymentAuditService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(TenantConfig)
    private readonly tenantConfigRepo: Repository<TenantConfig>,
  ) {}

  async handleUnifiedWebhook(
    headers: Record<string, string>,
    payload: Record<string, any>,
    rawBody: string,
  ) {
    try {
      const { gateway, signatureHeader } = this.detectorService.detectGateway(headers, payload);

      if (gateway === PaymentWebhookGateway.UNKNOWN) {
        void this.auditService.log({
          tenantId: 'unknown',
          action: AuditAction.WEBHOOK_GATEWAY_UNKNOWN,
          actor: 'webhook',
          isError: true,
          errorMessage: 'Could not detect payment gateway from webhook',
          metadata: { rawWebhookPayload: payload, headers },
        });
        throw new BadRequestException('Could not detect payment gateway from webhook');
      }

      this.logger.log(`Processing ${gateway} webhook`);

      const isValid = await this.verifyWebhookSignature(
        gateway,
        payload,
        rawBody,
        headers,
        signatureHeader,
      );

      if (!isValid) {
        this.logger.warn(`Invalid signature for ${gateway} webhook`);
        throw new BadRequestException(`Invalid webhook signature for ${gateway}`);
      }

      const result = await this.routeToGatewayHandler(gateway, payload);

      return {
        success: true,
        gateway,
        message: `${gateway} webhook processed successfully`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error processing unified webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resolves the tenant from the webhook's order id, fetches THIS
   * tenant's payment_secret_key, then verifies. Per-tenant secrets
   * are mandatory — webhooks for tenants without a config row are
   * rejected (returns false) so a mis-routed webhook can't slip in
   * with a fallback secret.
   */
  private async verifyWebhookSignature(
    gateway: PaymentWebhookGateway,
    payload: Record<string, any>,
    rawBody: string,
    headers: Record<string, string>,
    signature: string | null,
  ): Promise<boolean> {
    if (!signature) {
      throw new BadRequestException(`Missing signature header for ${gateway}`);
    }

    const orderId = this.extractOrderId(gateway, payload);
    if (!orderId) {
      this.logger.warn(`Could not extract order id from ${gateway} webhook payload`);
      return false;
    }

    const payment = await this.paymentRepo.findOne({
      where: { gatewayOrderId: orderId },
      select: ['id', 'tenantId'],
    });
    if (!payment) {
      this.logger.warn(
        `Webhook references unknown order ${orderId} — refusing to verify against any tenant.`,
      );
      return false;
    }

    const cfg = await this.tenantConfigRepo.findOne({
      where: { tenantId: payment.tenantId, isActive: true },
      order: { createdAt: 'DESC' },
      select: ['id', 'paymentSecretKey'],
    });
    const secret = cfg?.paymentSecretKey?.trim();
    if (!secret) {
      this.logger.error(
        `Tenant ${payment.tenantId} has no payment_secret_key configured — webhook rejected.`,
      );
      return false;
    }

    switch (gateway) {
      case PaymentWebhookGateway.RAZORPAY:
        return this.verificationService.verifyRazorpayWebhook(payload, signature, secret);

      case PaymentWebhookGateway.CASHFREE: {
        const timestamp = headers['x-webhook-timestamp'] ?? '';
        return this.verificationService.verifyCashfreeWebhook(
          rawBody,
          signature,
          timestamp,
          secret,
        );
      }

      default:
        throw new BadRequestException(`Unsupported gateway: ${gateway}`);
    }
  }

  /**
   * Pull the gateway-side order id from a webhook payload. Both
   * gateways nest it differently; this mapping is the only
   * gateway-aware code outside of the verification + handler split.
   */
  private extractOrderId(
    gateway: PaymentWebhookGateway,
    payload: Record<string, any>,
  ): string | null {
    if (gateway === PaymentWebhookGateway.RAZORPAY) {
      const entity =
        payload?.payload?.payment?.entity ??
        payload?.payload?.order?.entity ??
        payload?.payload?.refund?.entity;
      return (entity?.order_id as string | undefined) ?? null;
    }
    if (gateway === PaymentWebhookGateway.CASHFREE) {
      const orderRef =
        payload?.data?.order?.order_id ??
        payload?.data?.payment?.order_id ??
        payload?.order?.order_id;
      return (orderRef as string | undefined) ?? null;
    }
    return null;
  }

  private async routeToGatewayHandler(
    gateway: PaymentWebhookGateway,
    payload: Record<string, any>,
  ) {
    switch (gateway) {
      case PaymentWebhookGateway.RAZORPAY:
        return this.handleRazorpayWebhook(payload);

      case PaymentWebhookGateway.CASHFREE:
        return this.handleCashfreeWebhook(payload);

      default:
        throw new BadRequestException(`No handler for gateway: ${gateway}`);
    }
  }

  private async handleRazorpayWebhook(payload: Record<string, any>) {
    const dto: RazorpayWebhookDto = {
      event: payload.event,
      payload: payload.payload,
    };

    try {
      const result = await this.handlerService.handleRazorpayWebhook(dto);
      this.logger.log(`Razorpay webhook handled successfully for payment ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error handling Razorpay webhook: ${error.message}`);
      throw error;
    }
  }

  private async handleCashfreeWebhook(payload: Record<string, any>) {
    const dto: CashfreeWebhookDto = {
      eventType: payload.type ?? payload.eventType,
      eventTime: payload.event_time ?? payload.eventTime,
      data: payload.data,
    };

    try {
      const result = await this.handlerService.handleCashfreeWebhook(dto);
      this.logger.log(`Cashfree webhook handled successfully for payment ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error handling Cashfree webhook: ${error.message}`);
      throw error;
    }
  }
}
