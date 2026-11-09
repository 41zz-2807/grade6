import { BadRequestException, Injectable } from "@nestjs/common";
import { PaymentMethod, Prisma } from "@prisma/client";
import { toNumber } from "../common/utils/money";
import { PrismaService } from "../prisma/prisma.service";
import { ReportFilterDto, TransactionType } from "./dto/report-filter.dto";

export type UnifiedTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  date: string;
  description: string;
  category: string;
  counterparty: string;
  amount: number;
  paymentMethod: PaymentMethod;
  studentId: string | null;
  academicYear: string;
  proofCount: number;
  createdAt: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ringkasan saldo global + rincian per kategori. */
  async summary(filter: ReportFilterDto) {
    const range = this.dateRange(filter);

    const incomeWhere: Prisma.IncomeWhereInput = {
      ...range,
      ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
      ...(filter.studentId ? { studentId: filter.studentId } : {}),
    };
    const expenseWhere: Prisma.ExpenseWhereInput = { ...range };

    const categories = await this.prisma.incomeCategory.findMany({ orderBy: { order: "asc" } });

    const [incomeAgg, expenseAgg, kasLunas, komiteLunas, totalStudents] =
      await this.prisma.$transaction([
        this.prisma.income.aggregate({ where: incomeWhere, _sum: { amount: true }, _count: true }),
        this.prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true }, _count: true }),
        this.prisma.student.count({ where: { statusKasLunas: true } }),
        this.prisma.student.count({ where: { statusKomiteLunas: true } }),
        this.prisma.student.count(),
      ]);

    // Terpisah dari transaksi di atas: `groupBy` di Prisma 5.22 menghasilkan tipe
    // dengan circular reference yang tidak bisa di-resolve TypeScript, jadi
    // aggregate per kategori (kategorinya hanya 3).
    const perCategory = await this.prisma.$transaction(
      categories.map((category) =>
        this.prisma.income.aggregate({
          where: { ...incomeWhere, categoryId: category.id },
          _sum: { amount: true },
          _count: true,
        }),
      ),
    );

    const totalIncome = toNumber(incomeAgg._sum.amount);
    const totalExpense = toNumber(expenseAgg._sum.amount);

    return {
      period: { from: range.date?.gte ?? null, to: range.date?.lte ?? null },
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: incomeAgg._count + expenseAgg._count,
      incomeByCategory: categories.map((category, index) => ({
        category: category.name,
        label: category.label,
        total: toNumber(perCategory[index]._sum.amount),
        count: perCategory[index]._count,
      })),
      students: {
        total: totalStudents,
        kasLunas,
        komiteLunas,
        kasBelumLunas: totalStudents - kasLunas,
        komiteBelumLunas: totalStudents - komiteLunas,
      },
    };
  }

  /** Daftar transaksi gabungan (pemasukan + pengeluaran) dengan pagination. */
  async transactions(filter: ReportFilterDto) {
    const range = this.dateRange(filter);
    const take = Math.min(Math.max(filter.take ?? 50, 1), 200);
    const page = Math.max(filter.page ?? 1, 1);

    // Pengeluaran tidak punya siswa, jadi kalau disaring per siswa
    // (atau hanya tipe pemasukan) sisi pengeluaran dilewati sepenuhnya.
    const includeIncomes = filter.type !== TransactionType.EXPENSE;
    const includeExpenses = filter.type !== TransactionType.INCOME && !filter.studentId;

    const [incomes, expenses] = await Promise.all([
      includeIncomes
        ? this.prisma.income.findMany({
            where: {
              ...range,
              ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
              ...(filter.studentId ? { studentId: filter.studentId } : {}),
            },
            include: {
              student: { select: { id: true, name: true } },
              category: { select: { name: true, label: true } },
              academicYear: { select: { name: true } },
              proofs: { select: { id: true } },
            },
          })
        : Promise.resolve([]),
      includeExpenses
        ? this.prisma.expense.findMany({
            where: range,
            include: { proofs: { select: { id: true } } },
          })
        : Promise.resolve([]),
    ]);

    const merged: UnifiedTransaction[] = [
      ...incomes.map((i) => ({
        id: i.id,
        type: "INCOME" as const,
        date: i.date.toISOString(),
        description: i.description ?? "",
        category: i.category.name,
        counterparty: i.student?.name ?? "-",
        amount: toNumber(i.amount),
        paymentMethod: i.paymentMethod,
        studentId: i.studentId,
        academicYear: i.academicYear.name,
        proofCount: i.proofs.length,
        createdAt: i.createdAt.toISOString(),
      })),
      ...expenses.map((e) => ({
        id: e.id,
        type: "EXPENSE" as const,
        date: e.date.toISOString(),
        description: e.description ?? "",
        category: "PENGELUARAN",
        counterparty: e.recipient,
        amount: toNumber(e.amount),
        paymentMethod: e.paymentMethod,
        studentId: null,
        academicYear: "-",
        proofCount: e.proofs.length,
        createdAt: e.createdAt.toISOString(),
      })),
    ];

    merged.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    const total = merged.length;
    const items = merged.slice((page - 1) * take, page * take);

    return { items, total, page, take, totalPages: Math.max(1, Math.ceil(total / take)) };
  }

  /** Data lengkap untuk laporan PDF/Excel (tanpa pagination, dibatasi). */
  async allTransactions(filter: ReportFilterDto): Promise<UnifiedTransaction[]> {
    const result = await this.transactions({ ...filter, page: 1, take: 200 });
    const all: UnifiedTransaction[] = [...result.items];
    // Ambil halaman berikutnya sampai habis atau 1000 baris (batas aman laporan).
    for (let page = 2; page <= result.totalPages && all.length < 1000; page += 1) {
      const next = await this.transactions({ ...filter, page, take: 200 });
      all.push(...next.items);
    }
    return all.slice(0, 1000);
  }

  private dateRange(filter: ReportFilterDto): { date?: { gte?: Date; lte?: Date } } {
    const gte = filter.from ? new Date(filter.from) : undefined;
    const lte = filter.to ? new Date(filter.to) : undefined;

    if (gte && lte && lte < gte) {
      throw new BadRequestException("Rentang tanggal tidak valid: `to` harus setelah `from`.");
    }
    if (lte) lte.setHours(23, 59, 59, 999);
    if (!gte && !lte) return {};

    return { date: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } };
  }
}
