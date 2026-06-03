import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { AdminsModule } from './modules/admins/admins.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenantConfigsModule } from './modules/tenant-configs/tenant-configs.module';
import { TenantAdminsModule } from './modules/tenant-admins/tenant-admins.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { StudentsModule } from './modules/students/students.module';
import { FeesModule } from './modules/fees/fees.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PenaltiesModule } from './modules/penalties/penalties.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ParentAuthModule } from './modules/parent-auth/parent-auth.module';
import { ParentPortalModule } from './modules/parent-portal/parent-portal.module';
import { SystemMetadataModule } from './modules/system-metadata/system-metadata.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReceiptTemplatesModule } from './modules/receipt-templates/receipt-templates.module';
import { SocialModule } from './modules/social/social.module';
import { StudentIdentitiesModule } from './modules/student-identities/student-identities.module';
import { PublicPayModule } from './modules/public-pay/public-pay.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    // Global rate limit: 120 req / 60s per IP. Auth + OTP endpoints
    // add stricter per-route limits via @Throttle.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    HealthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const isProd = process.env.NODE_ENV === 'production';
        // Defense in depth: even if config is bypassed, synchronize is
        // hard-off in production. Schema changes only via migrations.
        const sync = isProd
          ? false
          : (config.get<boolean>('database.sync') ?? false);

        const migrationsDir = __dirname + '/migrations';
        const hasMigrations =
          existsSync(migrationsDir) &&
          readdirSync(migrationsDir).some((f) => /\.(ts|js)$/.test(f));

        // Fail fast: a prod deploy with neither synchronize nor any
        // migration would silently come up with an empty schema.
        if (isProd && !sync && !hasMigrations) {
          throw new Error(
            'FATAL: production has synchronize disabled and no migrations. ' +
              'Generate + commit the baseline (pnpm migration:generate ' +
              'src/migrations/Init) before deploying. Refusing to start.',
          );
        }

        return {
          type: 'postgres' as const,
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [migrationsDir + '/*{.ts,.js}'],
          synchronize: sync,
          // In prod (and any non-sync env) apply pending migrations on boot.
          migrationsRun: !sync,
          logging: false,
          // Pool tuning: pg defaults to ~10 connections which exhausts
          // quickly with concurrent uploads + dashboards across tenants.
          // Override via DB_POOL_MAX / DB_POOL_MIN if needed.
          extra: {
            max: parseInt(process.env.DB_POOL_MAX ?? '30', 10) || 30,
            min: parseInt(process.env.DB_POOL_MIN ?? '5', 10) || 5,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuditModule,
    AuthModule,
    AdminsModule,
    UsersModule,
    TenantsModule,
    TenantConfigsModule,
    TenantAdminsModule,
    AcademicYearsModule,
    StudentsModule,
    FeesModule,
    ApprovalsModule,
    PaymentsModule,
    PenaltiesModule,
    TemplatesModule,
    AnnouncementsModule,
    MediaModule,
    NotificationsModule,
    ReportsModule,
    DashboardModule,
    // Parent portal — OTP login + read endpoints scoped per parent
    ParentsModule,
    ParentAuthModule,
    ParentPortalModule,
    SystemMetadataModule,
    ChatModule,
    ReceiptTemplatesModule,
    SocialModule,
    StudentIdentitiesModule,
    PublicPayModule,
  ],
  providers: [
    // Apply the rate limiter globally; per-route @Throttle/@SkipThrottle
    // tighten or loosen it where needed.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Order matters: the context middleware must run first so the
    // request logger (and everything downstream) sees the ALS scope.
    consumer
      .apply(RequestContextMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
