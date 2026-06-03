import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(_dto: CreateUserDto): Promise<User> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findAll(_tenantId: string): Promise<User[]> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findOne(_id: string): Promise<User> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async updateRefreshToken(userId: string, hash: string | null): Promise<void> {
    await this.usersRepository.update(userId, { refreshTokenHash: hash });
  }

  async update(_id: string, _dto: UpdateUserDto): Promise<User> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async remove(_id: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
