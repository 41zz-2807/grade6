"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, type ApiError } from "@/lib/admin-api";

type Captcha = { question: string; token: string; expiresIn: number };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  // Alasan logout dipindah lewat query param (?expired=1) oleh SessionKeepAlive.
  // Dibaca langsung dari location, bukan useSearchParams(), supaya halaman ini
  // tetap bisa di-prerender tanpa harus dibungkus <Suspense>.
  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);

  const loadCaptcha = useCallback(async () => {
    try {
      const data = await apiFetch<Captcha>("/api/auth/captcha", { method: "GET", csrf: false });
      setCaptcha(data);
      setCaptchaAnswer("");
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setExpired(false);
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          ...(captchaRequired && captcha
            ? { captchaToken: captcha.token, captchaAnswer }
            : {}),
        }),
      });
      router.replace("/gema/dashboard");
      router.refresh();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login gagal.");
      if (apiError.captchaRequired && !captchaRequired) {
        setCaptchaRequired(true);
        await loadCaptcha();
      }
      setCaptchaAnswer("");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Panel Admin</h1>
          <p className="text-sm text-muted-foreground">
            GIIS Grade 6 Jannatul Firdaus — Sistem Uang Kas
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border bg-white p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {captchaRequired && (
            <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                Terlalu banyak percobaan gagal. Jawab pertanyaan berikut.
              </p>
              <div className="flex items-center gap-2">
                <span className="select-none font-mono text-sm font-semibold">
                  {captcha ? captcha.question : "..."}
                </span>
                <input
                  aria-label="Jawaban CAPTCHA"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="w-20 rounded-md border bg-white px-2 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  ganti
                </button>
              </div>
            </div>
          )}

          {expired && (
            <p
              role="status"
              className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              Sesi berakhir, silakan login kembali.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || (captchaRequired && !captcha)}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}
