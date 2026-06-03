import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stateless signature checks. Caller supplies the per-tenant secret;
 * this service knows nothing about ConfigService — that lookup is
 * UnifiedWebhookService's job because only it can map order_id →
 * tenantId → tenant_configurations.payment_secret_key.
 *
 * Using `timingSafeEqual` to prevent timing side-channels (the
 * previous `===` comparison was vulnerable in principle).
 */
@Injectable()
export class WebhookVerificationService {
  private readonly logger = new Logger(WebhookVerificationService.name);

  verifyRazorpayWebhook(
    payload: Record<string, any>,
    signature: string,
    secret: string,
  ): boolean {
    try {
      if (!secret) throw new Error('Razorpay secret not provided');

      // Razorpay: HMAC-SHA256(JSON.stringify(payload), secret) in hex.
      const body = JSON.stringify(payload);
      const expected = createHmac('sha256', secret).update(body).digest('hex');

      const ok = constantTimeEqual(expected, signature);
      if (!ok) {
        this.logger.warn(
          `Razorpay signature verification failed (len_exp=${expected.length}, len_got=${signature.length}).`,
        );
      }
      return ok;
    } catch (err) {
      this.logger.error('Razorpay webhook verification error', err);
      throw new BadRequestException('Razorpay webhook verification failed');
    }
  }

  verifyCashfreeWebhook(
    rawBody: string,
    signature: string,
    timestamp: string,
    secret: string,
  ): boolean {
    try {
      if (!secret) throw new Error('Cashfree secret not provided');

      // Cashfree: Base64(HMAC-SHA256(timestamp + rawBody, secret))
      const expected = createHmac('sha256', secret)
        .update(timestamp + rawBody)
        .digest('base64');

      const ok = constantTimeEqual(expected, signature);
      if (!ok) {
        this.logger.warn(
          `Cashfree signature verification failed (len_exp=${expected.length}, len_got=${signature.length}).`,
        );
      }
      return ok;
    } catch (err) {
      this.logger.error('Cashfree webhook verification error', err);
      throw new BadRequestException('Cashfree webhook verification failed');
    }
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  // Different-length strings can't be equal; timingSafeEqual would throw.
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
