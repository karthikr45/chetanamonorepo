import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'Send a notification (targeted or broadcast)' })
  send(@CurrentUser() user: any, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.send(user.tenantId, dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Notifications visible to the current user' })
  findAll(@CurrentUser() user: any) {
    return this.notificationsService.findAll(
      user.tenantId,
      user.userId,
      user.role,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.notificationsService
      .unreadCount(user.tenantId, user.userId, user.role)
      .then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(
      user.tenantId,
      user.userId,
      user.role,
    );
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(
      user.tenantId,
      id,
      user.userId,
      user.role,
    );
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPS_ADMIN)
  remove(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.remove(user.tenantId, id);
  }
}
