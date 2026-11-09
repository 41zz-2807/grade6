import { cookies } from "next/headers";

const API_ORIGIN = process.env.API_INTERNAL_URL || "http://127.0.0.1:3001";

export type SessionUser = { id: string; username: string };

/**
 * Nama cookie sesi. Sama dengan SESSION_COOKIE di backend
 * (apps/api/src/common/constants/auth-rules.ts) - dibecause app web tidak
 * mengimpor kode API, sama seperti CSRF_COOKIE di lib/admin-api.ts.
 */
const SESSION_COOKIE = "gema_session";

/**
 * Apakah ada cookie sesi, valid atau tidak.
 *
 * Dipakai untuk membedakan dua jenis sampai ke halaman login:
 *   - tidak ada cookie sama sekali       -> tamu baru, tidak perlu pesan
 *   - cookie ada tapi API menolak (401)  -> sesi habis karena idle
 */
export async function hasSessionCookie(): Promise<boolean> {
  return cookies().has(SESSION_COOKIE);
}

/**
 * Cek sesi di sisi server dengan meneruskan cookie browser ke API internal.
 * Dipakai hanya oleh Server Component di dalam /gema.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieHeader = cookies().toString();
  if (!cookieHeader) return null;

  try {
    const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? null;
  } catch {
    return null;
  }
}
