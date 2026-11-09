/**
 * Zona waktu aplikasi.
 *
 * Semua waktu yang ditampilkan ke pengguna (notifikasi Telegram, laporan
 * PDF/Excel) diformat di sini, bukan lewat `toISOString()` yang selalu UTC.
 * Defaults ke Asia/Jakarta (WIB, UTC+7), bisa diubah lewat env `APP_TIMEZONE`.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Jakarta";

/** Nama singkat zona waktu untuk ditampilkan, mis. "WIB". */
const ABBREVIATIONS: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

/** "30 Sep 2026 13:45 WIB" */
export function formatDateTime(date: Date = new Date()): string {
  return `${formatDate(date)} ${formatTime(date)} ${timezoneLabel()}`;
}

/** "30 Sep 2026" */
export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  });
}

/** "30 Sep 2026, 13.45" (format Indonesia, tanpa sufiks zona waktu) */
export function formatDateTimeId(date: Date = new Date()): string {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

/** "WIB" / "WITA" / "WIT", atau singkatan zone seperti "GMT+7". */
export function timezoneLabel(): string {
  return (
    ABBREVIATIONS[APP_TIMEZONE] ??
    new Date().toLocaleTimeString("id-ID", { timeZoneName: "short", timeZone: APP_TIMEZONE }).split(" ").pop() ??
    APP_TIMEZONE
  );
}

/** Tanggal hari ini dalam zona waktu app, format YYYY-MM-DD (untuk nama file). */
export function todayStamp(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

/** `20261109-060000` dalam zona waktu app (untuk nama file backup & laporan). */
export function fileStamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}`;
}
