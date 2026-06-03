import { IsString, IsNotEmpty } from 'class-validator';

export class PublicInitiateDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsString()
  @IsNotEmpty()
  feeId: string;
}

export class PublicVerifyDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsString()
  @IsNotEmpty()
  gatewayOrderId: string;

  @IsString()
  gatewayPaymentId?: string;

  @IsString()
  signature?: string;
}
