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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Create an announcement (draft or publish immediately)',
  })
  create(@CurrentUser() user: any, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user.tenantId, dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'List announcements for the tenant',
    description:
      'Admins see drafts + published. Other roles see only the published ' +
      'rows whose audience matches them (or broadcasts).',
  })
  findAll(@CurrentUser() user: any, @Query('all') all?: string) {
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      return all === 'false'
        ? this.announcements.findVisible(user.tenantId, user.role)
        : this.announcements.findAll(user.tenantId);
    }
    return this.announcements.findVisible(user.tenantId, user.role);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.announcements.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Edit an announcement; pass publish:true to publish a draft',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(user.tenantId, id, dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Post(':id/publish')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft and notify the audience' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  publish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.announcements.publish(user.tenantId, id, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Post(':id/unpublish')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move a published announcement back to draft' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  unpublish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.announcements.unpublish(user.tenantId, id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.announcements.remove(user.tenantId, id);
  }
}
