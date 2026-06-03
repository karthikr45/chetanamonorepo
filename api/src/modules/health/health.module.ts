import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// DataSource is provided globally by TypeOrmModule.forRootAsync in
// AppModule, so no extra imports are needed here.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
