"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Unduh laporan PDF dari endpoint publik.
 *
 * Dipakai `<a>` (bukan `<button>` + fetch) supaya browser menangani dialog
 * simpan file dan nama file dari header `Content-Disposition` dipakai apa
 * adanya. `target="_blank"` supaya halaman publik tidak kehilangan state.
 */
export function DownloadPdfButton({ className }: { className?: string }) {
  return (
    <a
      href="/api/public/laporan.pdf"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap", className)}
    >
      <Download className="mr-1.5 h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Download Laporan PDF</span>
      <span className="sm:hidden">Unduh PDF</span>
    </a>
  );
}
