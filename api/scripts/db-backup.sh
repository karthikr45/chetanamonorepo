#!/usr/bin/env bash
# Timestamped logical backup. MANDATORY before every production migration.
# Usage: bash scripts/db-backup.sh [label]
#   Reads DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME from env or .env.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

: "${DB_HOST:=localhost}" "${DB_PORT:=5432}" "${DB_USERNAME:=postgres}" "${DB_NAME:=svbk}"
LABEL="${1:-manual}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${DB_BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/${DB_NAME}_${LABEL}_${STAMP}.dump"

echo "▶  Backing up ${DB_NAME}@${DB_HOST}:${DB_PORT} → ${OUT}"
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" \
  --format=custom --no-owner --no-privileges -f "$OUT"

# Keep the 20 most recent backups; never auto-delete more aggressively.
ls -1t "$OUT_DIR"/*.dump 2>/dev/null | tail -n +21 | xargs -r rm -f

echo "✔  Backup complete: ${OUT}"
echo "   Restore with: bash scripts/db-restore.sh ${OUT}"
