/**
 * Klien API publik untuk Server Component.
 *
 * Semua request memakai `cache: "no-store"` supaya angka saldo & transaksi
 * selalu segar (data keuangan tidak boleh ditampilkan basi).
 * Data diambil lewat API internal, bukan langsung dari database.
 */
const API_ORIGIN = process.env.API_INTERNAL_URL || "http://127.0.0.1:3001";

export type PublicAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  description: string | null;
} | null;

export type PublicSummary = {
  saldo: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  jumlahTransaksi: number;
};

export type PublicTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  date: string;
  category: string;
  counterparty: string;
  description: string;
  amount: number;
  paymentMethod: "TRANSFER" | "CASH";
  proofCount: number;
};

export type PublicTransactions = {
  items: PublicTransaction[];
  total: number;
  page: number;
  take: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type PublicPopup = {
  id: string;
  title: string;
  content: string;
};

async function get<T>(path: string, revalidate = 0): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/public${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API tidak tersedia -> komponen harus tetap bisa render dengan fallback.
    return null;
  }
}

export const getPublicSummary = (from?: string, to?: string) =>
  get<PublicSummary>(`/summary${query({ from, to })}`);

export const getPublicTransactions = (page = 1, take = 10, from?: string, to?: string) =>
  get<PublicTransactions>(`/transactions${query({ page, take, from, to })}`);

export const getPublicPopups = () => get<PublicPopup[]>("/popup");

export const getPublicAccount = () => get<PublicAccount>("/rekening");

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
