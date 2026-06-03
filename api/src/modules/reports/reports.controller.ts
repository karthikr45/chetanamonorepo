import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import type { ReportFilters } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('fee-collection')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Collections ledger for a date range' })
  getFeeCollection(
    @CurrentUser() user: any,
    @Query() filters: ReportFilters,
  ) {
    return this.reportsService.getFeeCollectionReport(
      user.tenantId,
      filters,
    );
  }

  @Get('outstanding-fees')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Students with an outstanding balance' })
  getOutstandingFees(
    @CurrentUser() user: any,
    @Query() filters: ReportFilters,
  ) {
    return this.reportsService.getOutstandingFeesReport(
      user.tenantId,
      filters,
    );
  }

  @Get('payment-summary')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Day-by-day collection totals' })
  getPaymentSummary(
    @CurrentUser() user: any,
    @Query() filters: ReportFilters,
  ) {
    return this.reportsService.getPaymentSummaryReport(
      user.tenantId,
      filters,
    );
  }

  @Post('export')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Download a report as an Excel workbook' })
  async exportReport(
    @CurrentUser() user: any,
    @Body()
    body: { type: 'fee-collection' | 'outstanding-fees' | 'payment-summary'; filters?: ReportFilters },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reportsService.exportReport(
      user.tenantId,
      body.type,
      body.filters ?? {},
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
