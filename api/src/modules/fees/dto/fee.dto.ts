import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TermType, FeePeriod } from '../entities/fee.entity';
import { PaymentType } from '../entities/fee-payment.entity';

const OFFLINE_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.CASH,
  PaymentType.CHEQUE,
  PaymentType.DD,
  PaymentType.POS,
  PaymentType.NEFT,
];
const ONLINE_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.RAZORPAY,
  PaymentType.CASHFREE,
  PaymentType.UPI,
  PaymentType.NETBANKING,
  PaymentType.CARD,
];

/** Used internally by the upload flow. */
export interface CreateFeeInput {
  tenantId: string;
  academicYear: string;
  studentId: string;
  term: FeePeriod;
  originalAmount: number;
  /** Optional concession (sibling/staff/EWS/scholarship). Defaults to 0. */
  totalDiscount?: number;
}

/** Used internally by the upload validator. */
export interface ExistingFeeRecord {
  admissionNumber: string;
  academicYear: string;
  term: FeePeriod;
}

/**
 * POST /fees/penalty/add
 *
 * Two modes:
 *  - applyToAll=true  → apply to every non-PAID fee in (year, term)
 *  - applyToAll=false → apply only to fees of the listed students (max 500)
 *
 * Tenant is read from the JWT in the controller — not in the body.
 */
export class AddPenaltyDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, applies to every non-PAID fee in scope; admissionNumbers is ignored.',
  })
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Dummy1', 'Dummy2'],
    description: 'Required when applyToAll is false. Max 500 per call.',
  })
  @ValidateIf((o) => !o.applyToAll)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  admissionNumbers?: string[];

  @ApiProperty({ example: 100, description: 'Penalty amount in rupees.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'Late payment for 1st term' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/penalty/waive
 *
 * Same shape as AddPenaltyDto minus the `amount` field. Removes the full
 * current penalty on each affected fee.
 */
export class WaivePenaltyDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, waives every non-PAID fee with penalty > 0 in scope.',
  })
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Dummy1', 'Dummy2'],
    description: 'Required when applyToAll is false. Max 500 per call.',
  })
  @ValidateIf((o) => !o.applyToAll)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  admissionNumbers?: string[];

  @ApiPropertyOptional({ example: 'Scholarship students exempt' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/:id/discount
 * Adds a discount to a fee.
 */
export class AddDiscountDto {
  @ApiProperty({ example: 1000, description: 'Discount amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({ example: 'Scholarship award', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must be 500 characters or fewer' })
  reason?: string;
}

/**
 * POST /fees/:id/penalty
 * Adds a penalty to a single fee. Mirror of AddDiscountDto.
 */
export class AddSinglePenaltyDto {
  @ApiProperty({ example: 100, description: 'Penalty amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({ example: 'Late payment', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/:id/penalty/waive  or  /fees/:id/discount/waive
 * Waives part or all of a single fee's penalty/discount. Omit `amount`
 * to waive everything currently applied.
 */
/**
 * PATCH /fees/receipt-config — admin + super-admin can edit the
 * caller's tenant receipt config (prefix / reset policy / start).
 */
export class UpdateReceiptConfigDto {
  @ApiPropertyOptional({
    description: 'Visible receipt-number shape.',
    enum: ['COMPACT_ACADEMIC', 'PREFIXED'],
  })
  @IsOptional()
  @IsString()
  receiptFormat?: 'COMPACT_ACADEMIC' | 'PREFIXED';

  @ApiPropertyOptional({
    example: '2',
    description:
      'Leading segment of the compact receipt number (the school code).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tenantCode?: string;

  @ApiPropertyOptional({ example: 'SVBK', description: 'Short prefix for new receipts (prefixed format).' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  receiptPrefix?: string;

  @ApiPropertyOptional({
    description: 'How the running sequence resets.',
    enum: ['NEVER', 'YEARLY', 'ACADEMIC_YEAR', 'MONTHLY', 'DAILY'],
  })
  @IsOptional()
  @IsString()
  receiptResetPolicy?:
    | 'NEVER'
    | 'YEARLY'
    | 'ACADEMIC_YEAR'
    | 'MONTHLY'
    | 'DAILY';

  @ApiPropertyOptional({ example: 1, description: 'First number issued in a fresh period.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  receiptStartNumber?: number;
}

/**
 * PATCH /fees/receipt-sequence — admin + super-admin can correct the
 * running counter for the current period (or a specific period).
 */
export class CorrectReceiptSequenceDto {
  @ApiProperty({
    example: 42,
    description:
      'New current value. The next receipt issued will be currentValue + 1.',
  })
  @Type(() => Number)
  @IsNumber()
  currentValue: number;

  @ApiPropertyOptional({
    example: '2025-26',
    description: 'Period key to update. Defaults to the current period.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  periodKey?: string;
}

export class WaiveSingleDto {
  @ApiPropertyOptional({
    example: 50,
    description:
      'Optional partial-waive amount. Omit to waive the entire current ' +
      'penalty / discount on this fee.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 'Cheque cleared late but tracked separately' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/discount/add
 * Bulk discount across an academic year + term. Mirrors
 * AddPenaltyDto: applies to listed students, or all non-PAID fees in
 * scope when applyToAll is true.
 */
export class BulkAddDiscountDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, applies to every non-PAID fee in scope; admissionNumbers is ignored.',
  })
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Dummy1', 'Dummy2'],
    description: 'Required when applyToAll is false. Max 500 per call.',
  })
  @ValidateIf((o) => !o.applyToAll)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  admissionNumbers?: string[];

  @ApiProperty({ example: 500, description: 'Discount amount per fee, in rupees.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'Sibling concession' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/discount/waive
 * Removes the entire current discount on fees in scope. Mirrors
 * WaivePenaltyDto. Discount cannot be waived if it would push net
 * below what has already been paid — those fees are skipped.
 */
export class WaiveDiscountDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['Dummy1', 'Dummy2'] })
  @ValidateIf((o) => !o.applyToAll)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  admissionNumbers?: string[];

  @ApiPropertyOptional({ example: 'Discount revoked' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * POST /fees/:id/offline-payment
 * School staff records a cash / cheque / DD / NEFT payment.
 */
export class RecordOfflinePaymentDto {
  @ApiProperty({ example: 2500, description: 'Payment amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    enum: OFFLINE_PAYMENT_TYPES,
    description: 'One of the offline payment types',
  })
  @IsEnum(PaymentType, {
    message: `paymentType must be one of: ${OFFLINE_PAYMENT_TYPES.join(', ')}`,
  })
  paymentType: PaymentType;

  // Cheque details — required when paymentType = CHEQUE
  @ApiPropertyOptional({ example: '123456', description: 'Required when paymentType = CHEQUE' })
  @ValidateIf((o) => o.paymentType === PaymentType.CHEQUE)
  @IsString({ message: 'chequeNumber must be a string' })
  @IsNotEmpty({ message: 'chequeNumber is required when paymentType is CHEQUE' })
  @MaxLength(50, { message: 'chequeNumber must be 50 characters or fewer' })
  chequeNumber?: string;

  @ApiPropertyOptional({ example: '2026-04-23', description: 'Required when paymentType = CHEQUE' })
  @ValidateIf((o) => o.paymentType === PaymentType.CHEQUE)
  @IsISO8601({}, { message: 'chequeDate must be an ISO8601 date string (e.g. 2026-04-23)' })
  chequeDate?: string;

  // DD details — required when paymentType = DD
  @ApiPropertyOptional({ example: 'DD-00123', description: 'Required when paymentType = DD' })
  @ValidateIf((o) => o.paymentType === PaymentType.DD)
  @IsString({ message: 'ddNumber must be a string' })
  @IsNotEmpty({ message: 'ddNumber is required when paymentType is DD' })
  @MaxLength(50, { message: 'ddNumber must be 50 characters or fewer' })
  ddNumber?: string;

  @ApiPropertyOptional({ example: '2026-04-23', description: 'Required when paymentType = DD' })
  @ValidateIf((o) => o.paymentType === PaymentType.DD)
  @IsISO8601({}, { message: 'ddDate must be an ISO8601 date string (e.g. 2026-04-23)' })
  ddDate?: string;

  @ApiPropertyOptional({
    example: 'HDFC Bank',
    description: 'Required when paymentType is CHEQUE, DD, or NEFT',
  })
  @ValidateIf(
    (o) =>
      o.paymentType === PaymentType.CHEQUE ||
      o.paymentType === PaymentType.DD ||
      o.paymentType === PaymentType.NEFT,
  )
  @IsString({ message: 'bankName must be a string' })
  @IsNotEmpty({
    message: 'bankName is required when paymentType is CHEQUE, DD, or NEFT',
  })
  @MaxLength(100, { message: 'bankName must be 100 characters or fewer' })
  bankName?: string;

  // ── Bank branch (optional, all bank-backed types) ────────────────
  @ApiPropertyOptional({ example: 'Hyderabad — Banjara Hills' })
  @IsOptional()
  @IsString({ message: 'bankBranch must be a string' })
  @MaxLength(100)
  bankBranch?: string;

  // ── Drawer name — required for cheque / DD ───────────────────────
  @ApiPropertyOptional({ example: 'Ramesh Kumar', description: 'Required for CHEQUE / DD' })
  @ValidateIf(
    (o) =>
      o.paymentType === PaymentType.CHEQUE ||
      o.paymentType === PaymentType.DD,
  )
  @IsString({ message: 'drawerName must be a string' })
  @IsNotEmpty({ message: 'drawerName is required for CHEQUE / DD' })
  @MaxLength(150)
  drawerName?: string;

  // ── POS / NEFT — transaction id from terminal slip / UTR ────────
  @ApiPropertyOptional({
    example: 'POS-TXN-99887766',
    description: 'Required for POS (terminal txn id) and NEFT (UTR)',
  })
  @ValidateIf(
    (o) =>
      o.paymentType === PaymentType.POS ||
      o.paymentType === PaymentType.NEFT,
  )
  @IsString({ message: 'transactionId must be a string' })
  @IsNotEmpty({ message: 'transactionId is required for POS / NEFT' })
  @MaxLength(100)
  transactionId?: string;

  // ── POS only — last 4 of card swiped ──────────────────────────────
  @ApiPropertyOptional({ example: '4242', description: 'Last 4 digits of card (POS only)' })
  @IsOptional()
  @IsString({ message: 'cardLast4 must be a string' })
  @MaxLength(4)
  cardLast4?: string;

  // ── Free-text note ───────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'Paid at front desk by parent' })
  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500)
  notes?: string;

  /** Override the payment date. Defaults to now if omitted. */
  @ApiPropertyOptional({ example: '2026-04-23T10:15:30Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'paidAt must be an ISO8601 date-time string' })
  paidAt?: string;
}

/**
 * PATCH /fee-payments/:id/clearance
 * Mark a recorded cheque or DD as CLEARED or BOUNCED.
 */
export class UpdateClearanceDto {
  @ApiProperty({ enum: ['CLEARED', 'BOUNCED'], example: 'CLEARED' })
  @IsEnum(['CLEARED', 'BOUNCED'] as readonly string[], {
    message: 'status must be CLEARED or BOUNCED',
  })
  status: 'CLEARED' | 'BOUNCED';

  @ApiPropertyOptional({ description: 'Bounce reason / clearance note' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * POST /fees/:id/online-payment (called by the payments team's webhook)
 * Records a successful online payment from Razorpay / Cashfree / etc.
 */
export class RecordOnlinePaymentDto {
  @ApiProperty({ example: 2500, description: 'Payment amount (>0, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    enum: ONLINE_PAYMENT_TYPES,
    description: 'One of the online payment types',
  })
  @IsEnum(PaymentType, {
    message: `paymentType must be one of: ${ONLINE_PAYMENT_TYPES.join(', ')}`,
  })
  paymentType: PaymentType;

  @ApiProperty({ example: 'order_LXyz123', maxLength: 100 })
  @IsString({ message: 'orderId must be a string' })
  @IsNotEmpty({ message: 'orderId is required' })
  @MaxLength(100, { message: 'orderId must be 100 characters or fewer' })
  orderId: string;

  @ApiProperty({ example: 'pay_LXyz456', maxLength: 100 })
  @IsString({ message: 'transactionId must be a string' })
  @IsNotEmpty({ message: 'transactionId is required' })
  @MaxLength(100, { message: 'transactionId must be 100 characters or fewer' })
  transactionId: string;

  @ApiPropertyOptional({ example: '2026-04-23T10:15:30Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'paidAt must be an ISO8601 date-time string' })
  paidAt?: string;
}
