import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AcademicYear } from './entities/academic-year.entity';
import { SystemMetadata } from '../system-metadata/entities/system-metadata.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly academicYearsRepository: Repository<AcademicYear>,
    @InjectRepository(SystemMetadata)
    private readonly metadataRepository: Repository<SystemMetadata>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Seeds a tenant's academic_years table from the global
   * system_metadata catalog (type='academic_year', active rows).
   * Idempotent — only inserts rows that don't already exist. The
   * newest value (highest displayOrder) is flagged isCurrentYear iff
   * the tenant has no current year yet.
   *
   * Called from TenantsService.create so new schools get the full AY
   * list out of the box.
   */
  async syncFromMetadata(tenantId: string): Promise<{ created: number }> {
    const metaRows = await this.metadataRepository.find({
      where: { type: 'academic_year', isActive: true },
      order: { displayOrder: 'ASC' },
    });
    if (!metaRows.length) return { created: 0 };

    const existing = await this.academicYearsRepository.find({
      where: { tenantId },
      select: ['academicYear'],
    });
    const have = new Set(existing.map((r) => r.academicYear));
    const missing = metaRows.filter((m) => !have.has(m.value));
    if (!missing.length) return { created: 0 };

    const newestValue = metaRows[metaRows.length - 1].value;
    const hasCurrent = existing.length
      ? (
          await this.academicYearsRepository.findOne({
            where: { tenantId, isCurrentYear: true },
            select: ['id'],
          })
        )
        ? true
        : false
      : false;

    const rows = missing.map((m) =>
      this.academicYearsRepository.create({
        tenantId,
        academicYear: m.value,
        isActive: true,
        isCurrentYear: !hasCurrent && m.value === newestValue,
      }),
    );
    await this.academicYearsRepository.save(rows);
    return { created: rows.length };
  }

  async create(
    tenantId: string,
    dto: CreateAcademicYearDto,
  ): Promise<AcademicYear> {
    this.validateYearFormat(dto.academicYear);


    const existing = await this.academicYearsRepository.findOne({
      where: { tenantId, academicYear: dto.academicYear },
    });

    if (existing) {
      throw new ConflictException(
        `Academic year '${dto.academicYear}' already exists`,
      );
    }

    // If marking as current year, use a transaction to unset the old one
    if (dto.isCurrentYear) {
      return this.setCurrentYearTransaction(tenantId, async (queryRunner) => {
        const academicYear = this.academicYearsRepository.create({
          ...dto,
          tenantId,
        });
        return queryRunner.manager.save(academicYear);
      });
    }

    const academicYear = this.academicYearsRepository.create({
      ...dto,
      tenantId,
    });
    return this.academicYearsRepository.save(academicYear);
  }

  async findAll(tenantId: string): Promise<AcademicYear[]> {
   const result=await this.academicYearsRepository.find({
      where: { tenantId },
      order: { academicYear: 'ASC' },
    });
    return result
  }

  async findOne(tenantId: string, id: string): Promise<AcademicYear> {
    const academicYear = await this.academicYearsRepository.findOne({
      where: { id, tenantId },
    });

    if (!academicYear) {
      throw new NotFoundException(`Academic year with ID '${id}' not found`);
    }

    return academicYear;
  }

  async findCurrentYear(tenantId: string): Promise<AcademicYear> {
    const current = await this.academicYearsRepository.findOne({
      where: { tenantId, isCurrentYear: true },
    });

    if (!current) {
      throw new NotFoundException('No current academic year is set');
    }

    return current;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateAcademicYearDto,
  ): Promise<AcademicYear> {
    const academicYear = await this.findOne(tenantId, id);

    if (dto.academicYear && dto.academicYear !== academicYear.academicYear) {
      this.validateYearFormat(dto.academicYear);

      const duplicate = await this.academicYearsRepository.findOne({
        where: { tenantId, academicYear: dto.academicYear },
      });

      if (duplicate) {
        throw new ConflictException(
          `Academic year '${dto.academicYear}' already exists`,
        );
      }
    }

    // If marking as current year, use a transaction to unset the old one
    if (dto.isCurrentYear === true && !academicYear.isCurrentYear) {
      return this.setCurrentYearTransaction(tenantId, async (queryRunner) => {
        Object.assign(academicYear, dto);
        return queryRunner.manager.save(academicYear);
      });
    }

    Object.assign(academicYear, dto);
    return this.academicYearsRepository.save(academicYear);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const academicYear = await this.findOne(tenantId, id);
    await this.academicYearsRepository.remove(academicYear);
  }

  // ─── Private helpers ───

  private validateYearFormat(academicYear: string): void {
    const parts = academicYear.split('-');
    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);

    if (end !== start + 1) {
      throw new BadRequestException(
        'End year must be exactly start year + 1 (e.g. 2026-2027)',
      );
    }
  }

  /**
   * Wraps the operation in a transaction that first unsets any existing
   * current year for the tenant, then executes the provided callback.
   */
  private async setCurrentYearTransaction(
    tenantId: string,
    operation: (queryRunner: any) => Promise<AcademicYear>,
  ): Promise<AcademicYear> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Unset any existing current year for this tenant
      await queryRunner.manager.update(
        AcademicYear,
        { tenantId, isCurrentYear: true },
        { isCurrentYear: false },
      );

      const result = await operation(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}