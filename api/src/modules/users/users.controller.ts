import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() _dto: CreateUserDto) {
    // TODO: implement
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll() {
    // TODO: implement
  }

  @Get(':id')
  findOne(@Param('id') _id: string) {
    // TODO: implement
  }

  @Patch(':id')
  update(@Param('id') _id: string, @Body() _dto: UpdateUserDto) {
    // TODO: implement
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') _id: string) {
    // TODO: implement
  }
}
