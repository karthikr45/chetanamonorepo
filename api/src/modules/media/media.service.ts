import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { AzureStorageService } from '../storage/azure-storage.service';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    private readonly storage: AzureStorageService,
  ) {}

  async upload(
    tenantId: string,
    file: Express.Multer.File,
    opts: {
      branch?: string | null;
      caption?: string;
      uploadedBy?: string | null;
    },
  ): Promise<Media> {
    if (!file) throw new BadRequestException('No file provided');

    const { url, key } = await this.storage.uploadImage({
      tenantId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: 'media',
    });

    const media = this.mediaRepo.create({
      tenantId,
      branch: opts.branch ?? null,
      url,
      storageKey: key,
      fileName: file.originalname ?? null,
      mimeType: file.mimetype,
      sizeBytes: file.size ?? file.buffer?.length ?? 0,
      caption: opts.caption ?? null,
      uploadedBy: opts.uploadedBy ?? null,
    });
    return this.mediaRepo.save(media);
  }

  findAll(tenantId: string): Promise<Media[]> {
    return this.mediaRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Media> {
    const m = await this.mediaRepo.findOne({ where: { id, tenantId } });
    if (!m) throw new NotFoundException(`Media ${id} not found`);
    return m;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const m = await this.findOne(tenantId, id);
    // Best-effort blob cleanup; the DB row is the source of truth.
    try {
      await this.storage.deleteByUrl(tenantId, m.url);
    } catch {
      /* blob may already be gone — soft-delete the record anyway */
    }
    await this.mediaRepo.softRemove(m);
  }
}
