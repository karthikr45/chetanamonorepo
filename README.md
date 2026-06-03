# svbkmonorepo

Monorepo for the SVBK school fee management platform.

## Layout

```
.
├── api/                       @svbk/api               NestJS — single backend (port 3001)
├── web/
│   ├── admin/                 @svbk/admin             Next.js — admin web    (port 3001 dev*)
│   ├── parent/                @svbk/parent            Next.js — parent web   (port 3002)
│   └── students/              @svbk/students          Next.js — students web (port 3003)
├── mobile/
│   ├── admin/                 @svbk/mobile-admin      Expo
│   ├── parent/                @svbk/mobile-parent     Expo
│   └── students/              @svbk/mobile-students   Expo
├── packages/                  shared libs (types, ui, api-client, configs)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

\* admin web defaults to Next.js's port 3000 in source — adjust to avoid clashing with the API on 3001.

## Why this structure

- **One folder per tier** (`api`, `web`, `mobile`) — instant mental model.
- **Each leaf is one deployable**. CI/CD targets are obvious; no nesting under a generic `apps/`.
- **`packages/`** is the only non-deployable folder — anything inside is consumed by code in `api/`, `web/*`, or `mobile/*`.
- pnpm + Turborepo handle this layout natively (see `pnpm-workspace.yaml`).
- Adding a new portal (e.g. `web/teacher`) is a folder copy.

## API design

`api/` is the **single backend** for the whole platform. Three audiences:

| Audience | Auth | Routes |
|---|---|---|
| Super-admin | password (`POST /api/auth/signin`) | tenants, tenant-configs, tenant-admins |
| Tenant admin | password (`POST /api/auth/signin`) | per-tenant CRUD: students, fees, payments, parents, announcements, … |
| Parent | OTP (`POST /api/parent/auth/send-otp` → `/verify-otp`) | `/api/parent/{me,students,dashboard,fees,payments}` |

All entities carry `tenant_id`; JWT payload includes `role` + `tenantId`; services filter by it. Parents are linked to children by **admission number** (canonical, doesn't change yearly); the current-year `Student` row is resolved via `(tenantId, admissionNumber, currentAcademicYear)`.

See `api/.env.example` for required env vars.

## Tooling

- **pnpm workspaces** for dependency management
- **Turborepo** for task orchestration and caching
- **Node 20** (see `.nvmrc`)

## Getting started

```bash
npm install -g pnpm
pnpm install
cp api/.env.example api/.env       # then edit DB_*, JWT secrets

pnpm dev                           # run all dev servers in parallel
pnpm build
```

### Run a single workspace

```bash
pnpm --filter @svbk/api dev
pnpm --filter @svbk/admin dev
pnpm --filter @svbk/parent dev
pnpm --filter @svbk/students dev
pnpm --filter @svbk/mobile-parent dev
```

## Common scripts (root)

| Script | What it does |
|---|---|
| `pnpm dev` | Run `dev` in every workspace that has it |
| `pnpm build` | Build everything |
| `pnpm lint` | Lint everything |
| `pnpm test` | Test everything |
| `pnpm typecheck` | TypeScript check across all workspaces |
| `pnpm clean` | Remove build outputs and root `node_modules` |

## Environment files

Each app keeps its own `.env`. Real `.env` files are gitignored — commit only `.env.example`.

## Sharing code via `packages/`

Recommended packages to add as the codebase grows:

| Package | Purpose |
|---|---|
| `@svbk/types` | Shared DTOs / enums between api ↔ web ↔ mobile |
| `@svbk/api-client` | Typed HTTP client (can be hand-rolled or generated from Swagger) |
| `@svbk/ui` | Shared React components (web only) |
| `@svbk/config-eslint` | Shared ESLint preset |
| `@svbk/config-tsconfig` | Base `tsconfig.json` files |

Reference any of them from an app:

```json
{ "dependencies": { "@svbk/types": "workspace:*" } }
```

Then `pnpm install`.
