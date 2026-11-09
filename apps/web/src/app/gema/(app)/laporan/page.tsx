"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { PageHeader, SectionCard, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/admin-api";
import { formatRupiah, formatTanggalWaktu } from "@/lib/format";

type Trx = {
  id: string;
  type: "INCOME" | "EXPENSE";
  date: string;
  description: string;
  category: string;
  counterparty: string;
  amount: number;
  paymentMethod: "CASH" | "TRANSFER";
  proofCount: number;
  proofs?: { fileName: string; originalName: string; mimeType: string }[];
};

type Result = { items: Trx[]; total: number; page: number; take: number; totalPages: number };

export default function LaporanPage() {
  const [data, setData] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [proof, setProof] = useState<{ trx: Trx } | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), take: "20", type });
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      setData(await apiFetch<Result>(`/api/reports/transactions?${params}`));
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setLoading(false);
    }
  }, [type, from, to]);

  useEffect(() => {
    void load(1);
    setPage(1);
  }, [load]);

  async function removeTrx(trx: Trx) {
    // Endpoint hapus berbeda antara pemasukan dan pengeluaran.
    const path = trx.type === "INCOME" ? "incomes" : "expenses";
    try {
      await apiFetch(`/api/${path}/${trx.id}`, { method: "DELETE" });
      setMsg({
        kind: "success",
        text: `${trx.type === "INCOME" ? "Pemasukan" : "Pengeluaran"} ${formatRupiah(trx.amount)} dihapus.`,
      });
      await load(page);
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    }
  }

  return (
    <>
      <PageHeader title="Laporan Detail" description="Semua transaksi pemasukan & pengeluaran beserta buktinya." />

      <SectionCard title="Filter">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="type" className="block text-sm font-medium">Jenis</label>
            <select
              id="type"
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="ALL">Semua</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="from" className="block text-sm font-medium">Dari Tanggal</label>
            <input id="from" type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="block text-sm font-medium">Sampai Tanggal</label>
            <input id="to" type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => {
                setPage(1);
                void load(1);
              }}
            >
              Terapkan
            </Button>
          </div>
        </div>
        {(from || to) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Filter tanggal: {from || "awal"} s/d {to || "sekarang"}
          </p>
        )}
      </SectionCard>

      <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

      <SectionCard
        title={data ? `Transaksi (${(data.page - 1) * data.take + 1}–${Math.min(data.page * data.take, data.total)} dari ${data.total})` : "Transaksi"}
      >
        {!data || data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada transaksi pada filter ini.</p>
        ) : (
          <ul className="space-y-2" aria-busy={loading}>
            {data.items.map((trx) => {
              const isIncome = trx.type === "INCOME";
              return (
                <li key={trx.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {isIncome ? trx.category : "Pengeluaran"}
                        {trx.counterparty && trx.counterparty !== "-" ? (
                          <span className="font-normal text-muted-foreground"> · {trx.counterparty}</span>
                        ) : null}
                      </p>
                      {trx.description ? (
                        <p className="text-xs text-muted-foreground">{trx.description}</p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant={isIncome ? "success" : "destructive"}>
                          {isIncome ? "Masuk" : "Keluar"}
                        </Badge>
                        <Badge variant={trx.paymentMethod === "CASH" ? "secondary" : "outline"}>
                          {trx.paymentMethod === "CASH" ? "Tunai" : "Transfer"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {formatTanggalWaktu(trx.date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className={`text-sm font-semibold tabular-nums ${isIncome ? "text-emerald-700" : "text-amber-700"}`}>
                        {isIncome ? "+" : "−"}
                        {formatRupiah(trx.amount)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setProof({ trx })}>
                          <FileText className="mr-1 h-4 w-4" aria-hidden />
                          Bukti {trx.proofCount > 0 ? `(${trx.proofCount})` : ""}
                        </Button>
                        <DeleteButton
                          onConfirm={() => removeTrx(trx)}
                          label="Hapus"
                          confirmText={
                            trx.type === "INCOME"
                              ? "Hapus pemasukan ini? Total iuran siswa akan dihitung ulang."
                              : "Hapus pengeluaran ini? Tindakan ini tidak bisa dibatalkan."
                          }
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {data && data.total > 0 ? (
          <nav className="mt-4 flex items-center justify-between gap-2 border-t pt-4" aria-label="Navigasi halaman laporan">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || data.page <= 1}
              onClick={() => {
                const next = data.page - 1;
                setPage(next);
                void load(next);
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Sebelumnya
            </Button>
            <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
              Halaman {data.page} dari {data.totalPages}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || data.page >= data.totalPages}
              onClick={() => {
                const next = data.page + 1;
                setPage(next);
                void load(next);
              }}
            >
              Berikutnya
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </nav>
        ) : null}
      </SectionCard>

      <ProofViewer
        target={proof}
        onClose={() => setProof(null)}
        onError={(text) => setMsg({ kind: "error", text })}
      />
    </>
  );
}

function ProofViewer({
  target,
  onClose,
  onError,
}: {
  target: { trx: Trx } | null;
  onClose: () => void;
  onError: (text: string) => void;
}) {
  const [detail, setDetail] = useState<Trx | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) {
      setDetail(null);
      return;
    }
    let aktif = true;
    setLoading(true);
    const path = target.trx.type === "INCOME" ? "incomes" : "expenses";
    apiFetch<Trx>(`/api/${path}/${target.trx.id}`)
      .then((data) => {
        if (aktif) setDetail(data);
      })
      .catch((err) => onError((err as { message: string }).message))
      .finally(() => {
        if (aktif) setLoading(false);
      });
    return () => {
      aktif = false;
    };
    // onError sengaja tidak jadi dependensi agar tidak memicu fetch ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const proofs = detail?.proofs ?? [];

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bukti Transaksi</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
          {loading ? <p className="text-sm text-muted-foreground">Memuat bukti...</p> : null}
          {!loading && proofs.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Transaksi ini tidak memiliki bukti (dibayar tunai).
            </p>
          ) : null}
          {proofs.map((file) => (
            <div key={file.fileName} className="space-y-1.5">
              <p className="truncate text-xs text-muted-foreground">{file.originalName}</p>
              {file.mimeType === "application/pdf" ? (
                <iframe
                  src={`/uploads/${file.fileName}`}
                  title={file.originalName}
                  className="h-96 w-full rounded-md border"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/uploads/${file.fileName}`}
                  alt={file.originalName}
                  className="max-h-96 w-full rounded-md border object-contain"
                />
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
