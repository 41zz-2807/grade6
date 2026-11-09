#!/usr/bin/env bash
# Menghapus seluruh data transaksi (pemasukan + pengeluaran + bukti transfer)
# dan mereset tagihan iuran semua siswa.
#
#   ./scripts/clear-transactions.sh            # tampilkan ringkasan, lalu konfirmasi
#   ./scripts/clear-transactions.sh --yes      # tanpa konfirmasi (untuk otomatisasi)
#   ./scripts/clear-transactions.sh --dry-run  # hanya tampilkan ringkasan
#
# Master data tetap utuh: siswa, kategori, rekening, popup, masa ajaran,
# pengaturan, dan seluruh akun admin tidak disentuh.
#
# TIDAK ADA BACKUP. Kalau salah, data transaksi tidak bisa dikembalikan.
# Ekspor dulu lewat halaman Laporan (/gema/export) kalau masih perlu arsip.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
SERVICE="${SERVICE:-app}"
WORKER="apps/api/dist/scripts/clear-transactions.js"
ASSUME_YES=0
DRY_RUN=0

usage() {
  sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-2}"
}

case "${1:-}" in
  -h|--help) usage 0 ;;
  -y|--yes) ASSUME_YES=1 ;;
  -n|--dry-run) DRY_RUN=1 ;;
  "") ;;
  *) usage ;;
esac

if [ "$DRY_RUN" -eq 1 ]; then
  docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" node "$WORKER" --dry-run
  exit 0
fi

if ! docker compose -f "$COMPOSE_FILE" ps --status running --services | grep -qx "$SERVICE"; then
  echo "ERROR: service '$SERVICE' tidak sedang berjalan. Jalankan: docker compose up -d" >&2
  exit 1
fi

if [ "$ASSUME_YES" -eq 0 ]; then
  echo "PERINGATAN: seluruh data transaksi akan dihapus permanen."
  echo "Siswa, rekening, kategori, masa ajaran, dan pengaturan TIDAK ikut terhapus."
  echo ""
  docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" node "$WORKER" --dry-run
  echo ""
  printf "Ketik YA untuk melanjutkan: "
  read -r ANSWER
  if [ "$ANSWER" != "YA" ]; then
    echo "Dibatalkan. Tidak ada data yang diubah."
    exit 1
  fi
fi

docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" node "$WORKER"
