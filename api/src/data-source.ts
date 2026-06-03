import 'reflect-metadata';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone TypeORM DataSource for the migration CLI (it runs outside the
 * Nest DI container, so it can't reuse ConfigService). Defaults mirror
 * src/config/configuration.ts so dev works out of the box.
 *
 * Workflow:
 *   pnpm migration:generate src/migrations/Init   # diff entities → SQL
 *   pnpm migration:run                            # apply pending
 *   pnpm migration:revert                         # roll back last
 *
 * In production the API runs pending migrations automatically on boot
 * (migrationsRun) and never auto-syncs.
 */

// Minimal .env loader — avoids a dotenv dependency for the CLI path.
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'svbk',
  entities: [join(__dirname, '/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: false,
});
