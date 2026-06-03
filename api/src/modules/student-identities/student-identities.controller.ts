import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { StudentIdentitiesService } from './student-identities.service';

function tenantOf(req: Request): string {
  const u = (req as any).user;
  if (!u?.tenantId) throw new UnauthorizedException('Tenant context required.');
  return u.tenantId;
}

@ApiTags('student-identities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('student-identities')
export class StudentIdentitiesController {
  constructor(private readonly svc: StudentIdentitiesService) {}

  @Get('search')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary: 'Find candidate identities by name / phone / email',
    description:
      'Used by the admission form\'s first step ("is this person already on record?"). ' +
      'Returns up to 15 matches with their full enrollment history attached.',
  })
  search(
    @Req() req: Request,
    @Query('name') name?: string,
    @Query('phone') phone?: string,
    @Query('email') email?: string,
  ) {
    return this.svc.findMatches(tenantOf(req), { name, phone, email });
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'Get one identity with enrollment timeline' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.svc.findOne(tenantOf(req), id);
  }

  @Get(':id/outstanding')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary: 'Per-enrollment outstanding fees for this person',
    description:
      'Returns each enrollment under the identity with the sum of ' +
      'unpaid fees (netAmount − paidAmount where > 0). Used by the ' +
      'identity page balance column and the re-admission banner.',
  })
  outstanding(@Req() req: Request, @Param('id') id: string) {
    return this.svc.outstandingForIdentity(tenantOf(req), id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'Create a new identity (used when no match was found)' })
  create(
    @Req() req: Request,
    @Body()
    dto: {
      displayName: string;
      primaryPhone?: string;
      primaryEmail?: string;
      dateOfBirth?: string;
      gender?: string;
      photoUrl?: string;
      notes?: string;
    },
  ) {
    return this.svc.create(tenantOf(req), dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'Edit identity details (phone/email/name change over time)' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    dto: {
      displayName?: string;
      primaryPhone?: string | null;
      primaryEmail?: string | null;
      dateOfBirth?: string | null;
      gender?: string | null;
      photoUrl?: string | null;
      notes?: string | null;
    },
  ) {
    return this.svc.update(tenantOf(req), id, dto);
  }

  @Post('backfill')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Backfill identities for legacy student rows (super-admin only).',
    description:
      'Idempotent. Groups existing rows by (tenant, admission_number, email) ' +
      'so the same person across academic years lands on a single identity.',
  })
  backfill() {
    return this.svc.ensureIdentitiesForExisting();
  }
}
