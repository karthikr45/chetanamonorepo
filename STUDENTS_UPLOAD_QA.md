# Students bulk upload — QA cases

The Excel/CSV upload is **insert-only**. To change an existing fee
record, edit it from the Students table — the upload pipeline will
never overwrite a row.

## Expected behaviours

### Row format

| Case | Expected | Notes |
|---|---|---|
| Row missing `Academic Year`, `ADMISSION`, `NAME`, `e-mail`, `Phone number`, `Class`, `Section` or `Roll No` | Row rejected with `<field>: required` | All identity fields are required |
| `e-mail` not a valid email | `e-mail: invalid format` | |
| `Phone number` not 7–15 digits with optional leading `+` | `Phone number: must be 7–15 digits, optional leading +` | |
| `Academic Year` not in `YYYY-YYYY` format | `Academic Year: must be in YYYY-YYYY format` | |
| `Academic Year` end ≠ start + 1 | `Academic Year: end year must be start year + 1` | |
| Row has **no term column** populated | `Term Fee: at least one term fee column must be set` | Empty term row makes no sense |
| `Nth Term Fee` set but ≤ 0 | `Nth Term Fee: must be a positive number` | |
| `Nth Term Discount` < 0 | `Nth Term Discount: must be a non-negative number` | |
| `Nth Term Discount` > `Nth Term Fee` | `Nth Term Discount: discount (X) exceeds fee (Y)` | |
| Row has **only Term 1** populated | ✅ Inserts one Fee record for Term 1 | Partial-term uploads are fine |
| Row has Term 1 + Term 3 populated | ✅ Inserts two Fee records | |
| Row has all 5 terms populated | ✅ Inserts five Fee records | |
| One row mixes valid + invalid term values | Whole row rejected | Atomic: either the row commits or none of it does |

### School-code scoping

| Case | Expected |
|---|---|
| Any upload | All rows are stored under the tenant's own `school_code` (the tenant's `tenantCode`) |
| Excel `Code` column value differs from the tenant code | Ignored — the value is overridden with the tenant's code |

### Duplicate prevention (the core insert-only contract)

| Case | Expected |
|---|---|
| Excel row 5 and row 12 have the **same admission, year, term** | Both rejected: `Duplicate within file: Nth Term Fee for admission … (year) appears more than once — keep only one row per term` |
| Excel adds Term 1 for admission `ADM-001 / 2025-2026` that **already has a Term 1 in DB** | ❌ `1st Term Fee already exists for admission ADM-001 (2025-2026). Excel is insert-only — to change an existing fee, edit it from the Students table.` |
| Excel adds Term 2 for admission `ADM-001 / 2025-2026` where only Term 1 exists in DB | ✅ accepted (different term) |
| Excel re-uploads a previously-uploaded row | ❌ blocked by the same "already exists" check |
| Same admission, **different academic year** (e.g. `2024-2025` had Term 1, now uploading `2025-2026` Term 1) | ✅ accepted (year is part of the dedup key) |
| Row has Terms 1 + 2 + 3, where Term 1 already exists in DB | Whole row rejected — atomic. Admin should remove the offending term column for that row and re-upload. |

### Confirm step (after a successful validate)

| Case | Expected |
|---|---|
| Validate returns `errorCount > 0`, admin clicks Confirm anyway | API returns 400 / refuses to commit; only valid rows are persisted in a successful confirm |
| File is re-uploaded between validate and confirm with extra rows | API re-runs validation on the new file; the previously-validated rows aren't trusted (server is stateless) |
| Concurrent confirm by another admin lands first | Postgres unique constraint kicks in → API returns `409 Conflict` with "concurrent upload has already saved some of these records. Please re-validate and try again." |

### File-level edges

| Case | Expected |
|---|---|
| File > 20 MB | `MAX_UPLOAD_SIZE_BYTES` exceeded → 413 |
| File has > 10,000 rows | `MAX_UPLOAD_ROWS` exceeded → 400 |
| File is `.csv` | Parser handles both `.xlsx` and `.csv` |
| Empty file (only headers) | Validate returns `totalRows: 0`, no error, no commit |
| File missing a required column header | Header-level error before row validation runs |
| Cell formatted as text but containing a number | Parser coerces numerics for fee/discount columns |

### Auth + scoping

| Case | Expected |
|---|---|
| Unauthenticated download of `/students/upload/template` | 401 |
| Tenant admin downloads template | Excel includes 5 sample rows + Instructions sheet |
| Super-admin uploads to a tenant they don't admin | Blocked at JWT level; `tenantId` is read from token |
| Two tenants happen to use the same admission number | Each lives in their own tenant; uniqueness is `(tenant_id, school_code, admission_number, academic_year)` |

## What the admin sees in the UI

After clicking **Upload Excel**:

1. The file is sent to `POST /api/students/upload/validate`; scope is
   taken from the JWT (`tenantId`).
2. The response shows total / valid / error counts. Each errored row
   carries a human-readable message (see tables above).
3. If everything is valid (or the admin chooses to skip the bad rows),
   they confirm — `POST /api/students/upload/confirm` re-runs validation
   server-side and writes only the valid rows in a single transaction.
4. The Students table refreshes; new rows appear with status `UNPAID`
   and `paid_amount = 0`. Discount + net amount reflect the Excel.

## Edit existing records (UI only — never via Excel)

Once a fee exists, Excel will refuse to insert it again. The next
round will add inline editing on the Students table for these fields:

- `original_amount` (rare, but possible after fee revision)
- `total_discount` (concession changes mid-year)
- Recording an offline payment (cash/cheque/DD/NEFT)

Currently those flows live on the legacy view (accessible via the
"Legacy view" link at the top of the Students table).
