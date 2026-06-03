import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('platform-summary')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Platform-wide stats for the super-admin dashboard',
    description:
      'Counts of tenants (active/inactive, by type), admins (by role), ' +
      'students, fees received this month, balance outstanding, plus the ' +
      'last few tenants created.',
  })
  getPlatformSummary() {
    return this.dashboardService.getPlatformSummary();
  }

  @Get('summary')
  getSummary(@CurrentUser() _user: any) {
    // Tenant-admin summary — TODO
  }

  @Get('activity')
  getRecentActivity(@CurrentUser() _user: any) {
    // TODO
  }

  @Get('chart')
  getChartData(@CurrentUser() _user: any, @Query('type') _type: string) {
    // TODO
  }
}
