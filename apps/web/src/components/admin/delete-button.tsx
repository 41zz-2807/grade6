"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Tombol hapus dengan konfirmasi, mencegah klik tidak sengaja. */
export function DeleteButton({
  onConfirm,
  label = "Hapus",
  confirmText = "Hapus data ini? Tindakan ini tidak bisa dibatalkan.",
  busy = false,
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  confirmText?: string;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="text-red-700 hover:bg-red-50"
      >
        <Trash2 className="mr-1 h-4 w-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi hapus</DialogTitle>
            <DialogDescription>{confirmText}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={working}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={working}
              onClick={async () => {
                setWorking(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working ? "Menghapus..." : "Ya, hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
