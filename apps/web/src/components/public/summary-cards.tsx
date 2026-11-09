import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import type { PublicSummary } from "@/lib/public-api";

type Props = { summary: PublicSummary | null; loading?: boolean };

/**
 * Tiga kartu ringkasan: Saldo, Total Pemasukan, Total Pengeluaran.
 * Pada HP tetap 1 kolom supaya nominal panjang tidak terpotong.
 */
export function SummaryCards({ summary, loading = false }: Props) {
  const cards = [
    {
      key: "saldo",
      label: "Saldo",
      value: summary?.saldo,
      icon: Wallet,
      tone: "text-primary",
      chip: "bg-primary/10",
      note: "Kas tersedia saat ini",
    },
    {
      key: "pemasukan",
      label: "Total Pemasukan",
      value: summary?.totalPemasukan,
      icon: ArrowDownCircle,
      tone: "text-emerald-600",
      chip: "bg-emerald-50",
      note: "Kas masuk & iuran",
    },
    {
      key: "pengeluaran",
      label: "Total Pengeluaran",
      value: summary?.totalPengeluaran,
      icon: ArrowUpCircle,
      tone: "text-amber-600",
      chip: "bg-amber-50",
      note: "Belanja & biaya",
    },
  ];

  return (
    <section aria-label="Ringkasan kas" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key} className="overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                    {card.label}
                  </p>
                  {loading ? (
                    <Skeleton className="mt-2 h-7 w-32" />
                  ) : (
                    <p className="mt-1 break-words text-lg font-semibold tabular-nums sm:text-xl">
                      {formatRupiah(card.value ?? 0)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.chip}`}>
                  <Icon className={`h-5 w-5 ${card.tone}`} aria-hidden />
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
