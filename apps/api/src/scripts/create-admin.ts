/**
 * Menambahkan user admin baru di tabel `users`.
 * Dipanggil oleh scripts/create-admin.sh.
 *
 * Password dibaca dari STDIN (bukan argv) supaya tidak muncul di `ps` / history.
 * Jalankan: echo -n 'password-kuat' | node dist/scripts/create-admin.js <username>
 *
 * Catatan: model `User` belum punya kolom `role`, jadi semua user yang ada
 * otomatis admin (lihat agents.md, daftar "Yang belum ada"). User baru yang
 * dibuat script ini karena itu juga admin penuh.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const MIN_LENGTH = 8;
/** Sama dengan batas `username` di LoginDto — username yang lebih panjang
 *  akan dibuatkan, tapi tidak akan pernah bisa login. */
const MAX_LENGTH = 60;
const BCRYPT_ROUNDS = 12;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const username = process.argv[2]?.trim();
  if (!username) {
    console.error("Usage: create-admin.js <username>   (password dibaca dari stdin)");
    process.exit(2);
  }
  if (username.length > MAX_LENGTH) {
    console.error(`Username terlalu panjang (maksimal ${MAX_LENGTH} karakter).`);
    process.exit(2);
  }

  const password = (await readStdin()).replace(/\r?\n$/, "");
  if (password.length < MIN_LENGTH) {
    console.error(`Password terlalu pendek (minimal ${MIN_LENGTH} karakter).`);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      console.error(`Username '${username}' sudah dipakai.`);
      console.error("Untuk mengganti passwordnya, pakai scripts/change-admin-password.sh.");
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let created;
    try {
      created = await prisma.user.create({ data: { username, passwordHash } });
    } catch (error) {
      // P2002 = unique constraint. Possible kalau dua proses create berjalan
      // bersamaan, jadi pengecekan di atas saja tidak cukup.
      if ((error as { code?: string })?.code === "P2002") {
        console.error(`Username '${username}' sudah dipakai.`);
        process.exit(1);
      }
      throw error;
    }

    // Verifikasi ulang hash yang tersimpan, sama seperti change-admin-password.
    const saved = await prisma.user.findUnique({ where: { id: created.id } });
    const ok = saved ? await bcrypt.compare(password, saved.passwordHash) : false;
    if (!ok) {
      // Jangan tinggalkan akun yang passwordnya tidak diketahui.
      await prisma.user.delete({ where: { id: created.id } });
      console.error("Gagal verifikasi hash password. User dibatalkan.");
      process.exit(1);
    }

    console.log(`Admin '${username}' berhasil dibuat (id: ${created.id}, bcrypt, ${BCRYPT_ROUNDS} rounds).`);
    console.log("Login di /gema/login memakai username tersebut.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Gagal membuat admin:", error instanceof Error ? error.message : error);
  process.exit(1);
});
