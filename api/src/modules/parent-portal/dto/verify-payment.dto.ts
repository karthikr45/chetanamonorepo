import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Parent-side payment confirmation after the gateway checkout closes.
 * The webhook remains the source of truth — this just lets the parent see
 * an immediate result instead of waiting for async reconciliation.
 */
export class ParentVerifyPaymentDto {
  @ApiProperty({ description: 'Gateway order id (payment.gatewayOrderId)' })
  @IsString()
  gatewayOrderId: string;

  @ApiPropertyOptional({ example: 'pay_PXyz456' })
  @IsString()
  @IsOptional()
  gatewayPaymentId?: string;

  @ApiPropertyOptional({ example: 'abc123signature' })
  @IsString()
  @IsOptional()
  signature?: string;
}
