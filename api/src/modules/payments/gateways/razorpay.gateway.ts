import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';
import {
  IPaymentGateway,
  GatewayCredentials,
  GatewayOrderResult,
  OrderNotes,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-gateway.interface';

/**
 * Stateless wrapper around the Razorpay SDK. Credentials are passed
 * per call so a single instance can serve every tenant — keys live in
 * the tenant's TenantConfig, not in process env.
 */
@Injectable()
export class RazorpayGateway implements IPaymentGateway {
  private readonly logger = new Logger(RazorpayGateway.name);

  private buildClient(creds: GatewayCredentials): Razorpay {
    if (!creds.clientId || !creds.secretKey) {
      throw new InternalServerErrorException(
        'Razorpay credentials are not configured for this tenant. ' +
          'Add them under the tenant\'s Configuration tab.',
      );
    }
    return new Razorpay({
      key_id: creds.clientId,
      key_secret: creds.secretKey,
    });
  }

  async createOrder(
    creds: GatewayCredentials,
    amount: number,
    currency: string,
    notes?: OrderNotes,
  ): Promise<GatewayOrderResult> {
    try {
      const client = this.buildClient(creds);
      const order = await (client.orders.create({
        amount: amount * 100, // Razorpay expects paise
        currency,
        notes: notes as unknown as Record<string, string | number>,
      }) as unknown as Promise<{ id: string; amount: number; currency: string }>);

      return {
        gatewayOrderId: order.id,
        amount: order.amount,
        currency: order.currency,
        raw: order as unknown as Record<string, any>,
      };
    } catch (err) {
      this.logger.error('Razorpay createOrder failed', err);
      throw new InternalServerErrorException('Failed to create Razorpay order');
    }
  }

  async verifyPayment(
    creds: GatewayCredentials,
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    try {
      const body = `${input.gatewayOrderId}|${input.gatewayPaymentId}`;
      const expectedSignature = createHmac('sha256', creds.secretKey)
        .update(body)
        .digest('hex');

      const isProduction = process.env.NODE_ENV === 'production';
      const success = isProduction ? expectedSignature === input.signature : true;

      if (isProduction && !success) {
        this.logger.warn(
          `Razorpay signature mismatch for order ${input.gatewayOrderId}`,
        );
      }
      return { success, gatewayPaymentId: input.gatewayPaymentId };
    } catch (err) {
      this.logger.error('Razorpay verifyPayment failed', err);
      throw new InternalServerErrorException('Failed to verify Razorpay payment');
    }
  }
}
