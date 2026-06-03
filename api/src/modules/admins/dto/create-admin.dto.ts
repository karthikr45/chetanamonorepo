import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Firstname' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Lastname' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    example: '00000000-0000-0000-0000-000000000000',
    description: 'Tenant UUID (from /tenants). Omit for a super-admin.',
  })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'admin',
    description:
      'Role identifier. Built-ins: super_admin / admin / fin_admin / ops_admin. ' +
      'Custom roles can be defined by super-admin via system_metadata(type=admin_role).',
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ example: 'Main Branch' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({
    example: 'Welcome@123',
    description: 'Initial password. Defaults to system default if omitted.',
  })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
