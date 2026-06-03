import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parent } from './entities/parent.entity';
import { ParentStudent } from './entities/parent-student.entity';
import { ParentsService } from './parents.service';
import { ParentsController } from './parents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Parent, ParentStudent])],
  providers: [ParentsService],
  controllers: [ParentsController],
  exports: [ParentsService, TypeOrmModule],
})
export class ParentsModule {}
