#!/usr/bin/env bash
# The ONLY sanctioned production migration path:
#   1. mandatory backup
#   2. show pending migrations (operator confirms)
#   3. apply inside a transaction (TypeORM wraps each migration)
#   4. verify none remain pending
# Usage: bash scripts/db-migrate.sh [--yes]
set -euo pipefail

cd "$(dirname "$0")/.."
AUTO="${1:-}"

echo "── Step 1/4: backup ───────────────────────────────"
bash scripts/db-backup.sh pre-migrate

echo "── Step 2/4: pending migrations ───────────────────"
pnpm --silent migration:show || true

if [ "$AUTO" != "--yes" ]; then
  read -r -p "Apply the above migrations to $(grep -E '^DB_NAME=' .env 2>/dev/null || echo DB_NAME)? [y/N] " ok
  [ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Aborted."; exit 1; }
fi

echo "── Step 3/4: applying ─────────────────────────────"
pnpm --silent migration:run

echo "── Step 4/4: verify clean ─────────────────────────"
# migration:show exits 0; assert no '[ ]' (pending) markers remain.
if pnpm --silent migration:show | grep -q '\[ \]'; then
  echo "✖  Migrations still pending after run — investigate immediately."
  exit 1
fi
echo "✔  Migration complete; schema up to date."
