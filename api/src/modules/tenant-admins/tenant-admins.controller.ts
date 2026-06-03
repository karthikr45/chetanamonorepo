import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantAdminsService } from './tenant-admins.service';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('tenant-admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant-admins')
export class TenantAdminsController {
  constructor(private readonly tenantAdminsService: TenantAdminsService) {}

  private requireTenant(user: any): string {
    if (!user?.tenantId) {
      throw new ForbiddenException('Caller is not scoped to a tenant.');
    }
    return user.tenantId;
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users in the caller’s tenant' })
  list(@CurrentUser() user: any) {
    return this.tenantAdminsService.list(this.requireTenant(user));
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a user (admin/fin-admin/ops-admin) in the caller’s tenant' })
  create(@CurrentUser() user: any, @Body() dto: CreateTenantAdminDto) {
    return this.tenantAdminsService.create(this.requireTenant(user), dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a user in the caller’s tenant' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTenantAdminDto,
  ) {
    return this.tenantAdminsService.update(this.requireTenant(user), id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a user in the caller’s tenant' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tenantAdminsService.remove(
      this.requireTenant(user),
      id,
      user.userId,
    );
  }
}
