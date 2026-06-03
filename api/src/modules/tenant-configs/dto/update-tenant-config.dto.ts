import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTenantConfigDto } from './create-tenant-config.dto';

export class UpdateTenantConfigDto extends PartialType(CreateTenantConfigDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
