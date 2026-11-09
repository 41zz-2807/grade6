const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number | null | undefined): string {
  return rupiah.format(Number(value ?? 0));
}

const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Jakarta";

/** "29 Sep 2026" dalam zona waktu aplikasi (bukan zona browser). */
export function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  });
}

/** "29 Sep 2026, 14.08" */
export function formatTanggalWaktu(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

export const CATEGORY_LABELS: Record<string, string> = {
  KAS_KELAS: "Iuran Kas Kelas",
  KOMITE: "Iuran Komite",
  UMUM: "Pemasukan Umum",
  PENGELUARAN: "Pengeluaran",
};
