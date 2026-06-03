import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ParentSelectTenantDto {
  @ApiProperty({ description: 'Selection token from verify-otp' })
  @IsString()
  @IsNotEmpty()
  selectionToken: string;

  @ApiProperty({ description: 'Chosen parent account id (one per school)' })
  @IsUUID()
  parentId: string;
}
