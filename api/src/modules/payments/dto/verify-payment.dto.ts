import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentGateway } from '../entities/payment.entity';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'tenant-uuid', description: 'Tenant ID sent from the frontend' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiPropertyOptional({ enum: PaymentGateway, example: PaymentGateway.RAZORPAY, description: 'Auto-detected if not provided' })
  @IsEnum(PaymentGateway)
  @IsOptional()
  gateway?: PaymentGateway;

  // Generic field
  @ApiPropertyOptional({ example: 'order_PXyz123' })
  @IsString()
  @IsOptional()
  gatewayOrderId?: string;

  // Razorpay native
  @ApiPropertyOptional({ example: 'order_PXyz123' })
  @IsString()
  @IsOptional()
  razorpay_order_id?: string;

  // Generic field
  @ApiPropertyOptional({ example: 'pay_PXyz456' })
  @IsString()
  @IsOptional()
  gatewayPaymentId?: string;

  // Razorpay native
  @ApiPropertyOptional({ example: 'pay_PXyz456' })
  @IsString()
  @IsOptional()
  razorpay_payment_id?: string;

  // Generic field
  @ApiPropertyOptional({ example: 'abc123signature' })
  @IsString()
  @IsOptional()
  signature?: string;

  // Razorpay native
  @ApiPropertyOptional({ example: 'abc123signature' })
  @IsString()
  @IsOptional()
  razorpay_signature?: string;
}
