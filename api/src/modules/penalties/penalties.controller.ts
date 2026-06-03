import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PenaltiesService } from './penalties.service';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { UpdatePenaltyDto } from './dto/update-penalty.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('penalties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('penalties')
export class PenaltiesController {
  constructor(private readonly penaltiesService: PenaltiesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@CurrentUser() _user: any, @Body() _dto: CreatePenaltyDto) {
    // TODO: implement
  }

  @Get()
  findAll(@CurrentUser() _user: any) {
    // TODO: implement
  }

  @Get(':id')
  findOne(@CurrentUser() _user: any, @Param('id') _id: string) {
    // TODO: implement
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@CurrentUser() _user: any, @Param('id') _id: string, @Body() _dto: UpdatePenaltyDto) {
    // TODO: implement
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@CurrentUser() _user: any, @Param('id') _id: string) {
    // TODO: implement
  }
}
