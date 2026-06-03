import * as winston from 'winston';
import { getRequestContext } from '../common/middleware/request-context.middleware';

const { combine, timestamp, colorize, printf, json } = winston.format;

/**
 * Per-line enrichment — stamps the active request's `requestId` +
 * `tenantId` + `userId` onto every winston log line. Outside a
 * request scope (boot logs, cron jobs) the fields are null and the
 * console format omits them.
 */
const enrichWithRequestContext = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.requestId = ctx.requestId;
    info.tenantId = ctx.tenantId;
    info.userId = ctx.userId;
  }
  return info;
});

const consoleFormat = combine(
  enrichWithRequestContext(),
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ timestamp, level, message, context, trace, requestId, tenantId }) => {
    const ids = requestId
      ? ` [req=${String(requestId).slice(0, 8)} tenant=${tenantId ?? 'none'}]`
      : '';
    return `[${timestamp}] [${level}]${context ? ` [${context}]` : ''}${ids} ${message}${trace ? `\n${trace}` : ''}`;
  }),
);

const fileFormat = combine(enrichWithRequestContext(), timestamp(), json());

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
    }),
  ],
};
