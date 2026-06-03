import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Welcome Message' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '<p>Hello {{name}}, welcome!</p>' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  message: string;

  @ApiPropertyOptional({ example: 'Onboarding' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'admin-user-id' })
  @IsString()
  @IsOptional()
  adminId?: string;

}
