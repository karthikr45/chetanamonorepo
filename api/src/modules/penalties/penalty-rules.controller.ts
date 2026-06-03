import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PenaltyRulesService } from './penalty-rules.service';
import {
  CreatePenaltyRuleDto,
  UpdatePenaltyRuleDto,
} from './dto/penalty-rule.dto';

@ApiTags('penalty-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('penalty-rules')
export class PenaltyRulesController {
  constructor(private readonly rules: PenaltyRulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a penalty rule for this tenant' })
  create(@CurrentUser() user: any, @Body() dto: CreatePenaltyRuleDto) {
    return this.rules.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List penalty rules for this tenant' })
  list(@CurrentUser() user: any) {
    return this.rules.list(user.tenantId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rules.findOneOrFail(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePenaltyRuleDto,
  ) {
    return this.rules.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rules.remove(user.tenantId, id);
  }
}
