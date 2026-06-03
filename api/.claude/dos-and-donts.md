---
name: SVBK API — Dos and Don'ts
description: Rules Claude must follow when working on this project
type: feedback
---

# SVBK API — Dos and Don'ts

## SECURITY — TENANT ISOLATION (CRITICAL)

**DO:**
- Always extract `tenantId` from `request.user.tenantId` (the JWT payload)
- Pass `tenantId` from `@CurrentUser()` into every service method
- Filter ALL database queries by `tenantId`
- Verify the requested resource belongs to the requesting tenant before returning it

**DON'T:**
- Never trust `tenantId` from `req.body`, `req.query`, or `req.params` for write operations
- Never return records from another tenant (even if IDs match)
- Never skip tenant filtering "for speed" — it is a hard security requirement

**Exception:** `super_admin` role may pass `tenantId` as a query param (for cross-tenant admin operations).

---

## AUTHENTICATION

**DO:**
- Use `@UseGuards(JwtAuthGuard)` on all protected routes
- Use `@UseGuards(JwtAuthGuard, RolesGuard)` when roles also need enforcing
- Use `@CurrentUser()` decorator to access the authenticated user
- Use `@Roles(Role.X, Role.Y)` to restrict routes to specific roles
- Hash passwords with `bcrypt` (salt rounds: 10)
- Return both `accessToken` and `refreshToken` on login

**DON'T:**
- Never store plain-text passwords
- Never put sensitive data in the JWT payload (no passwords, no secrets)
- Never expose the refresh secret in logs or responses
- Never skip `@UseGuards` on routes that touch tenant data

---

## API DESIGN

**DO:**
- Keep global prefix `/api` — all routes are under `/api/...`
- Use RESTful conventions: GET (list), GET/:id (detail), POST (create), PATCH/:id (partial update), DELETE/:id (remove)
- Document every controller with `@ApiTags()`
- Document every protected controller with `@ApiBearerAuth()`
- Document every DTO field with `@ApiProperty()`
- Return consistent response shape via `TransformInterceptor`

**DON'T:**
- Don't create routes outside the `/api` prefix
- Don't return raw TypeORM entities with sensitive fields (passwords, tokens)
- Don't put business logic in controllers — keep controllers thin, logic in services
- Don't bypass `ValidationPipe` — always use DTOs with `class-validator` decorators

---

## DATABASE

**DO:**
- Use TypeORM entities with `@Entity()` decorator
- Use TypeORM repositories injected via `@InjectRepository()`
- Use `DB_SYNC=true` in dev only; switch to migrations for production
- Use snake_case for table/column names (`@Entity('academic_years')`)

**DON'T:**
- Don't write raw SQL unless absolutely necessary
- Don't use `synchronize: true` in production
- Don't create new migrations manually — use `typeorm migration:generate`
- Don't share database connections across tenants (use row-level tenant isolation)

---

## CODE STYLE

**DO:**
- Use `async/await` consistently
- Prefix unused parameters with `_` (e.g., `_dto`, `_user`)
- Keep services focused: one service per module
- Use `class-validator` decorators on all DTO fields
- Use `class-transformer` with `@Exclude()` to hide sensitive entity fields

**DON'T:**
- Don't use `any` type unless it's a genuine placeholder marked with TODO
- Don't add speculative abstractions — implement what is needed now
- Don't add error handling for impossible cases
- Don't add `console.log` debug statements in production code

---

## MODULES

**DO:**
- Export services that other modules need
- Import `TypeOrmModule.forFeature([Entity])` in the module that owns the entity
- Keep each module self-contained

**DON'T:**
- Don't import `TypeOrmModule.forRoot()` in feature modules (only in `AppModule`)
- Don't circular-import modules — use events or shared services

---

## PAYMENTS (Razorpay)

**DO:**
- Verify Razorpay webhook signatures before processing
- Store `razorpayOrderId`, `razorpayPaymentId`, and payment status in the DB
- Use idempotency — never process the same payment twice

**DON'T:**
- Never trust client-side payment confirmations without server-side verification
- Never log full Razorpay webhook payloads (may contain sensitive data)

---

## FILE UPLOADS (Cloudinary)

**DO:**
- Upload files to Cloudinary via the server — never give clients direct upload credentials
- Store the Cloudinary URL and `public_id` in the `media` table
- Validate file type and size with Multer before uploading

**DON'T:**
- Don't store binary file data in the database
- Don't expose Cloudinary API keys in client responses
