import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { TenantConfig } from './entities/tenant-config.entity';
import { CreateTenantConfigDto } from './dto/create-tenant-config.dto';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';

@Injectable()
export class TenantConfigsService {
  constructor(
    @InjectRepository(TenantConfig)
    private readonly repo: Repository<TenantConfig>,
  ) {}

  private toEntity(dto: CreateTenantConfigDto | UpdateTenantConfigDto): DeepPartial<TenantConfig> {
    return {
      tenantId: dto.tenantId,
      environmentType: dto.envType,
      configurationName: dto.configName,
      logoUrl: dto.logoUrl,
      receiptLogoUrl: dto.receiptLogoUrl,
      domainUrl: dto.domainUrl,
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
   * Returns the most recent active config for a tenant, used by the
   * payments flow to pick the right gateway credentials. Returns null
   * if the tenant has no active config (caller decides whether to fall
   * back to platform defaults or refuse the operation).
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
