import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { In, LessThan, Repository } from 'typeorm';
import { Role } from '../../common/enums/roles.enum';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Parent } from '../parents/entities/parent.entity';
import { ParentsService } from '../parents/parents.service';
import { ParentOtp } from './entities/otp.entity';

interface ParentJwtPayload {
  sub: string;
  email: string;
  role: Role;
  tenantId: string;
  name?: string;
}

@Injectable()
export class ParentAuthService {
  private readonly logger = new Logger(ParentAuthService.name);

  constructor(
    @InjectRepository(ParentOtp)
    private readonly otpRepo: Repository<ParentOtp>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly parentsService: ParentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * One email may have a Parent row in several tenants (kids across
   * branches/schools). We send a SINGLE OTP and write one OTP row per
   * tenant with the same hash, so the parent never has to know a tenant
   * code up front. tenantCode still works to target one school.
   */
  async sendOtp(
    email: string,
    tenantCode?: string,
  ): Promise<{ message: string; demoMode?: boolean; devOtp?: string }> {
    const targets = tenantCode
      ? [await this.resolveParentByEmail(email, tenantCode)]
      : await this.activeParentsByEmail(email);

    const rawOtp = this.generateOtp();
    const hash = await bcrypt.hash(rawOtp, 10);
    const expiresInMinutes =
      this.configService.get<number>('otp.expiresInMinutes') ?? 5;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    for (const p of targets) {
      await this.otpRepo.update(
        { tenantId: p.tenantId, email: p.email, isUsed: false },
        { isUsed: true },
      );
      await this.otpRepo.save(
        this.otpRepo.create({
          tenantId: p.tenantId,
          email: p.email,
          otpHash: hash,
          expiresAt,
          isUsed: false,
        }),
      );
    }

    const demoMode = this.configService.get<boolean>('demoMode') === true;
    if (demoMode) {
      this.logger.warn(`[OTP] ${email} → ${rawOtp}  (DEMO_MODE — any 6 digits accepted)`);
      return {
        message: 'Demo mode is on — enter any 6-digit code to continue.',
        demoMode: true,
      };
    }

    const delivered = await this.sendOtpEmail(
      targets[0].email,
      targets[0].name,
      rawOtp,
    );
    if (delivered) {
      return { message: 'OTP sent successfully. Please check your email.' };
    }

    // No SMTP configured. In production this is a real outage — fail loudly
    // instead of telling the parent to "check your email" forever. In
    // dev/staging, hand the code back so local testing works without SMTP.
    const isProd =
      this.configService.get<string>('nodeEnv') === 'production';
    if (isProd) {
      throw new ServiceUnavailableException(
        'OTP email could not be delivered. The email service is not configured. Please contact the school office.',
      );
    }
    return {
      message:
        'Email delivery is not configured — using the development code shown below.',
      devOtp: rawOtp,
    };
  }

  async verifyOtp(email: string, otp: string, tenantCode?: string) {
    const candidates = await this.activeParentsByEmail(email);

    const demoMode = this.configService.get<boolean>('demoMode');
    if (!demoMode) {
      const tenantIds = candidates.map((c) => c.tenantId);
      const otpRecord = await this.otpRepo.findOne({
        where: { tenantId: In(tenantIds), email, isUsed: false },
        order: { createdAt: 'DESC' },
      });

      if (!otpRecord) {
        throw new BadRequestException('OTP not found. Please request a new one.');
      }
      if (new Date() > otpRecord.expiresAt) {
        await this.otpRepo.update(
          { email, tenantId: In(tenantIds), isUsed: false },
          { isUsed: true },
        );
        throw new BadRequestException('OTP has expired. Please request a new one.');
      }
      const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
      if (!isMatch) {
        throw new BadRequestException('Invalid OTP. Please try again.');
      }
      // Burn the OTP for every tenant it was issued to.
      await this.otpRepo.update(
        { email, tenantId: In(tenantIds), isUsed: false },
        { isUsed: true },
      );
    }

    // Targeted (tenantCode) or single-tenant → straight to tokens.
    if (tenantCode) {
      const parent = await this.resolveParentByEmail(email, tenantCode);
      return this.tokenResponse(parent);
    }
    if (candidates.length === 1) {
      return this.tokenResponse(candidates[0]);
    }

    // Multiple schools → hand back a picker + short-lived selection token
    // so the parent doesn't have to re-enter the OTP.
    const tenants = await this.buildTenantChoices(candidates);
    const selectionToken = this.jwtService.sign(
      {
        purpose: 'parent-tenant-selection',
        email,
        parentIds: candidates.map((c) => c.id),
      },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: 300,
      },
    );
    return { requiresTenantSelection: true, email, selectionToken, tenants };
  }

  /** Exchange a selection token + chosen parentId for real tokens. */
  async selectTenant(selectionToken: string, parentId: string) {
    let claims: { purpose?: string; email?: string; parentIds?: string[] };
    try {
      claims = this.jwtService.verify(selectionToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Selection token expired or invalid');
    }
    if (
      claims.purpose !== 'parent-tenant-selection' ||
      !claims.parentIds?.includes(parentId)
    ) {
      throw new UnauthorizedException(
        'Selection token does not authorise this account',
      );
    }
    const candidates = await this.activeParentsByEmail(claims.email ?? '');
    const parent = candidates.find((c) => c.id === parentId);
    if (!parent) throw new NotFoundException('Account not found');
    return this.tokenResponse(parent);
  }

  private async activeParentsByEmail(email: string): Promise<Parent[]> {
    const all = await this.parentsService.findByEmailGlobal(email);
    const active = all.filter((p) => p.isActive);
    if (active.length === 0) {
      throw new NotFoundException('No account found with this email address');
    }
    return active;
  }

  private async buildTenantChoices(parents: Parent[]) {
    const out: {
      parentId: string;
      tenantId: string;
      tenantCode: string | null;
      tenantName: string | null;
    }[] = [];
    for (const p of parents) {
      const t = await this.tenantRepo
        .findOne({ where: { id: p.tenantId } })
        .catch(() => null);
      out.push({
        parentId: p.id,
        tenantId: p.tenantId,
        tenantCode: t?.tenantCode ?? null,
        tenantName: t?.tenantName ?? t?.name ?? null,
      });
    }
    return out;
  }

  private async tokenResponse(parent: Parent) {
    const tokens = await this.issueTokenPair(parent);
    return {
      ...tokens,
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        tenantId: parent.tenantId,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: ParentJwtPayload;
    try {
      payload = this.jwtService.verify<ParentJwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.role !== Role.PARENT) {
      throw new UnauthorizedException('Token is not a parent token');
    }

    const parent = await this.parentsService
      .findOneOrFail(payload.tenantId, payload.sub)
      .catch(() => null);
    if (!parent || !parent.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isMatch = await bcrypt.compare(refreshToken, parent.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokenPair(parent);
  }

  async logout(parentId: string): Promise<void> {
    await this.parentsService.updateRefreshToken(parentId, null);
  }

  async cleanExpiredOtps(): Promise<void> {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });
  }

  private async resolveParentByEmail(
    email: string,
    tenantCode?: string,
  ): Promise<Parent> {
    const candidates = await this.parentsService.findByEmailGlobal(email);
    if (candidates.length === 0) {
      throw new NotFoundException('No account found with this email address');
    }

    if (candidates.length === 1 && !tenantCode) {
      return candidates[0];
    }

    if (!tenantCode) {
      throw new ConflictException(
        'This email is registered with multiple schools. Please provide a tenantCode.',
      );
    }

    const tenant = await this.tenantRepo.findOne({
      where: { tenantCode },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantCode} not found`);
    }

    const match = candidates.find((p) => p.tenantId === tenant.id);
    if (!match) {
      throw new NotFoundException(
        'No account found for this email at the given school',
      );
    }
    return match;
  }

  private async issueTokenPair(
    parent: Parent,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: ParentJwtPayload = {
      sub: parent.id,
      email: parent.email,
      role: Role.PARENT,
      tenantId: parent.tenantId,
      name: parent.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: Number(this.configService.get('jwt.expiresIn')) || 86400,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: Number(this.configService.get('jwt.refreshExpiresIn')) || 604800,
    });

    const hash = await bcrypt.hash(refreshToken, 10);
    await this.parentsService.updateRefreshToken(parent.id, hash);

    return { accessToken, refreshToken };
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /** @returns true if the email was actually delivered via SMTP. */
  private async sendOtpEmail(
    email: string,
    name: string,
    otp: string,
  ): Promise<boolean> {
    const smtpUser = this.configService.get<string>('smtp.user');
    const smtpHost = this.configService.get<string>('smtp.host');

    if (!smtpUser || !smtpHost) {
      this.logger.warn(
        `[OTP] ${email} → ${otp}  (no SMTP configured — email not sent)`,
      );
      return false;
    }

    const port = this.configService.get<number>('smtp.port') ?? 587;
    const secure = port === 465;

    const transporterOptions: Record<string, any> = {
      host: smtpHost,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: smtpUser, pass: this.configService.get<string>('smtp.pass') },
    };

    if (this.configService.get<boolean>('smtp.allowInsecure')) {
      transporterOptions.tls = { rejectUnauthorized: false };
    }

    const expiresInMinutes =
      this.configService.get<number>('otp.expiresInMinutes') ?? 5;

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#6c739c">Sri Venkateswara Bala Kuteer</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your one-time password for the Parent Portal is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                    padding:16px;background:#f0dad5;border-radius:8px;color:#6c739c">
          ${otp}
        </div>
        <p style="color:#888;font-size:13px">
          This OTP is valid for ${expiresInMinutes} minutes. Do not share it with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #eee"/>
        <p style="color:#aaa;font-size:12px">
          © ${new Date().getFullYear()} Sri Venkateswara Bala Kuteer. All rights reserved.
        </p>
      </div>
    `;

    try {
      const transporter = nodemailer.createTransport(transporterOptions);
      await transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to: email,
        subject: 'Your SVBK Parent Portal OTP',
        html,
      });
      this.logger.log(`[OTP] Email sent to ${email}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[OTP] Failed to send email to ${email}: ${message}`);
      throw new Error('Could not send OTP email. Check SMTP configuration.');
    }
  }
}
