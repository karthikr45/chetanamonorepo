import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'admin@svbk.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Raw token from the reset email link' })
  @IsString()
  @MinLength(16)
  token: string;

  @ApiProperty({ example: 'NewStr0ng@Pass' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
