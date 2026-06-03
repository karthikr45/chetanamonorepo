import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { SocialService } from './social.service';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
} from './dto/social.dto';
import { SocialPostKind } from './entities/social-post.entity';

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  // ─── Public reads — no auth ─────────────────────────────────────

  @Get('public/feed')
  @ApiOperation({
    summary: 'Public school feed — every published+public post across all tenants',
    description:
      'Pass ?tenantCode=SVBK_HYD to scope the feed to one school. Use ?limit=20 to page.',
  })
  publicFeed(
    @Query('limit') limit?: string,
    @Query('tenantCode') tenantCode?: string,
  ) {
    return this.social.publicFeed({
      limit: limit ? Number(limit) : undefined,
      tenantCode: tenantCode?.trim() || undefined,
    });
  }

  @Get('public/posts/:id')
  @ApiOperation({ summary: 'View one public post' })
  publicPost(@Param('id') id: string) {
    return this.social.findOnePublic(id);
  }

  @Get('public/posts/:id/comments')
  @ApiOperation({ summary: 'List comments on a public post' })
  publicComments(@Param('id') id: string) {
    return this.social.listComments(id);
  }

  // ─── Authed reads — caller's tenant ──────────────────────────────

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Published posts in the caller\'s tenant' })
  myFeed(@Req() req: Request, @Query('limit') limit?: string) {
    const tenantId = tenantOf(req);
    return this.social.myFeed(tenantId, { limit: limit ? Number(limit) : undefined });
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({
    summary: 'Admin view — drafts + published in caller\'s tenant',
  })
  manage(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('kind') kind?: SocialPostKind,
  ) {
    const tenantId = tenantOf(req);
    return this.social.tenantFeed(tenantId, {
      limit: limit ? Number(limit) : undefined,
      kind,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single post (tenant-scoped, drafts included)' })
  one(@Req() req: Request, @Param('id') id: string) {
    return this.social.findOneScoped(tenantOf(req), id);
  }

  // ─── Writes — admin / fin_admin / ops_admin ──────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @ApiOperation({ summary: 'Create a new post or event' })
  create(@Req() req: Request, @Body() dto: CreateSocialPostDto) {
    const { tenantId, userId, email } = actorOf(req);
    return this.social.create(tenantId, { adminId: userId, email }, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSocialPostDto,
  ) {
    return this.social.update(tenantOf(req), id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.social.remove(tenantOf(req), id);
  }

  // ─── Image upload to tenant Azure Blob ──────────────────────────

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FIN_ADMIN, Role.OPS_ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a single image to the tenant\'s Azure blob container',
    description:
      'Returns { url } — the public blob URL. Credentials are read from the ' +
      'tenant\'s active TenantConfig (storageConnectionString or accountName + accessKey).',
  })
  async upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('file is required');
    const tenantId = tenantOf(req);
    return this.social.uploadImage(tenantId, file);
  }

  // ─── Comments + reactions ───────────────────────────────────────

  @Get(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List comments on a post (auth)' })
  comments(@Param('id') id: string) {
    return this.social.listComments(id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Comment on a post as an authenticated user (admin or parent)',
  })
  async addComment(
    @Req() req: Request,
    @Param('id') postId: string,
    @Body() body: { body: string; authorName?: string },
  ) {
    const me = anyActor(req);
    return this.social.addComment({
      postId,
      tenantId: me.kind === 'admin' ? me.tenantId : undefined,
      authorKind: me.kind,
      authorId: me.userId,
      authorName: body.authorName ?? me.email,
      body: body.body,
    });
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle a like on a post (admin or parent)' })
  async toggleLike(@Req() req: Request, @Param('id') postId: string) {
    const me = anyActor(req);
    return this.social.toggleReaction({
      postId,
      authorKind: me.kind,
      authorId: me.userId,
    });
  }
}

function anyActor(req: Request): {
  kind: 'admin' | 'parent';
  userId: string;
  tenantId?: string;
  email: string | null;
} {
  const user = (req as any).user ?? {};
  if (!user.userId) {
    throw new UnauthorizedException('Authentication required.');
  }
  const isParent = String(user.role ?? '').toLowerCase() === 'parent';
  return {
    kind: isParent ? 'parent' : 'admin',
    userId: user.userId,
    tenantId: user.tenantId ?? undefined,
    email: typeof user.email === 'string' ? user.email : null,
  };
}

function tenantOf(req: Request): string {
  const user = (req as any).user;
  if (!user?.tenantId) {
    throw new UnauthorizedException('Tenant context required.');
  }
  return user.tenantId;
}

function actorOf(req: Request): {
  tenantId: string;
  userId: string;
  email: string | null;
} {
  const user = (req as any).user ?? {};
  if (!user.tenantId || !user.userId) {
    throw new UnauthorizedException('Authentication required.');
  }
  return {
    tenantId: user.tenantId,
    userId: user.userId,
    email: typeof user.email === 'string' ? user.email : null,
  };
}
