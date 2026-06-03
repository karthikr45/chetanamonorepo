---
name: SVBK API — Project Scope
description: What this project is, what modules exist, and what is in/out of scope
type: project
---

# SVBK API — Project Scope

## What is SVBK?

SVBK is a **multi-tenant School Fee Management System**.
- Backend: NestJS + TypeScript + PostgreSQL (this repo)
- Frontend: Next.js (separate repo, served at `CLIENT_URL`)
- Tenants are individual schools/campuses — each tenant's data is fully isolated

---

## Tech Stack

| Concern            | Technology                          |
|--------------------|-------------------------------------|
| Framework          | NestJS 11 (TypeScript)              |
| Database           | PostgreSQL via TypeORM              |
| Auth               | JWT (access 15m + refresh 7d) + Passport |
| Validation         | class-validator + class-transformer |
| File uploads       | Multer + Cloudinary                 |
| Payments           | Razorpay                            |
| API docs           | Swagger at `/api/docs`              |
| Config             | @nestjs/config + `.env`             |

---

## Roles

```
super_admin       — cross-tenant, full access
tenant_admin      — full access within their tenant
finance_admin     — fee/payment management within tenant
principal         — read access + announcements within tenant
operations_admin  — student/admission management within tenant
it_admin          — system config within tenant
staff             — limited read access within tenant
```

---

## Modules (all under `/api`)

| Module            | Path                     | Status        | Notes                              |
|-------------------|--------------------------|---------------|------------------------------------|
| auth              | /api/auth                | Implemented   | login, refresh, logout, me         |
| users             | /api/users               | Stub          | Base user model                    |
| tenants           | /api/tenants             | Stub          | School/campus records              |
| tenant-configs    | /api/tenant-configs      | Stub          | Per-tenant settings                |
| tenant-admins     | /api/tenant-admins       | Stub          | Thin wrapper over users            |
| academic-years    | /api/academic-years      | Stub          | Academic year management           |
| students          | /api/students            | Stub          | Student records                    |
| fees              | /api/fees                | Stub          | Fee structures                     |
| payments          | /api/payments            | Stub          | Razorpay integration               |
| penalties         | /api/penalties           | Stub          | Late payment penalties             |
| templates         | /api/templates           | Stub          | Email/receipt templates            |
| announcements     | /api/announcements       | Stub          | School-wide announcements          |
| media             | /api/media               | Stub          | File uploads via Cloudinary        |
| notifications     | /api/notifications       | Stub          | In-app notifications               |
| reports           | /api/reports             | Stub          | Aggregated reports (no entity)     |
| dashboard         | /api/dashboard           | Stub          | Dashboard metrics (no entity)      |

---

## Global Setup

- All routes prefixed with `/api`
- Swagger docs at `/api/docs` (BearerAuth enabled)
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform)
- Global `TransformInterceptor` → `{ success, data, message }`
- Global `HttpExceptionFilter` → `{ success, statusCode, message, errors[] }`
- CORS enabled for `CLIENT_URL`
- `helmet` + `compression` middleware

---

## Environment Variables

All env vars are in `.env` and centralised in `src/config/configuration.ts`.
Key vars: `PORT`, `DB_*`, `JWT_*`, `RAZORPAY_*`, `CLOUDINARY_*`, `CLIENT_URL`

---

## What is NOT in scope (yet)

- WebSockets / real-time notifications
- Email sending (SMTP integration)
- SMS / WhatsApp notifications
- Mobile app API differences
- Multi-currency support
- Role permissions beyond the 7 defined roles
- Database migrations (using `DB_SYNC=true` in dev)

---

## Current Phase

All 16 modules are scaffolded (entities empty, DTOs empty, service/controller stubs).
Next phase: implement entities with full column definitions, then implement service logic module by module.

**Implementation order recommended:**
1. Users entity + service (needed by auth)
2. Tenants entity + service
3. Auth login flow (end-to-end test)
4. Academic years
5. Students
6. Fees + Payments
7. Penalties, Reports, Dashboard

---

## Seeding

Run `npm run seed` to create:
- Super admin: `superadmin@svbk.com` / `Admin@123`
- Sample tenant: `Sunrise High School` (TNT001)
- Tenant admin: `admin@sunrise.com` / `Admin@123`
