import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfigsController } from './tenant-configs.controller';
import { TenantConfigsService } from './tenant-configs.service';
import { TenantConfig } from './entities/tenant-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TenantConfig])],
  controllers: [TenantConfigsController],
  providers: [TenantConfigsService],
  exports: [TenantConfigsService],
})
export class TenantConfigsModule {}
