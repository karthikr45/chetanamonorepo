import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { SystemMetadataService } from './system-metadata.service';
import {
  CreateSystemMetadataDto,
  UpdateSystemMetadataDto,
} from './dto/system-metadata.dto';

@ApiTags('system-metadata')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('system-metadata')
export class SystemMetadataController {
  constructor(private readonly svc: SystemMetadataService) {}

  // ─── Read endpoints — open to any authenticated user ───────────────

  @Get()
  @ApiOperation({
    summary: 'List system metadata (read-only)',
    description:
      'Used by every UI to populate dropdowns. Filter by type=academic_year / class / etc. Pass activeOnly=true to hide soft-deleted rows.',
  })
  list(
    @Query('type') type?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.svc.list({
      type,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get('types')
  @ApiOperation({ summary: 'Distinct list of metadata types' })
  types() {
    return this.svc.types();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOneOrFail(id);
  }

  // ─── Write endpoints — super-admin only ────────────────────────────

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a metadata row (super-admin only)' })
  create(@Body() dto: CreateSystemMetadataDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a metadata row (super-admin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSystemMetadataDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a metadata row (super-admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
