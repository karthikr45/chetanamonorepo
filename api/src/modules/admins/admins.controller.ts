import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@ApiTags('admins')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post('save')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new admin' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @Get('get-admin')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all admins' })
  findAll(@Query('tenantId') tenantId: string) {
    return this.adminsService.findAll(tenantId);
  }

  @Get('get-admin/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get admin by id' })
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Patch('update/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update admin' })
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminsService.update(id, dto);
  }

  @Delete('delete/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete admin' })
  remove(@Param('id') id: string) {
    return this.adminsService.remove(id);
  }
}
