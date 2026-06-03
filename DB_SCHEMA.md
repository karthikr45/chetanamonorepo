# Database schema

The API is **TypeORM + Postgres**. With `DB_SYNC=true` (dev default) the
schema below is created automatically on first boot. For production set
`DB_SYNC=false` and use migrations generated from these entities.

## Multi-tenant model

Every row that belongs to a school carries `tenant_id`. Every service
filters by `tenant_id` from the JWT, so tenants can never see each
other's data. The `students` table additionally carries a `school_code`
identifying the institution (shared across sibling tenants).

## Tables involved in the Students + Fees flow

```
                         ┌─────────────┐
                         │   tenants   │
                         └──────┬──────┘
                                │ 1
                                ├────────────────┐
                                │                │
                          1..N  │           1..N │
                  ┌─────────────┴────┐    ┌──────┴──────────┐
                  │ academic_years   │    │     admins      │
                  │  (per tenant)    │    │ (super/tenant)  │
                  └──────────────────┘    └─────────────────┘
                                │
                                │ 1..N (tenant_id, school_code, year, admission)
                                ▼
                         ┌─────────────┐
                         │   students  │  one row per academic year
                         └──────┬──────┘
                                │ 1
                                │ N
                                ▼
                         ┌─────────────┐
                         │    fees     │  one row per (student, term)
                         │             │  up to 5 terms
                         └──────┬──────┘
                                │ 1
                                │ N
                                ▼
                         ┌──────────────┐
                         │   payments   │  unified ledger — one row per
                         └──────────────┘  payment (online order + settled)

                         ┌─────────────┐
                         │   parents   │
                         └──────┬──────┘
                                │ 1
                                │ N
                                ▼
                         ┌──────────────────┐
                         │  parent_students │  links parent ↔ admission
                         └──────────────────┘
                         ┌─────────────┐
                         │ parent_otps │  OTP login records
                         └─────────────┘
```

## `students`

One row per **(tenant, school_code, admission_number, academic_year)**. So a
student promoted from class 7 to class 8 will have **two rows** — one
per year. The admission number is the canonical identity that doesn't
change yearly.

```sql
students
├── id                  uuid PK
├── tenant_id           uuid                       NOT NULL
├── school_code         varchar(100)               NOT NULL
├── admission_number    varchar(50)                NOT NULL
├── academic_year       varchar(20)                NOT NULL   -- "2025-2026"
├── name                varchar(150)               NOT NULL
├── email               varchar(150)               NOT NULL
├── phone_number        varchar(20)                NOT NULL
├── class               varchar(20)                NOT NULL
├── section             varchar(10)                NOT NULL
├── roll_no             varchar(20)                NOT NULL
├── img_url             text                       NULL
├── created_at          timestamptz                default now()
└── updated_at          timestamptz                default now()

UNIQUE (tenant_id, school_code, admission_number, academic_year)
       └─ uq_students_tenant_branch_admission_year
INDEX  (tenant_id, school_code, academic_year)
       └─ idx_students_tenant_branch_year
```

**Why per-year row, not just one student row?** Class/section/roll-no
all change yearly. Storing them on a per-year row keeps history
intact ("what class was Arjun in 2024-2025?") without needing a
separate `student_enrolments` table.

## `fees` (the term-fee bill)

One row per **(tenant, student_id, academic_year, term)**.
With 5 terms supported, one student in one year has up to 5 rows here.

```sql
fees
├── id                  uuid PK
├── tenant_id           uuid                       NOT NULL
├── academic_year       varchar(20)                NOT NULL
├── student_id          uuid                       NOT NULL FK → students.id
├── term                ENUM(                       NOT NULL
│                          '1st Term Fee',
│                          '2nd Term Fee',
│                          '3rd Term Fee',
│                          '4th Term Fee',
│                          '5th Term Fee')
├── original_amount     decimal(12,2)              NOT NULL  -- as uploaded
├── total_penalty       decimal(12,2)              default 0  -- sum of applied penalties
├── total_discount      decimal(12,2)              default 0  -- sibling/staff/EWS/scholarship
├── net_amount          decimal(12,2)              NOT NULL  -- original + penalty − discount
├── paid_amount         decimal(12,2)              default 0  -- sum of recognised payments.amount
├── payment_status      ENUM('UNPAID','PARTIAL','PAID')  default 'UNPAID'
├── created_at          timestamptz                default now()
└── updated_at          timestamptz                default now()

UNIQUE (tenant_id, student_id, academic_year, term)
       └─ uq_fees_tenant_student_year_term
INDEX  (tenant_id, academic_year)
       └─ idx_fees_tenant_year
INDEX  (tenant_id, payment_status)
       └─ idx_fees_tenant_status
CHECK  original_amount  >= 0
CHECK  total_penalty    >= 0
CHECK  total_discount   >= 0
CHECK  paid_amount      >= 0
```

**Derived `payment_status`:**
- `paid_amount = 0`               → `UNPAID`
- `0 < paid_amount < net_amount`  → `PARTIAL`
- `paid_amount = net_amount`      → `PAID`

(Maintained by the service when payments are recorded.)

## `payments` (the single unified ledger)

There is **one** payments table. It is both the gateway-order tracker and
the settled-payment ledger — the `fee_payments` table has been removed and
folded in here.

A row plays two roles over its lifetime:

1. **Gateway order** (online): created with `status='created'` and a
   `gateway_order_id` when checkout starts.
2. **Settled ledger entry**: once recognised it carries a `receipt_number`,
   a `method`, and (for cheque/DD) a `clearance_status`. Offline payments
   are inserted directly in this settled form. On a successful online
   payment the *same* order row is finalised — no second row is created.

A row counts as a **ledger entry** (collections, receipts, statements,
`fees.paid_amount`) exactly when **`receipt_number IS NOT NULL`** — so
`created`/`failed` orders are naturally excluded. `amount` is in **rupees**.

```sql
payments
├── id                  uuid PK
├── tenant_id           varchar                    NOT NULL
├── fee_id              uuid                       NULL   FK → fees.id (set null on fee delete)
├── payment_type        ENUM('online','offline')   default 'online'  -- channel
├── method              ENUM(                       NULL  -- concrete instrument
│                          'RAZORPAY','CASHFREE','UPI','NETBANKING','CARD',  -- online
│                          'CASH','CHEQUE','DD','POS','NEFT')                -- offline
├── gateway             ENUM('razorpay','cashfree') NULL
├── status              ENUM('created','paid','failed','refunded')  default 'created'
├── amount              decimal(12,2)              NOT NULL  -- rupees
├── currency            varchar                    default 'INR'
├── receipt_number      varchar(50)  UNIQUE        NULL   -- set when recognised
├── gateway_order_id    varchar UNIQUE             NULL
├── gateway_payment_id  varchar                    NULL
├── order_id            varchar(100)               NULL
├── transaction_id      varchar(100)               NULL
├── cheque_number       varchar(50)                NULL
├── cheque_date         date                       NULL
├── dd_number           varchar(50)                NULL
├── dd_date             date                       NULL
├── bank_name           varchar(100)               NULL
├── bank_branch         varchar(100)               NULL
├── drawer_name         varchar(150)               NULL
├── card_last4          varchar(4)                 NULL
├── clearance_status    ENUM('PENDING','CLEARED','BOUNCED','NA')  default 'NA'
├── notes               text                       NULL
├── paid_at             timestamptz                NULL
├── recorded_by         uuid                       NULL   -- admin user id (null for gateway/webhook)
├── failure_reason      text                       NULL
├── refunded_amount     decimal(12,2)              NULL
├── refunded_at         timestamptz                NULL
├── created_at          timestamptz                default now()
└── updated_at          timestamptz                default now()

UNIQUE (receipt_number)                  └─ uq_payments_receipt_number
INDEX  (tenant_id, status)
INDEX  (tenant_id, created_at)
INDEX  (tenant_id, paid_at)              └─ idx_payments_tenant_paid_at
INDEX  (tenant_id, clearance_status)     └─ idx_payments_tenant_clearance
INDEX  (fee_id)                          └─ idx_payments_fee
```

**Cheque/DD clearance:** recorded with `clearance_status='PENDING'` and a
`receipt_number`, but they do **not** add to `fees.paid_amount` until marked
`CLEARED`. `BOUNCED` reverses a previously-cleared amount.

Plus `transactions` and `payment_audit_logs` tables that record every
gateway state transition for auditing — out of scope for the students view.

## `parents` and `parent_students`

Parents log in via OTP and see only their children's data scoped by
tenant.

```sql
parents
├── id                  uuid PK
├── tenant_id           uuid                       NOT NULL
├── name                varchar(150)               NOT NULL
├── email               varchar(150)               NOT NULL
├── phone_number        varchar(20)                NULL
├── is_active           boolean                    default true
├── refresh_token_hash  varchar                    NULL
├── created_at          timestamptz
└── updated_at          timestamptz

UNIQUE (tenant_id, email)              └─ uq_parents_tenant_email
INDEX  (tenant_id)                     └─ idx_parents_tenant
```

```sql
parent_students  (link table)
├── id                  uuid PK
├── parent_id           uuid                       NOT NULL FK → parents.id (cascade on delete)
├── tenant_id           uuid                       NOT NULL
├── admission_number    varchar(50)                NOT NULL
├── relationship        ENUM('father','mother','guardian')  default 'guardian'
├── is_primary          boolean                    default false
└── created_at          timestamptz

UNIQUE (parent_id, tenant_id, admission_number)
       └─ uq_parent_students_link
INDEX  (tenant_id, admission_number)
       └─ idx_parent_students_lookup
```

**Why link by `admission_number`, not `student_id`?** `student_id`
points at a per-year row. The link is parent ↔ child, not parent ↔
year. The admission number stays constant year-over-year, so a single
link works for every year.

```sql
parent_otps
├── id                  uuid PK
├── tenant_id           uuid                       NOT NULL
├── email               varchar(150)               NOT NULL
├── otp_hash            varchar                    NOT NULL
├── expires_at          timestamptz                NOT NULL
├── is_used             boolean                    default false
└── created_at          timestamptz

INDEX  (tenant_id, email)              └─ idx_parent_otps_tenant_email
```

## Tenant + admin tables

Brief — these are the tables every other entity scopes by:

- `tenants` — one row per school. `tenantCode` (unique), `tenantName`, `medium`, `boardType`, address fields, `clientId`/`secretKey`, `isActive`.
- `tenant_configs` — per-(tenant, env) credentials: storage (S3/etc.), payment gateway keys, SMTP. Secrets live here, not in env files. Also holds branding (`logo_url`, `receipt_logo_url`, `domain_url`) and the parent-facing legal links `privacy_policy_url`, `terms_and_conditions_url`, `refund_policy_url`. The non-secret subset is served to the parent portal / public pay via `GET /parent/config?url=<window.location.href>`, which matches the host against `domain_url` and picks the row whose `environment_type` matches `APP_ENV`.
- `academic_years` — per-tenant. `(academic_year, isCurrentYear, isActive, tenantId)`. Unique on `academic_year`.
- `admins` — both super-admins and per-tenant admins. `role enum(super_admin, admin, parent)`, `tenantId` (null for super), `passwordHash`, `refreshTokenHash`.
- `users` — placeholder for non-admin user types (currently lightly used).

## What changed for the 5-term + discount upload

In the latest commits the schema gained:

| Change | Where | Effect |
|---|---|---|
| `TermType` enum extended with `'5th Term Fee'` | `fees.term` | Schools can now upload 5 terms per student per year |
| `Branch` + per-term `Discount` columns in Excel | (no DB change) | Admins can upload across branches and apply concessions in one file |
| Excel `Discount` value persisted | `fees.total_discount` | Was 0 on upload; now reflects the concession passed in Excel |
| `net_amount` recomputed on bulk-create | `fees.net_amount` | `original_amount − total_discount` instead of equal to `original_amount` |

Nothing was renamed or dropped — purely additive.

## Worked example

A school in TS uploads one Excel row for **Arjun Kumar**, 2025-2026,
Class 7-A, Roll 1, with 4 terms of ₹25,000 each and a sibling
discount of ₹2,000 on terms 1 and 2.

After the upload, the DB has:

```
students:
  1 row  — admission ADM-2024-001, year 2025-2026, class 7, section A

fees:
  4 rows — same student_id, terms 1..4
           orig=25000, discount={2000,2000,0,0}, net={23000,23000,25000,25000}
           paid_amount=0, payment_status=UNPAID

payments: (none yet)
```

After the parent pays ₹10,000 toward term 1 via Razorpay:

```
payments: 1 row — fee_id=<term1.id>, channel=online, method=RAZORPAY, status=paid,
                  amount=10000.00 (rupees), receipt_number set, clearance=NA
                  (the gateway-order row, finalised in place — no second row)
fees (term1): paid_amount=10000, payment_status=PARTIAL  (since 0 < 10000 < 23000)
```

After the parent pays the remaining ₹13,000 (a new order):

```
payments: 2 rows under term1 (each a recognised ledger entry)
fees (term1): paid_amount=23000, payment_status=PAID
```

This is what the parent web/mobile dashboard summary reflects, and
what the admin Students table shows in the per-term `Status` column.
