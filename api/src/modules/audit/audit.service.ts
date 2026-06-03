import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

const REDACT_KEYS = [
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'selectiontoken',
  'otp',
  'secret',
  'secretkey',
  'signature',
  'razorpay_signature',
  'authorization',
];

export interface AuditRecord {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  method: string;
  path: string;
  statusCode?: number | null;
  isError?: boolean;
  durationMs?: number | null;
  ipAddress?: string | null;
  payload?: unknown;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Strips secrets and truncates large blobs before persisting. */
  static sanitize(value: unknown, depth = 0): any {
    if (value == null || depth > 4) return value ?? null;
    if (Array.isArray(value)) {
      return value.slice(0, 50).map((v) => AuditService.sanitize(v, depth + 1));
    }
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (REDACT_KEYS.includes(k.toLowerCase())) {
          out[k] = '[redacted]';
        } else {
          out[k] = AuditService.sanitize(v, depth + 1);
        }
      }
      return out;
    }
    if (typeof value === 'string' && value.length > 2000) {
      return value.slice(0, 2000) + '…';
    }
    return value;
  }

  /** Fire-and-forget: auditing must never break the request it records. */
  async record(rec: AuditRecord): Promise<void> {
    try {
      await this.repo.insert({
        tenantId: rec.tenantId,
        actorId: rec.actorId ?? null,
        actorEmail: rec.actorEmail ?? null,
        actorRole: rec.actorRole ?? null,
        method: rec.method,
        path: rec.path,
        statusCode: rec.statusCode ?? null,
        isError: rec.isError ?? false,
        durationMs: rec.durationMs ?? null,
        ipAddress: rec.ipAddress ?? null,
        payload:
          rec.payload == null
            ? null
            : AuditService.sanitize(rec.payload),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to write audit log: ${msg}`);
    }
  }
}
