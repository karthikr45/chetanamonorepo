import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReceiptTemplateKind } from '../entities/receipt-template.entity';

export class CreateReceiptTemplateDto {
  @ApiProperty({ example: 'Default School Receipt' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: ReceiptTemplateKind, default: ReceiptTemplateKind.BOTH })
  @IsOptional()
  @IsEnum(ReceiptTemplateKind)
  kind?: ReceiptTemplateKind;

  @ApiPropertyOptional({ description: 'Header HTML. Mustache placeholders allowed.' })
  @IsOptional()
  @IsString()
  headerHtml?: string;

  @ApiPropertyOptional({ description: 'Body HTML. Mustache placeholders allowed.' })
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional({ description: 'Footer HTML. Mustache placeholders allowed.' })
  @IsOptional()
  @IsString()
  footerHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateReceiptTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ReceiptTemplateKind })
  @IsOptional()
  @IsEnum(ReceiptTemplateKind)
  kind?: ReceiptTemplateKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footerHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RenderTemplateDto {
  /**
   * Render this template against a real fee/payment. If both are
   * supplied, payment wins (we resolve the fee via payment.feeId).
   */
  @ApiPropertyOptional({ description: 'Existing payment id to render the receipt for' })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'Existing fee id to render against (no payment context)' })
  @IsOptional()
  @IsUUID()
  feeId?: string;

  @ApiPropertyOptional({ description: 'Render with sample/mock data — useful for the editor preview' })
  @IsOptional()
  @IsBoolean()
  sample?: boolean;
}
