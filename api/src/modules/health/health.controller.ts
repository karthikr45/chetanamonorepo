import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness/readiness endpoint for load balancers, k8s probes, uptime
 * monitors. Public (no auth, no throttle). Pings the DB directly via the
 * TypeORM DataSource — no Terminus dependency.
 */
@ApiTags('health')
@Controller('healthz')
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + DB readiness probe' })
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up', uptime: process.uptime() };
  }
}
