import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdjustmentApproval } from './entities/adjustment-approval.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { FeesModule } from '../fees/fees.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdjustmentApproval]),
    forwardRef(() => FeesModule),
    NotificationsModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
