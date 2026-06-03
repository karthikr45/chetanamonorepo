import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYear } from './entities/academic-year.entity';
import { SystemMetadata } from '../system-metadata/entities/system-metadata.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicYear, SystemMetadata])],
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}