import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('academic-years')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new academic year' })
  @ApiResponse({ status: 201, description: 'Academic year created successfully' })
  @ApiResponse({ status: 409, description: 'Academic year already exists' })
  create(@CurrentUser() user: any, @Body() dto: CreateAcademicYearDto) {
    return this.academicYearsService.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all academic years for the tenant' })
  @ApiResponse({ status: 200, description: 'List of academic years' })
  findAll(@CurrentUser() user: any) {
    return this.academicYearsService.findAll(user.tenantId);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the current academic year' })
  @ApiResponse({ status: 200, description: 'Current academic year' })
  @ApiResponse({ status: 404, description: 'No current academic year set' })
  findCurrentYear(@CurrentUser() user: any) {
    return this.academicYearsService.findCurrentYear(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an academic year by ID' })
  @ApiResponse({ status: 200, description: 'Academic year details' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  findOne(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.academicYearsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update an academic year' })
  @ApiResponse({ status: 200, description: 'Academic year updated successfully' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  @ApiResponse({ status: 409, description: 'Academic year already exists' })
  update(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.academicYearsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an academic year' })
  @ApiResponse({ status: 204, description: 'Academic year deleted successfully' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  remove(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.academicYearsService.remove(user.tenantId, id);
  }
}