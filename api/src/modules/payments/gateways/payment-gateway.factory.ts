import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../entities/payment.entity';
import { IPaymentGateway } from './payment-gateway.interface';
import { RazorpayGateway } from './razorpay.gateway';
import { CashfreeGateway } from './cashfree.gateway';

@Injectable()
export class PaymentGatewayFactory {
  constructor(
    private readonly razorpay: RazorpayGateway,
    private readonly cashfree: CashfreeGateway,
  ) {}

  get(gateway: PaymentGateway): IPaymentGateway {
    switch (gateway) {
      case PaymentGateway.RAZORPAY:
        return this.razorpay;
      case PaymentGateway.CASHFREE:
        return this.cashfree;
    }
  }
}
