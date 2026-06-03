import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'admin@svbk.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Raw token from the verification email link' })
  @IsString()
  @MinLength(16)
  token: string;
}
