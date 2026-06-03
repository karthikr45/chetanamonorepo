import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AzureStorageService } from './azure-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantConfig, Tenant])],
  providers: [AzureStorageService],
  exports: [AzureStorageService],
})
export class StorageModule {}
