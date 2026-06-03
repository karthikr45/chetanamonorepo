# End-to-end testing guide

This walks you through bringing the platform up locally and exercising
the **admin → parent OTP login → parent dashboard** flow.

## Ports

| Service | Port |
|---|---|
| `api` (NestJS) | **3001** |
| `web/admin` (Next.js) | **3000** |
| `web/parent` (Next.js) | **3002** |
| `web/students` (Next.js) | **3003** |
| Postgres | 5432 |

## 1. Prereqs

- Node ≥ 20 (`.nvmrc`)
- pnpm: `npm i -g pnpm`
- Postgres running locally with a database (default name `svbk`)

## 2. Install + env

```bash
git pull
pnpm install

cp api/.env.example api/.env
cp web/admin/.env.example web/admin/.env.local
cp web/parent/.env.example web/parent/.env.local
```

Edit `api/.env`:

```ini
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<your_postgres_password>
DB_NAME=svbk
DB_SYNC=true             # creates tables on first boot

JWT_SECRET=local_jwt_secret
JWT_REFRESH_SECRET=local_refresh_secret

DEMO_MODE=true           # any 6-digit OTP is accepted, OTPs logged to console
```

## 3. Start services

In three separate terminals:

```bash
# 1. API
pnpm --filter @svbk/api start:dev
# → http://localhost:3001/api  (Swagger at /api/docs)

# 2. Admin web
pnpm --filter @svbk/admin dev
# → http://localhost:3000

# 3. Parent web
pnpm --filter @svbk/parent dev
# → http://localhost:3002
```

On first API boot, TypeORM will create all tables, including the new
`parents`, `parent_students`, and `parent_otps` tables.

### Mobile parent (Expo)

```bash
cd mobile/parent
pnpm install         # already done by root install
pnpm dev             # Expo dev server; press i for iOS sim or scan QR with Expo Go
```

If you run on a real device, change `apiBaseUrl` in `mobile/parent/app.json`
from `http://localhost:3001/api` to your machine's LAN IP (e.g.
`http://192.168.1.5:3001/api`) so the device can reach your local API.

## 4. Seed the demo dataset (one command)

```bash
pnpm --filter @svbk/api seed
```

This creates the full chain in one shot — idempotent, safe to re-run:

| # | Entity | Value |
|---|---|---|
| 1 | Super-admin | `superadmin@svbk.com` / `Admin@123` |
| 2 | Tenant | `SVBK_HYD` (Sri Venkateswara Bala Kuteer) |
| 3 | Tenant admin | `admin@svbk.com` / `Admin@123` |
| 4 | Academic year | `2025-2026` (set as current) |
| 5 | Sample student | `Arjun Kumar` — admission `ADM-2024-001`, class 7-A |
| 6 | Term fees | 4 unpaid fees of ₹25,000 each |
| 7 | Parent | `parent@svbk.com` linked to that admission |

After this you can immediately:
- Log in to admin web with `superadmin@svbk.com` or `admin@svbk.com`
- Log in to parent web with `parent@svbk.com` (DEMO_MODE accepts any 6-digit OTP)

The old per-step manual setup is kept below for reference if you want
to bypass the seed.

## 4b. Manual data creation (alternative to the seed)

You need at least:

1. A super-admin (so you can log into the admin web)
2. A tenant
3. A tenant admin
4. An academic year (with `isCurrentYear: true`)
5. A student row for that tenant + branch + admission_number + academic_year
6. A parent linked to that admission

If your `api/src/seed.ts` already populates 1–4, run it:

```bash
pnpm --filter @svbk/api seed
```

Otherwise, hit the endpoints from Swagger (`http://localhost:3001/api/docs`).
You'll need to log in as super-admin first to create tenants.

### Create a parent (admin login required)

```bash
# 1. Log in as admin
curl -X POST http://localhost:3001/api/auth/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"<password>"}'
# → copy accessToken from the response

# 2. Create the parent and link to a child's admission number
curl -X POST http://localhost:3001/api/parents \
  -H 'Authorization: Bearer <admin-access-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Ramesh Kumar",
    "email": "parent@test.com",
    "phoneNumber": "+91-9876543210",
    "students": [
      {
        "branch": "Main Branch",
        "admissionNumber": "ADM-2024-001",
        "relationship": "father",
        "isPrimary": true
      }
    ]
  }'
```

## 5. Parent flow (the new feature)

1. Open `http://localhost:3002` → redirects to `/login`.
2. Enter `parent@test.com` → click **Send OTP**.
3. With `DEMO_MODE=true`, check the API terminal — you'll see:
   ```
   [OTP] parent@test.com → 123456  (demo / no SMTP — email not sent)
   ```
   You can enter that code, or **any 6 digits** — both work in demo mode.
4. After verification, you're redirected to `/dashboard`. You should see:
   - The parent's name + email in the sidebar
   - The linked child(ren) listed
   - Fee summary cards (Total Paid / Due / Penalty)
   - Per-term fee cards for the selected child

If a parent has no fees yet, the dashboard says "No fees yet" — create
fees as the admin (`POST /api/fees` or via the Excel upload) and reload.

### Pay a fee (online)

On the dashboard, every unpaid fee card has **Pay via Razorpay** /
**Pay via Cashfree** buttons. They call `POST /api/parent/payments` with
`{ feeId, gateway }`. The server creates a payment + transaction row,
then asks the gateway to create an order. The button shows the resulting
gateway order id. Plugging in the gateway SDK to actually charge the
card is the last step (Razorpay Checkout / Cashfree Drop-in) — wired the
same way as the existing admin pay-now flow in `web/admin/src/app/(main)/pay-now`.

### Manage parents from the admin UI

Open `http://localhost:3000/parents` (after admin login). You can:
- Create a parent and link to one or more children by `(branch, admissionNumber)`.
- See the list of parents in the current tenant.
- Delete a parent (cascades to their student links).

## 6. Verify multi-tenant isolation

Repeat step 4 with **a second tenant**, creating another parent with the
**same email** (`parent@test.com`). The send-OTP call will respond with
`409 Conflict` and ask for `tenantCode`. Pass the right `tenantCode` in
the body and you should only see children for that tenant — never the
other one's.

## 7. Disable demo mode (real OTP email)

In `api/.env`:

```ini
DEMO_MODE=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<app-password>
SMTP_FROM=SVBK <no-reply@your-domain>
```

Restart the API. Now OTPs are emailed via nodemailer.

## 8. Production switches

Before deploying, change at minimum:

- `DB_SYNC=false` (use migrations instead — TypeORM `synchronize` is dev-only)
- `JWT_SECRET` and `JWT_REFRESH_SECRET` to long random strings
- `DEMO_MODE=false`
- Set real `SMTP_*` and `RAZORPAY_*` / `CASHFREE_*` keys
- Lock CORS in `api/src/main.ts` (currently `origin: true`) to your real domains
