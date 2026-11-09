import { PrismaClient, IncomeCategoryType } from "@prisma/client";
import { DEFAULT_CASH_RULES } from "../src/common/constants/cash-rules";
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";

/**
 * Seed data awal.
 *  - Akun admin default (password WAJIB diganti lewat scripts/change-admin-password.sh)
 *  - 3 kategori pemasukan
 *  - Masa ajaran default
 *  - Pengaturan awal (rekening, popup, telegram)
 *
 * Idempotent: aman dijalankan berulang kali.
 */
const prisma = new PrismaClient();

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || "admin";
// Tanpa fallback hardcode: password acak kalau env kosong, dicetak saat seed.
const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD || randomBytes(12).toString("base64url");

const CATEGORIES = [
  { name: IncomeCategoryType.KAS_KELAS, label: "Iuran Kas Kelas", order: 1 },
  { name: IncomeCategoryType.KOMITE, label: "Iuran Komite", order: 2 },
  { name: IncomeCategoryType.UMUM, label: "Pemasukan Umum", order: 3 },
];

const SETTINGS = [
  {
    key: "bank.name",
    value: "Bank Syariah Indonesia",
    description: "Nama bank rekening penampung kas",
  },
  {
    key: "bank.accountNumber",
    value: "",
    description: "Nomor rekening penampung iuran",
  },
  {
    key: "bank.accountHolder",
    value: "Komite Sekolah GIIS Grade 6 Jannatul Firdaus",
    description: "Nama atas rekening",
  },
  {
    key: "popup.info",
    value: "Iuran kas kelas Rp 15.000/bulan, iuran komite Rp 75.000 per masa ajaran.",
    description: "Informasi yang ditampilkan di popup awal aplikasi",
  },
  {
    key: "kas.monthlyAmount",
    value: String(DEFAULT_CASH_RULES.kasMonthly),
    description: "Iuran kas kelas per bulan (Rupiah). Diubah lewat PATCH /api/cash-rules",
  },
  {
    key: "kas.maxMonths",
    value: String(DEFAULT_CASH_RULES.kasMaxMonths),
    description: "Jumlah bulan maksimal iuran kas kelas. Diubah lewat PATCH /api/cash-rules",
  },
  {
    key: "komite.amount",
    value: String(DEFAULT_CASH_RULES.komiteAmount),
    description: "Iuran komite per masa ajaran (Rupiah). Diubah lewat PATCH /api/cash-rules",
  },
  {
    key: "public.showStudentName",
    value: "false",
    description:
      "true = nama siswa tampil utuh di API publik; false (default) = dimasker, demi privasi",
  },
  {
    key: "school.name",
    value: "GIIS Grade 6 Jannatul Firdaus",
    description: "Nama sekolah",
  },
  {
    key: "telegram.botToken",
    value: process.env.TELEGRAM_BOT_TOKEN || "",
    description: "Token bot Telegram untuk notifikasi",
    isSecret: true,
  },
  {
    key: "telegram.chatId",
    value: process.env.TELEGRAM_CHAT_ID || "",
    description: "Chat ID tujuan notifikasi",
  },
];

async function main() {
  // --- Admin -------------------------------------------------------------
  const existingAdmin = await prisma.user.findUnique({
    where: { username: DEFAULT_ADMIN_USERNAME },
  });

  if (existingAdmin) {
    // Jangan pernah menimpa password hasil scripts/change-admin-password.sh.
    console.log(`Seed: admin '${DEFAULT_ADMIN_USERNAME}' sudah ada, password tidak diubah.`);
  } else {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    await prisma.user.create({ data: { username: DEFAULT_ADMIN_USERNAME, passwordHash } });
    console.log(`Seed: admin '${DEFAULT_ADMIN_USERNAME}' dibuat.`);
  }

  // --- Kategori pemasukan ----------------------------------------------
  for (const category of CATEGORIES) {
    await prisma.incomeCategory.upsert({
      where: { name: category.name },
      create: category,
      update: { label: category.label, order: category.order },
    });
  }

  // --- Masa ajaran default ---------------------------------------------
  const currentYear = new Date().getFullYear();
  const defaultYear = `${currentYear}/${currentYear + 1}`;
  const existingYears = await prisma.academicYear.count();
  if (existingYears === 0) {
    await prisma.academicYear.create({
      data: { name: defaultYear, startMonth: 7, endMonth: 6, isActive: true },
    });
  }

  // --- Pengaturan --------------------------------------------------------
  for (const setting of SETTINGS) {
    // Kredensial Telegram tidak diambil dari .env (sengaja), tapi tetap boleh
    // diisi lewat environment saat seeding manual. Kalau kosong, jangan dibuat -
    // biarkan scripts/sync-telegram-settings.sh yang mengisinya dari DB.
    const existing = await prisma.setting.findUnique({ where: { key: setting.key } });
    // Nilai iuran kas/komite milik admin: jangan ditimpa oleh default seed.
    if (existing && (setting.key in DEFAULT_CASH_RULES)) continue;
    if (setting.value === "" && existing) continue;

    await prisma.setting.upsert({
      where: { key: setting.key },
      create: setting,
      update: { description: setting.description, isSecret: setting.isSecret ?? false },
    });
  }

  console.log("Seed selesai:");
  console.log(`  - kategori    : ${CATEGORIES.map((c) => c.name).join(", ")}`);
  console.log(`  - masa ajaran : ${defaultYear}`);
  console.log(`  - settings    : ${SETTINGS.length} baris`);

  if (!existingAdmin) {
    console.log("");
    console.log(`  Password awal : ${DEFAULT_ADMIN_PASSWORD}`);
    console.log("  GANTI SEGERA :");
    console.log(`    ./scripts/change-admin-password.sh ${DEFAULT_ADMIN_USERNAME} 'password-baru-anda'`);
  }
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
