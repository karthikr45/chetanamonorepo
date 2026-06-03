import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPS_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image to the tenant media library' })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
  ) {
    return this.mediaService.upload(user.tenantId, file, {
      caption: body?.caption,
      uploadedBy: user.userId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List media for the tenant (newest first)' })
  findAll(@CurrentUser() user: any) {
    return this.mediaService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.findOne(user.tenantId, id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPS_ADMIN)
  remove(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.remove(user.tenantId, id);
  }
}
