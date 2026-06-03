import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentAuditLog, AuditAction } from './entities/payment-audit-log.entity';

export interface CreateAuditLogDto {
  tenantId: string;
  action: AuditAction;
  paymentId?: string | null;
  transactionId?: string | null;
  gateway?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  eventType?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor?: string | null;
  ipAddress?: string | null;
  isError?: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, any> | null;
}

@Injectable()
export class PaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);

  constructor(
    @InjectRepository(PaymentAuditLog)
    private readonly auditRepo: Repository<PaymentAuditLog>,
  ) {}

  /**
   * Fire-and-forget audit write.
   * Never throws — audit logging must never break the main payment flow.
   */
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          tenantId: dto.tenantId,
          action: dto.action,
          paymentId: dto.paymentId ?? null,
          transactionId: dto.transactionId ?? null,
          gateway: dto.gateway ?? null,
          gatewayOrderId: dto.gatewayOrderId ?? null,
          gatewayPaymentId: dto.gatewayPaymentId ?? null,
          eventType: dto.eventType ?? null,
          fromStatus: dto.fromStatus ?? null,
          toStatus: dto.toStatus ?? null,
          actor: dto.actor ?? null,
          ipAddress: dto.ipAddress ?? null,
          isError: dto.isError ?? false,
          errorMessage: dto.errorMessage ?? null,
          metadata: dto.metadata ?? null,
        }),
      );
    } catch (err) {
      this.logger.error('Failed to write payment audit log', err?.message);
    }
  }
}
