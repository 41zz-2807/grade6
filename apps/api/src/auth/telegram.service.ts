import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const API_BASE = "https://api.telegram.org";
const TIMEOUT_MS = 8_000;
/** Dokumen (PDF/backup) lebih besar dari pesan teks, butuh waktu lebih lama. */
const DOCUMENT_TIMEOUT_MS = 60_000;

/**
 * Notifikasi ke Telegram.
 *
 * Token & chat id SELALU dibaca dari tabel `settings`, bukan dari environment:
 *   settings['telegram.botToken'] dan settings['telegram.chatId']
 * Jadi credential Telegram tidak perlu ada di .env / docker-compose.
 *
 * Kegagalan tidak pernah dilempar ke pemanggil - Telegram yang lambat/down
 * tidak boleh menggagalkan login atau cron. Pemanggil yang butuh tahu
 * memakai nilai balik boolean; untuk jalur login, Pakai `notify()`.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Kirim pesan. Return true bila Telegram API responded sukses. */
  async send(message: string, overrideChatId?: string): Promise<boolean> {
    const [token, chatId] = await this.getCredentials();
    const target = overrideChatId?.trim() || chatId;

    if (!token || !target) {
      this.logger.warn(
        "Notifikasi Telegram dilewati: telegram.botToken / telegram.chatId belum diisi di tabel settings.",
      );
      return false;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target,
          text: message,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.error(`Telegram API menolak (HTTP ${res.status}): ${await res.text()}`);
        return false;
      }
      this.logger.log("Notifikasi Telegram terkirim.");
      return true;
    } catch (error) {
      this.logger.error(
        `Gagal kirim notifikasi Telegram: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Kirim tanpa menunggu - dipakai agar request login tidak ikut lambat. */
  notify(message: string): void {
    void this.send(message);
  }

  /**
   * Kirim dokumen (PDF laporan / backup database).
   *
   * Batas Telegram 50 MB per dokumen. `shortcut: tanpa cek ukuran di sini -
   * data sekolah jauh di bawah batas; tolak lebih awal kalau suatu saat
   * backup melewati 45 MB.`
   */
  async sendDocument(
    fileName: string,
    data: Buffer,
    caption?: string,
    mimeType = "application/octet-stream",
  ): Promise<boolean> {
    const [token, chatId] = await this.getCredentials();

    if (!token || !chatId) {
      this.logger.warn(
        "Dokumen Telegram dilewati: telegram.botToken / telegram.chatId belum diisi di tabel settings.",
      );
      return false;
    }

    const form = new FormData();
    form.set("chat_id", chatId);
    if (caption) form.set("caption", caption);
    form.set("document", new Blob([new Uint8Array(data)], { type: mimeType }), fileName);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOCUMENT_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/bot${token}/sendDocument`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.error(
          `Telegram menolak dokumen ${fileName} (HTTP ${res.status}): ${await res.text()}`,
        );
        return false;
      }
      this.logger.log(`Dokumen Telegram terkirim: ${fileName}.`);
      return true;
    } catch (error) {
      this.logger.error(
        `Gagal kirim dokumen ${fileName}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private async getCredentials(): Promise<[string, string]> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: ["telegram.botToken", "telegram.chatId"] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((row) => [row.key, row.value.trim()]));
    return [map.get("telegram.botToken") ?? "", map.get("telegram.chatId") ?? ""];
  }
}
