import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemMetadata } from './entities/system-metadata.entity';
import { SystemMetadataService } from './system-metadata.service';
import { SystemMetadataController } from './system-metadata.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemMetadata])],
  providers: [SystemMetadataService],
  controllers: [SystemMetadataController],
  exports: [SystemMetadataService],
})
export class SystemMetadataModule {}
