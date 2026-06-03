import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ParentsService } from './parents.service';
import { CreateParentDto, ParentStudentLinkDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

@ApiTags('parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a parent and link to students (admin)' })
  create(@CurrentUser() user: any, @Body() dto: CreateParentDto) {
    return this.parentsService.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List parents in current tenant' })
  findAll(@CurrentUser() user: any) {
    return this.parentsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.parentsService.findOneOrFail(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateParentDto,
  ) {
    return this.parentsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.parentsService.remove(user.tenantId, id);
  }

  @Post('backfill-from-students')
  @ApiOperation({
    summary:
      'Create/link parent accounts for existing students using their parent-contact email.',
  })
  backfillFromStudents(@CurrentUser() user: any) {
    return this.parentsService.backfillFromStudents(user.tenantId);
  }

  @Post(':id/students')
  @ApiOperation({ summary: 'Link an additional child to this parent' })
  addStudent(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ParentStudentLinkDto,
  ) {
    return this.parentsService.addStudentLink(user.tenantId, id, dto);
  }

  @Delete(':id/students/:linkId')
  @ApiOperation({ summary: 'Unlink a child from this parent' })
  removeStudent(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ) {
    return this.parentsService.removeStudentLink(user.tenantId, id, linkId);
  }
}
