#!/usr/bin/env bash
# Generate the baseline (Init) migration safely — NO Docker.
#
#   pnpm db:baseline
#
# Creates a temporary EMPTY scratch database on the Postgres you already
# run (from .env / env), lets TypeORM diff the entities against it to
# emit a full-schema migration into src/migrations/, then DROPS the
# scratch DB. Your real database is never touched.
#
# Requires the psql client on PATH and a reachable Postgres.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

: "${DB_HOST:=localhost}" "${DB_PORT:=5432}" "${DB_USERNAME:=postgres}" "${DB_NAME:=svbk}"
NAME="${1:-Init}"
SCRATCH="${DB_NAME}_baseline_$$"
export PGPASSWORD="${DB_PASSWORD:-}"
ADMIN=( psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -v ON_ERROR_STOP=1 -tAc )

[ "$SCRATCH" = "$DB_NAME" ] && { echo "✖  scratch == real db; aborting"; exit 1; }

cleanup() {
  "${ADMIN[@]}" "DROP DATABASE IF EXISTS \"$SCRATCH\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▶  Creating empty scratch DB \"$SCRATCH\" on $DB_HOST:$DB_PORT …"
"${ADMIN[@]}" "CREATE DATABASE \"$SCRATCH\"" >/dev/null

echo "▶  Generating src/migrations/$NAME from entities …"
DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USERNAME="$DB_USERNAME" \
  DB_PASSWORD="${DB_PASSWORD:-}" DB_NAME="$SCRATCH" \
  pnpm --silent typeorm migration:generate "src/migrations/$NAME"

echo
echo "✔  Done (scratch DB dropped). Review the SQL, then:"
echo "     git add src/migrations && git commit -m 'db: baseline migration'"
