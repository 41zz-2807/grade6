"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  FileText,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/admin/page-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/admin-api";

type Summary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  students: { total: number; kasLunas: number; komiteLunas: number };
};

const MENU = [
  { href: "/gema/master/siswa", label: "Siswa", icon: Users, desc: "Data siswa & status lunas" },
  { href: "/gema/master/rekening", label: "Rekening", icon: Wallet, desc: "Rekening penampung iuran" },
  { href: "/gema/master/info", label: "Info Popup", icon: FileText, desc: "Pengumuman halaman publik" },
  { href: "/gema/master/iuran", label: "Nilai Iuran", icon: Database, desc: "Nominal kas & komite" },
  { href: "/gema/master/tahun-ajaran", label: "Tahun Ajaran", icon: Database, desc: "Masa ajaran aktif" },
];

const TRANSAKSI = [
  { href: "/gema/pemasukan", label: "Input Pemasukan", icon: ArrowDownToLine, desc: "Kas kelas, komite, umum" },
  { href: "/gema/pengeluaran", label: "Input Pengeluaran", icon: ArrowUpFromLine, desc: "Belanja & biaya" },
  { href: "/gema/laporan", label: "Laporan Detail", icon: FileText, desc: "Riwayat & bukti" },
  { href: "/gema/export", label: "Export", icon: FileText, desc: "PDF & Excel" },
  { href: "/gema/pengaturan", label: "Pengaturan", icon: Settings, desc: "Telegram & keamanan" },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    apiFetch<Summary>("/api/reports/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const cards = [
    { label: "Saldo", value: summary?.balance, tone: "text-primary" },
    { label: "Total Pemasukan", value: summary?.totalIncome, tone: "text-emerald-600" },
    { label: "Total Pengeluaran", value: summary?.totalExpense, tone: "text-amber-600" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan kas dan pintasan menu."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            {summary ? (
              <p className={`mt-1 break-words text-lg font-semibold tabular-nums ${card.tone}`}>
                {formatRupiah(card.value ?? 0)}
              </p>
            ) : (
              <Skeleton className="mt-2 h-7 w-28" />
            )}
          </div>
        ))}
      </div>

      {summary ? (
        <p className="text-xs text-muted-foreground">
          {summary.transactionCount} transaksi tercatat · {summary.students.total} siswa
          (lunas kas {summary.students.kasLunas}, lunas komite {summary.students.komiteLunas})
        </p>
      ) : null}

      <MenuGroup title="Transaksi Harian" items={TRANSAKSI} />
      <MenuGroup title="Master Data" items={MENU} />
    </>
  );
}

function MenuGroup({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[];
}) {
  return (
    <SectionCard title={title}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}
