import { Module } from '@nestjs/common';
import { TenantAdminsController } from './tenant-admins.controller';
import { TenantAdminsService } from './tenant-admins.service';
import { AdminsModule } from '../admins/admins.module';

@Module({
  imports: [AdminsModule],
  controllers: [TenantAdminsController],
  providers: [TenantAdminsService],
})
export class TenantAdminsModule {}
