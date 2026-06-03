import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { FeePayment } from '../fees/entities/fee-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Admin, Student, Fee, FeePayment])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
