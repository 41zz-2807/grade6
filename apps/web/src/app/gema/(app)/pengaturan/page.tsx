"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, KeyRound, Save, Send, ShieldCheck } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/admin-api";
import { formatTanggalWaktu } from "@/lib/format";

const MASK = "********";

type LoginLog = {
  id: string;
  ip: string;
  userAgent: string | null;
  success: boolean;
  timestamp: string;
  user: { username: string } | null;
};

export default function PengaturanPage() {
  return (
    <>
      <PageHeader title="Pengaturan" description="Notifikasi Telegram dan keamanan akun admin." />
      <TelegramSettings />
      <DailyReportSettings />
      <KeamananSettings />
      <LoginLogSection />
    </>
  );
}

function TelegramSettings() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [tokenTerisi, setTokenTerisi] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const settings = await apiFetch<{ key: string; value: string; isSecret: boolean }[]>(
        "/api/settings",
      );
      const token = settings.find((s) => s.key === "telegram.botToken");
      const chat = settings.find((s) => s.key === "telegram.chatId");
      setTokenTerisi(Boolean(token?.value));
      setChatId(chat?.value ?? "");
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      // Nilai bertanda ******** berarti "tidak diubah" - API tidak pernah
      // mengembalikan isi token asli, jadi form tidak boleh mengirimnya balik.
      if (botToken.trim()) {
        await apiFetch("/api/settings", {
          method: "PATCH",
          body: JSON.stringify({
            key: "telegram.botToken",
            value: botToken.trim(),
            description: "Token bot Telegram untuk notifikasi",
            isSecret: true,
          }),
        });
      }
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "telegram.chatId", value: chatId.trim() }),
      });
      setBotToken("");
      setMsg({ kind: "success", text: "Pengaturan Telegram disimpan." });
      await load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Notifikasi Telegram"
      description="Dipakai untuk memberi tahu saat ada login berhasil dan percobaan login gagal berulang."
    >
      <form onSubmit={save} className="space-y-4">
        <Field
          label="Bot Token"
          htmlFor="botToken"
          hint={
            tokenTerisi
              ? "Token tersimpan. Kosongkan field ini kalau tidak ingin mengganti."
              : "Ambil dari @BotFather. Simpan baik-baik, jangan dibagikan."
          }
        >
          <input
            id="botToken"
            type="password"
            autoComplete="off"
            className={inputClass}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={tokenTerisi ? "******** (tersimpan)" : "123456:ABC-DEF..."}
          />
        </Field>

        <Field label="Chat ID" htmlFor="chatId" hint="ID chat tujuan, bisa grup atau channel.">
          <input
            id="chatId"
            className={inputClass}
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-1001234567890"
            inputMode="numeric"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tokenTerisi && chatId ? "success" : "secondary"}>
            {tokenTerisi && chatId ? "Aktif" : "Belum lengkap"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Notifikasi dikirim tanpa awaits - Telegram down tidak memblokir login.
          </span>
        </div>

        <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

        <Button type="submit" disabled={busy}>
          <Save className="mr-1 h-4 w-4" aria-hidden />
          {busy ? "Menyimpan..." : "Simpan Pengaturan Telegram"}
        </Button>
      </form>
    </SectionCard>
  );
}

function DailyReportSettings() {
  const [status, setStatus] = useState<{ enabled: boolean; time: string; cronExpression: string | null; timezone: string } | null>(null);
  const [time, setTime] = useState("07:00");
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<typeof status>("/api/auth/daily-report");
      if (!data) return;
      setStatus(data);
      setTime(data.time);
      setEnabled(data.enabled);
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const data = await apiFetch<typeof status>("/api/auth/daily-report", {
        method: "PATCH",
        body: JSON.stringify({ enabled, time }),
      });
      setStatus(data);
      setMsg({ kind: "success", text: "Jadwal laporan harian disimpan." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await apiFetch<{
        balance: number;
        delivered: boolean;
        pdf?: boolean;
        backup?: boolean;
      }>("/api/auth/daily-report/send-now", { method: "POST" });
      const gagal = [
        !result.delivered ? "ringkasan" : null,
        !result.pdf ? "PDF" : null,
        !result.backup ? "backup" : null,
      ].filter(Boolean);
      setMsg(
        gagal.length === 0
          ? { kind: "success", text: "Ringkasan, PDF arus kas, dan backup terkirim ke Telegram." }
          : { kind: "error", text: `Gagal terkirim: ${gagal.join(", ")}. Periksa log & konfigurasi Telegram.` },
      );
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Laporan Harian"
      description="Setiap hari: ringkasan saldo, PDF seluruh arus kas, dan backup database ke Telegram."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Jam Kirim" htmlFor="reportTime" required hint="Format 24 jam, zona waktu aplikasi.">
            <input
              id="reportTime"
              type="time"
              required
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <div className="flex items-end gap-2">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Aktifkan
            </label>
          </div>
        </div>

        {status ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.enabled ? "success" : "secondary"}>
              {status.enabled ? "Aktif" : "Nonaktif"}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {status.enabled ? `Setiap ${status.time} (${status.timezone}) · cron ${status.cronExpression}` : "Laporan otomatis dimatikan."}
            </span>
          </div>
        ) : null}

        <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            <BellRing className="mr-1 h-4 w-4" aria-hidden />
            {busy ? "Menyimpan..." : "Simpan Jadwal"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={sendNow}>
            <Send className="mr-1 h-4 w-4" aria-hidden />
            Kirim Sekarang
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          "Kirim Sekarang" berguna untuk memverifikasi token &amp; chat ID tanpa menunggu
          jadwal. Batas 5 kali per menit.
        </p>
      </form>
    </SectionCard>
  );
}

function KeamananSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = passwordStrength(newPassword);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPassword !== confirmPassword) {
      setMsg({ kind: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg({ kind: "success", text: "Password berhasil diganti." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Keamanan" description="Ganti password admin yang dipakai untuk masuk.">
      <form onSubmit={save} className="space-y-4">
        <Field label="Password Saat Ini" htmlFor="currentPassword" required>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>

        <Field
          label="Password Baru"
          htmlFor="newPassword"
          required
          hint="Minimal 8 karakter, mengandung huruf dan angka."
        >
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {newPassword ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${strength.bar}`}
                  style={{ width: `${strength.percent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{strength.label}</span>
            </div>
          ) : null}
        </Field>

        <Field label="Ulangi Password Baru" htmlFor="confirmPassword" required>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Kebijakan keamanan login
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Maksimal 10 percobaan login per menit per IP.</li>
            <li>CAPTCHA wajib setelah 5 kali gagal beruntun.</li>
            <li>Akun terkunci 15 menit tiap kelipatan 5 kali gagal.</li>
            <li>Login berhasil dan gagal sangat banyak mengirim notifikasi Telegram.</li>
            <li>
              Ganti password akan membuka kunci akun dan mereset penghitung gagal login.
            </li>
          </ul>
        </div>

        <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

        <Button type="submit" disabled={busy}>
          <KeyRound className="mr-1 h-4 w-4" aria-hidden />
          {busy ? "Menyimpan..." : "Ganti Password"}
        </Button>
      </form>
    </SectionCard>
  );
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const levels = [
    { label: "Lemah", percent: 20, bar: "bg-red-500" },
    { label: "Lemah", percent: 35, bar: "bg-red-500" },
    { label: "Cukup", percent: 55, bar: "bg-amber-500" },
    { label: "Baik", percent: 75, bar: "bg-lime-500" },
    { label: "Kuat", percent: 90, bar: "bg-emerald-600" },
    { label: "Sangat kuat", percent: 100, bar: "bg-emerald-600" },
  ];
  return levels[Math.min(score, levels.length - 1)];
}

function LoginLogSection() {
  const [logs, setLogs] = useState<LoginLog[] | null>(null);

  useEffect(() => {
    apiFetch<LoginLog[]>("/api/auth/login-logs?take=20")
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  return (
    <SectionCard title="Riwayat Login Terakhir" description="20 aktivitas terakhir.">
      {!logs ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
      ) : (
        <ul className="space-y-1.5">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5 text-sm last:border-0">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant={log.success ? "success" : "destructive"}>
                  {log.success ? "Berhasil" : "Gagal"}
                </Badge>
                <span className="truncate font-mono text-xs">{log.ip}</span>
                {log.user ? <span className="truncate text-xs text-muted-foreground">{log.user.username}</span> : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatTanggalWaktu(log.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
