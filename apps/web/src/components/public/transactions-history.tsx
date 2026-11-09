"use client";

import { useState, useTransition } from "react";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, formatRupiah, formatTanggalWaktu } from "@/lib/format";
import type { PublicTransaction, PublicTransactions } from "@/lib/public-api";

const TAKE = 10;

type Props = { initial: PublicTransactions | null };

/**
 * 10 transaksi terakhir + pagination.
 *
 * Mobile: daftar kartu (tabel akan terlalu sempit untuk nominal rupiah).
 * Desktop (md+): tabel. Dua-duanya dirender dari data yang sama.
 */
export function TransactionsHistory({ initial }: Props) {
  const [data, setData] = useState<PublicTransactions | null>(initial);
  const [page, setPage] = useState(initial?.page ?? 1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const loading = pending && !data;

  function goTo(nextPage: number) {
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/public/transactions?page=${nextPage}&take=${TAKE}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: PublicTransactions = await res.json();
        setData(json);
        setPage(json.page);
      } catch {
        setError("Gagal memuat data transaksi. Coba lagi.");
      }
    });
  }

  const items = data?.items ?? [];
  const hasNext = data?.hasNextPage ?? false;
  const showFrom = data && data.total > 0 ? (data.page - 1) * data.take + 1 : 0;
  const showTo = data ? (data.page - 1) * data.take + items.length : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">Transaksi Terakhir</CardTitle>
          {data && data.total > 0 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Menampilkan {showFrom}–{showTo} dari {data.total} transaksi
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Memuat transaksi">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Belum ada transaksi</p>
            <p className="text-xs text-muted-foreground">
              Data akan muncul setelah ada penerimaan atau pengeluaran kas.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: kartu */}
            <ul className="space-y-2 md:hidden">
              {items.map((trx) => (
                <TransactionCard key={trx.id} trx={trx} />
              ))}
            </ul>

            {/* Desktop: tabel */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Tanggal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="min-w-40">Penerima / Siswa</TableHead>
                    <TableHead className="w-24">Metode</TableHead>
                    <TableHead className="w-32 text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((trx) => {
                    const isIncome = trx.type === "INCOME";
                    return (
                      <TableRow key={trx.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatTanggalWaktu(trx.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isIncome ? (
                              <ArrowDownCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                            )}
                            <span>{CATEGORY_LABELS[trx.category] ?? trx.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56 truncate">
                          {trx.counterparty && trx.counterparty !== "-" ? (
                            <span className="block truncate">{trx.counterparty}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {trx.type === "EXPENSE" ? "Pengeluaran" : "Tanpa siswa"}
                            </span>
                          )}
                          {trx.description ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {trx.description}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={trx.paymentMethod === "CASH" ? "secondary" : "outline"}>
                            {trx.paymentMethod === "CASH" ? "Tunai" : "Transfer"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium tabular-nums ${
                            isIncome ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {isIncome ? "+" : "−"}
                          {formatRupiah(trx.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {data && data.total > 0 ? (
          <nav className="flex items-center justify-between gap-2 border-t pt-4" aria-label="Navigasi halaman transaksi">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || page <= 1}
              onClick={() => goTo(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Sebelumnya
            </Button>

            <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
              Halaman {data.page} dari {data.totalPages}
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !hasNext}
              onClick={() => goTo(page + 1)}
            >
              Berikutnya
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </nav>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TransactionCard({ trx }: { trx: PublicTransaction }) {
  const isIncome = trx.type === "INCOME";
  return (
    <li className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isIncome ? (
              <ArrowDownCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <ArrowUpCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            )}
            <span className="truncate text-sm font-medium">
              {CATEGORY_LABELS[trx.category] ?? trx.category}
            </span>
          </div>
          {trx.counterparty && trx.counterparty !== "-" ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{trx.counterparty}</p>
          ) : null}
          {trx.description ? (
            <p className="truncate text-xs text-muted-foreground">{trx.description}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={trx.paymentMethod === "CASH" ? "secondary" : "outline"}>
              {trx.paymentMethod === "CASH" ? "Tunai" : "Transfer"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{formatTanggalWaktu(trx.date)}</span>
          </div>
        </div>
        <p
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            isIncome ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {isIncome ? "+" : "−"}
          {formatRupiah(trx.amount)}
        </p>
      </div>
    </li>
  );
}
