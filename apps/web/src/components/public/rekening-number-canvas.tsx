"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Digit mentah tanpa spasi, mis. "001667632223". */
  digits: string;
  className?: string;
};

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Tinggi kanvas dalam px. Lebar mengikuti lebar container (responsive). */
const HEIGHT = 54;
const PADDING_X = 4;

/**
 * Menggambar nomor rekening ke `<canvas>`.
 *
 * Kenapa canvas, bukan teks: angka yang dirender sebagai `<p>`/`<span>` bisa
 * diubah lewat Inspect Element lalu dipotret untuk menipu orang yang melihat
 * layar. Di canvas, angka hanya ada sebagai **piksel** - tidak ada node teks
 * di DOM yang bisa diedit, dan `document.body.innerText` tidak memuatnya.
 *
 * Penyesuaian: ukuran font mengecil otomatis supaya selalu muat, dan angka
 * di-group 4 digit dengan spasi.
 */
export function RekeningNumberCanvas({ digits, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !digits) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = Math.max(wrap.clientWidth, 120);
      const cssHeight = HEIGHT;

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const charGap = 6;
      const groupGap = 16;
      const available = cssWidth - PADDING_X * 2;
      const groups = digits.match(/.{1,4}/g) ?? [digits];

      // Font monospace: lebar tiap karakter ~0.6 x fontSize.
      const totalChars = digits.length;
      const gaps = groups.length - 1;

      let fontSize = 30;
      const widthFor = (size: number) => totalChars * size * 0.6 + (totalChars - 1) * charGap + gaps * groupGap;
      while (fontSize > 13 && widthFor(fontSize) > available) fontSize -= 1;

      const charWidth = fontSize * 0.6;
      const gap = charGap;
      const totalWidth = widthFor(fontSize);
      // Rata kiri supaya sejajar dengan label di atasnya.
      let x = PADDING_X;

      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${fontSize}px ${MONO}`;

      for (let i = 0; i < digits.length; i += 1) {
        if (i > 0) {
          x += charWidth + gap;
          // Jarak lebih lebar setiap 4 digit (pemisah group).
          if (i % 4 === 0) x += groupGap - gap;
        }
        ctx.fillText(digits[i], x, cssHeight / 2 + 1);
      }

      void totalWidth;
    };

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [digits]);

  if (!digits) return null;

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Nomor rekening (gunakan tombol Salin untuk menyalin)"
      />
    </div>
  );
}
