import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Penalty } from './entities/penalty.entity';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { UpdatePenaltyDto } from './dto/update-penalty.dto';

@Injectable()
export class PenaltiesService {
  constructor(
    @InjectRepository(Penalty)
    private readonly penaltiesRepository: Repository<Penalty>,
  ) {}

  async create(_tenantId: string, _dto: CreatePenaltyDto): Promise<Penalty> {
    // TODO: implement — tenantId from JWT
    throw new Error('Not implemented');
  }

  async findAll(_tenantId: string): Promise<Penalty[]> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findOne(_tenantId: string, _id: string): Promise<Penalty> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async update(_tenantId: string, _id: string, _dto: UpdatePenaltyDto): Promise<Penalty> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async remove(_tenantId: string, _id: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
