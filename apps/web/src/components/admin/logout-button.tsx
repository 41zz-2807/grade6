"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export function LogoutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      // Varian compact hanya ikon, jadi aria-label wajib agar tetap ada
      // nama yang bisa dibaca screen reader.
      aria-label={compact ? "Keluar" : undefined}
      className={cn(className)}
      onClick={async () => {
        setLoading(true);
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
        } finally {
          router.replace("/gema/login");
          router.refresh();
        }
      }}
    >
      {!compact ? <LogOut className="mr-1.5 h-4 w-4" aria-hidden /> : null}
      {compact ? <LogOut className="h-4 w-4" aria-hidden /> : loading ? "Keluar..." : "Keluar"}
    </Button>
  );
}
