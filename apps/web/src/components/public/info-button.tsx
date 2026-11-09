"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicPopup } from "@/lib/public-api";

/**
 * Tombol "Informasi" yang membuka modal berisi isi dari tabel `popup_infos`
 * (diambil lewat endpoint publik /api/public/popup).
 *
 * Popup diambil ulang saat dialog dibuka supaya informasinya selalu terbaru
 * tanpa perlu reload halaman.
 */
export function InfoButton({ fallback }: { fallback: PublicPopup[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PublicPopup[]>(fallback);
  const [loading, setLoading] = useState(false);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const res = await fetch("/api/public/popup", { cache: "no-store" });
      if (res.ok) setItems(await res.json());
    } catch {
      // Pakai data fallback yang sudah di-render server.
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <Info className="mr-1.5 h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Informasi</span>
        <span className="sm:hidden">Info</span>
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informasi Kelas</DialogTitle>
          <DialogDescription>
            Pengumuman resmi dari pihak sekolah dan komite.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Memuat informasi...
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada informasi yang dipublikasikan.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((popup) => (
                <li key={popup.id} className="rounded-lg border bg-muted/20 p-3">
                  <h3 className="text-sm font-semibold">{popup.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {popup.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
