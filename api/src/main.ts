import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WinstonLoggerService } from './logger/winston-logger.service';
import { initSentry } from './observability/sentry';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMetadata } from './modules/system-metadata/entities/system-metadata.entity';

/**
 * Reference-data types the UI relies on. Warn (don't crash) if any are
 * empty in the DB so a fresh deploy without `pnpm seed` is loud but not
 * fatal — admin can still log in and create entries.
 */
const REQUIRED_METADATA_TYPES = [
  'academic_year',
  'class',
  'section',
  'medium',
  'board_type',
  'tenant_type',
  'admin_role',
  'term',
  'payment_status',
  'clearance_status',
  'template_status',
  'environment_type',
  'payment_gateway',
  'country',
  'state',
  'city',
];

async function checkMetadataHealth(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  try {
    const repo = app.get<Repository<SystemMetadata>>(getRepositoryToken(SystemMetadata));
    const missing: string[] = [];
    for (const type of REQUIRED_METADATA_TYPES) {
      const count = await repo.count({ where: { type } });
      if (count === 0) missing.push(type);
    }
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '\n⚠  system_metadata is missing types used by UI dropdowns:\n   ' +
          missing.join(', ') +
          "\n   Run `pnpm seed` (or add them under super-admin → System Metadata) before users hit the affected forms.\n",
      );
    }
  } catch {
    /* table might not exist yet; synchronize will catch real issues */
  }
}

async function bootstrap() {
  // Init Sentry before Nest spins up so any early-boot errors get
  // captured. No-op when SENTRY_DSN isn't set.
  await initSentry(
    process.env.SENTRY_DSN
      ? {
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          release: process.env.SENTRY_RELEASE,
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
        }
      : null,
  );

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  // Route Nest's own logs + our app logs through winston (console +
  // logs/error.log + logs/combined.log).
  app.useLogger(new WinstonLoggerService());
  const configService = app.get(ConfigService);

  // Security & performance middleware
  app.use(helmet());
  app.use(compression());

  // Behind a load balancer / reverse proxy the request IP is the LB's
  // address unless we trust the X-Forwarded-* headers — without this,
  // throttling keys on the LB IP and every tenant shares one bucket.
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  // Global prefix
  app.setGlobalPrefix('api');

  // Serve locally-stored uploads (chat-attachment disk fallback for tenants
  // without cloud storage). Registered at the raw `/uploads` path, outside
  // the `/api` prefix, matching the URLs AzureStorageService.uploadLocal mints.
  const uploadsDir =
    process.env.LOCAL_UPLOAD_DIR || join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    // helmet defaults Cross-Origin-Resource-Policy to same-origin, which would
    // stop the admin web app (different port) from loading these attachments.
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // CORS — comma-separated list in CORS_ORIGINS, or "*" to allow all (dev only)
  const corsOriginsRaw =
    configService.get<string>('CORS_ORIGINS') ?? process.env.CORS_ORIGINS ?? '';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.includes('*') || corsOrigins.length === 0
      ? true
      : corsOrigins,
    credentials: true,
  });

  // Global pipes, interceptors, filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SVBK School Fee Management API')
    .setDescription('Multi-tenant School Fee Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await checkMetadataHealth(app);

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);
  console.log(`SVBK API running on: http://localhost:${port}/api`);
  console.log(`Swagger docs at:      http://localhost:${port}/api/docs`);
}

// bufferLogs swallows output until the logger is attached, so a failure
// during NestFactory.create() would otherwise be completely silent.
// Surface it on the raw console and exit non-zero.
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: API failed to start.\n', err);
  process.exit(1);
});
