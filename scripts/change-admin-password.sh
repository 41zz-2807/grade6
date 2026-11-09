#!/usr/bin/env bash
# Mengganti password admin (tabel `users`) dengan hash bcrypt.
#
#   ./scripts/change-admin-password.sh <username> <password-baru>
#   ./scripts/change-admin-password.sh <username>          # prompted, tidak echoed
#   NEW_PASSWORD='...' ./scripts/change-admin-password.sh <username>
#
# Script ini berjalan di dalam container app, karena nama host database
# ("postgres-15") hanya bisa di-resolve di network Docker, bukan di host.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
SERVICE="${SERVICE:-app}"
WORKER="apps/api/dist/scripts/change-admin-password.js"
MIN_LENGTH=8

usage() {
  sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-2}"
}

[ $# -ge 1 ] || usage

USERNAME="$1"
PASSWORD="${2:-${NEW_PASSWORD:-}}"

if [ -z "$PASSWORD" ]; then
  # Password tidak diketik-ekho agar tidak terekam di shell history.
  read -r -s -p "Password baru untuk '$USERNAME': " PASSWORD
  echo
  read -r -s -p "Ulangi password: " PASSWORD_CONFIRM
  echo
  [ "$PASSWORD" = "$PASSWORD_CONFIRM" ] || { echo "ERROR: password tidak cocok." >&2; exit 2; }
fi

if [ ${#PASSWORD} -lt "$MIN_LENGTH" ]; then
  echo "ERROR: password minimal $MIN_LENGTH karakter." >&2
  exit 2
fi

if ! docker compose -f "$COMPOSE_FILE" ps --status running --services | grep -qx "$SERVICE"; then
  echo "ERROR: service '$SERVICE' tidak sedang berjalan. Jalankan: docker compose up -d" >&2
  exit 1
fi

# Password dikirim lewat stdin agar tidak muncul di daftar proses container.
printf '%s' "$PASSWORD" |
  docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" node "$WORKER" "$USERNAME"

unset PASSWORD PASSWORD_CONFIRM
