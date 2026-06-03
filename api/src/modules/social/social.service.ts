import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SocialPost, SocialPostKind } from './entities/social-post.entity';
import { SocialPostImage } from './entities/social-post-image.entity';
import { SocialComment } from './entities/social-comment.entity';
import { SocialReaction } from './entities/social-reaction.entity';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
} from './dto/social.dto';
import { Admin } from '../admins/entities/admin.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AzureStorageService } from '../storage/azure-storage.service';

export interface SocialAuthor {
  adminId: string;
  email?: string | null;
  name?: string | null;
}

export interface FeedItem extends SocialPost {
  images: SocialPostImage[];
  tenantName: string | null;
  commentCount: number;
  reactionCount: number;
}

export interface CommentRow {
  id: string;
  postId: string;
  authorKind: 'admin' | 'parent';
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: Date;
}

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(SocialPost)
    private readonly postRepo: Repository<SocialPost>,
    @InjectRepository(SocialPostImage)
    private readonly imageRepo: Repository<SocialPostImage>,
    @InjectRepository(SocialComment)
    private readonly commentRepo: Repository<SocialComment>,
    @InjectRepository(SocialReaction)
    private readonly reactionRepo: Repository<SocialReaction>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: AzureStorageService,
  ) {}

  // ─── Image uploads (Azure Blob, per-tenant credentials) ─────────

  async uploadImage(
    tenantId: string,
    file: { buffer: Buffer; mimetype: string; originalname?: string },
  ): Promise<{ url: string }> {
    const { url } = await this.storage.uploadImage({
      tenantId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: 'social-feed',
    });
    return { url };
  }

  // ─── Authoring (admin only, scoped to caller's tenant) ──────────

  async create(
    tenantId: string,
    actor: SocialAuthor,
    dto: CreateSocialPostDto,
  ): Promise<FeedItem> {
    const authorName =
      actor.name ??
      (await this.adminRepo
        .findOne({ where: { id: actor.adminId } })
        .then((a) => (a ? `${a.firstName} ${a.lastName}`.trim() : null)));

    return this.dataSource.transaction(async (m) => {
      const post = await m.getRepository(SocialPost).save(
        m.getRepository(SocialPost).create({
          tenantId,
          authorAdminId: actor.adminId,
          authorName,
          kind: dto.kind ?? SocialPostKind.POST,
          title: dto.title.trim(),
          excerpt: dto.excerpt?.trim() || null,
          body: dto.body ?? '',
          eventAt: dto.eventAt ? new Date(dto.eventAt) : null,
          location: dto.location?.trim() || null,
          tags: dto.tags?.trim() || null,
          isPublic: dto.isPublic ?? true,
          isPublished: dto.isPublished ?? true,
        }),
      );
      if (dto.images?.length) {
        await m.getRepository(SocialPostImage).save(
          dto.images.map((img, i) =>
            m.getRepository(SocialPostImage).create({
              postId: post.id,
              url: img.url,
              alt: img.alt ?? null,
              order: i,
            }),
          ),
        );
      }
      return this.composeFeedItem(post);
    });
  }

  async update(
    tenantId: string,
    postId: string,
    dto: UpdateSocialPostDto,
  ): Promise<FeedItem> {
    const post = await this.postRepo.findOne({
      where: { id: postId, tenantId },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);

    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.kind !== undefined) post.kind = dto.kind;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt?.trim() || null;
    if (dto.body !== undefined) post.body = dto.body ?? '';
    if (dto.eventAt !== undefined) {
      post.eventAt = dto.eventAt ? new Date(dto.eventAt) : null;
    }
    if (dto.location !== undefined) post.location = dto.location?.trim() || null;
    if (dto.tags !== undefined) post.tags = dto.tags?.trim() || null;
    if (dto.isPublic !== undefined) post.isPublic = dto.isPublic;
    if (dto.isPublished !== undefined) post.isPublished = dto.isPublished;

    return this.dataSource.transaction(async (m) => {
      await m.getRepository(SocialPost).save(post);

      if (dto.images !== undefined) {
        // Replace strategy — simple and predictable for the editor.
        await m.getRepository(SocialPostImage).delete({ postId });
        if (dto.images.length) {
          await m.getRepository(SocialPostImage).save(
            dto.images.map((img, i) =>
              m.getRepository(SocialPostImage).create({
                postId,
                url: img.url,
                alt: img.alt ?? null,
                order: i,
              }),
            ),
          );
        }
      }
      return this.composeFeedItem(post);
    });
  }

  async remove(tenantId: string, postId: string): Promise<void> {
    const post = await this.postRepo.findOne({
      where: { id: postId, tenantId },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    const images = await this.imageRepo.find({ where: { postId } });
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(SocialPostImage).delete({ postId });
      await m.getRepository(SocialComment).delete({ postId });
      await m.getRepository(SocialReaction).delete({ postId });
      await m.getRepository(SocialPost).softRemove(post);
    });
    // Best-effort blob cleanup — runs outside the txn so a flaky
    // Azure call doesn't block the delete.
    for (const img of images) {
      void this.storage.deleteByUrl(tenantId, img.url).catch(() => undefined);
    }
  }

  // ─── Comments + reactions ───────────────────────────────────────

  async addComment(args: {
    postId: string;
    tenantId?: string; // when caller is admin — for tenant-scoped post lookup
    authorKind: 'admin' | 'parent';
    authorId: string;
    authorName: string | null;
    body: string;
  }): Promise<CommentRow> {
    const trimmed = args.body?.trim();
    if (!trimmed) throw new NotFoundException('Empty comment'); // covered by DTO normally
    // Make sure the post exists + is published+public OR belongs to caller's tenant.
    const post = await this.postRepo.findOne({ where: { id: args.postId } });
    if (!post) throw new NotFoundException(`Post ${args.postId} not found`);
    if (args.authorKind === 'admin') {
      if (!args.tenantId || post.tenantId !== args.tenantId) {
        throw new ForbiddenException('Cannot comment on this post.');
      }
    } else {
      // Parent: must be public + published.
      if (!post.isPublic || !post.isPublished) {
        throw new ForbiddenException('Cannot comment on this post.');
      }
    }
    const saved = await this.commentRepo.save(
      this.commentRepo.create({
        postId: args.postId,
        authorKind: args.authorKind,
        authorId: args.authorId,
        authorName: args.authorName?.trim() || null,
        body: trimmed.slice(0, 1000),
      }),
    );
    return { ...saved };
  }

  async listComments(postId: string): Promise<CommentRow[]> {
    return this.commentRepo.find({
      where: { postId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async toggleReaction(args: {
    postId: string;
    authorKind: 'admin' | 'parent';
    authorId: string;
  }): Promise<{ liked: boolean; total: number }> {
    const post = await this.postRepo.findOne({ where: { id: args.postId } });
    if (!post) throw new NotFoundException(`Post ${args.postId} not found`);

    const existing = await this.reactionRepo.findOne({
      where: {
        postId: args.postId,
        authorKind: args.authorKind,
        authorId: args.authorId,
      },
    });
    if (existing) {
      await this.reactionRepo.remove(existing);
    } else {
      await this.reactionRepo.save(
        this.reactionRepo.create({
          postId: args.postId,
          authorKind: args.authorKind,
          authorId: args.authorId,
        }),
      );
    }
    const total = await this.reactionRepo.count({ where: { postId: args.postId } });
    return { liked: !existing, total };
  }

  // ─── Reads ───────────────────────────────────────────────────────

  /** Admin feed — every post in their tenant (drafts included). */
  async tenantFeed(
    tenantId: string,
    opts: { limit?: number; kind?: SocialPostKind } = {},
  ): Promise<FeedItem[]> {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const where: any = { tenantId };
    if (opts.kind) where.kind = opts.kind;
    const posts = await this.postRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachExtras(posts);
  }

  /** Logged-in feed — published posts in caller's tenant. */
  async myFeed(tenantId: string, opts: { limit?: number } = {}): Promise<FeedItem[]> {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const posts = await this.postRepo.find({
      where: { tenantId, isPublished: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachExtras(posts);
  }

  /**
   * Public feed — every published, public post across every tenant.
   * Used by the marketing landing / pre-login feed.
   */
  async publicFeed(
    opts: { limit?: number; tenantCode?: string } = {},
  ): Promise<FeedItem[]> {
    const limit = Math.min(60, Math.max(1, opts.limit ?? 20));
    let tenantIdFilter: string | null = null;
    if (opts.tenantCode) {
      const t = await this.tenantRepo.findOne({
        where: { tenantCode: opts.tenantCode.trim() },
      });
      if (!t) throw new NotFoundException('Tenant not found');
      tenantIdFilter = t.id;
    }
    const where: any = { isPublished: true, isPublic: true };
    if (tenantIdFilter) where.tenantId = tenantIdFilter;
    const posts = await this.postRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachExtras(posts);
  }

  async findOnePublic(postId: string): Promise<FeedItem> {
    const post = await this.postRepo.findOne({
      where: { id: postId, isPublished: true, isPublic: true },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    return this.composeFeedItem(post);
  }

  async findOneScoped(tenantId: string, postId: string): Promise<FeedItem> {
    const post = await this.postRepo.findOne({ where: { id: postId, tenantId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    return this.composeFeedItem(post);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async attachExtras(posts: SocialPost[]): Promise<FeedItem[]> {
    if (posts.length === 0) return [];
    const ids = posts.map((p) => p.id);
    const [images, tenants, commentRows, reactionRows] = await Promise.all([
      this.imageRepo.find({
        where: { postId: In(ids) },
        order: { order: 'ASC', createdAt: 'ASC' },
      }),
      this.tenantRepo.find({
        where: { id: In(Array.from(new Set(posts.map((p) => p.tenantId)))) },
      }),
      this.commentRepo
        .createQueryBuilder('c')
        .select('c.postId', 'postId')
        .addSelect('COUNT(*)::int', 'count')
        .where('c.postId IN (:...ids)', { ids })
        .groupBy('c.postId')
        .getRawMany<{ postId: string; count: number }>(),
      this.reactionRepo
        .createQueryBuilder('r')
        .select('r.postId', 'postId')
        .addSelect('COUNT(*)::int', 'count')
        .where('r.postId IN (:...ids)', { ids })
        .groupBy('r.postId')
        .getRawMany<{ postId: string; count: number }>(),
    ]);

    const nameByTenant = new Map(
      tenants.map((t) => [t.id, t.tenantName ?? t.name ?? null]),
    );
    const commentByPost = new Map(commentRows.map((c) => [c.postId, Number(c.count)]));
    const reactionByPost = new Map(
      reactionRows.map((r) => [r.postId, Number(r.count)]),
    );

    return posts.map((p) => ({
      ...p,
      images: images.filter((i) => i.postId === p.id),
      tenantName: nameByTenant.get(p.tenantId) ?? null,
      commentCount: commentByPost.get(p.id) ?? 0,
      reactionCount: reactionByPost.get(p.id) ?? 0,
    }));
  }

  private async composeFeedItem(post: SocialPost): Promise<FeedItem> {
    const [images, tenant, commentCount, reactionCount] = await Promise.all([
      this.imageRepo.find({
        where: { postId: post.id },
        order: { order: 'ASC', createdAt: 'ASC' },
      }),
      this.tenantRepo.findOne({ where: { id: post.tenantId } }),
      this.commentRepo.count({ where: { postId: post.id } }),
      this.reactionRepo.count({ where: { postId: post.id } }),
    ]);
    return {
      ...post,
      images,
      tenantName: tenant?.tenantName ?? tenant?.name ?? null,
      commentCount,
      reactionCount,
    };
  }
}
