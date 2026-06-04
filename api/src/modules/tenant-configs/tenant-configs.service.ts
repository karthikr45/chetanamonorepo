import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

  /** The non-secret subset served to the parent portal / public pay. */
  private toPublic(cfg: TenantConfig): PublicTenantConfig {
    return {
      tenantId: cfg.tenantId,
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
   * `domain_url`. Returns null if nothing matches.
   */
  async resolvePublicByUrl(url: string): Promise<PublicTenantConfig | null> {
    const cfg = await this.resolveActiveByHost(url);
    return cfg ? this.toPublic(cfg) : null;
  }

  /**
   * Non-secret config for a logged-in user's tenant (parent portal / mobile
   * parent — no domain available).
   */
  async resolveByTenant(tenantId: string): Promise<PublicTenantConfig | null> {
    const cfg = await this.findActiveForTenant(tenantId);
    return cfg ? this.toPublic(cfg) : null;
  }

  /**
   * Resolve the active config whose domain matches the caller's host
   * (accepts a full href, Host header, or bare host). Returns the full
   * entity for callers that need secrets (e.g. public-pay gateway keys).
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
    return matches[0] ?? null;
  }

  private toEntity(dto: CreateTenantConfigDto | UpdateTenantConfigDto): DeepPartial<TenantConfig> {
    return {
      tenantId: dto.tenantId,
      // Environments were removed — every tenant has a single configuration.
      // The column is retained but no longer surfaced; default to production.
      environmentType: dto.envType ?? EnvironmentType.PRODUCTION,
      configurationName: dto.configName ?? 'default',
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

    // A tenant may have only ONE configuration — reject a second.
    const existing = await this.repo.findOne({
      where: { tenantId: data.tenantId as string },
    });
    if (existing) {
      throw new ConflictException(
        'This tenant already has a configuration. Edit the existing one instead.',
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
   * The active config for a tenant. A tenant has a single configuration, so
   * this returns it (newest active if more than one exists on legacy data).
   * Used by payments (gateway credentials), branding and the parent portal.
   */
  async findActiveForTenant(tenantId: string): Promise<TenantConfig | null> {
    return this.repo.findOne({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
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

    // Single config per tenant — update the existing one if present.
    const existing = await this.repo.findOne({
      where: { tenantId: data.tenantId as string },
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
