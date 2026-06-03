import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PenaltyRule } from './entities/penalty-rule.entity';
import {
  CreatePenaltyRuleDto,
  UpdatePenaltyRuleDto,
} from './dto/penalty-rule.dto';

@Injectable()
export class PenaltyRulesService {
  constructor(
    @InjectRepository(PenaltyRule)
    private readonly rulesRepo: Repository<PenaltyRule>,
  ) {}

  async create(tenantId: string, dto: CreatePenaltyRuleDto): Promise<PenaltyRule> {
    const row = this.rulesRepo.create({
      tenantId,
      academicYear: dto.academicYear ?? null,
      term: dto.term ?? null,
      triggerAfterDays: dto.triggerAfterDays,
      amountType: dto.amountType,
      amount: dto.amount.toFixed(2),
      maxAmount: dto.maxAmount != null ? dto.maxAmount.toFixed(2) : null,
      isActive: dto.isActive ?? true,
      description: dto.description ?? null,
    });
    return this.rulesRepo.save(row);
  }

  async list(tenantId: string): Promise<PenaltyRule[]> {
    return this.rulesRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(tenantId: string, id: string): Promise<PenaltyRule> {
    const r = await this.rulesRepo.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException(`Penalty rule ${id} not found`);
    return r;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePenaltyRuleDto,
  ): Promise<PenaltyRule> {
    const r = await this.findOneOrFail(tenantId, id);
    if (dto.academicYear !== undefined) r.academicYear = dto.academicYear || null;
    if (dto.term !== undefined) r.term = dto.term || null;
    if (dto.triggerAfterDays !== undefined) r.triggerAfterDays = dto.triggerAfterDays;
    if (dto.amountType !== undefined) r.amountType = dto.amountType;
    if (dto.amount !== undefined) r.amount = dto.amount.toFixed(2);
    if (dto.maxAmount !== undefined)
      r.maxAmount = dto.maxAmount != null ? dto.maxAmount.toFixed(2) : null;
    if (dto.isActive !== undefined) r.isActive = dto.isActive;
    if (dto.description !== undefined) r.description = dto.description || null;
    return this.rulesRepo.save(r);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const r = await this.findOneOrFail(tenantId, id);
    await this.rulesRepo.softRemove(r);
  }
}
