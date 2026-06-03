import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMetadata } from './entities/system-metadata.entity';
import {
  CreateSystemMetadataDto,
  UpdateSystemMetadataDto,
} from './dto/system-metadata.dto';

@Injectable()
export class SystemMetadataService {
  constructor(
    @InjectRepository(SystemMetadata)
    private readonly repo: Repository<SystemMetadata>,
  ) {}

  /** Public read — used by tenant admins and any logged-in user. */
  async list(filters: {
    type?: string;
    activeOnly?: boolean;
  }): Promise<SystemMetadata[]> {
    const qb = this.repo
      .createQueryBuilder('m')
      .orderBy('m.displayOrder', 'ASC')
      .addOrderBy('m.value', 'ASC');
    if (filters.type) qb.andWhere('m.type = :type', { type: filters.type });
    if (filters.activeOnly) qb.andWhere('m.isActive = true');
    return qb.getMany();
  }

  /** Distinct list of metadata types for picker UIs. */
  async types(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('m')
      .select('DISTINCT m.type', 'type')
      .orderBy('m.type', 'ASC')
      .getRawMany<{ type: string }>();
    return rows.map((r) => r.type);
  }

  async findOneOrFail(id: string): Promise<SystemMetadata> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`System metadata ${id} not found`);
    return r;
  }

  async create(dto: CreateSystemMetadataDto): Promise<SystemMetadata> {
    const existing = await this.repo.findOne({
      where: { type: dto.type, value: dto.value },
    });
    if (existing) {
      throw new ConflictException(
        `${dto.type}=${dto.value} already exists`,
      );
    }
    return this.repo.save(
      this.repo.create({
        type: dto.type.trim(),
        value: dto.value.trim(),
        label: dto.label?.trim() || null,
        description: dto.description?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateSystemMetadataDto): Promise<SystemMetadata> {
    const row = await this.findOneOrFail(id);
    if (dto.value !== undefined) row.value = dto.value.trim();
    if (dto.label !== undefined) row.label = dto.label?.trim() || null;
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.displayOrder !== undefined) row.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOneOrFail(id);
    await this.repo.remove(row);
  }
}
