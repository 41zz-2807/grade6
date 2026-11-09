"use client";

/** Nama cookie CSRF harus sama dengan konstanta di backend. */
const CSRF_COOKIE = "gema_csrf";
const CSRF_HEADER = "x-csrf-token";

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export type ApiError = {
  message: string;
  captchaRequired?: boolean;
  status: number;
};

/**
 * Fetch ke API dengan header CSRF.
 * Session rides on cookie httpOnly, jadi tidak perlu mengirim token manual -
 * tapi request yang mengubah data wajib menyertakan token CSRF.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { csrf?: boolean } = {},
): Promise<T> {
  const { csrf = true, headers, ...rest } = init;

  const finalHeaders = new Headers(headers);
  if (csrf && rest.method && !["GET", "HEAD"].includes(rest.method.toUpperCase())) {
    finalHeaders.set(CSRF_HEADER, readCookie(CSRF_COOKIE));
  }
  if (rest.body && !(rest.body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...rest,
    headers: finalHeaders,
    credentials: "same-origin",
  });

  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      /* body bukan JSON */
    }
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message || `HTTP ${res.status}`;
    throw { message, captchaRequired: payload?.captchaRequired, status: res.status } as ApiError;
  }

  return res.status === 204 ? (undefined as T) : await res.json();
}

/**
 * Ambil daftar data. Menoleransi dua bentuk respons:
 *   - array biasa                    (mis. /api/bank-accounts)
 *   - objek terpaginate { items }    (mis. /api/students)
 * Tanpa normalisasi ini, pemanggil akan melakukan `items.filter` pada objek.
 */
export async function fetchList<T>(path: string): Promise<T[]> {
  const data = await apiFetch<T[] | { items: T[] }>(path);
  return Array.isArray(data) ? data : (data?.items ?? []);
}
