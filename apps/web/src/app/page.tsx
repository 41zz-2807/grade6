import { getPublicPopups, getPublicSummary, getPublicTransactions } from "@/lib/public-api";
import { AccountCard } from "@/components/public/account-card";
import { DownloadPdfButton } from "@/components/public/download-pdf-button";
import { InfoButton } from "@/components/public/info-button";
import { SiteHeader } from "@/components/public/site-header";
import { SummaryCards } from "@/components/public/summary-cards";
import { TransactionsHistory } from "@/components/public/transactions-history";

// Angka kas harus selalu segar - jangan di-cache.
export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  // Summary, transaksi, dan popup diambil paralel lewat API internal.
  const [summary, transactions, popups] = await Promise.all([
    getPublicSummary(),
    getPublicTransactions(1, 10),
    getPublicPopups(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader>
        <InfoButton fallback={popups ?? []} />
      </SiteHeader>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5 sm:space-y-5 sm:px-6 sm:py-8">
        <AccountCard />
        <SummaryCards summary={summary} />
        <TransactionsHistory initial={transactions} />
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            Powered By Smart-Plus.id 2026
          </p>
          <DownloadPdfButton />
        </div>
      </footer>
    </div>
  );
}
