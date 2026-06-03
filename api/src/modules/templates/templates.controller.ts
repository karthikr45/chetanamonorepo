import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class TemplateDecisionDto {
  @ApiPropertyOptional({ description: 'Reviewer note (shown to creator).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new template for the logged-in tenant' })
  create(@CurrentUser() user: any, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all templates for the logged-in tenant' })
  findAll(@CurrentUser() user: any) {
    return this.templatesService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID for the logged-in tenant' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templatesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update a template by ID for the logged-in tenant' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a template by ID for the logged-in tenant' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templatesService.remove(user.tenantId, id);
  }

  // ─── Approval workflow ──────────────────────────────────────────

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a template for tenant-admin review',
    description:
      'Idempotent. Resets status to "pending" and notifies tenant admins.',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  submit(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templatesService.submitForReview(user.tenantId, id, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending template (tenant admin only)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  approve(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: TemplateDecisionDto,
  ) {
    return this.templatesService.approve(
      user.tenantId,
      id,
      { userId: user.userId, role: user.role },
      dto.note,
    );
  }

  @Post(':id/reject')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending template (tenant admin only)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  reject(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: TemplateDecisionDto,
  ) {
    return this.templatesService.reject(
      user.tenantId,
      id,
      { userId: user.userId, role: user.role },
      dto.note,
    );
  }
}
