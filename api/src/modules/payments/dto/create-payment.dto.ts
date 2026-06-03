import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaymentGateway, PaymentType } from '../entities/payment.entity';

export class CreateOrderDto {
  @ApiProperty({ example: 'tenant-uuid', description: 'Tenant ID sent from the frontend' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Fee record this payment is linked to' })
  @IsOptional()
  @IsUUID()
  feeId?: string;

  @ApiProperty({ enum: PaymentType, example: PaymentType.ONLINE })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiPropertyOptional({ enum: PaymentGateway, example: PaymentGateway.RAZORPAY, description: 'Required for online payments' })
  @ValidateIf((o) => o.paymentType === PaymentType.ONLINE)
  @IsEnum(PaymentGateway)
  gateway?: PaymentGateway;

  @ApiProperty({ example: 5000, description: 'Amount in paise/lowest currency unit' })
  @IsInt()
  @Min(100)
  amount: number;

  @ApiProperty({ example: 'INR' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ example: 'dummy_001' })
  @IsString()
  @IsNotEmpty()
  ADMISSION: string;

  @ApiProperty({ example: '2025-2026' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: '1st Term' })
  @IsString()
  @IsNotEmpty()
  term: string;

  @ApiProperty({ example: 'Stephen' })
  @IsString()
  @IsNotEmpty()
  studentName: string;

  @ApiProperty({ example: '10' })
  @IsString()
  @IsNotEmpty()
  class: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty({ example: '42' })
  @IsString()
  @IsNotEmpty()
  rollNo: string;

  @ApiProperty({ example: 'stephen@school.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '123456', description: 'Cheque number (offline only)' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ example: '2024-06-15', description: 'Cheque date ISO string (offline only)' })
  @IsOptional()
  @IsDateString()
  chequeDate?: string;

  @ApiPropertyOptional({ example: '2024-06-20', description: 'DD date ISO string (offline only)' })
  @IsOptional()
  @IsDateString()
  ddDate?: string;
  

  
}
