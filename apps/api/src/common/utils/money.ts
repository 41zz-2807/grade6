import { Prisma } from "@prisma/client";

/** Konversi nilai Decimal Prisma menjadi `number` untuk respons API. */
export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(new Prisma.Decimal(value).toFixed(2));
}

/** Ubah `number` menjadi Decimal Prisma (2 desimal). */
export function toDecimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

/** Format Rupiah tanpa desimal, mis. 15000 -> "Rp 15.000". */
export function formatRupiah(value: Prisma.Decimal | number | string | null | undefined): string {
  return `Rp ${Math.round(toNumber(value)).toLocaleString("id-ID")}`;
}
