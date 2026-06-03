import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { winstonConfig } from './winston.config';

/**
 * Adapts the winston logger to Nest's LoggerService so the framework's
 * own logs (bootstrap, request errors, etc.) and our app logs all flow
 * through the same structured pipeline + file transports. Wired via
 * `app.useLogger()` in main.ts.
 */
export class WinstonLoggerService implements LoggerService {
  private readonly logger = winston.createLogger(winstonConfig);

  log(message: unknown, context?: string) {
    this.logger.info(this.toMessage(message), { context });
  }

  error(message: unknown, trace?: string, context?: string) {
    this.logger.error(this.toMessage(message), { trace, context });
  }

  warn(message: unknown, context?: string) {
    this.logger.warn(this.toMessage(message), { context });
  }

  debug(message: unknown, context?: string) {
    this.logger.debug(this.toMessage(message), { context });
  }

  verbose(message: unknown, context?: string) {
    this.logger.verbose(this.toMessage(message), { context });
  }

  private toMessage(m: unknown): string {
    if (typeof m === 'string') return m;
    try {
      return JSON.stringify(m);
    } catch {
      return String(m);
    }
  }
}
