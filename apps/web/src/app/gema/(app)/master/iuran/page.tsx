"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/admin-api";
import { formatRupiah } from "@/lib/format";

type Rules = { kasMonthly: number; kasMaxMonths: number; komiteAmount: number; kasMaxTotal: number };

export default function IuranPage() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [kasMonthly, setKasMonthly] = useState(0);
  const [kasMaxMonths, setKasMaxMonths] = useState(0);
  const [komiteAmount, setKomiteAmount] = useState(0);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Rules>("/api/cash-rules")
      .then((data) => {
        setRules(data);
        setKasMonthly(data.kasMonthly);
        setKasMaxMonths(data.kasMaxMonths);
        setKomiteAmount(data.komiteAmount);
      })
      .catch(() => setMsg({ kind: "error", text: "Gagal memuat nilai iuran." }));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const updated = await apiFetch<Rules>("/api/cash-rules", {
        method: "PATCH",
        body: JSON.stringify({ kasMonthly, kasMaxMonths, komiteAmount }),
      });
      setRules(updated);
      setMsg({ kind: "success", text: "Nilai iuran disimpan." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  const maxTotal = kasMonthly * kasMaxMonths;

  return (
    <>
      <PageHeader
        title="Nilai Iuran"
        description="Nominal iuran kas kelas dan komite. Nilai ini dipakai server saat memvalidasi transaksi."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">Perhatikan sebelum mengubah</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
          <li>Mengubah iuran hanya berlaku untuk transaksi <em>berikutnya</em>.</li>
          <li>
            Siswa yang sudah lunas tetap lunas; status tidak dihitung ulang otomatis.
          </li>
          <li>
            Pembayaran kas tidak harus kelipatan <strong>{formatRupiah(kasMonthly)}</strong>;
            bulan lunas dihitung dengan pembulatan ke bawah.
          </li>
        </ul>
      </div>

      <SectionCard title="Nominal Iuran">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Kas Kelas / Bulan" htmlFor="kasMonthly" required>
              <input
                id="kasMonthly"
                type="number"
                min={1}
                step={1}
                required
                className={inputClass}
                value={kasMonthly}
                onChange={(e) => setKasMonthly(Number(e.target.value))}
              />
            </Field>
            <Field label="Maksimum Bulan" htmlFor="kasMaxMonths" required hint="11 = iuran 11 bulan.">
              <input
                id="kasMaxMonths"
                type="number"
                min={1}
                max={36}
                required
                className={inputClass}
                value={kasMaxMonths}
                onChange={(e) => setKasMaxMonths(Number(e.target.value))}
              />
            </Field>
            <Field label="Iuran Komite" htmlFor="komiteAmount" required>
              <input
                id="komiteAmount"
                type="number"
                min={1}
                step={1}
                required
                className={inputClass}
                value={komiteAmount}
                onChange={(e) => setKomiteAmount(Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">Perkiraan tagihan per siswa</p>
            <p className="mt-1 text-muted-foreground tabular-nums">
              Kas kelas: {formatRupiah(kasMonthly)} × {kasMaxMonths} bulan ={" "}
              <strong>{formatRupiah(maxTotal)}</strong>
            </p>
            <p className="text-muted-foreground tabular-nums">
              Komite: <strong>{formatRupiah(komiteAmount)}</strong> per masa ajaran
            </p>
          </div>

          <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

          <Button type="submit" disabled={busy || !rules}>
            <Save className="mr-1 h-4 w-4" aria-hidden />
            {busy ? "Menyimpan..." : "Simpan Nilai Iuran"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Aturan yang berlaku sekarang">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>
            Iuran kas kelas <strong className="text-foreground">{formatRupiah(rules?.kasMonthly ?? 0)}</strong>{" "}
            per bulan, maksimal <strong className="text-foreground">{rules?.kasMaxMonths ?? 0}</strong>{" "}
            bulan (total {formatRupiah(rules?.kasMaxTotal ?? 0)}).
          </li>
          <li>
            Iuran komite <strong className="text-foreground">{formatRupiah(rules?.komiteAmount ?? 0)}</strong>{" "}
            per masa ajaran, boleh dicicil.
          </li>
          <li>Pembayaran TRANSFER wajib melampirkan minimal 1 bukti.</li>
        </ul>
      </SectionCard>
    </>
  );
}
