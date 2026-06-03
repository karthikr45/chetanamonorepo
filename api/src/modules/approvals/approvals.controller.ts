import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { ApprovalsService, ApprovalCaller } from './approvals.service';
import { ApprovalStatus } from './entities/adjustment-approval.entity';

function caller(req: Request): ApprovalCaller {
  const u = (req as any).user;
  if (!u?.userId || !u?.tenantId) {
    throw new UnauthorizedException('Authentication required');
  }
  return {
    userId: u.userId,
    email: typeof u.email === 'string' ? u.email : null,
    role: u.role,
    tenantId: u.tenantId,
  };
}

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'List concession approval requests for the tenant' })
  list(@Req() req: Request, @Query('status') status?: ApprovalStatus) {
    return this.approvals.list(caller(req).tenantId, status);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'Approval request detail (payload + status)' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.approvals.findOne(caller(req).tenantId, id);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Approve and apply the concession' })
  approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.approvals.approve(caller(req), id, body?.note);
  }

  @Post(':id/reject')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Reject the concession request' })
  reject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.approvals.reject(caller(req), id, body?.note);
  }
}
