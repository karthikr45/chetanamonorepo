import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { FeesModule } from '../fees/fees.module';
import { PublicPayController } from './public-pay.controller';
import { PublicPayService } from './public-pay.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantConfig,
      AcademicYear,
      Student,
      Fee,
      Payment,
    ]),
    PaymentsModule,
    FeesModule,
  ],
  controllers: [PublicPayController],
  providers: [PublicPayService],
})
export class PublicPayModule {}
