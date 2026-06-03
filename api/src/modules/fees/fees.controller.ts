import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { ApprovalAction } from '../approvals/entities/adjustment-approval.entity';
import type { Request } from 'express';
import { FeesService } from './fees.service';
import {
  AddPenaltyDto,
  AddDiscountDto,
  AddSinglePenaltyDto,
  BulkAddDiscountDto,
  WaiveDiscountDto,
  WaiveSingleDto,
  UpdateReceiptConfigDto,
  CorrectReceiptSequenceDto,
  RecordOfflinePaymentDto,
  RecordOnlinePaymentDto,
  UpdateClearanceDto,
  WaivePenaltyDto,
} from './dto/fee.dto';
import { ClearanceStatus } from './entities/fee-payment.entity';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@ApiTags('fees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees')
export class FeesController {
  constructor(
    private readonly feesService: FeesService,
    @Inject(forwardRef(() => ApprovalsService))
    private readonly approvals: ApprovalsService,
  ) {}

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get fee amount stats',
    description:
      'Returns the sum of originalAmount across all fee rows for the tenant, plus month-over-month percentage change so the UI can display an increase/decrease indicator.',
  })
  async getFeeStats(@Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.feesService.getFeeStats(tenantId);
  }

  @Get('receipt-status')
  @ApiOperation({
    summary: 'Show the current running receipt sequence for the caller\'s tenant',
    description:
      'Returns prefix, reset policy, current period key (e.g. "2025-26"), ' +
      'the next receipt number that would be issued, and the last 12 periods\' counters.',
  })
  async getReceiptStatus(@Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.feesService.getReceiptStatus(tenantId);
  }

  @Patch('receipt-config')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Update receipt prefix / reset policy / start number',
    description:
      'Tenant admin can edit their own tenant\'s receipt configuration; ' +
      'super-admin can target any tenant via the existing Tenant PATCH. ' +
      'Existing receipts keep their format; only future receipts use the ' +
      'updated config.',
  })
  async updateReceiptConfig(
    @Body() dto: UpdateReceiptConfigDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.updateReceiptConfig(tenantId, {
      receiptFormat: dto.receiptFormat as any,
      tenantCode: dto.tenantCode,
      receiptPrefix: dto.receiptPrefix,
      receiptResetPolicy: dto.receiptResetPolicy as any,
      receiptStartNumber: dto.receiptStartNumber,
    });
  }

  @Patch('receipt-sequence')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Manually correct the receipt running number',
    description:
      'Admin/super-admin sets the current value of the receipt sequence ' +
      'for the active period (or any periodKey passed in). The next ' +
      'receipt issued will be currentValue + 1. Use when a receipt was ' +
      'issued incorrectly or you need to roll back. Existing receipt ' +
      'numbers on already-posted payments are not changed.',
  })
  async correctReceiptSequence(
    @Body() dto: CorrectReceiptSequenceDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.correctReceiptSequence(tenantId, {
      currentValue: dto.currentValue,
      periodKey: dto.periodKey,
    });
  }

 @Post('penalty/add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add penalty (single, multiple, or all students)',
    description:
      'Applies a penalty to fees in the current year+term. Use admissionNumbers for selective application (max 500). Use applyToAll=true to apply to every non-PAID fee in scope. PAID fees are silently skipped.',
  })
  async addPenalty(@Body() dto: AddPenaltyDto, @Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.feesService.addPenaltyForStudents(
      tenantId,
      { ...dto },
      actorOf(req),
    );
  }

  @Post('penalty/waive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Waive penalty (single, multiple, or all students)',
    description:
      'Removes the full current penalty from fees in scope. Use admissionNumbers for selective waiver (max 500). Use applyToAll=true to waive for every non-PAID fee with penalty > 0. PAID fees and fees with no penalty are silently skipped.',
  })
  async waivePenalty(@Body() dto: WaivePenaltyDto, @Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.approvals.gate(
      callerOf(req),
      ApprovalAction.PENALTY_WAIVE_BULK,
      { tenantId, dto: { ...dto }, actor: actorOf(req) },
      summarize("Waive penalty", dto),
    );
  }

  @Post('discount/add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add discount in bulk (single, multiple, or all students)',
    description:
      'Applies a per-fee discount across the current year + term. ' +
      'Use admissionNumbers for selective application (max 500). Use ' +
      'applyToAll=true to apply to every non-PAID fee in scope. Fees where ' +
      'the discount would invalidate an already-posted payment are silently ' +
      'skipped.',
  })
  async addDiscountBulk(@Body() dto: BulkAddDiscountDto, @Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.approvals.gate(
      callerOf(req),
      ApprovalAction.DISCOUNT_ADD_BULK,
      { tenantId, dto: { ...dto }, actor: actorOf(req) },
      summarize("Add discount", dto),
    );
  }

  @Post('discount/waive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Waive discount in bulk (single, multiple, or all students)',
    description:
      'Removes the entire current discount from fees in scope. Skips PAID ' +
      'fees, fees with no discount, and fees where removing the discount ' +
      'would invalidate an already-posted payment.',
  })
  async waiveDiscountBulk(@Body() dto: WaiveDiscountDto, @Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.approvals.gate(
      callerOf(req),
      ApprovalAction.DISCOUNT_WAIVE_BULK,
      { tenantId, dto: { ...dto }, actor: actorOf(req) },
      summarize("Waive discount", dto),
    );
  }

  @Post(':id/discount')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add discount to a fee',
    description:
      'Adds to total_discount and recomputes net_amount. Rejected if it would drop net_amount below what has already been paid.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async addDiscount(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: AddDiscountDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.approvals.gate(
      callerOf(req),
      ApprovalAction.DISCOUNT_ADD_SINGLE,
      { tenantId, feeId, amount: dto.amount, reason: dto.reason, actor: actorOf(req) },
      `Add discount ₹${dto.amount} on one fee${dto.reason ? ` — ${dto.reason}` : ""}`,
    );
  }

  @Post(':id/penalty')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add penalty to a fee',
    description:
      'Adds to total_penalty and recomputes net_amount. PAID fees are rejected.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async addPenaltySingle(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: AddSinglePenaltyDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.addPenaltyToFee(
      tenantId,
      feeId,
      dto.amount,
      dto.reason,
      actorOf(req),
    );
  }

  @Post(':id/penalty/waive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Waive penalty on a single fee',
    description:
      'Waives part or all of total_penalty on this fee. Omit `amount` to waive everything currently applied.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID' })
  async waivePenaltyOnFee(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: WaiveSingleDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.approvals.gate(
      callerOf(req),
      ApprovalAction.PENALTY_WAIVE_SINGLE,
      { tenantId, feeId, amount: dto.amount, reason: dto.reason, actor: actorOf(req) },
      `Waive penalty${dto.amount ? ` ₹${dto.amount}` : " (full)"} on one fee${dto.reason ? ` — ${dto.reason}` : ""}`,
    );
  }

  @Post(':id/discount/waive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Waive discount on a single fee',
    description:
      'Waives part or all of total_discount on this fee. Omit `amount` to waive everything currently applied. Refused if it would push net below the amount already paid.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID' })
  async waiveDiscountOnFee(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: WaiveSingleDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.approvals.gate(
      callerOf(req),
      ApprovalAction.DISCOUNT_WAIVE_SINGLE,
      { tenantId, feeId, amount: dto.amount, reason: dto.reason, actor: actorOf(req) },
      `Waive discount${dto.amount ? ` ₹${dto.amount}` : " (full)"} on one fee${dto.reason ? ` — ${dto.reason}` : ""}`,
    );
  }

  @Get(':id/adjustments')
  @ApiOperation({
    summary: 'List penalty / discount history for a fee',
    description:
      'Returns every fee_adjustments row for this fee — penalty add, penalty waive, discount add, discount waive — with actor (email) and timestamp. Used by the Payment Details timeline.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID' })
  async listAdjustments(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.listAdjustments(tenantId, feeId);
  }

  @Post(':id/offline-payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an offline payment',
    description:
      'School staff records a cash, cheque, DD, or NEFT payment. Amount cannot exceed remaining balance. Part payments supported.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async recordOfflinePayment(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: RecordOfflinePaymentDto,
    @Req() req: Request,
  ) {
    const { tenantId, userId } = ctx(req);
    return this.feesService.recordOfflinePayment(tenantId, feeId, {
      amount: dto.amount,
      paymentType: dto.paymentType,
      chequeNumber: dto.chequeNumber,
      chequeDate: dto.chequeDate,
      ddNumber: dto.ddNumber,
      ddDate: dto.ddDate,
      bankName: dto.bankName,
      bankBranch: dto.bankBranch,
      drawerName: dto.drawerName,
      transactionId: dto.transactionId,
      cardLast4: dto.cardLast4,
      notes: dto.notes,
      paidAt: dto.paidAt,
      recordedBy: userId,
    });
  }

  @Post(':id/online-payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an online payment (called by webhook handler)',
    description:
      'Called by the payments team after a gateway payment succeeds. Accepts orderId + transactionId from the gateway.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID', example: 'a1b2c3d4-0000-4000-8000-000000000001' })
  async recordOnlinePayment(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Body() dto: RecordOnlinePaymentDto,
    @Req() req: Request,
  ) {
    const { tenantId, userId } = ctx(req);
    return this.feesService.recordOnlinePayment(tenantId, feeId, {
      amount: dto.amount,
      paymentType: dto.paymentType,
      orderId: dto.orderId,
      transactionId: dto.transactionId,
      paidAt: dto.paidAt,
      recordedBy: userId,
    });
  }

  // ─────────────── Clearance (cheque / DD) ───────────────

  @Patch('payments/:paymentId/clearance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a cheque / DD as CLEARED or BOUNCED',
    description:
      'Cheque and DD payments are recorded with clearance_status=PENDING (payments) and do not yet add to fee.paid_amount. Mark CLEARED to recognise the payment, or BOUNCED to reject it. CLEARED → BOUNCED reverses a previously-cleared cheque.',
  })
  @ApiParam({ name: 'paymentId', description: 'payment UUID' })
  async updateClearance(
    @Param('paymentId', buildUuidPipe('paymentId')) paymentId: string,
    @Body() dto: UpdateClearanceDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.updateClearance(
      tenantId,
      paymentId,
      dto.status as unknown as ClearanceStatus,
      dto.notes,
    );
  }

  @Get('payment-details')
  @ApiOperation({
    summary: 'Cross-tenant payment details for a student',
    description:
      'Looks up the student in the caller tenant, plus matching students (by admissionNumber + name) in sibling tenants of type Hostel / Transport, and returns the fees + payment history grouped per tenant.',
  })
  async paymentDetails(
    @Req() req: Request,
    @Query('admissionNumber') admissionNumber?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    const { tenantId } = ctx(req);
    if (!admissionNumber) {
      throw new BadRequestException('admissionNumber is required');
    }
    return this.feesService.findPaymentDetails(
      tenantId,
      admissionNumber.trim(),
      academicYear?.trim() || undefined,
    );
  }

  @Get('by-admission')
  @ApiOperation({
    summary: 'Find a student + their fees by admission number',
    description:
      'Used by the admin Record-Payment fee picker. Returns the student row + every fee for the latest academic year (or pass academicYear).',
  })
  async findByAdmission(
    @Req() req: Request,
    @Query('admissionNumber') admissionNumber?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    const { tenantId } = ctx(req);
    if (!admissionNumber) {
      throw new BadRequestException('admissionNumber is required');
    }
    return this.feesService.findStudentWithFees(tenantId, admissionNumber, academicYear);
  }

  @Get(':id/payments')
  @ApiOperation({
    summary: 'List all payments recorded against a fee',
    description:
      'Returns every payments row for this fee (online + offline), oldest first. Used for the admin payment-history view and parent receipts.',
  })
  @ApiParam({ name: 'id', description: 'Fee UUID' })
  async listFeePayments(
    @Param('id', buildUuidPipe('id')) feeId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.listFeePayments(tenantId, feeId);
  }

  @Get('payments')
  @ApiOperation({
    summary: 'List all fee payments (online + offline) for the tenant',
    description:
      'Tenant-wide payment log. Optional filters: type=online|offline, status=PAID|PARTIAL|UNPAID-style clearance, search (admission/receipt), from/to (paid_at range).',
  })
  async listAllPayments(
    @Req() req: Request,
    @Query('type') type?: 'online' | 'offline',
    @Query('clearance') clearance?: 'PENDING' | 'CLEARED' | 'BOUNCED' | 'NA',
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { tenantId } = ctx(req);
    return this.feesService.listAllPayments(tenantId, {
      type, clearance, search, from, to,
    });
  }

  @Get('payments/pending-clearance')
  @ApiOperation({
    summary: 'List cheque/DD payments awaiting clearance',
    description:
      'Returns every payments row with clearance_status=PENDING (payments) for the current tenant. Use to drive the admin "Pending cheques" view.',
  })
  async listPendingClearance(@Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.feesService.listPendingClearance(tenantId);
  }

  @Get('payments/:paymentId/receipt')
  @ApiOperation({
    summary: 'Printable HTML receipt for a payment',
    description:
      'Returns a self-contained, print-ready HTML receipt for the given payments row. Open and Cmd+P / Ctrl+P to print.',
  })
  @ApiParam({ name: 'paymentId', description: 'payment UUID' })
  async receipt(
    @Param('paymentId', buildUuidPipe('paymentId')) paymentId: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const html = await this.feesService.renderReceipt(tenantId, paymentId);
    const res = (req as any).res;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('payments/receipts/batch')
  @ApiOperation({
    summary: 'Batch printable receipts',
    description:
      'Returns one HTML page with multiple receipts (page-break between each). Pass receipt numbers OR fee_payment UUIDs in `ids` (comma-separated). Use the browser print dialog to send the whole batch to a printer.',
  })
  async batchReceipts(@Req() req: Request, @Query('ids') ids?: string) {
    const { tenantId } = ctx(req);
    const list = (ids ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      throw new BadRequestException(
        'ids is required: comma-separated receipt numbers or payment UUIDs',
      );
    }
    const html = await this.feesService.renderReceiptsBatch(tenantId, list);
    const res = (req as any).res;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}

// ─────────────── helpers ───────────────

interface AuthContext {
  tenantId: string;
  userId: string;
}

function ctx(req: Request): AuthContext {
  const user = (req as any).user;
  if (!user?.tenantId || !user?.userId) {
    throw new UnauthorizedException('Authentication required');
  }
  return {
    tenantId: user.tenantId,
    userId: user.userId,
  };
}

/** Snapshot of the authenticated user, safe to record on audit rows. */
function actorOf(req: Request): { userId: string; email: string | null } {
  const user = (req as any).user ?? {};
  return {
    userId: user.userId,
    email: typeof user.email === 'string' ? user.email : null,
  };
}

/** Human one-liner for a bulk concession (shown in the approvals list). */
function summarize(
  label: string,
  dto: {
    amount?: number;
    reason?: string;
    applyToAll?: boolean;
    admissionNumbers?: string[];
    academicYear?: string;
    term?: string;
  },
): string {
  const who = dto.applyToAll
    ? "all students"
    : `${dto.admissionNumbers?.length ?? 0} student(s)`;
  const amt = dto.amount != null ? ` ₹${dto.amount}` : "";
  const scope = [dto.academicYear, dto.term]
    .filter(Boolean)
    .join(" · ");
  return `${label}${amt} for ${who}${scope ? ` (${scope})` : ""}${
    dto.reason ? ` — ${dto.reason}` : ""
  }`;
}

/** Caller identity (incl. role + tenant) for the approval gate. */
function callerOf(req: Request): {
  userId: string;
  email: string | null;
  role: string;
  tenantId: string;
} {
  const u = (req as any).user ?? {};
  if (!u.userId || !u.tenantId) {
    throw new UnauthorizedException('Authentication required');
  }
  return {
    userId: u.userId,
    email: typeof u.email === 'string' ? u.email : null,
    role: u.role,
    tenantId: u.tenantId,
  };
}

function buildUuidPipe(paramName: string) {
  return new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new BadRequestException(`${paramName} must be a valid UUID`),
  });
}
