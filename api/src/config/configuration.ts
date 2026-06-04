// In production, refuse to boot with unsafe defaults. In dev, fall back to
// values that work against a local Postgres so contributors can run the app
// out of the box.
const isProd = process.env.NODE_ENV === 'production';

/**
 * Banking-grade rule: TypeORM `synchronize` is destructive (it will drop
 * columns/tables to match entities) and is FORBIDDEN in production.
 * Schema in prod changes only via reviewed, versioned migrations. We
 * refuse to boot rather than silently risk data loss.
 */
function resolveDbSync(): boolean {
  const requested = process.env.DB_SYNC === 'true';
  if (requested && isProd) {
    throw new Error(
      'FATAL: DB_SYNC=true is not allowed when NODE_ENV=production. ' +
        'Auto-synchronize can drop columns and lose data. Use migrations ' +
        '(pnpm migration:run). Refusing to start.',
    );
  }
  return requested && !isProd;
}

function required(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (isProd) {
    throw new Error(
      `Environment variable ${name} is required in production. Refusing to boot with default value.`,
    );
  }
  return devDefault;
}

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3001', 10) || 3001,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: required('DB_PASSWORD', 'postgres'),
    name: process.env.DB_NAME || 'svbk',
    sync: resolveDbSync(),
  },
  jwt: {
    secret: required('JWT_SECRET', 'dev-only-jwt-secret-do-not-use-in-prod'),
    // Access tokens are short-lived (15m); refresh tokens carry the
    // long session (7d). Match auth.module.ts fallback to avoid drift.
    expiresIn: process.env.JWT_EXPIRES_IN || 900, // seconds
    refreshSecret: required(
      'JWT_REFRESH_SECRET',
      'dev-only-jwt-refresh-secret-do-not-use-in-prod',
    ),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || 604800, // seconds
  },
  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES ?? '5', 10) || 5,
  },
  auth: {
    lockoutMaxAttempts:
      parseInt(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS ?? '5', 10) || 5,
    lockoutMinutes:
      parseInt(process.env.AUTH_LOCKOUT_MINUTES ?? '15', 10) || 15,
    requireEmailVerification:
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SVBK <no-reply@svbk.edu.in>',
    allowInsecure: process.env.SMTP_ALLOW_INSECURE === 'true',
  },
  demoMode: process.env.DEMO_MODE === 'true',
  // NOTE: Razorpay and Cashfree credentials are NOT platform-level any more —
  // each tenant stores its own gateway keys in TenantConfig. See
  // PaymentsService.credsForTenant + GET /tenant-configs/active-payment.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
});
