import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdjustmentApproval } from './entities/adjustment-approval.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { FeesModule } from '../fees/fees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { AdminsModule } from '../admins/admins.module';
import { TenantConfigsModule } from '../tenant-configs/tenant-configs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdjustmentApproval]),
    forwardRef(() => FeesModule),
    NotificationsModule,
    MailModule,
    AdminsModule,
    TenantConfigsModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
