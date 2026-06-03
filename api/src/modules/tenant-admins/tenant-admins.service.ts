import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminsService, SafeAdmin } from '../admins/admins.service';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto';
import { Role } from '../../common/enums/roles.enum';

/**
 * Tenant-scoped user management — exposed to the tenant's own ADMIN so they
 * can add fin/ops/custom admins (or peer admins) to their own tenant.
 * Backed by the `admins` table; we don't keep a separate tenant_admins entity.
 */
@Injectable()
export class TenantAdminsService {
  constructor(private readonly adminsService: AdminsService) {}

  /**
   * Denylist: a tenant admin must not be able to create platform-level
   * super-admins or parent accounts from inside a tenant. Everything else
   * (the built-in admin/fin_admin/ops_admin plus any custom role configured
   * by super-admin via system_metadata) is fine.
   */
  private ensureAssignableRole(role: string) {
    const denied: string[] = [Role.SUPER_ADMIN, Role.PARENT];
    if (!role || denied.includes(role)) {
      throw new ForbiddenException(
        `Role "${role}" cannot be assigned from the tenant admin console.`,
      );
    }
  }

  async list(tenantId: string): Promise<SafeAdmin[]> {
    return this.adminsService.findAll(tenantId);
  }

  async create(tenantId: string, dto: CreateTenantAdminDto): Promise<SafeAdmin> {
    this.ensureAssignableRole(dto.role);
    return this.adminsService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      role: dto.role,
      branch: dto.branch,
      tenantId,
      password: dto.password,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTenantAdminDto,
  ): Promise<SafeAdmin> {
    const target = await this.adminsService.findById(id);
    if (!target || target.tenantId !== tenantId) {
      throw new NotFoundException(`User ${id} not found in this tenant`);
    }
    if (dto.role) this.ensureAssignableRole(dto.role);
    return this.adminsService.update(id, dto);
  }

  async remove(tenantId: string, id: string, callerId: string): Promise<void> {
    if (id === callerId) {
      throw new ForbiddenException('You cannot delete your own account.');
    }
    const target = await this.adminsService.findById(id);
    if (!target || target.tenantId !== tenantId) {
      throw new NotFoundException(`User ${id} not found in this tenant`);
    }
    await this.adminsService.remove(id);
  }
}
