#!/usr/bin/env bash
# Bootstrap database & role for GIIS Grade 6 Cashier app.
# Secrets are read from the credential file at runtime; nothing is hardcoded here.
# Usage: ./scripts/db-bootstrap.sh [postgres-container-name]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRED_FILE="${CRED_FILE:-$ROOT_DIR/.credential.txt}"
PG_CONTAINER="${1:-postgres-15}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"

[ -f "$CRED_FILE" ] || { echo "ERROR: credential file not found: $CRED_FILE" >&2; exit 1; }

read_cred() {
  node "$ROOT_DIR/scripts/parse-credential.js" "$CRED_FILE" "$1"
}

DB_NAME="$(read_cred 'db')"
DB_USER="$(read_cred 'user db')"
DB_PASS="$(read_cred 'pass db')"

[ -n "$DB_NAME" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASS" ] \
  || { echo "ERROR: could not parse db / user db / pass db from $CRED_FILE" >&2; exit 1; }

echo "Bootstrapping role/db on container '$PG_CONTAINER': $DB_USER @ $DB_NAME"

# CREATE ROLE / CREATE DATABASE cannot run inside a transaction block, hence \gexec.
docker exec -i "$PG_CONTAINER" psql -U "$PG_SUPERUSER" -v ON_ERROR_STOP=1 \
  -v db_name="$DB_NAME" -v db_user="$DB_USER" -v db_pass="$DB_PASS" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user') \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_pass') \gexec

SELECT format('CREATE DATABASE %I OWNER %I ENCODING %L', :'db_name', :'db_user', 'UTF8')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') \gexec

SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'db_name', :'db_user') \gexec

-- CREATEDB is required by `prisma migrate dev` to build its shadow database.
SELECT format('ALTER ROLE %I CREATEDB', :'db_user') \gexec
SQL

# Schema-level privileges (PG15 no longer grants CREATE on public to everyone).
docker exec -i "$PG_CONTAINER" psql -U "$PG_SUPERUSER" -v ON_ERROR_STOP=1 \
  -d "$DB_NAME" -v db_user="$DB_USER" <<'SQL'
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'db_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'db_user') \gexec
SQL

echo "OK: role '$DB_USER' and database '$DB_NAME' are ready."
echo "Connection URL (store in .env):"
echo "  DATABASE_URL=postgresql://${DB_USER}:<password>@${PG_CONTAINER}:5432/${DB_NAME}?schema=public"
