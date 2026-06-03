import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Headers, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RazorpayWebhookDto } from './dto/webhook.dto';
import { WebhookHandlerService } from './webhooks/webhook-handler.service';
import { WebhookVerificationService } from './webhooks/webhook-verification.service';
import { UnifiedWebhookService } from './webhooks/unified-webhook.service';

@ApiTags('payments')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly webhookVerification: WebhookVerificationService,
    private readonly unifiedWebhookService: UnifiedWebhookService,
  ) {}

  @Post('create-order')
  @ApiOperation({ summary: 'Create a payment order (Razorpay or Cashfree)' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto.tenantId, dto);
  }

  @Post('verify-payment')
  @ApiOperation({ summary: 'Verify a payment after frontend callback' })
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    try {
      const result = await this.paymentsService.verifyPayment(dto.tenantId, dto);
      return result;
    } catch (err) {
      console.error('[verify-payment] error:', err?.message, err?.stack);
      throw err;
    }
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get all payments for the tenant' })
  findAll(@CurrentUser() user: any) {
    return this.paymentsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single payment by id' })
  findOne(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(user.tenantId, id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get all transactions for a payment' })
  findTransactions(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findTransactions(user.tenantId, id);
  }

  /**
   * UNIFIED WEBHOOK ENDPOINT
   * Handles webhooks from ALL payment gateways (Razorpay, Cashfree, etc.)
   * Automatically detects the gateway and routes to the appropriate handler
   *
   * @param payload The webhook payload from the payment gateway
   * @param allHeaders All headers from the request (contains gateway-specific signature headers)
   * @returns Processing result
   */
  @Post('webhooks')
  @ApiOperation({
    summary: 'Unified webhook endpoint for all payment gateways',
    description: 'Handles webhooks from Razorpay, Cashfree, and other payment gateways. tenantId is resolved automatically from the order in the database.',
  })
  async handleUnifiedWebhook(
    @Req() req: any,
    @Body() payload: any,
    @Headers() allHeaders: Record<string, string>,
  ) {
    const rawBody: string = req.rawBody?.toString('utf-8') ?? JSON.stringify(payload);
    try {
      const result = await this.unifiedWebhookService.handleUnifiedWebhook(
        allHeaders,
        payload,
        rawBody,
      );
      return result;
    } catch (err) {
      console.error('[unified-webhook] error:', err?.message);
      return { status: 'error', message: err?.message, gateway: 'unknown' };
    }
  }

  /**
   * DEPRECATED: Use /payments/webhooks/unified instead.
   * Kept only for backward compatibility on existing Razorpay
   * dashboards. The unified endpoint does per-tenant signature
   * verification; this one cannot, so callers should migrate.
   */
  @Post('webhooks/razorpay')
  @ApiOperation({
    summary: 'Razorpay webhook endpoint (DEPRECATED)',
    description:
      'DEPRECATED: Use /payments/webhooks/unified instead. This endpoint ' +
      'does not support per-tenant gateway credentials — only the unified ' +
      'endpoint resolves the tenant from the order id before verifying.',
  })
  async handleRazorpayWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: { rawBody?: Buffer },
  ) {
    // Forward to the unified path so we get per-tenant verification.
    const rawBody =
      req.rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    const result = await this.unifiedWebhookService.handleUnifiedWebhook(
      { 'x-razorpay-signature': signature },
      payload,
      rawBody,
    );
    return { status: 'success', ...result };
  }

}
