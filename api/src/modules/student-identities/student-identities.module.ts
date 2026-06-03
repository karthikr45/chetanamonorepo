import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentIdentity } from './entities/student-identity.entity';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import { StudentIdentitiesService } from './student-identities.service';
import { StudentIdentitiesController } from './student-identities.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StudentIdentity, Student, Fee])],
  controllers: [StudentIdentitiesController],
  providers: [StudentIdentitiesService],
  exports: [StudentIdentitiesService],
})
export class StudentIdentitiesModule {}
