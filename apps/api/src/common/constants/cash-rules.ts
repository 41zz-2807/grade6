/**
 * Default iuran kas & komite.
 *
 * Nilairuntime-nya bisa diubah admin lewat `PATCH /api/cash-rules`
 * (disimpan di tabel `settings`). Konstanta di sini hanya dipakai sebagai
 * fallback kalau key-nya belum pernah diisi.
 */
export const DEFAULT_CASH_RULES = {
  /** Iuran kas kelas per bulan. */
  kasMonthly: 15_000,
  /** Jumlah bulan maksimal yang boleh dibayar dalam satu masa ajaran. */
  kasMaxMonths: 11,
  /** Iuran komite per masa ajaran. */
  komiteAmount: 75_000,
} as const;

/** Prefix key di tabel `settings`. */
export const CASH_RULE_SETTING_KEYS = {
  kasMonthly: "kas.monthlyAmount",
  kasMaxMonths: "kas.maxMonths",
  komiteAmount: "komite.amount",
} as const;

export type CashRules = {
  kasMonthly: number;
  kasMaxMonths: number;
  komiteAmount: number;
};

/** Total maksimum iuran kas kelas = kasMonthly x kasMaxMonths. */
export function kasMaxTotal(rules: CashRules): number {
  return rules.kasMonthly * rules.kasMaxMonths;
}

/** Batas upload & aturan umum (tidak diubah dari UI). */
export const MIN_TRANSFER_PROOFS = 1;
export const ALLOWED_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PROOFS_PER_TRANSACTION = 5;
