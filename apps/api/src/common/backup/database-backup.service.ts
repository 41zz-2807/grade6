import { Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";
import { fileStamp } from "../utils/datetime";

/**
 * Backup database harian: `pg_dump` -> gzip -> Buffer, siap dikirim ke Telegram.
 *
 * Koneksi diambil dari `DATABASE_URL` (sumber yang sama dengan Prisma), bukan
 * dari DB_* terpisah, supaya tidak ada dua konfigurasi yang bisa berbeda.
 * Password dikirim lewat env `PGPASSWORD`, bukan argumen, supaya tidak
 * terlihat di daftar proses.
 */
@Injectable()
export class DatabaseBackupService {
  /** Nama file: `grade6-kas-YYYYMMDD-HHmmss.sql.gz`. */
  async create(): Promise<{ fileName: string; buffer: Buffer }> {
    const buffer = await this.dump();
    return {
      fileName: `grade6-kas-${fileStamp()}.sql.gz`,
      buffer: gzipSync(buffer),
    };
  }

  private dump(): Promise<Buffer> {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum di-set, backup tidak bisa dibuat.");

    const parsed = new URL(url);
    const args = [
      "--host", parsed.hostname,
      "--port", parsed.port || "5432",
      "--username", decodeURIComponent(parsed.username),
      "--dbname", parsed.pathname.replace(/^\//, ""),
      // Tanpa owner/privilege supaya dump bisa di-restore ke user lain.
      "--no-owner",
      "--no-privileges",
    ];
    const env = { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password) };

    return new Promise((resolve, reject) => {
      const child = spawn("pg_dump", args, { env });
      const chunks: Buffer[] = [];
      const errors: Buffer[] = [];
      // Data sekolah kecil; lebih dari 2 menit berarti ada yang macet.
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("pg_dump timeout (120 detik)."));
      }, 120_000);

      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
      // `error` muncul kalau pg_dump tidak terpasang (ENOENT), bukan exit code.
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const detail = Buffer.concat(errors).toString().trim();
          reject(new Error(`pg_dump gagal (exit ${code}): ${detail}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
