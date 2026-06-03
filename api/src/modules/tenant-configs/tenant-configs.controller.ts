import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantConfigsService } from './tenant-configs.service';
import { CreateTenantConfigDto } from './dto/create-tenant-config.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantConfig } from './entities/tenant-config.entity';
import { Role } from '../../common/enums/roles.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('tenant-configs')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant-configs')
export class TenantConfigsController {
  constructor(private readonly tenantConfigsService: TenantConfigsService) {}

  /**
   * Public-safe view of the caller's tenant's active payment gateway —
   * only `{ gatewayType, paymentClientId }`. Used by the checkout page
   * to mount the gateway widget. Never returns the secret key.
   */
  @Get('active-payment')
  @UseGuards(JwtAuthGuard)
  async activePayment(
    @CurrentUser() user: any,
  ): Promise<{
    gatewayType: string | null;
    paymentClientId: string | null;
  }> {
    if (!user?.tenantId) {
      return { gatewayType: null, paymentClientId: null };
    }
    const cfg = await this.tenantConfigsService.findActiveForTenant(user.tenantId);
    return {
      gatewayType: cfg?.gatewayType ?? null,
      paymentClientId: cfg?.paymentClientId ?? null,
    };
  }

  /**
   * Non-secret branding fields for the caller's tenant. Used by both
   * admin and parent apps to display the school's logo in sidebars,
   * headers, receipts, etc. Returns nulls when the tenant has no
   * active config — clients then render their generic fallback.
   *
   * Both admin and parent JWTs carry `tenantId`, so a single endpoint
   * serves both surfaces.
   */
  @Get('me/branding')
  @UseGuards(JwtAuthGuard)
  async myBranding(
    @CurrentUser() user: any,
  ): Promise<{
    logoUrl: string | null;
    tenantId: string | null;
  }> {
    if (!user?.tenantId) {
      return { logoUrl: null, tenantId: null };
    }
    const cfg = await this.tenantConfigsService.findActiveForTenant(
      user.tenantId,
    );
    return {
      logoUrl: cfg?.logoUrl ?? null,
      tenantId: user.tenantId,
    };
  }

  // POST /tenant-configs
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateTenantConfigDto): Promise<TenantConfig> {
    return this.tenantConfigsService.create(dto);
  }

  // POST /tenant-configs/upsert
  @Post('upsert')
  upsert(@Body() dto: CreateTenantConfigDto): Promise<TenantConfig> {
    return this.tenantConfigsService.upsert(dto);
  }

  // GET /tenant-configs
  @Get()
  findAll(): Promise<TenantConfig[]> {
    return this.tenantConfigsService.findAll();
  }

  // GET /tenant-configs/tenant/:tenantId
  @Get('tenant/:tenantId')
  findByTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<TenantConfig[]> {
    return this.tenantConfigsService.findByTenant(tenantId);
  }

  // GET /tenant-configs/:id
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TenantConfig> {
    return this.tenantConfigsService.findOne(id);
  }

  // PATCH /tenant-configs/:id
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantConfigDto,
  ): Promise<TenantConfig> {
    return this.tenantConfigsService.update(id, dto);
  }

  // DELETE /tenant-configs/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tenantConfigsService.remove(id);
  }
}
