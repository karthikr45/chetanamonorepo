import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * One structured line per request: method, path, status, duration,
 * tenant (if authed). Skips health-check noise.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    if (req.originalUrl === '/api/healthz' || req.originalUrl === '/healthz') {
      return next();
    }
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const user = (req as any).user;
      const tenant = user?.tenantId ? ` tenant=${user.tenantId}` : '';
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${tenant}`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
