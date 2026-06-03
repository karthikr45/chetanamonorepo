import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import {
  IPaymentGateway,
  GatewayCredentials,
  GatewayOrderResult,
  OrderNotes,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-gateway.interface';

/**
 * Stateless wrapper around the Cashfree SDK. Credentials are passed
 * per call so a single instance can serve every tenant.
 */
@Injectable()
export class CashfreeGateway implements IPaymentGateway {
  private readonly logger = new Logger(CashfreeGateway.name);

  private buildClient(creds: GatewayCredentials): Cashfree {
    if (!creds.clientId || !creds.secretKey) {
      throw new InternalServerErrorException(
        'Cashfree credentials are not configured for this tenant. ' +
          'Add them under the tenant\'s Configuration tab.',
      );
    }
    // Sandbox vs production comes from the tenant's active
    // TenantConfig (environment_type) — propagated via creds.mode.
    // No env-var coordination needed; each school chooses independently.
    const env =
      creds.mode === 'production'
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX;
    return new Cashfree(env, creds.clientId, creds.secretKey);
  }

  async createOrder(
    creds: GatewayCredentials,
    amount: number,
    currency: string,
    notes?: OrderNotes,
  ): Promise<GatewayOrderResult> {
    try {
      const client = this.buildClient(creds);
      const orderId = `order_${Date.now()}`;
      const orderNote = notes
        ? `${notes.studentName} | ${notes.admission} | ${notes.term} | ${notes.academicYear}`
        : undefined;

      // Tell Cashfree where to ping us when payment completes (the
      // unified webhook), and where to send the browser back when the
      // checkout is in redirect mode. PUBLIC_API_BASE_URL takes
      // precedence over CLIENT_URL so the webhook hits the API host,
      // not the frontend host.
      const apiBase = (process.env.PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
      const clientBase = (process.env.CLIENT_URL ?? '').replace(/\/$/, '');
      const notifyUrl = apiBase ? `${apiBase}/api/payments/webhooks` : undefined;
      const returnUrl = clientBase ? `${clientBase}/pay?order_id={order_id}` : undefined;

      const response = await client.PGCreateOrder({
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        order_note: orderNote,
        customer_details: {
          customer_id: 'guest',
          customer_phone: '9999999999',
        },
        ...(notifyUrl || returnUrl
          ? {
              order_meta: {
                ...(notifyUrl ? { notify_url: notifyUrl } : {}),
                ...(returnUrl ? { return_url: returnUrl } : {}),
              },
            }
          : {}),
      });

      const order = response.data;
      const gatewayOrderId = order.order_id ?? orderId;

      return {
        gatewayOrderId,
        amount,
        currency,
        raw: order as unknown as Record<string, any>,
      };
    } catch (err) {
      this.logger.error('Cashfree createOrder failed', err?.response?.data ?? err);
      throw new InternalServerErrorException('Failed to create Cashfree order');
    }
  }

  async verifyPayment(
    creds: GatewayCredentials,
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    try {
      const client = this.buildClient(creds);
      const orderResponse = await client.PGFetchOrder(input.gatewayOrderId);
      const order = orderResponse.data;
      const success = order.order_status === 'PAID';

      if (!success) {
        this.logger.warn(
          `Cashfree order ${input.gatewayOrderId} status: ${order.order_status}`,
        );
        return { success: false, gatewayPaymentId: input.gatewayPaymentId };
      }

      const paymentsResponse = await client.PGOrderFetchPayments(
        input.gatewayOrderId,
      );
      const payments = paymentsResponse.data;
      const successfulPayment = payments.find(
        (p: any) => p.payment_status === 'SUCCESS',
      );
      const gatewayPaymentId =
        successfulPayment?.cf_payment_id ?? input.gatewayPaymentId;

      return { success: true, gatewayPaymentId };
    } catch (err) {
      this.logger.error('Cashfree verifyPayment failed', err?.response?.data ?? err);
      throw new InternalServerErrorException('Failed to verify Cashfree payment');
    }
  }
}
