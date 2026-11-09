"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, type ApiError } from "@/lib/admin-api";

/**
 * HARUS sama dengan SESSION_IDLE_MINUTES di
 * apps/api/src/common/constants/auth-rules.ts. Kalau diubah di satu sisi saja,
 * frontend akan mengarahkan login terlalu cepat/lambat dibanding server.
 */
const IDLE_MINUTES = 5;
const IDLE_MS = IDLE_MINUTES * 60_000;

/**
 * Jeda minimum antar permintaan refresh.
 *
 * Event aktivitas (`pointerdown`, `keydown`, ...) bisa membanjiri - satu klik
 * saja bisa memicu puluhan event. Tanpa jeda ini, kuota rate limit global
 * (API_RATE_LIMIT) habis dalam hitungan detik.
 */
const REFRESH_MIN_INTERVAL_MS = 60_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Menjaga sesi admin tetap hidup selama ada aktivitas, dan mengeluarkan admin
 * yang sudah diam lebih dari 5 menit.
 *
 * Enforcement sebenarnya ada di server: token sesi berumur 5 menit, dan setiap
 * ada aktivitas endpoint `POST /api/auth/refresh` memberi token baru. Jadi
 * komponen ini tidak bisa "menghidupkan" sesi yang sudah kedaluwarsa - kalau
 * token sudah habis, refresh akan 401 dan user diarahkan login ulang.
 *
 * Timer idle di sini supaya user diberi tahu SEBELUM mencoba menyimpan form,
 * bukan baru gagal saat menekan tombol.
 */
export function SessionKeepAlive() {
  const router = useRouter();
  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);
  const handledRef = useRef(false);

  const endSession = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    router.replace("/gema/login?expired=1");
    router.refresh();
  }, [router]);

  const refreshSession = useCallback(async () => {
    if (inFlightRef.current || handledRef.current) return;

    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_MIN_INTERVAL_MS) return;
    lastRefreshRef.current = now;
    inFlightRef.current = true;

    try {
      await apiFetch("/api/auth/refresh", { method: "POST" });
    } catch (err) {
      // 401 = token sudah kedaluwarsa (idle terlalu lama). Error lain
      // (mis. 403 CSRF sementara, 429 rate limit) sengaja diabaikan: sesi
      // sebenarnya masih hidup dan request berikutnya akan berhasil.
      if ((err as ApiError).status === 401) endSession();
    } finally {
      inFlightRef.current = false;
    }
  }, [endSession]);

  useEffect(() => {
    // Perpanjang begitu halaman admin dibuka, supaya sesi yang tersisa 1 menit
    // tidak langsung habis saat admin mulai bekerja.
    void refreshSession();

    const onActivity = () => void refreshSession();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    // Timer idle di-reset tiap ada aktivitas, jadi user yang aktif terus
    // tidak pernah sampai ke batas.
    let idleTimer = window.setTimeout(endSession, IDLE_MS);
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(endSession, IDLE_MS);
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    }

    return () => {
      window.clearTimeout(idleTimer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
        window.removeEventListener(event, resetIdleTimer);
      }
    };
  }, [refreshSession, endSession]);

  return null;
}
