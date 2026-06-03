import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Per-request context made available everywhere via AsyncLocalStorage.
 * Read by the winston format to stamp `requestId` + `tenantId` on
 * every log line, by Sentry tags, and by anything else that wants
 * caller context without plumbing it through every function signature.
 *
 * AsyncLocalStorage is the standard Node primitive for this — same
 * pattern Pino, opentelemetry, Sentry all use internally.
 */
export interface RequestContext {
  requestId: string;
  tenantId: string | null;
  userId: string | null;
  method: string;
  path: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Patch the active context with caller identity. Called from
 * JwtStrategy.validate once a token has been verified — middleware
 * runs before guards in the Nest pipeline, so the initial pass
 * doesn't have `req.user` yet.
 */
export function setRequestContextUser(
  tenantId: string | null,
  userId: string | null,
): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.tenantId = tenantId;
  ctx.userId = userId;
}

/**
 * Express middleware that opens an ALS scope for the rest of the
 * request lifecycle. Wins:
 *   - `tenantId` is from the JWT (filled in by JwtStrategy.validate
 *     when the route is authenticated; null otherwise)
 *   - `requestId` is the inbound `x-request-id` header if present
 *     (so traces stitch across services), else a new UUID
 *   - Echoes back as `X-Request-Id` so clients can quote it in support
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId =
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['x-correlation-id'] as string | undefined);
    const requestId = headerId?.trim() || randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const user = (req as { user?: { tenantId?: string; userId?: string } })
      .user;
    const ctx: RequestContext = {
      requestId,
      tenantId: user?.tenantId ?? null,
      userId: user?.userId ?? null,
      method: req.method,
      path: req.originalUrl ?? req.url,
    };

    storage.run(ctx, () => next());
  }
}
