import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export enum PaymentWebhookGateway {
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  UNKNOWN = 'UNKNOWN',
}

interface WebhookDetectionResult {
  gateway: PaymentWebhookGateway;
  signatureHeader: string | null;
}

@Injectable()
export class WebhookGatewayDetectorService {
  private readonly logger = new Logger(WebhookGatewayDetectorService.name);

  /**
   * Detects which payment gateway sent the webhook based on headers and payload
   *
   * Detection Strategy:
   * - Razorpay: Sends 'x-razorpay-signature' header, payload has 'event' field
   * - Cashfree: Sends 'x-webhook-signature' header, payload has 'eventType' field
   */
  detectGateway(headers: Record<string, string>, payload: Record<string, any>): WebhookDetectionResult {
    const razorpaySignature = headers['x-razorpay-signature'];
    const cashfreeSignature = headers['x-webhook-signature'];

    // Check for Razorpay signature header
    if (razorpaySignature) {
      this.logger.log('Detected Razorpay webhook via x-razorpay-signature header');
      return {
        gateway: PaymentWebhookGateway.RAZORPAY,
        signatureHeader: razorpaySignature,
      };
    }

    // Check for Cashfree signature header
    if (cashfreeSignature) {
      this.logger.log('Detected Cashfree webhook via x-webhook-signature header');
      return {
        gateway: PaymentWebhookGateway.CASHFREE,
        signatureHeader: cashfreeSignature,
      };
    }

    // Fallback: check payload structure for Razorpay (has 'event' field)
    if (payload.event && payload.payload) {
      this.logger.log('Detected Razorpay webhook via payload structure (event field)');
      return {
        gateway: PaymentWebhookGateway.RAZORPAY,
        signatureHeader: razorpaySignature,
      };
    }

    // Fallback: check payload structure for Cashfree (has 'type' or 'eventType' field)
    if ((payload.type || payload.eventType) && payload.data) {
      this.logger.log('Detected Cashfree webhook via payload structure (eventType field)');
      return {
        gateway: PaymentWebhookGateway.CASHFREE,
        signatureHeader: cashfreeSignature,
      };
    }

    this.logger.warn('Could not detect payment gateway from webhook');
    return {
      gateway: PaymentWebhookGateway.UNKNOWN,
      signatureHeader: null,
    };
  }
}
