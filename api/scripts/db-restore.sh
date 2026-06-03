#!/usr/bin/env bash
# Restore a logical backup produced by db-backup.sh.
# Usage: bash scripts/db-restore.sh <path-to.dump>
# DESTRUCTIVE: overwrites the target database. Requires explicit confirm.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
: "${DB_HOST:=localhost}" "${DB_PORT:=5432}" "${DB_USERNAME:=postgres}" "${DB_NAME:=svbk}"

DUMP="${1:-}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "Usage: db-restore.sh <file.dump>"; exit 1; }

echo "!!  This will OVERWRITE ${DB_NAME}@${DB_HOST}:${DB_PORT} from:"
echo "    ${DUMP}"
read -r -p "Type the database name to confirm: " confirm
[ "$confirm" = "$DB_NAME" ] || { echo "Mismatch. Aborted."; exit 1; }

PGPASSWORD="${DB_PASSWORD:-}" pg_restore \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges "$DUMP"

echo "✔  Restore complete from ${DUMP}"
