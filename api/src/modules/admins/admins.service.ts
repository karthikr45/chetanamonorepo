import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { Role } from '../../common/enums/roles.enum';

const DEFAULT_ADMIN_PASSWORD = 'Svbk@1234';

export type SafeAdmin = Omit<Admin, 'clientId' | 'secretKey' | 'passwordHash'>;

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepository: Repository<Admin>,
  ) {}

  private sanitize(admin: Admin): SafeAdmin {
    const { clientId: _c, secretKey: _s, passwordHash: _p, ...safe } = admin;
    return safe;
  }

  /** Creates an admin. `password` optional — falls back to the default seed password. */
  async create(dto: CreateAdminDto & { password?: string }): Promise<SafeAdmin> {
    if (dto.role === Role.SUPER_ADMIN) {
      // Super-admins are tenant-less, so the (email, tenantId) unique index
      // can't enforce uniqueness for them (NULL tenantId is distinct in PG).
      const existing = await this.adminsRepository.findOne({
        where: { email: dto.email, role: Role.SUPER_ADMIN, tenantId: IsNull() },
      });
      if (existing) {
        throw new ConflictException('A super-admin with this email already exists');
      }
    } else {
      if (!dto.tenantId) {
        throw new ForbiddenException('tenantId is required for non super-admin roles');
      }
      const existing = await this.adminsRepository.findOne({
        where: { email: dto.email, tenantId: dto.tenantId },
      });
      if (existing) {
        throw new ConflictException(
          'An admin with this email already exists in this tenant',
        );
      }
    }

    const clientId = `client_${randomBytes(8).toString('hex')}`;
    const secretKey = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(
      dto.password || DEFAULT_ADMIN_PASSWORD,
      10,
    );

    const { password: _pw, ...rest } = dto;
    const admin = this.adminsRepository.create({
      ...rest,
      clientId,
      secretKey,
      passwordHash,
    });
    return this.sanitize(await this.adminsRepository.save(admin));
  }

  async findAll(tenantId: string): Promise<SafeAdmin[]> {
    const admins = await this.adminsRepository.find({ where: { tenantId } });
    return admins.map((a) => this.sanitize(a));
  }

  async findOne(id: string): Promise<SafeAdmin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin ${id} not found`);
    return this.sanitize(admin);
  }

  async update(id: string, dto: UpdateAdminDto): Promise<SafeAdmin> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin ${id} not found`);

    if (dto.password) {
      admin.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const { password: _pw, ...rest } = dto;
    Object.assign(admin, rest);
    return this.sanitize(await this.adminsRepository.save(admin));
  }

  async remove(id: string): Promise<void> {
    const admin = await this.adminsRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin ${id} not found`);
    await this.adminsRepository.remove(admin);
  }

  /**
   * Returns ALL admin rows matching the email — same email can exist across
   * tenants, so callers must disambiguate (typically by validating the
   * password against each row).
   */
  async findAllByEmail(email: string): Promise<Admin[]> {
    return this.adminsRepository.find({ where: { email } });
  }

  /** Convenience: returns the first match. Prefer findAllByEmail for multi-tenant flows. */
  async findByEmail(email: string): Promise<Admin | null> {
    return this.adminsRepository.findOne({ where: { email } });
  }

  async findByEmailAndTenant(email: string, tenantId: string | null): Promise<Admin | null> {
    return this.adminsRepository.findOne({
      where: { email, tenantId: tenantId ?? (IsNull() as any) },
    });
  }

  async findById(id: string): Promise<Admin | null> {
    return this.adminsRepository.findOne({ where: { id } });
  }

  async updateRefreshToken(adminId: string, hash: string | null): Promise<void> {
    await this.adminsRepository.update(adminId, { refreshTokenHash: hash });
  }

  /** Active admin rows for an email — same email may span tenants. */
  async findActiveByEmail(email: string): Promise<Admin[]> {
    return this.adminsRepository.find({ where: { email, isActive: true } });
  }

  /**
   * Records a failed sign-in for every active row of this email and locks
   * them once the threshold is hit. Returns the lock expiry if now locked.
   */
  async registerFailedLogin(
    email: string,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<Date | null> {
    const rows = await this.findActiveByEmail(email);
    if (rows.length === 0) return null;
    const attempts = Math.max(...rows.map((r) => r.failedLoginAttempts)) + 1;
    let lockedUntil: Date | null = null;
    if (attempts >= maxAttempts) {
      lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    }
    await this.adminsRepository.update(
      { email, isActive: true },
      { failedLoginAttempts: attempts, lockedUntil },
    );
    return lockedUntil;
  }

  /** Clears lockout state after a successful sign-in. */
  async resetLoginState(email: string): Promise<void> {
    await this.adminsRepository.update(
      { email, isActive: true },
      { failedLoginAttempts: 0, lockedUntil: null },
    );
  }

  async setPasswordResetToken(
    adminId: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.adminsRepository.update(adminId, {
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: expiresAt,
    });
  }

  /** Sets a new password and atomically clears reset + refresh state. */
  async completePasswordReset(
    adminId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.adminsRepository.update(adminId, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      refreshTokenHash: null,
    });
  }

  async setEmailVerificationToken(
    adminId: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.adminsRepository.update(adminId, {
      emailVerificationTokenHash: hash,
      emailVerificationExpiresAt: expiresAt,
    });
  }

  /** Marks every active row for an email verified and clears the token. */
  async markEmailVerified(email: string): Promise<void> {
    await this.adminsRepository.update(
      { email, isActive: true },
      {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    );
  }
}
