import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * Parent kicks off an online payment. The gateway is NOT in this DTO
 * by design — the tenant's admin chooses which gateway via
 * tenant_configurations.gateway_type. Letting the client pick would
 * let a parent attempt a different account than the school's.
 */
export class ParentInitiatePaymentDto {
  @ApiProperty({ description: 'Fee record to pay against' })
  @IsUUID()
  @IsNotEmpty()
  feeId: string;
}
