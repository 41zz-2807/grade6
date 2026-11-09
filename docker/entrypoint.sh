#!/usr/bin/env bash
# Menjalankan proxy masuk + NestJS API + Next.js dalam satu container.
# Hanya proxy yang listen di port 3000 (dipublish ke host sebagai 3004).
# Kalau salah satu proses mati, container ikut exit supaya Docker me-restart.
set -euo pipefail

API_PORT="${API_PORT:-3001}"
NEXT_PORT="${NEXT_PORT:-3002}"
WEB_PORT="${WEB_PORT:-3000}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"

mkdir -p "$UPLOAD_DIR"

WEB_ENTRY="apps/web/server.js"
if [ ! -f "$WEB_ENTRY" ]; then
  echo "ERROR: $WEB_ENTRY not found (Next.js standalone build missing?)" >&2
  exit 1
fi

pids=()

shutdown() {
  echo "[entrypoint] shutting down..."
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit 0
}
trap shutdown SIGTERM SIGINT

echo "[entrypoint] starting NestJS API on :$API_PORT"
node apps/api/dist/main.js &
pids+=($!)

echo "[entrypoint] starting Next.js web on :$NEXT_PORT"
PORT="$NEXT_PORT" HOSTNAME=127.0.0.1 node "$WEB_ENTRY" &
pids+=($!)

# Proxy menunggu backend siap supaya request pertama tidak 502.
echo "[entrypoint] starting proxy on :$WEB_PORT"
sleep 3
node docker/proxy.js &
pids+=($!)

wait -n
shutdown
