# Database Change Standards (production)

Money + student records. Treat the schema like a banking system: **no
change may lose or corrupt data, every change is reviewed, versioned,
reversible, and recoverable.**

## Hard rules (enforced in code)

1. **`synchronize` is forbidden in production.** TypeORM auto-sync drops
   columns/tables to match entities. `NODE_ENV=production` forces
   `synchronize=false`; setting `DB_SYNC=true` in prod makes the app
   **refuse to boot** (`configuration.ts`, `app.module.ts`).
2. **Schema changes only via migrations.** Prod runs pending migrations
   on boot (`migrationsRun`). A prod start with no migrations and no sync
   **fails fast** rather than come up with an empty schema.
3. **App code never runs DDL.** No `ALTER`/`DROP`/`CREATE` from services,
   `seed.ts`, or scripts. `seed.ts` is data-only and idempotent.
4. **Every migration is reversible.** Implement `down()`. A migration
   without a real `down()` is rejected in review.
5. **Backups are mandatory before every prod migration** (`db:migrate`
   takes one automatically).

## Expand → migrate → contract (no destructive change in one release)

Renaming/removing a column or table is a multi-release sequence:

| Phase | Action |
|------|--------|
| **Expand** | Add the new nullable column/table. Deploy. |
| **Backfill** | Migration copies old → new in batches; app writes both. |
| **Switch** | App reads/writes only the new shape. Deploy. Soak. |
| **Contract** | Separate later release drops the old column/table, after a verified backup and a retention window. |

Never `DROP` / destructive `ALTER TYPE` / `NOT NULL` without default in
the same release that introduces the replacement. Adding a `NOT NULL`
column requires a default or a backfilled nullable→not-null two-step.

## Authoring a change

```bash
# 1. edit the *.entity.ts files
# 2. generate the migration from the diff (review the SQL!)
pnpm migration:generate src/migrations/AddStudentDateOfAdmission
# 3. hand-write/verify down(); make data moves batched + idempotent
# 4. commit entity + migration together (CI enforces they match)
```

`down()` must restore the prior state without data loss where possible;
where a down would lose data, document it in the migration and require
explicit sign-off.

## CI guards

- **Safety lint** — `pnpm migration:lint` (static, every PR) flags
  destructive / table-locking DDL (`DROP`, type change, `RENAME`,
  `TRUNCATE`, bulk `DELETE`, `NOT NULL` without `DEFAULT`). A reviewed
  contract step opts in with a `// migration-allow: <reason>` comment.
  (SQL-only linters like `squawk` can't parse TypeScript migrations,
  so this is the TS-aware equivalent.)
- **Drift gate** — `pnpm migration:check` regenerates against a fresh
  Postgres and **fails if any entity change lacks a migration**, so
  "schema in code" can never diverge from "schema in migrations". Runs
  once the baseline exists.

## Production deployment runbook

```bash
# on the deploy host, with prod env / .env
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
bash scripts/db-migrate.sh        # backup → show → confirm → run → verify
pnpm start:prod                   # also applies pending migrations on boot
```

Rollback:

```bash
pnpm migration:revert             # reverts the last migration (uses down())
# or, last resort, restore the pre-migrate backup:
bash scripts/db-restore.sh ./backups/svbk_pre-migrate_<stamp>.dump
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/db-generate-baseline.sh` | Emit `Init` via a temp scratch DB, no Docker (`pnpm db:baseline`). |
| `scripts/lint-migrations.sh` | Static safety gate (`pnpm migration:lint`). |
| `scripts/db-backup.sh`  | Timestamped `pg_dump` (custom format); keeps last 20. |
| `scripts/db-migrate.sh` | Sanctioned prod path: backup → show → confirm → run → verify. |
| `scripts/db-restore.sh` | Restore a dump (destructive; double-confirms DB name). |

## First production deploy

Dev DBs were built by `synchronize`. Generate the baseline against a
temporary **empty scratch database** on your existing Postgres (the real
DB is never touched; no Docker needed):

```bash
pnpm db:baseline           # creates+drops a scratch DB, emits src/migrations/Init
# review the generated SQL, then:
git add src/migrations && git commit -m "db: baseline migration"
```

Until that exists, `app.module` refuses to boot in production (by
design) and the CI drift gate is skipped.
