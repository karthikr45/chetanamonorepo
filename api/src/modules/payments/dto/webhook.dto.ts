import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RazorpayWebhookDto {
  @ApiProperty()
  @IsNotEmpty()
  event: string; // 'payment.authorized', 'payment.failed', etc.

  @ApiProperty()
  @IsNotEmpty()
  payload: {
    payment: {
      id: string;
      entity: string;
      amount: number;
      currency: string;
      status: string;
      method: string;
      description?: string;
      amount_refunded?: number;
      refund_status?: string;
      captured: boolean;
      email?: string;
      contact?: string;
      fee?: number;
      tax?: number;
      error_code?: string;
      error_description?: string;
      error_source?: string;
      error_reason?: string;
      error_step?: string;
      acquirer_data?: Record<string, any>;
      notes?: Record<string, any>;
    };
    order?: {
      id: string;
      entity: string;
      amount: number;
      amount_paid: number;
      amount_due: number;
      currency: string;
      receipt: string;
      status: string;
      attempts: number;
      notes: Record<string, any>;
    };
  };
}

export class CashfreeWebhookDto {
  @ApiProperty({ example: 'PAYMENT_SUCCESS' })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ example: '2024-04-20T10:00:00Z' })
  @IsString()
  @IsNotEmpty()
  eventTime: string;

  @ApiProperty()
  @IsNotEmpty()
  data: {
    order: {
      order_id: string;
      cf_order_id?: number;
      order_amount: number;
      order_currency: string;
      order_status: string;
    };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_method?: Record<string, any>;
    };
    customer_details?: {
      customer_id?: string;
      customer_email?: string;
      customer_phone?: string;
    };
  };
}
