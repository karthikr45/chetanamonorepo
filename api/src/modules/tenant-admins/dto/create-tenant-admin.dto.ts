import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTenantAdminDto {
  @ApiProperty({ example: 'Firstname' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Lastname' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'fin_admin',
    description:
      'Role identifier. Any string except super_admin and parent. Built-in ' +
      'choices: admin, fin_admin, ops_admin. Custom roles defined by ' +
      'super-admin in system_metadata(type=admin_role) are also accepted.',
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
    description:
      'Initial password. If omitted, the system default seed password is used.',
  })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
