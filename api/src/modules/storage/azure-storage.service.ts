import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { randomBytes } from 'crypto';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

/**
 * Per-tenant Azure Blob Storage. Reads credentials from the tenant's
 * active TenantConfig — same pattern we use for payment gateway keys.
 *
 * Supports either:
 *  - `storageConnectionString` (preferred — single field, contains
 *    account name + key)
 *  - `accountName + accessKey` (legacy / explicit fields)
 *
 * Container name comes from `storageContainerName` (the "container name"
 * field on the tenant Configuration tab — same field receipts use). The
 * container and the per-tenant directories are provisioned out-of-band —
 * this service never creates them, it only reads/writes blobs into them.
 *
 * Blob layout inside the container:
 *  - chat attachments → `chat-files/{file}`
 *  - media uploads     → `{tenantCode}/media/{file}`
 *  - social feed images→ `{tenantCode}/social-feed/{file}`
 *  - receipts          → `{tenantCode}/receipts/{file}`
 */
@Injectable()
export class AzureStorageService {
  private readonly logger = new Logger(AzureStorageService.name);

  constructor(
    @InjectRepository(TenantConfig)
    private readonly tenantConfigRepo: Repository<TenantConfig>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /**
   * Looks up a tenant's `tenantCode` — used as the top-level directory
   * for media and social-feed uploads (mirrors the receipt layout).
   */
  private async resolveTenantCode(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant?.tenantCode) {
      throw new NotFoundException(
        'Tenant not found, or has no tenantCode set for storage paths.',
      );
    }
    return tenant.tenantCode;
  }

  /**
   * Returns the most-recent active TenantConfig for the tenant — same
   * resolution as the payment gateway flow.
   */
  private async resolveConfig(tenantId: string): Promise<TenantConfig> {
    const cfg = await this.tenantConfigRepo.findOne({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    if (!cfg) {
      throw new NotFoundException(
        'No active tenant configuration. Set storage credentials under the tenant Configuration tab.',
      );
    }
    return cfg;
  }

  /**
   * Builds just the Azure client + host from the tenant's credentials —
   * no container resolution. Prefers a connection string, falls back to
   * explicit account + access key.
   */
  private blobServiceFromConfig(
    cfg: TenantConfig,
  ): { blobService: BlobServiceClient; baseHost: string } {
    // Prefer connection string when present.
    if (cfg.storageConnectionString && cfg.storageConnectionString.trim()) {
      const blobService = BlobServiceClient.fromConnectionString(
        cfg.storageConnectionString.trim(),
      );
      return {
        blobService,
        baseHost: `${blobService.accountName}.blob.core.windows.net`,
      };
    }

    // Fall back to explicit account + access key.
    // We treat `accessKey` as the account access key and
    // `storageSecretKey` as the account NAME (legacy mapping in this
    // schema since there was no dedicated account-name column).
    const accessKey = (cfg.accessKey ?? '').trim();
    const accountName = (cfg.storageSecretKey ?? '').trim();
    if (!accessKey || !accountName) {
      throw new BadRequestException(
        'Storage credentials missing. Provide either a connection string, or both account name + access key for this tenant.',
      );
    }
    const credential = new StorageSharedKeyCredential(accountName, accessKey);
    const blobService = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential,
    );
    return {
      blobService,
      baseHost: `${accountName}.blob.core.windows.net`,
    };
  }

  private clientFromConfig(
    cfg: TenantConfig,
  ): { blobService: BlobServiceClient; container: string; baseHost: string } {
    const container = (cfg.storageContainerName ?? '').trim();
    if (!container) {
      throw new BadRequestException(
        'storageContainerName (container name) is not configured for this tenant.',
      );
    }
    const { blobService, baseHost } = this.blobServiceFromConfig(cfg);
    return { blobService, container, baseHost };
  }

  /**
   * Upload a single image buffer and return the public URL. Stored under
   * `{tenantCode}/{folder}/{file}` inside the tenant's container — `folder`
   * is `media` for the Media tab and `social-feed` for the Social feed.
   * The container/directory must already exist (we don't create them).
   */
  async uploadImage(args: {
    tenantId: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    folder?: string;
  }): Promise<{ url: string; key: string }> {
    if (!args.buffer?.length) {
      throw new BadRequestException('Empty upload');
    }
    if (args.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 10 MB)');
    }
    if (!/^image\//i.test(args.mimeType)) {
      throw new BadRequestException('Only images are accepted on this endpoint');
    }

    const cfg = await this.resolveConfig(args.tenantId);
    const { blobService, container, baseHost } = this.clientFromConfig(cfg);
    const tenantCode = await this.resolveTenantCode(args.tenantId);

    // Container and per-tenant directories are provisioned out-of-band; we
    // only write blobs into them.
    const containerClient = blobService.getContainerClient(container);

    const ext = extOf(args.originalName, args.mimeType);
    const folder = sanitizePathSegment(args.folder ?? 'media');
    const key = `${sanitizePathSegment(tenantCode)}/${folder}/${Date.now()}-${randomBytes(
      8,
    ).toString('hex')}${ext}`;

    const blockBlob = containerClient.getBlockBlobClient(key);
    try {
      await blockBlob.uploadData(args.buffer, {
        blobHTTPHeaders: {
          blobContentType: args.mimeType,
          blobCacheControl: 'public, max-age=31536000, immutable',
        },
      });
    } catch (err) {
      this.rethrowUploadError(err, container);
    }

    const url = `https://${baseHost}/${container}/${key}`;
    this.logger.log(`Uploaded ${args.buffer.length}B → ${url}`);
    return { url, key };
  }

  /**
   * Generic file upload (any mime) for chat attachments. 25 MB cap.
   * Stored under the container's `chat-files/` directory.
   */
  async uploadFile(args: {
    tenantId: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    folder?: string;
  }): Promise<{ url: string; key: string }> {
    if (!args.buffer?.length) {
      throw new BadRequestException('Empty upload');
    }
    if (args.buffer.length > 25 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 25 MB)');
    }

    const cfg = await this.resolveConfig(args.tenantId);
    const { blobService, container, baseHost } = this.clientFromConfig(cfg);
    const containerClient = blobService.getContainerClient(container);

    const ext = extOf(args.originalName, args.mimeType);
    const folder = sanitizePathSegment(args.folder ?? 'chat-files');
    const key = `${folder}/${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;

    try {
      await containerClient.getBlockBlobClient(key).uploadData(args.buffer, {
        blobHTTPHeaders: {
          blobContentType: args.mimeType || 'application/octet-stream',
          blobCacheControl: 'private, max-age=31536000, immutable',
        },
      });
    } catch (err) {
      this.rethrowUploadError(err, container);
    }

    const url = `https://${baseHost}/${container}/${key}`;
    this.logger.log(`Uploaded file ${args.buffer.length}B → ${url}`);
    return { url, key };
  }

  /**
   * Upload a generated receipt PDF and return its public URL. Stored
   * under `{tenantCode}/receipts/{blobName}.pdf` inside the tenant's
   * container (resolved from the tenant config's `storageContainerName`,
   * public-read, must already exist — we never create it).
   *
   * Overwrites any existing blob of the same name (receipts are always
   * regenerated), and sets `no-cache` so a browser/CDN never serves a
   * stale copy from a reused URL.
   */
  async uploadReceiptPdf(args: {
    tenantId: string;
    tenantCode: string;
    buffer: Buffer;
    blobName: string;
  }): Promise<{ url: string; key: string }> {
    if (!args.buffer?.length) {
      throw new BadRequestException('Empty receipt PDF');
    }

    const cfg = await this.resolveConfig(args.tenantId);
    const container = (cfg.storageContainerName ?? '').trim();
    if (!container) {
      throw new BadRequestException(
        'storageContainerName is not configured for this tenant.',
      );
    }
    const { blobService, baseHost } = this.blobServiceFromConfig(cfg);
    const containerClient = blobService.getContainerClient(container);

    const folder = sanitizePathSegment(args.tenantCode);
    const name = sanitizePathSegment(args.blobName);
    const key = `${folder}/receipts/${name}.pdf`;

    try {
      await containerClient.getBlockBlobClient(key).uploadData(args.buffer, {
        blobHTTPHeaders: {
          blobContentType: 'application/pdf',
          blobCacheControl: 'no-cache',
        },
      });
    } catch (err) {
      this.rethrowUploadError(err, container);
    }

    const url = `https://${baseHost}/${container}/${key}`;
    this.logger.log(`Uploaded receipt ${args.buffer.length}B → ${url}`);
    return { url, key };
  }

  /**
   * Translates Azure's "container/directory missing" failures into a
   * clear 400 — we never create containers, so a missing one is a
   * configuration problem the admin needs to fix.
   */
  private rethrowUploadError(err: unknown, container: string): never {
    const code = (err as { code?: string }).code;
    if (code === 'ContainerNotFound') {
      throw new BadRequestException(
        `Storage container "${container}" was not found. Create the container ` +
          `and the per-tenant directory before uploading — this service does ` +
          `not create them.`,
      );
    }
    throw err as Error;
  }

  /**
   * Best-effort delete. Doesn't throw on 404 — callers tolerate
   * missing blobs (e.g. when a post that's already been edited gets
   * deleted and the new image set is shorter than the old one).
   */
  async deleteByUrl(tenantId: string, url: string): Promise<void> {
    if (!url) return;
    let cfg: TenantConfig;
    try {
      cfg = await this.resolveConfig(tenantId);
    } catch {
      return;
    }
    const { blobService, container, baseHost } = this.clientFromConfig(cfg);
    const prefix = `https://${baseHost}/${container}/`;
    if (!url.startsWith(prefix)) {
      return; // not our blob, leave it alone
    }
    const key = url.slice(prefix.length);
    try {
      await blobService
        .getContainerClient(container)
        .getBlockBlobClient(key)
        .deleteIfExists();
    } catch (err) {
      this.logger.warn(`delete blob ${key} failed: ${(err as Error).message}`);
    }
  }
}

/**
 * Make a value safe to use as a single blob path segment — strips
 * whitespace and anything outside [A-Za-z0-9._-] (slashes included, so a
 * value can't smuggle in extra path levels).
 */
function sanitizePathSegment(v: string | null | undefined): string {
  return (
    (v ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

function extOf(name: string | undefined, mime: string): string {
  if (name) {
    const m = /\.[a-zA-Z0-9]+$/.exec(name);
    if (m) return m[0].toLowerCase();
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/avif') return '.avif';
  return '';
}
