import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { Student } from './entities/student.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { StudentIdentity } from '../student-identities/entities/student-identity.entity';
import { FeesModule } from '../fees/fees.module';
import { UploadService } from './upload.service';
import { UploadValidationService } from './upload-validation.service';
import { StudentsDetailsController } from './students-details.controller';
import { StudentIdentitiesModule } from '../student-identities/student-identities.module';
import { ParentsModule } from '../parents/parents.module';

/**
 * Dependencies: students → fees, students → student-identities.
 *
 * Students depends on fees because the bulk-upload flow creates fees
 * alongside students; on identities because every new enrollment must
 * be attached to a canonical person identity.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Tenant, StudentIdentity]),
    FeesModule,
    StudentIdentitiesModule,
    ParentsModule,
  ],
  controllers: [StudentsController, StudentsDetailsController],
  providers: [StudentsService, UploadService, UploadValidationService],
  exports: [StudentsService],
})
export class StudentsModule {}