import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureError } from '../../observability/sentry';
import { getRequestContext } from '../middleware/request-context.middleware';

/**
 * Catches every exception, returns a consistent error envelope, and logs
 * server-side failures with request context through Winston (Logger is
 * routed to winston-logger.service → logs/error.log). 5xx and unknown
 * errors are logged with the stack; 4xx are quieter.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let errors: string[] = [];

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || message;

        if (Array.isArray(resp.message)) {
          errors = resp.message as string[];
          message = 'Validation failed';
        }
      }
    }

    const tenantId =
      (request as any)?.user?.tenantId ??
      (request?.headers?.['x-tenant-id'] as string | undefined) ??
      'none';
    const where = `${request?.method} ${request?.originalUrl} (tenant=${tenantId})`;

    if (status >= 500) {
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${status} ${where} — ${message}`, stack);
      // Forward to Sentry with tags useful for triage. No-op when
      // SENTRY_DSN isn't configured.
      const ctx = getRequestContext();
      captureError(exception, {
        requestId: ctx?.requestId,
        route: `${request?.method} ${request?.route?.path ?? request?.originalUrl}`,
        tenantId,
        userId:
          ctx?.userId ??
          (request as { user?: { userId?: string } })?.user?.userId,
        status,
      });
    } else if (status !== HttpStatus.UNAUTHORIZED && status !== 422) {
      this.logger.warn(`${status} ${where} — ${message}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: status >= 500 ? 'Internal server error' : message,
      errors,
    });
  }
}
