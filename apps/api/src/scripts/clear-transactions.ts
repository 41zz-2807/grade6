/**
 * Menghapus SELURUH data transaksi (pemasukan + pengeluaran + bukti transfer)
 * dan mereset tagihan iuran semua siswa.
 *
 * Dipanggil oleh scripts/clear-transactions.sh.
 *
 *   node dist/scripts/clear-transactions.js --dry-run   # hanya tampilkan ringkasan
 *   node dist/scripts/clear-transactions.js             # benar-benar menghapus
 *
 * Master data TIDAK disentuh: siswa, kategori pemasukan, rekening, popup,
 * masa ajaran, pengaturan, dan seluruh akun admin tetap utuh.
 */
import { PrismaClient } from "@prisma/client";
import { removeProofFiles } from "../common/upload/upload.config";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  try {
    const [incomeCount, expenseCount, studentCount, incomeTotal, expenseTotal] =
      await Promise.all([
        prisma.income.count(),
        prisma.expense.count(),
        prisma.student.count(),
        prisma.income.aggregate({ _sum: { amount: true } }),
        prisma.expense.aggregate({ _sum: { amount: true } }),
      ]);

    const rupiah = (value: { _sum: { amount: unknown } }) => {
      const n = Number(value._sum.amount ?? 0);
      return `Rp ${n.toLocaleString("id-ID")}`;
    };

    console.log("Ringkasan data transaksi:");
    console.log(`  pemasukan   : ${incomeCount} transaksi (${rupiah(incomeTotal)})`);
    console.log(`  pengeluaran : ${expenseCount} transaksi (${rupiah(expenseTotal)})`);
    console.log(`  siswa       : ${studentCount} (tagihan iuran akan di-reset, datanya tetap ada)`);

    if (dryRun) {
      console.log("");
      console.log("Mode dry-run: tidak ada yang dihapus.");
      return;
    }

    if (incomeCount === 0 && expenseCount === 0) {
      console.log("");
      console.log("Tidak ada transaksi untuk dihapus.");
      return;
    }

    // IncomeProof & ExpenseProof ikut terhapus lewat onDelete: Cascade, jadi
    // nama file HARUS diambil lebih dulu - sesudah deleteMany barisnya sudah
    // hilang dan file di disk jadi yatim yang tidak pernah dibersihkan.
    const [incomeProofs, expenseProofs] = await Promise.all([
      prisma.incomeProof.findMany({ select: { fileName: true } }),
      prisma.expenseProof.findMany({ select: { fileName: true } }),
    ]);
    const fileNames = [...incomeProofs, ...expenseProofs].map((p) => p.fileName);

    // Reset tagihan di transaksi yang sama dengan hapus transaksi, supaya tidak
    // pernah ada keadaan setengah jadi: siswa sudah tagihan 0 tapi transaksinya
    // masih ada (atau sebaliknya).
    const [deletedIncomes, deletedExpenses, resetStudents] = await prisma.$transaction([
      prisma.income.deleteMany(),
      prisma.expense.deleteMany(),
      prisma.student.updateMany({
        data: {
          totalKasPaid: 0,
          totalKomitePaid: 0,
          statusKasLunas: false,
          statusKomiteLunas: false,
        },
      }),
    ]);

    // File bukti dihapus setelah commit. Kalau langkah ini gagal, yang tertinggal
    // hanya file yatim di disk - database tetap konsisten dan tidak ada transaksi
    // palsu yang muncul di laporan. Hapus manual: rm di dalam UPLOAD_DIR.
    await removeProofFiles(fileNames);

    console.log("");
    console.log("Selesai:");
    console.log(`  pemasukan dihapus   : ${deletedIncomes.count}`);
    console.log(`  pengeluaran dihapus : ${deletedExpenses.count}`);
    console.log(`  file bukti dihapus  : ${fileNames.length}`);
    console.log(`  siswa di-reset      : ${resetStudents.count}`);
    console.log("Master data (siswa, rekening, kategori, masa ajaran, pengaturan) tidak berubah.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Gagal membersihkan data transaksi:", error instanceof Error ? error.message : error);
  process.exit(1);
});
