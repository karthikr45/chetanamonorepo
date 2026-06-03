import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { AuditService } from './audit.service';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Records every mutating API call to audit_logs. Reads only: GETs are
 * skipped (the per-request HTTP log already covers traffic). Never
 * blocks or fails the request — the write is fire-and-forget.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method?.toUpperCase();
    const path = req.originalUrl || req.url;

    if (!AUDITED_METHODS.has(method) || path.includes('/healthz')) {
      return next.handle();
    }

    const start = Date.now();
    const user = (req as any).user;
    const base = {
      tenantId: user?.tenantId ?? 'none',
      actorId: user?.userId ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      method,
      path,
      ipAddress: req.ip ?? null,
      payload: req.body,
    };

    const finish = (statusCode: number, isError: boolean) => {
      void this.audit.record({
        ...base,
        statusCode,
        isError,
        durationMs: Date.now() - start,
      });
    };

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          finish(res.statusCode, false);
        },
        error: (err) => {
          const status =
            typeof err?.getStatus === 'function' ? err.getStatus() : 500;
          finish(status, true);
        },
      }),
    );
  }
}
