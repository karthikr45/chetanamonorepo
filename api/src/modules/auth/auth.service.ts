import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { AdminsService } from '../admins/admins.service';
import { TenantsService } from '../tenants/tenants.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TenantChoice {
  adminId: string;
  tenantId: string | null;
  tenantName: string | null;
  role: string;
}

export interface SignInDirectResult {
  kind: 'tokens';
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    tenantName: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface SignInSelectionResult {
  kind: 'selection';
  selectionToken: string;
  email: string;
  tenants: TenantChoice[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly adminsService: AdminsService,
    private readonly tenantsService: TenantsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Starts a password reset. Always returns the same response whether or not
   * the email exists (no account enumeration). One raw token is issued and
   * its hash stored on every active admin row for that email so the person
   * resets their password across all their tenants at once.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const generic = {
      message:
        'If an account exists for that email, a reset link has been sent.',
    };
    const admins = await this.adminsService.findActiveByEmail(email);
    if (admins.length === 0) return generic;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    for (const a of admins) {
      await this.adminsService.setPasswordResetToken(a.id, tokenHash, expiresAt);
    }

    const clientUrl =
      this.configService.get<string>('clientUrl') || 'http://localhost:3000';
    const link = `${clientUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      email,
    )}`;
    const name = admins[0].firstName || 'there';
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#6c739c">Sri Venkateswara Bala Kuteer</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>We received a request to reset your admin password. Click the
           button below to choose a new one:</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${link}" style="background:#6c739c;color:#fff;padding:12px 24px;
             border-radius:8px;text-decoration:none;font-weight:bold">
            Reset Password
          </a>
        </p>
        <p style="color:#888;font-size:13px">
          This link is valid for 30 minutes. If you didn't request this, you
          can safely ignore this email — your password won't change.
        </p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#aaa;font-size:12px">
          © ${new Date().getFullYear()} Sri Venkateswara Bala Kuteer.
        </p>
      </div>
    `;
    await this.mailService.send(email, 'Reset your SVBK admin password', html);
    return generic;
  }

  /**
   * Completes a password reset. The raw token is hashed and matched against
   * every active admin row for the email; all matching rows get the new
   * password and have their reset + refresh state cleared (forces re-login).
   */
  async resetPassword(
    email: string,
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const admins = await this.adminsService.findActiveByEmail(email);
    const now = new Date();
    const matched = admins.filter(
      (a) =>
        a.passwordResetTokenHash === tokenHash &&
        a.passwordResetExpiresAt != null &&
        a.passwordResetExpiresAt > now,
    );

    if (matched.length === 0) {
      throw new UnauthorizedException(
        'Reset link is invalid or has expired. Please request a new one.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    for (const a of matched) {
      await this.adminsService.completePasswordReset(a.id, passwordHash);
    }
    return { message: 'Password has been reset. Please sign in.' };
  }

  /**
   * Sends (or resends) an email-verification link. Generic response so it
   * can't be used to probe which emails exist.
   */
  async sendVerificationEmail(email: string): Promise<{ message: string }> {
    const generic = {
      message:
        'If an unverified account exists for that email, a verification link has been sent.',
    };
    const admins = (await this.adminsService.findActiveByEmail(email)).filter(
      (a) => !a.emailVerified,
    );
    if (admins.length === 0) return generic;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    for (const a of admins) {
      await this.adminsService.setEmailVerificationToken(
        a.id,
        tokenHash,
        expiresAt,
      );
    }

    const clientUrl =
      this.configService.get<string>('clientUrl') || 'http://localhost:3000';
    const link = `${clientUrl.replace(/\/$/, '')}/verify-email?token=${rawToken}&email=${encodeURIComponent(
      email,
    )}`;
    const name = admins[0].firstName || 'there';
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#6c739c">Sri Venkateswara Bala Kuteer</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Please confirm your email address to finish setting up your
           admin account:</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${link}" style="background:#6c739c;color:#fff;padding:12px 24px;
             border-radius:8px;text-decoration:none;font-weight:bold">
            Verify Email
          </a>
        </p>
        <p style="color:#888;font-size:13px">
          This link is valid for 24 hours.
        </p>
      </div>
    `;
    await this.mailService.send(email, 'Verify your SVBK admin email', html);
    return generic;
  }

  async verifyEmail(
    email: string,
    rawToken: string,
  ): Promise<{ message: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const admins = await this.adminsService.findActiveByEmail(email);
    const now = new Date();
    const ok = admins.some(
      (a) =>
        a.emailVerificationTokenHash === tokenHash &&
        a.emailVerificationExpiresAt != null &&
        a.emailVerificationExpiresAt > now,
    );
    if (!ok) {
      throw new UnauthorizedException(
        'Verification link is invalid or has expired. Please request a new one.',
      );
    }
    await this.adminsService.markEmailVerified(email);
    return { message: 'Email verified. You can now sign in.' };
  }

  /**
   * Validates email+password against every admin row matching that email
   * (same email may exist across tenants, each with its own password).
   * - 0 matches → 401
   * - 1 match  → returns tokens immediately
   * - 2+ matches → returns a short-lived selection token + tenant list so
   *   the UI can prompt the user to pick a tenant.
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<SignInDirectResult | SignInSelectionResult> {
    const candidates = await this.adminsService.findAllByEmail(email);
    const activeAdmins = candidates.filter((c) => c.isActive);

    // Brute-force lockout (admin accounts only).
    if (activeAdmins.length > 0) {
      const now = Date.now();
      const lockedRow = activeAdmins.find(
        (a) => a.lockedUntil != null && a.lockedUntil.getTime() > now,
      );
      if (lockedRow) {
        const mins = Math.ceil(
          (lockedRow.lockedUntil!.getTime() - now) / 60000,
        );
        throw new UnauthorizedException(
          `Account locked due to too many failed attempts. Try again in ${mins} minute(s) or reset your password.`,
        );
      }
    }

    const matched: typeof candidates = [];
    for (const c of activeAdmins) {
      if (await bcrypt.compare(password, c.passwordHash)) matched.push(c);
    }

    if (matched.length === 0) {
      // Fall back to users table (parents etc.)
      const user = await this.usersService.findByEmail(email);
      if (user && user.isActive && user.passwordHash) {
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (ok) return this.issueTokens(user as any, 'user');
      }
      // Count this as a failed admin attempt only if admin rows exist.
      if (activeAdmins.length > 0) {
        const maxAttempts =
          Number(this.configService.get('auth.lockoutMaxAttempts')) || 5;
        const lockMinutes =
          Number(this.configService.get('auth.lockoutMinutes')) || 15;
        const lockedUntil = await this.adminsService.registerFailedLogin(
          email,
          maxAttempts,
          lockMinutes,
        );
        if (lockedUntil) {
          throw new UnauthorizedException(
            `Account locked due to too many failed attempts. Try again in ${lockMinutes} minute(s) or reset your password.`,
          );
        }
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.adminsService.resetLoginState(email);

    if (
      this.configService.get<boolean>('auth.requireEmailVerification') &&
      matched.some((m) => !m.emailVerified)
    ) {
      throw new UnauthorizedException(
        'Please verify your email before signing in. Check your inbox or request a new verification link.',
      );
    }

    if (matched.length === 1) {
      return this.issueTokens(matched[0], 'admin');
    }

    // 2+ matches → return tenant picker.
    const tenants: TenantChoice[] = [];
    for (const a of matched) {
      let tenantName: string | null = null;
      if (a.tenantId) {
        try {
          const t = await this.tenantsService.findOne(a.tenantId);
          tenantName = t.tenantName ?? t.name ?? null;
        } catch {
          tenantName = null;
        }
      }
      tenants.push({
        adminId: a.id,
        tenantId: a.tenantId ?? null,
        tenantName,
        role: a.role,
      });
    }

    const selectionToken = this.jwtService.sign(
      { purpose: 'tenant-selection', email, adminIds: matched.map((m) => m.id) },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: 300, // 5 minutes
      },
    );

    return { kind: 'selection', selectionToken, email, tenants };
  }

  /**
   * Exchanges a selection token + chosen adminId/tenantId for a full session.
   */
  async selectTenant(
    selectionToken: string,
    adminId: string,
  ): Promise<SignInDirectResult> {
    let claims: { purpose?: string; email?: string; adminIds?: string[] };
    try {
      claims = this.jwtService.verify(selectionToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Selection token expired or invalid');
    }
    if (claims.purpose !== 'tenant-selection' || !claims.adminIds?.includes(adminId)) {
      throw new UnauthorizedException('Selection token does not authorise this admin');
    }
    const admin = await this.adminsService.findById(adminId);
    if (!admin || !admin.isActive) throw new NotFoundException('Admin not found');
    if (admin.email !== claims.email) {
      throw new UnauthorizedException('Selection token mismatch');
    }
    return this.issueTokens(admin, 'admin');
  }

  private async issueTokens(
    user: any,
    source: 'admin' | 'user',
  ): Promise<SignInDirectResult> {
    let tenantName: string | null = null;
    if (user.tenantId) {
      try {
        const t = await this.tenantsService.findOne(user.tenantId);
        tenantName = t.tenantName ?? t.name ?? null;
      } catch {
        tenantName = null;
      }
    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn:
        Number(this.configService.get('jwt.refreshExpiresIn')) || 604800,
    });
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.storeRefreshToken(user.id, hash, source);
    return {
      kind: 'tokens',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId ?? null,
        tenantName,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Disambiguate by id (sub), not email — emails are no longer unique.
    const admin = await this.adminsService.findById(payload.sub);
    if (admin?.refreshTokenHash) {
      const isMatch = await bcrypt.compare(refreshToken, admin.refreshTokenHash);
      if (isMatch) {
        return this.issueNewTokenPair(payload, admin.id, 'admin');
      }
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (user?.refreshTokenHash) {
      const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (isMatch) {
        return this.issueNewTokenPair(payload, user.id, 'user');
      }
    }

    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async logout(userId: string): Promise<void> {
    await Promise.allSettled([
      this.adminsService.updateRefreshToken(userId, null),
      this.usersService.updateRefreshToken(userId, null),
    ]);
  }

  private async issueNewTokenPair(
    payload: JwtPayload,
    entityId: string,
    source: 'admin' | 'user',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const newPayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };

    const newAccessToken = this.jwtService.sign(newPayload);
    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn:
        Number(this.configService.get<string>('jwt.refreshExpiresIn')) || 604800,
    });

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    await this.storeRefreshToken(entityId, newHash, source);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  private async storeRefreshToken(
    entityId: string,
    hash: string | null,
    source: 'admin' | 'user',
  ): Promise<void> {
    if (source === 'admin') {
      await this.adminsService.updateRefreshToken(entityId, hash);
    } else {
      await this.usersService.updateRefreshToken(entityId, hash);
    }
  }
}
