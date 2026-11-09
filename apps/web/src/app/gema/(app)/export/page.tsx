"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader, SectionCard, inputClass, selectClass, StatusMessage } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/admin-api";
import { formatRupiah, formatTanggal } from "@/lib/format";

type Summary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  incomeByCategory: { category: string; label: string; total: number; count: number }[];
  students: { total: number; kasLunas: number; komiteLunas: number };
};

type AcademicYear = {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  isActive: boolean;
};

type Rekap = {
  months: { short: string; long: string }[];
  kasMonthly: number;
  targetMonths: number;
  totals: {
    students: number;
    lunas: number;
    belumLunas: number;
    komiteLunas: number;
    totalPaid: number;
    totalTagihan: number;
  };
  warning: string | null;
};

export default function ExportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Rekap iuran per bulan.
  // `years` = null berarti masih memuat, [] berarti memang tidak ada masa ajaran.
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [academicYearId, setAcademicYearId] = useState("");
  const [rekap, setRekap] = useState<Rekap | null>(null);

  const query = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    return params;
  }, [from, to]);

  useEffect(() => {
    apiFetch<Summary>(`/api/reports/summary?${query()}`)
      .then(setSummary)
      .catch((err) => setMsg({ kind: "error", text: (err as { message: string }).message }));
  }, [query]);

  // Ambil daftar masa ajaran, lalu pilih yang aktif sebagai bawaan.
  useEffect(() => {
    apiFetch<AcademicYear[]>("/api/academic-years")
      .then((data) => {
        setYears(data);
        const active = data.find((y) => y.isActive) ?? data[0];
        if (active) setAcademicYearId(active.id);
      })
      .catch((err) => {
        setYears([]);
        setMsg({ kind: "error", text: (err as { message: string }).message });
      });
  }, []);

  // Ringkasan rekap untuk masa ajaran terpilih (biar admin tahu isi PDF-nya).
  useEffect(() => {
    if (!academicYearId) return;
    setRekap(null);
    apiFetch<Rekap>(`/api/reports/rekap-iuran?academicYearId=${academicYearId}`)
      .then(setRekap)
      .catch((err) => setMsg({ kind: "error", text: (err as { message: string }).message }));
  }, [academicYearId]);

  function download(kind: "pdf" | "excel") {
    const params = query();
    const url = `/api/reports/export/${kind}?${params}`;
    // Buka di tab baru supaya nama file dari Content-Disposition dipakai browser.
    window.open(url, "_blank", "noopener");
    setMsg({ kind: "success", text: `Laporan ${kind.toUpperCase()} sedang diunduh.` });
  }

  function downloadRekap() {
    if (!academicYearId) return;
    // Buka di tab baru supaya nama file dari Content-Disposition dipakai browser.
    window.open(`/api/reports/export/rekap-pdf?academicYearId=${academicYearId}`, "_blank", "noopener");
    setMsg({ kind: "success", text: "Rekap iuran kas kelas sedang diunduh." });
  }

  return (
    <>
      <PageHeader title="Export Laporan" description="Unduh laporan kas dalam format PDF atau Excel." />

      <SectionCard title="Periode" description="Kosongkan untuk seluruh periode.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Reset Periode
            </Button>
          </div>
        </div>
      </SectionCard>

      <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

      <SectionCard title="Unduh">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => download("pdf")}
            className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50">
              <FileText className="h-5 w-5 text-red-600" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Laporan PDF</span>
              <span className="block text-xs text-muted-foreground">Siap cetak, lengkap dengan rincian</span>
            </span>
            <Download className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => download("excel")}
            className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Laporan Excel</span>
              <span className="block text-xs text-muted-foreground">3 sheet, bisa diolah lagi</span>
            </span>
            <Download className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Rekap Iuran Kas Kelas"
        description="Tabel nama siswa per bulan. Bulan yang sudah dibayar dicentang hijau, yang belum garis strip."
      >
        {years === null ? (
          <p className="text-sm text-muted-foreground">Memuat data masa ajaran...</p>
        ) : years.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada masa ajaran. Tambahkan dulu di Master Data &gt; Tahun Ajaran.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="rekap-masa" className="block text-sm font-medium">
                  Masa Ajaran
                </label>
                <select
                  id="rekap-masa"
                  className={selectClass}
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                >
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.isActive ? " (aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={downloadRekap} className="w-full" disabled={!academicYearId}>
                  <Download className="h-4 w-4" aria-hidden />
                  Unduh PDF Rekap Iuran
                </Button>
                <Button
                  onClick={() => window.open(`/api/reports/export/rekomite-pdf?academicYearId=${academicYearId}`, "_blank", "noopener")}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Unduh PDF Rekomite
                </Button>
              </div>
            </div>

            {rekap ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {rekap.months[0]?.long} s.d {rekap.months[rekap.months.length - 1]?.long} ·{" "}
                {rekap.totals.students} siswa · lunas kas {rekap.totals.lunas} · belum lunas{" "}
                {rekap.totals.belumLunas} · lunas komite {rekap.totals.komiteLunas} · kas
                terkumpul {formatRupiah(rekap.totals.totalPaid)} dari tagihan{" "}
                {formatRupiah(rekap.totals.totalTagihan)}
                {rekap.warning ? ` · ${rekap.warning}` : ""}
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Memuat rekap iuran...</p>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Pratinjau Ringkasan" description={from || to ? `Periode ${from || "awal"} s/d ${to || "sekarang"}` : "Seluruh periode"}>
        {summary ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="text-base font-semibold tabular-nums text-primary">{formatRupiah(summary.balance)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total Pemasukan</p>
                <p className="text-base font-semibold tabular-nums text-emerald-600">{formatRupiah(summary.totalIncome)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                <p className="text-base font-semibold tabular-nums text-amber-600">{formatRupiah(summary.totalExpense)}</p>
              </div>
            </div>

            <h3 className="mt-4 text-sm font-medium">Rincian per kategori pemasukan</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {summary.incomeByCategory.map((row) => (
                <li key={row.category} className="flex items-center justify-between gap-2 border-b pb-1 last:border-0">
                  <span className="text-muted-foreground">
                    {row.label} <span className="text-xs">({row.count}×)</span>
                  </span>
                  <span className="tabular-nums">{formatRupiah(row.total)}</span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">
              {summary.transactionCount} transaksi · {summary.students.total} siswa (lunas kas{" "}
              {summary.students.kasLunas}, lunas komite {summary.students.komiteLunas})
              {from || to ? ` · dibuat ${formatTanggal(new Date().toISOString())}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Memuat ringkasan...</p>
        )}
      </SectionCard>
    </>
  );
}
