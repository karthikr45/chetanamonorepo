import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from './entities/audit-log.entity';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary:
      'Paginated activity trail. Admins are scoped to their tenant; ' +
      'super-admins see all (optionally filter by tenantId).',
  })
  async list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('actorId') actorId?: string,
    @Query('method') method?: string,
    @Query('tenantId') tenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const qb = this.repo.createQueryBuilder('a');

    if (user.role === Role.SUPER_ADMIN) {
      if (tenantId) qb.andWhere('a.tenantId = :tid', { tid: tenantId });
    } else {
      qb.andWhere('a.tenantId = :tid', { tid: user.tenantId });
    }
    if (actorId) qb.andWhere('a.actorId = :actorId', { actorId });
    if (method)
      qb.andWhere('a.method = :method', { method: method.toUpperCase() });
    if (from)
      qb.andWhere('a.createdAt >= :from', {
        from: new Date(from).toISOString(),
      });
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      qb.andWhere('a.createdAt <= :to', { to: t.toISOString() });
    }

    const [rows, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return {
      rows,
      total,
      page: Math.max(Number(page) || 1, 1),
      limit: take,
      pages: Math.ceil(total / take),
    };
  }
}
