"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RekeningNumberCanvas } from "./rekening-number-canvas";

type Rekening = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  description: string | null;
} | null;

/**
 * Kartu ATM (bagian depan) untuk rekening resmi sekolah.
 *
 * Keamanan tampilan:
 * - **Nomor rekening digambar di `<canvas>`**, bukan teks HTML. Angkanya cuma
 *   ada sebagai piksel, jadi tidak bisa diedit lewat Inspect Element lalu
 *   difoto untuk menipu orang yang melihat layar, dan tidak muncul di
 *   `document.body.innerText` / Ctrl+F.
 * - **Tombol "Salin" menyalin dari data API** (state React), bukan dari teks
 *   DOM, dan spasi dihapus supaya tersalin sebagai angka murni.
 *
 * Batasnya (jujur): ini menaikkan biaya defacement, bukan menutupnya. Siapa
 * pun yang memakai browser asli tetap bisa mengetik ulang nomornya sendiri.
 * Yang dicegah adalah penyuntingan tampilan di layar orang lain.
 *
 * Aset: desain orisinal (gradien, pola, chip generik) - tidak memakai logo
 * atau aset resmi bank.
 */
export function AccountCard() {
  const [account, setAccount] = useState<Rekening>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    let aktif = true;
    fetch("/api/public/rekening", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        if (aktif) setAccount(data);
      })
      .finally(() => {
        if (aktif) setLoading(false);
      });
    return () => {
      aktif = false;
    };
  }, []);

  async function copyRekening() {
    setCopyError("");
    if (!account?.accountNumber) return;
    try {
      // Dari state API, bukan dari teks canvas/DOM. Spasi dibuang.
      const plain = account.accountNumber.replace(/\s+/g, "");
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Browser menolak akses clipboard. Salin manual dari gambar.");
    }
  }

  return (
    <Card className="overflow-hidden border-0 bg-transparent p-0 shadow-none">
      {loading ? (
        <CardContent className="rounded-2xl bg-neutral-900 p-6">
          <Skeleton className="h-4 w-28 bg-white/10" />
          <Skeleton className="mt-6 h-12 w-full max-w-sm bg-white/10" />
          <Skeleton className="mt-6 h-4 w-40 bg-white/10" />
        </CardContent>
      ) : account ? (
        <CardContent className="p-0">
          {/* Kartu ATM: hitam, rounded, dengan gradien & pola miring.
              Lebar dibatasi max-w-[26rem] supaya proporsinya tetap menyerupai
              kartu fisik di layar desktop yang lebar. */}
          <div className="relative isolate w-full max-w-[26rem] overflow-hidden rounded-2xl bg-neutral-950 text-white shadow-xl sm:rounded-3xl">
            {/* Pola garis diagonal + cahaya halus di sudut. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(115deg, #ffffff 0 1px, transparent 1px 16px)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl"
            />

            <div className="relative flex flex-col gap-6 p-6 sm:gap-7 sm:p-8">
              {/* Baris atas: nama bank + chip */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight sm:text-xl">
                    {account.bankName}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
                    Rekening Sekolah
                  </p>
                </div>
                {/* Chip generik (bukan logo resmi). */}
                <span
                  aria-hidden
                  className="grid shrink-0 grid-cols-3 gap-[3px] rounded-md bg-gradient-to-br from-amber-200/90 to-amber-400/70 p-1.5"
                >
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="h-2.5 w-2.5 rounded-[1px] bg-amber-950/40" />
                  ))}
                </span>
              </div>

              {/* Nomor rekening - digambar, bukan teks. */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45 sm:text-[11px]">
                  Nomor rekening
                </p>
                <RekeningNumberCanvas
                  digits={account.accountNumber.replace(/\s+/g, "")}
                  className="mt-1"
                />
              </div>

              {/* Baris bawah: atas nama + tombol salin */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45 sm:text-[11px]">
                    Atas nama
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium sm:text-base">
                    {account.accountHolder}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={copyRekening}
                  aria-label="Salin nomor rekening"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-300" aria-hidden />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden />
                      Salin
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {copyError ? <p className="mt-2 text-xs text-red-600">{copyError}</p> : null}

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Pastikan rekening tujuan adalah rekening resmi sekolah. Rekening dapat
            berubah, selalu cek nomor lengkap sebelum transfer.
          </p>
        </CardContent>
      ) : (
        <CardContent className="rounded-2xl border border-dashed bg-white p-6">
          <p className="text-sm text-muted-foreground">
            Rekening resmi belum tersedia. Silakan hubungi komite sekolah.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
