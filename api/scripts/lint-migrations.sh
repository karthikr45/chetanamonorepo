#!/usr/bin/env bash
# Migration safety gate (static; no DB needed).
#
# TypeORM migrations are TypeScript, so SQL-only linters like `squawk`
# can't parse them. This enforces the expand→contract policy by flagging
# destructive / table-locking statements. A migration that genuinely
# needs one opts in with a line containing:
#     migration-allow: <reason>
# which records the deliberate, reviewed exception.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="src/migrations"
shopt -s nullglob
files=("$DIR"/*.ts)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migrations yet — nothing to lint."
  exit 0
fi

# regex<TAB>human reason — simple POSIX ERE, no lookaheads.
PATTERNS=(
  'DROP[[:space:]]+TABLE	drops a table (data loss)'
  'DROP[[:space:]]+COLUMN	drops a column (data loss)'
  'ALTER[[:space:]]+COLUMN.*[[:space:]]TYPE[[:space:]]	destructive column type change'
  'RENAME[[:space:]]+(TO|COLUMN)	rename breaks parallel-change'
  'TRUNCATE[[:space:]]	truncates a table'
  'DELETE[[:space:]]+FROM	bulk delete inside a migration'
)

fail=0
for f in "${files[@]}"; do
  base="$(basename "$f")"
  if grep -qiE 'migration-allow:' "$f"; then
    echo "• ${base}: reviewed exception (migration-allow) — skipped"
    continue
  fi
  for entry in "${PATTERNS[@]}"; do
    rx="${entry%%	*}"; why="${entry#*	}"
    hits="$(grep -niE "$rx" "$f" || true)"
    if [ -n "$hits" ]; then
      echo "✖ ${base}: ${why}"
      echo "$hits" | sed 's/^/    /'
      fail=1
    fi
  done
  # NOT NULL column without a DEFAULT: locks the table and fails on
  # existing rows. Flag lines that add NOT NULL but have no DEFAULT.
  nn="$(grep -niE 'ADD[[:space:]]+COLUMN.*NOT[[:space:]]+NULL' "$f" \
        | grep -viE 'DEFAULT' || true)"
  if [ -n "$nn" ]; then
    echo "✖ ${base}: NOT NULL column without DEFAULT (locks + fails on existing rows)"
    echo "$nn" | sed 's/^/    /'
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "Destructive migration(s) detected. Use expand→backfill→contract."
  echo "If this is a deliberate, reviewed contract step, add a comment:"
  echo "    // migration-allow: <ticket / reason>"
  exit 1
fi
echo "✔  Migrations pass the safety gate."
