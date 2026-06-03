import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description:
      'Required only when the same email is registered under multiple tenants. ' +
      'Use the tenant code (e.g. "SVBK_HYD").',
  })
  @IsOptional()
  @IsString()
  tenantCode?: string;
}
