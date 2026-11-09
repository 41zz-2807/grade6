/**
 * Mengganti password admin langsung di tabel `users`.
 * Dipanggil oleh scripts/change-admin-password.sh.
 *
 * Password dibaca dari STDIN (bukan argv) supaya tidak muncul di `ps` / history.
 * Jalankan: echo -n 'password-baru' | node dist/scripts/change-admin-password.js <username>
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const MIN_LENGTH = 8;
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
    console.error("Usage: change-admin-password.js <username>   (password dibaca dari stdin)");
    process.exit(2);
  }

  const password = (await readStdin()).replace(/\r?\n$/, "");
  if (password.length < MIN_LENGTH) {
    console.error(`Password terlalu pendek (minimal ${MIN_LENGTH} karakter).`);
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`User tidak ditemukan: ${username}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Ganti password juga membuka kunci & mereset hitungan gagal login.
        lockedUntil: null,
        failedLoginCount: 0,
      },
    });

    // Verifikasi ulang hash yang tersimpan.
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    const ok = saved ? await bcrypt.compare(password, saved.passwordHash) : false;
    if (!ok) {
      console.error("Gagal verifikasi hash password setelah update.");
      process.exit(1);
    }

    console.log(`Password untuk '${username}' berhasil diganti (bcrypt, ${BCRYPT_ROUNDS} rounds).`);
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.log("Akun juga dibuka dari status terkunci.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Gagal mengganti password:", error instanceof Error ? error.message : error);
  process.exit(1);
});
