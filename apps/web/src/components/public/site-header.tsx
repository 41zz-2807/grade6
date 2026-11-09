import { School } from "lucide-react";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <School className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight sm:text-base">
              GIIS Grade 6 Jannatul Firdaus
            </p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              Informasi Uang Kas Kelas &amp; Komite
            </p>
          </div>
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
