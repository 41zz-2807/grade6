"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { inputClass } from "./page-parts";

/**
 * Format ribuan gaya Indonesia: 45000 -> "45.000", 1234567 -> "1.234.567".
 * Semua karakter non-angka dibuang, jadi input ini selalu berisi digit saja.
 */
export function formatThousands(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type Props = {
  id?: string;
  /** Nilai dalam bentuk digit mentah, mis. "45000". Boleh "" saat kosong. */
  value: string;
  /** Menerima digit mentah (tanpa pemisah) - siap dikirim ke API. */
  onChange: (plainDigits: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Input nominal Rupiah dengan pemisah ribuan.
 *
 * Kenapa bukan `type="number"`: input number menolak karakter non-angka, jadi
 * pemisah ribuan mustahil dimasukkan. Solusinya `type="text"` + `inputMode=
 * "numeric"` (tetap memunculkan keypad angka di HP) dan format dilakukan di sini.
 *
 * State di luar tetap menyimpan digit mentah, sehingga payload ke API tidak
 * pernah ikut berformat ("45000", bukan "45.000").
 */
export function RupiahInput({
  id,
  value,
  onChange,
  placeholder = "0",
  className,
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label={ariaLabel}
      value={formatThousands(value)}
      placeholder={placeholder}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        onChange(digits);
        // Kursor selalu ditarik ke akhir supaya pengetikan berikutnya menyambung
        // di belakang (kasus umum: mengisi dari kosong ke kanan).
        const caret = formatThousands(digits).length;
        requestAnimationFrame(() => {
          const el = ref.current;
          if (!el) return;
          el.setSelectionRange(caret, caret);
        });
      }}
      className={cn(inputClass, "tabular-nums", className)}
    />
  );
}
