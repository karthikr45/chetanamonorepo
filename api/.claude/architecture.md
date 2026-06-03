---
name: SVBK API — Architecture Notes
description: Key architectural decisions, patterns, and constraints
type: project
---

# SVBK API — Architecture Notes

## Request Flow

```
Client (Next.js)
  → POST /api/auth/login  →  LocalStrategy (validates email+password)
                          →  AuthService.login()  →  JWT access + refresh tokens

Client
  → GET /api/students     →  JwtAuthGuard (verifies Bearer token)
                          →  JwtStrategy (attaches user to request)
                          →  RolesGuard (checks role from JWT)
                          →  StudentsController.findAll()
                          →  StudentsService.findAll(user.tenantId)
                          →  DB query filtered by tenantId
                          →  TransformInterceptor wraps response
```

## Response Envelope

Every successful response is wrapped by `TransformInterceptor`:
```json
{ "success": true, "data": <payload>, "message": "OK" }
```

Every error is standardised by `HttpExceptionFilter`:
```json
{ "success": false, "statusCode": 400, "message": "...", "errors": [] }
```

## JWT Payload Shape

```ts
{
  sub: string,        // userId
  email: string,
  role: string,       // one of Role enum values
  tenantId: string | null   // null for super_admin
}
```

## Tenant Isolation Pattern

Every service method that reads/writes tenant data must:
1. Accept `tenantId: string` as its first parameter
2. That `tenantId` must come from `request.user.tenantId` (JWT), never from client input
3. Always include `WHERE tenantId = :tenantId` in queries

```ts
// CORRECT
async findAll(tenantId: string) {
  return this.repo.find({ where: { tenantId } });
}

// WRONG — never trust body tenantId
async findAll(dto: any) {
  return this.repo.find({ where: { tenantId: dto.tenantId } });
}
```

## Module Dependency Graph

```
AppModule
  ├── ConfigModule (global)
  ├── TypeOrmModule (global)
  ├── AuthModule
  │     └── UsersModule (imported for LocalStrategy)
  ├── UsersModule
  ├── TenantsModule
  ├── TenantConfigsModule
  ├── TenantAdminsModule
  │     └── UsersModule (thin wrapper)
  ├── AcademicYearsModule
  ├── StudentsModule
  ├── FeesModule
  ├── PaymentsModule
  ├── PenaltiesModule
  ├── TemplatesModule
  ├── AnnouncementsModule
  ├── MediaModule
  ├── NotificationsModule
  ├── ReportsModule        (no entity — aggregates)
  └── DashboardModule      (no entity — aggregates)
```

## Naming Conventions

| Layer       | Pattern                        | Example                         |
|-------------|--------------------------------|---------------------------------|
| Entity      | PascalCase, singular           | `AcademicYear`                  |
| Table       | snake_case, plural             | `academic_years`                |
| Service     | `<Module>Service`              | `AcademicYearsService`          |
| Controller  | `<Module>Controller`           | `AcademicYearsController`       |
| Module      | `<Module>Module`               | `AcademicYearsModule`           |
| DTO         | `Create<Module>Dto`            | `CreateAcademicYearDto`         |
| Route       | kebab-case                     | `/api/academic-years`           |

## File Structure per Module

```
modules/<name>/
├── <name>.module.ts
├── <name>.controller.ts
├── <name>.service.ts
├── entities/
│   └── <name>.entity.ts
└── dto/
    ├── create-<name>.dto.ts
    └── update-<name>.dto.ts
```

Strategies go in:
```
modules/auth/strategies/
├── local.strategy.ts
└── jwt.strategy.ts
```
