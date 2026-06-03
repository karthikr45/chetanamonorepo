import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FeePayment } from '../fees/entities/fee-payment.entity';
import { Fee } from '../fees/entities/fee.entity';
import { Student } from '../students/entities/student.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeePayment, Fee, Student])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
