import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SelectTenantDto {
  @ApiProperty({ description: 'Selection token returned by /auth/signin' })
  @IsString()
  @IsNotEmpty()
  selectionToken: string;

  @ApiProperty({ description: 'Admin row id for the tenant the user picked' })
  @IsString()
  @IsNotEmpty()
  adminId: string;
}
