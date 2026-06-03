import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { ReceiptTemplatesService } from './receipt-templates.service';
import {
  CreateReceiptTemplateDto,
  RenderTemplateDto,
  UpdateReceiptTemplateDto,
} from './dto/receipt-template.dto';

function tenantOf(req: Request): string {
  const user = (req as any).user;
  if (!user?.tenantId) {
    throw new UnauthorizedException('Tenant context required.');
  }
  return user.tenantId;
}

@ApiTags('receipt-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receipt-templates')
export class ReceiptTemplatesController {
  constructor(private readonly svc: ReceiptTemplatesService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "List the caller's tenant receipt templates" })
  list(@Req() req: Request) {
    return this.svc.list(tenantOf(req));
  }

  @Get('keys')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Available placeholder keys for the editor' })
  keys() {
    return this.svc.availableKeys();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.svc.findOne(tenantOf(req), id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateReceiptTemplateDto, @Req() req: Request) {
    return this.svc.create(tenantOf(req), dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReceiptTemplateDto,
    @Req() req: Request,
  ) {
    return this.svc.update(tenantOf(req), id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.svc.remove(tenantOf(req), id);
  }

  @Post(':id/render')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Render an existing template with real (or sample) data',
  })
  render(
    @Param('id') id: string,
    @Body() dto: RenderTemplateDto,
    @Req() req: Request,
  ) {
    return this.svc.renderById(tenantOf(req), id, dto);
  }

  @Post('render-preview')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Live-preview a draft (unsaved) template — used by the editor',
  })
  renderPreview(
    @Body()
    dto: {
      headerHtml?: string;
      bodyHtml?: string;
      footerHtml?: string;
      paymentId?: string;
      feeId?: string;
      sample?: boolean;
    },
    @Req() req: Request,
  ) {
    return this.svc.renderPreview(
      tenantOf(req),
      {
        headerHtml: dto.headerHtml,
        bodyHtml: dto.bodyHtml,
        footerHtml: dto.footerHtml,
      },
      { paymentId: dto.paymentId, feeId: dto.feeId, sample: dto.sample ?? true },
    );
  }
}
