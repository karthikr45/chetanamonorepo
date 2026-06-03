import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { setRequestContextUser } from '../../../common/middleware/request-context.middleware';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
  branch: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') as string,
    });
  }

  /**
   * Runs on every authenticated request. Enforces tenant lifecycle so a
   * suspended (`isActive = false`) tenant's tokens stop working
   * immediately — `auth.service` only checks active at login.
   *
   * The `monetization_enabled` flag is wired but currently
   * informational; once the subscription module lands, gate paid
   * tenants here with a 402 instead of letting them through.
   *
   * Super-admins (no tenantId on the JWT) skip the lookup so they can
   * still administer suspended tenants.
   */
  async validate(payload: JwtPayload) {
    if (payload.tenantId) {
      const tenant = await this.tenantRepo.findOne({
        where: { id: payload.tenantId },
        select: ['id', 'isActive', 'monetizationEnabled'],
      });
      if (!tenant || !tenant.isActive) {
        throw new ForbiddenException(
          'This account is suspended. Please contact support.',
        );
      }
      // Future seam — see class comment.
      // if (tenant.monetizationEnabled && !subscriptionActive(...)) throw 402
    }

    // Patch the per-request ALS context so every log line emitted by
    // this request carries the authenticated user's tenant + id.
    setRequestContextUser(payload.tenantId, payload.sub);

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      branch: payload.branch,
    };
  }
}
