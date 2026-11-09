"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/admin/logout-button";

/**
 * Navigasi admin.
 *
 * Desktop: sidebar tetap di kiri.
 * Mobile: bottom bar (5 menu utama) + tombol menu membuka drawer untuk
 * seluruh menu, supaya tidak ada 9 ikon berdesakan di layar 390px.
 */
export const NAV_ITEMS = [
  { href: "/gema/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/gema/pemasukan", label: "Pemasukan", icon: ArrowDownToLine, mobile: true },
  { href: "/gema/pengeluaran", label: "Pengeluaran", icon: ArrowUpFromLine, mobile: true },
  { href: "/gema/laporan", label: "Laporan", icon: FileText, mobile: true },
  { href: "/gema/export", label: "Export", icon: FileText, mobile: false },
  { href: "/gema/pengaturan", label: "Pengaturan", icon: Settings, mobile: true },
];

const MASTER_ITEMS = [
  { href: "/gema/master/siswa", label: "Siswa" },
  { href: "/gema/master/rekening", label: "Rekening" },
  { href: "/gema/master/info", label: "Info Popup" },
  { href: "/gema/master/iuran", label: "Nilai Iuran" },
  { href: "/gema/master/tahun-ajaran", label: "Tahun Ajaran" },
];

export function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 border-r bg-white lg:flex lg:flex-col">
        <div className="border-b px-4 py-4">
          <p className="text-sm font-semibold">Panel Admin</p>
          <p className="truncate text-xs text-muted-foreground">GIIS Grade 6 Jannatul Firdaus</p>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          <NavGroup>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(item.href)}
                icon={item.icon}
              />
            ))}
          </NavGroup>
          <NavGroup title="Master Data">
            {MASTER_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(item.href)}
              />
            ))}
          </NavGroup>
        </nav>
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <span className="truncate text-xs text-muted-foreground">{username}</span>
          <LogoutButton compact />
        </div>
      </aside>

      {/* Topbar mobile.
          WAJIB `fixed`, bukan `sticky`: AdminNav dirender sebagai anak dari
          baris `flex` yang juga jadi induk <main>. Kalau topbar ikut jadi
          flex item, dia mengambil lebar sehingga <main> hanya menyisakan
          ~215px dari 390px -> semua halaman jadi overflow. Fixed berarti
          keluar dari alur flex; ruangnya diganti padding-top di layout. */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 border-b bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Panel Admin</p>
          <p className="truncate text-xs text-muted-foreground">{username}</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu"
          aria-expanded={drawerOpen}
          className="flex h-9 w-9 items-center justify-center rounded-md border shadow-sm"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Drawer mobile */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop sengaja <div>, bukan <button>: kalau jadi button, ia
              menabrak tombol "Tutup" di Nama aksesibel yang sama dan ikut
              masuk ke tab order. Penutupan lewat tombol X atau Escape. */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Menu</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-8 w-8 items-center justify-center rounded-md border"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3">
              <NavGroup>
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(item.href)}
                    icon={item.icon}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                ))}
              </NavGroup>
              <NavGroup title="Master Data">
                {MASTER_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(item.href)}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                ))}
              </NavGroup>
            </nav>
            <div className="border-t p-3">
              <LogoutButton className="w-full justify-center" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white lg:hidden">
        {NAV_ITEMS.filter((item) => item.mobile).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function NavGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div>
      {title ? (
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  label,
  active,
  icon: Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
        active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
