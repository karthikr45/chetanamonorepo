import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ParentsModule } from '../parents/parents.module';
import { PaymentsModule } from '../payments/payments.module';
import { FeesModule } from '../fees/fees.module';
import { StudentsModule } from '../students/students.module';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { TenantConfigsModule } from '../tenant-configs/tenant-configs.module';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalController } from './parent-portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      Fee,
      Payment,
      ParentStudent,
      Tenant,
    ]),
    ParentsModule,
    PaymentsModule,
    FeesModule,
    StudentsModule,
    AcademicYearsModule,
    TenantConfigsModule,
  ],
  providers: [ParentPortalService],
  controllers: [ParentPortalController],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
