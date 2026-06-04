import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DeepPartial } from 'typeorm';
import {
  EnvironmentType,
  TenantConfig,
} from './entities/tenant-config.entity';
import { CreateTenantConfigDto } from './dto/create-tenant-config.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';

/** Non-secret config surface returned to the parent portal / public pay. */
export interface PublicTenantConfig {
  tenantId: string;
  environmentType: EnvironmentType;
  configurationName: string;
  logoUrl: string | null;
  receiptLogoUrl: string | null;
  domainUrl: string | null;
  privacyPolicyUrl: string | null;
  termsAndConditionsUrl: string | null;
  refundPolicyUrl: string | null;
}

@Injectable()
export class TenantConfigsService {
  constructor(
    @InjectRepository(TenantConfig)
    private readonly repo: Repository<TenantConfig>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reduce a URL / href / Host header to a bare hostname so a configured
   * `domainUrl` of `https://pay.school.com/` matches a caller value of
   * `https://pay.school.com/parent/login?x=1` or `pay.school.com:443`.
   */
  private normaliseHost(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');
  }

  /** Current app environment (from APP_ENV / NODE_ENV) as an EnvironmentType. */
  private currentEnvironment(): EnvironmentType | null {
    const raw = (this.config.get<string>('appEnv') ?? '').toLowerCase().trim();
    const allowed = Object.values(EnvironmentType) as string[];
    return allowed.includes(raw) ? (raw as EnvironmentType) : null;
  }

  /**
   * From a list of candidate configs (expected pre-ordered newest-first),
   * pick the one matching the running app environment (APP_ENV); otherwise
   * fall back to the first candidate. The single place every "which config"
   * decision goes through, so payments, receipts, branding, parent portal
   * and public pay all resolve the same way.
   */
  private pickForEnv(configs: TenantConfig[]): TenantConfig | null {
    if (!configs.length) return null;
    const env = this.currentEnvironment();
    return (env && configs.find((c) => c.environmentType === env)) || configs[0];
  }

  /** The non-secret subset served to the parent portal / public pay. */
  private toPublic(cfg: TenantConfig): PublicTenantConfig {
    return {
      tenantId: cfg.tenantId,
      environmentType: cfg.environmentType,
      configurationName: cfg.configurationName,
      logoUrl: cfg.logoUrl,
      receiptLogoUrl: cfg.receiptLogoUrl,
      domainUrl: cfg.domainUrl,
      privacyPolicyUrl: cfg.privacyPolicyUrl,
      termsAndConditionsUrl: cfg.termsAndConditionsUrl,
      refundPolicyUrl: cfg.refundPolicyUrl,
    };
  }

  /**
   * Resolve the non-secret tenant config for a caller's domain. The client
   * passes its `window.location.href`; we match its host against
   * `domain_url`. When several configs share a domain we prefer the one
   * whose `environment_type` matches the running app env (APP_ENV), so the
   * production site gets the production config and QA gets QA. Returns null
   * if nothing matches.
   */
  async resolvePublicByUrl(url: string): Promise<PublicTenantConfig | null> {
    const cfg = await this.resolveActiveByHost(url);
    return cfg ? this.toPublic(cfg) : null;
  }

  /**
   * Non-secret config for a logged-in user's tenant (parent portal / mobile
   * parent — no domain available). Env-aware via APP_ENV.
   */
  async resolveByTenant(tenantId: string): Promise<PublicTenantConfig | null> {
    const cfg = await this.findActiveForTenant(tenantId);
    return cfg ? this.toPublic(cfg) : null;
  }

  /**
   * Resolve the active config whose domain matches the caller's host
   * (accepts a full href, Host header, or bare host). Env-aware + newest
   * first. Returns the full entity for callers that need secrets
   * (e.g. public-pay gateway keys).
   */
  async resolveActiveByHost(hostOrUrl: string): Promise<TenantConfig | null> {
    const target = this.normaliseHost(hostOrUrl);
    if (!target) return null;
    const matches = (
      await this.repo.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      })
    ).filter((cfg) => this.normaliseHost(cfg.domainUrl) === target);
    return this.pickForEnv(matches);
  }

  private toEntity(dto: CreateTenantConfigDto | UpdateTenantConfigDto): DeepPartial<TenantConfig> {
    return {
      tenantId: dto.tenantId,
      environmentType: dto.envType,
      configurationName: dto.configName,
      logoUrl: dto.logoUrl,
      receiptLogoUrl: dto.receiptLogoUrl,
      domainUrl: dto.domainUrl,
      privacyPolicyUrl: dto.privacyPolicyUrl,
      termsAndConditionsUrl: dto.termsAndConditionsUrl,
      refundPolicyUrl: dto.refundPolicyUrl,
      accessKey: dto.accessKey,
      storageConnectionString: dto.connectionString,
      storageContainerName: dto.containerName,
      storageSecretKey: dto.secretKey,
      storageBucketName: dto.bucketName,
      gatewayType: dto.gatewayType,
      paymentClientId: dto.paymentKey,
      paymentSecretKey: dto.paymentSecret,
      paymentMode: dto.paymentMode,
      paymentWebhookUrl: dto.webhookUrl,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpUser: dto.smtpUser,
      smtpPassword: dto.smtpPassword,
      smtpFromName: dto.smtpFromName,
      smtpFromEmail: dto.smtpFromEmail,
      smtpSecure: dto.smtpSecure,
      ...('isActive' in dto ? { isActive: (dto as UpdateTenantConfigDto).isActive } : {}),
    };
  }

  async create(dto: CreateTenantConfigDto): Promise<TenantConfig> {
    const data = this.toEntity(dto);

    const existing = await this.repo.findOne({
      where: {
        tenantId: data.tenantId as string,
        configurationName: data.configurationName as string,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Configuration "${data.configurationName}" already exists for this tenant.`,
      );
    }

    const config = this.repo.create(data);
    return this.repo.save(config);
  }

  async findAll(): Promise<TenantConfig[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByTenant(tenantId: string): Promise<TenantConfig[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * The active config for a tenant — env-aware: prefers the one whose
   * environment_type matches APP_ENV, else the newest active. Used by the
   * payments flow (gateway credentials), branding, and the parent portal,
   * so every surface resolves the same config. Returns null if the tenant
   * has no active config.
   */
  async findActiveForTenant(tenantId: string): Promise<TenantConfig | null> {
    const configs = await this.repo.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return this.pickForEnv(configs);
  }

  async findOne(id: string): Promise<TenantConfig> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(
        `Tenant configuration with id "${id}" not found.`,
      );
    }
    return config;
  }

  async update(id: string, dto: UpdateTenantConfigDto): Promise<TenantConfig> {
    const config = await this.findOne(id);
    const data = this.toEntity(dto);

    if (
      data.configurationName &&
      data.configurationName !== config.configurationName
    ) {
      const conflict = await this.repo.findOne({
        where: {
          tenantId: config.tenantId,
          configurationName: data.configurationName as string,
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Configuration "${data.configurationName}" already exists for this tenant.`,
        );
      }
    }

    Object.assign(config, data);
    return this.repo.save(config);
  }

  async upsert(dto: CreateTenantConfigDto): Promise<TenantConfig> {
    const data = this.toEntity(dto);

    const existing = await this.repo.findOne({
      where: {
        tenantId: data.tenantId as string,
        configurationName: data.configurationName as string,
      },
    });

    if (existing) {
      Object.assign(existing, data);
      return this.repo.save(existing);
    }

    const config = this.repo.create(data);
    return this.repo.save(config);
  }

  async remove(id: string): Promise<void> {
    const config = await this.findOne(id);
    await this.repo.remove(config);
  }
}
