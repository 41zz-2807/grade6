import { BadRequestException, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { diskStorage } from "multer";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import {
  ALLOWED_PROOF_MIME_TYPES,
  MAX_PROOFS_PER_TRANSACTION,
  MAX_PROOF_SIZE_BYTES,
} from "../constants/cash-rules";

/**
 * Opsi multer dibaca langsung dari process.env (bukan DI) karena options ini
 * dipakai di decorator @UseInterceptors, yang dievaluasi sebelum instance
 * controller siap - property `this` belum ter-assign di titik itu.
 * ConfigModule sudah memuat .env ke process.env saat boot.
 */

/** Bentuk file yang dipakai service setelah dinormalisasi. */
export interface UploadedProof {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Direktori tujuan upload bukti transaksi.
 *
 * WAJIB di luar source tree aplikasi. Kalau UPLOAD_DIR menunjuk ke
 * `public/` milik Next.js, semua bukti transfer akan ikut ter-serve sebagai
 * aset statis - Anyone bisa membukanya tanpa login. `assertUploadDirIsSafe`
 * dipakai saat boot untuk menolak konfigurasi seperti itu.
 */
export function uploadDirectory(): string {
  const dir = process.env.UPLOAD_DIR || "/app/uploads";
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Path yang tidak boleh dipakai sebagai UPLOAD_DIR. */
const FORBIDDEN_SEGMENTS = ["public", "static", "dist", ".next"];

export function assertUploadDirIsSafe(configured?: string): void {
  const dir = resolve(configured || process.env.UPLOAD_DIR || "/app/uploads");
  const segments = dir.split(/[\\/]+/);

  const bad = FORBIDDEN_SEGMENTS.find((segment) => segments.includes(segment));
  if (bad) {
    throw new Error(
      `UPLOAD_DIR tidak boleh berada di dalam folder "${bad}" (ditentukan: ${dir}). ` +
        "Berkas bukti akan ter-expose sebagai aset statis tanpa autentikasi. " +
        "Gunakan volume Docker, contoh: /app/uploads",
    );
  }
  new Logger("Upload").log(`Bukti transaksi disimpan di: ${dir} (di luar source tree aplikasi)`);
}

export function proofUploadOptions(): MulterOptions {
  const dir = uploadDirectory();
  const allowed = new Set<string>(ALLOWED_PROOF_MIME_TYPES);
  const maxSize = Number(process.env.MAX_UPLOAD_MB || "10") * 1024 * 1024;

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      // Nama file diacak dengan uuid agar tidak menebak / menimpa file lain.
      filename: (_req, file, cb) =>
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: {
      fileSize: Math.min(maxSize, MAX_PROOF_SIZE_BYTES),
      files: MAX_PROOFS_PER_TRANSACTION,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        cb(
          new BadRequestException(
            `Tipe file tidak didukung: ${file.mimetype}. Gunakan JPG, PNG, WEBP, atau PDF.`,
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
  };
}

/** Ubah hasil multer menjadi bentuk yang siap disimpan ke database. */
export function toUploadedProof(file: Express.Multer.File): UploadedProof {
  return {
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

/** Hapus file bukti dari disk (dipanggil saat transaksi gagal / dihapus). */
export async function removeProofFiles(fileNames: string[]): Promise<void> {
  const dir = uploadDirectory();
  await Promise.all(fileNames.map((name) => unlink(join(dir, name)).catch(() => undefined)));
}
