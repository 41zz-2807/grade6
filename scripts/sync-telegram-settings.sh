#!/usr/bin/env bash
# Menyalin kredensial Telegram dari .credential.txt ke TABEL SETTINGS di database.
#
# Kredensial Telegram sengaja tidak pernah ditulis ke .env / docker-compose.
# TelegramService membacanya setiap kali perlu mengirim notifikasi:
#   SELECT value FROM settings WHERE key = 'telegram.botToken' | 'telegram.chatId'
#
# Usage: ./scripts/sync-telegram-settings.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRED_FILE="${CRED_FILE:-$ROOT_DIR/.credential.txt}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
SERVICE="${SERVICE:-app}"

[ -f "$CRED_FILE" ] || { echo "ERROR: credential file not found: $CRED_FILE" >&2; exit 1; }

read_cred() { node "$ROOT_DIR/scripts/parse-credential.js" "$CRED_FILE" "$1"; }

BOT_TOKEN="$(read_cred 'TELEGRAM_BOT_TOKEN')"
CHAT_ID="$(read_cred 'TELEGRAM_CHAT_ID')"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID tidak ditemukan di $CRED_FILE" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" ps --status running --services | grep -qx "$SERVICE"; then
  echo "ERROR: service '$SERVICE' tidak berjalan. Jalankan: docker compose up -d" >&2
  exit 1
fi

BOT_TOKEN="$BOT_TOKEN" CHAT_ID="$CHAT_ID" \
  docker compose -f "$COMPOSE_FILE" exec -T -e BOT_TOKEN -e CHAT_ID "$SERVICE" \
  node -e '
    const { PrismaClient } = require("/app/node_modules/@prisma/client");
    const p = new PrismaClient();
    (async () => {
      await p.setting.upsert({
        where: { key: "telegram.botToken" },
        create: {
          key: "telegram.botToken",
          value: process.env.BOT_TOKEN,
          description: "Token bot Telegram untuk notifikasi",
          isSecret: true,
        },
        update: { value: process.env.BOT_TOKEN },
      });
      await p.setting.upsert({
        where: { key: "telegram.chatId" },
        create: {
          key: "telegram.chatId",
          value: process.env.CHAT_ID,
          description: "Chat ID tujuan notifikasi",
        },
        update: { value: process.env.CHAT_ID },
      });
      const rows = await p.setting.findMany({
        where: { key: { in: ["telegram.botToken", "telegram.chatId"] } },
        select: { key: true, value: true },
      });
      for (const r of rows) {
        const masked = r.key === "telegram.botToken" ? r.value.slice(0, 10) + "..." : r.value;
        console.log(`  ${r.key} = ${masked}`);
      }
      await p.$disconnect();
    })();
  '

echo "Kredensial Telegram tersimpan di tabel settings (bukan di environment)."
