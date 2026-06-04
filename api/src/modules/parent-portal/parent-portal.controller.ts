import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParentPortalService } from './parent-portal.service';
import { ParentInitiatePaymentDto } from './dto/initiate-payment.dto';
import { ParentVerifyPaymentDto } from './dto/verify-payment.dto';

@ApiTags('parent-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARENT)
@Controller('parent')
export class ParentPortalController {
  constructor(private readonly portal: ParentPortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Logged-in parent profile' })
  me(@CurrentUser() user: any) {
    return this.portal.me(user.tenantId, user.userId);
  }

  @Get('students')
  @ApiOperation({ summary: 'List of children for the logged-in parent' })
  students(@CurrentUser() user: any) {
    return this.portal.listChildren(user.tenantId, user.userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Parent dashboard summary' })
  dashboard(@CurrentUser() user: any) {
    return this.portal.dashboard(user.tenantId, user.userId);
  }

  @Get('overview')
  @ApiOperation({
    summary:
      'Every child: school + hostel + transport fees by year & term, ' +
      'payment history, receipts and TC status',
  })
  overview(@CurrentUser() user: any) {
    return this.portal.childrenOverview(user.tenantId, user.userId);
  }

  @Get('students/:studentId/services')
  @ApiOperation({
    summary:
      "One child's school/hostel/transport fees across sibling tenants",
  })
  childServices(
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
  ) {
    return this.portal.childServices(user.tenantId, user.userId, studentId);
  }

  @Get('payments/receipt/:paymentId')
  @ApiOperation({
    summary: 'Generate the PDF receipt and return its URL (own children only)',
  })
  receipt(
    @CurrentUser() user: any,
    @Param('paymentId') paymentId: string,
  ) {
    return this.portal.getReceiptUrlForParent(
      user.tenantId,
      user.userId,
      paymentId,
    );
  }

  @Get('fees')
  @ApiOperation({ summary: 'List fees for parent\'s children (optionally filter by studentId)' })
  fees(
    @CurrentUser() user: any,
    @Query('studentId') studentId?: string,
  ) {
    return this.portal.listFees(user.tenantId, user.userId, studentId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List of payments tied to the parent\'s children' })
  payments(@CurrentUser() user: any) {
    return this.portal.listPayments(user.tenantId, user.userId);
  }

  @Get('payments/history')
  @ApiOperation({
    summary:
      "Cross-tenant payment history for the logged-in parent — matched by " +
      'email across every school the parent is registered in',
  })
  paymentHistory(@CurrentUser() user: any) {
    return this.portal.paymentHistoryByEmail(user.email);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Initiate an online payment for a fee' })
  initiatePayment(
    @CurrentUser() user: any,
    @Body() dto: ParentInitiatePaymentDto,
  ) {
    return this.portal.initiatePayment(
      user.tenantId,
      user.userId,
      dto.feeId,
    );
  }

  @Post('payments/verify')
  @ApiOperation({ summary: 'Confirm a payment after the gateway checkout' })
  verifyPayment(
    @CurrentUser() user: any,
    @Body() dto: ParentVerifyPaymentDto,
  ) {
    return this.portal.verifyPayment(user.tenantId, user.userId, {
      gatewayOrderId: dto.gatewayOrderId,
      gatewayPaymentId: dto.gatewayPaymentId,
      signature: dto.signature,
    });
  }
}
