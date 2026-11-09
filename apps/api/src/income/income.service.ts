import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  IncomeCategoryType,
  PaymentMethod,
  Prisma,
  Student,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIncomeDto, QueryIncomeDto } from "./dto/create-income.dto";
import { toDecimal, toNumber } from "../common/utils/money";
import { removeProofFiles, toUploadedProof, UploadedProof } from "../common/upload/upload.config";
import { CashRulesService } from "../cash-rules/cash-rules.service";
import { CashRules, kasMaxTotal, MIN_TRANSFER_PROOFS } from "../common/constants/cash-rules";

const INCOME_INCLUDE = {
  student: true,
  category: true,
  academicYear: true,
  proofs: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.IncomeInclude;

@Injectable()
export class IncomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashRules: CashRulesService,
  ) {}

  async create(dto: CreateIncomeDto, files: Express.Multer.File[] = []) {
    const proofs = files.map(toUploadedProof);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.incomeCategory.findUnique({
          where: { name: dto.category },
        });
        if (!category || !category.isActive) {
          throw new BadRequestException(`Kategori tidak aktif atau tidak ditemukan: ${dto.category}`);
        }

        const academicYear = await tx.academicYear.findUnique({
          where: { id: dto.academicYearId },
        });
        if (!academicYear) {
          throw new NotFoundException(`Masa ajaran tidak ditemukan: ${dto.academicYearId}`);
        }

        this.assertProofs(dto.paymentMethod, proofs);

        let student: Student | null = null;
        if (dto.studentId) {
          student = await this.lockStudent(tx, dto.studentId);
        }

        let totalKasPaid: Prisma.Decimal | undefined;
        let totalKomitePaid: Prisma.Decimal | undefined;
        let statusKasLunas: boolean | undefined;
        let statusKomiteLunas: boolean | undefined;

        const amount = toDecimal(dto.amount);
        const rules = await this.cashRules.get();

        switch (category.name) {
          case IncomeCategoryType.KAS_KELAS:
            ({ totalKasPaid, statusKasLunas } = this.applyKasRules(student, amount, rules));
            break;
          case IncomeCategoryType.KOMITE:
            ({ totalKomitePaid, statusKomiteLunas } = this.applyKomiteRules(student, amount, rules));
            break;
          case IncomeCategoryType.UMUM:
            // Donasi/dana lain: bebas nominal, tidak memengaruhi status lunas.
            break;
        }

        // Update total siswa DULUAN dari income.create, supaya relasi `student`
        // yang di-include sudah terbaru (keduanya dalam satu transaksi).
        if (student) {
          await tx.student.update({
            where: { id: student.id },
            data: {
              ...(totalKasPaid !== undefined ? { totalKasPaid } : {}),
              ...(statusKasLunas !== undefined ? { statusKasLunas } : {}),
              ...(totalKomitePaid !== undefined ? { totalKomitePaid } : {}),
              ...(statusKomiteLunas !== undefined ? { statusKomiteLunas } : {}),
            },
          });
        }

        const income = await tx.income.create({
          data: {
            date: dto.date ? new Date(dto.date) : new Date(),
            amount,
            description: dto.description ?? null,
            paymentMethod: dto.paymentMethod,
            studentId: dto.studentId ?? null,
            categoryId: category.id,
            academicYearId: academicYear.id,
            proofs: { create: proofs },
          },
          include: INCOME_INCLUDE,
        });

        return this.serialize(income);
      });
    } catch (error) {
      // Jangan meninggalkan file yatim kalau transaksi gagal.
      await removeProofFiles(proofs.map((p) => p.fileName));
      throw error;
    }
  }

  async findAll(query: QueryIncomeDto) {
    const where: Prisma.IncomeWhereInput = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.category ? { category: { name: query.category } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.income.findMany({
        where,
        include: INCOME_INCLUDE,
        orderBy: { date: "desc" },
        skip: (query.page - 1) * query.take,
        take: query.take,
      }),
      this.prisma.income.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      total,
      page: query.page,
      take: query.take,
    };
  }

  async findOne(id: string) {
    const income = await this.prisma.income.findUnique({ where: { id }, include: INCOME_INCLUDE });
    if (!income) throw new NotFoundException(`Pemasukan tidak ditemukan: ${id}`);
    return this.serialize(income);
  }

  /**
   * Hapus pemasukan. Total dan status lunas siswa ikut dikembalikan ke kondisi
   * sebelum transaksi ini dibuat, supaya `totalKasPaid`/`totalKomitePaid` tidak
   * lagi cocok dengan jumlah transaksinya. Status lunas dihitung ulang dari
   * nominal iuran saat ini, bukan dengan pengurangan sederhana.
   */
  async remove(id: string) {
    const income = await this.prisma.income.findUnique({
      where: { id },
      include: { proofs: { select: { fileName: true } } },
    });
    if (!income) throw new NotFoundException(`Pemasukan tidak ditemukan: ${id}`);

    const rules = await this.cashRules.get();

    await this.prisma.$transaction(async (tx) => {
      await tx.income.delete({ where: { id } });

      if (!income.studentId) return;
      await tx.$queryRaw`SELECT id FROM students WHERE id = ${income.studentId} FOR UPDATE`;

      const student = await tx.student.findUnique({ where: { id: income.studentId } });
      if (!student) return;

      const newTotalKas = Prisma.Decimal.max(
        toDecimal(0),
        student.totalKasPaid.minus(income.amount),
      );
      const newTotalKomite = Prisma.Decimal.max(
        toDecimal(0),
        student.totalKomitePaid.minus(income.amount),
      );
      const kasMax = kasMaxTotal(rules);

      await tx.student.update({
        where: { id: student.id },
        data: {
          totalKasPaid: newTotalKas,
          totalKomitePaid: newTotalKomite,
          statusKasLunas: newTotalKas.gte(toDecimal(kasMax)),
          statusKomiteLunas: newTotalKomite.gte(toDecimal(rules.komiteAmount)),
        },
      });
    });

    await removeProofFiles(income.proofs.map((p) => p.fileName));
    return { deleted: true };
  }

  // -------------------------------------------------------------------------
  // Aturan bisnis
  // -------------------------------------------------------------------------

  /** TRANSFER wajib melampirkan minimal 1 file bukti. */
  private assertProofs(paymentMethod: PaymentMethod, proofs: UploadedProof[]) {
    if (paymentMethod === PaymentMethod.TRANSFER && proofs.length < MIN_TRANSFER_PROOFS) {
      throw new BadRequestException(
        `Bukti transfer wajib diunggah (minimal ${MIN_TRANSFER_PROOFS} file) untuk pembayaran TRANSFER.`,
      );
    }
  }

  /**
   * Iuran Kas Kelas: nominal bebas, TIDAK harus kelipatan `rules.kasMonthly`
   * (mis. Rp 50.000 untuk iuran Rp 15.000/bulan). Laporan menghitung bulan
   * lunas dengan pembulatan ke bawah, jadi kelebihan nominal menjadi kredit
   * untuk bulan berikutnya.
   * Total maksimal `kasMaxMonths` bulan; saat total menyentuh batas itu siswa
   * ditandai lunas dan tidak bisa ditambah.
   */
  private applyKasRules(student: Student | null, amount: Prisma.Decimal, rules: CashRules) {
    if (!student) {
      throw new BadRequestException("studentId wajib diisi untuk kategori KAS_KELAS.");
    }
    const maxTotal = kasMaxTotal(rules);
    const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

    if (student.statusKasLunas) {
      throw new BadRequestException(
        `Iuran kas kelas ${student.name} sudah lunas (${rules.kasMaxMonths} bulan / ${rupiah(maxTotal)}).`,
      );
    }
    const newTotal = student.totalKasPaid.plus(amount);
    if (newTotal.gt(toDecimal(maxTotal))) {
      const remaining = toDecimal(maxTotal).minus(student.totalKasPaid);
      throw new BadRequestException(
        `Maksimal ${rules.kasMaxMonths} bulan (${rupiah(maxTotal)}). ` +
          `Sisa yang boleh dibayar untuk ${student.name}: ${rupiah(toNumber(remaining))}.`,
      );
    }

    return {
      totalKasPaid: newTotal,
      statusKasLunas: newTotal.gte(toDecimal(maxTotal)),
    };
  }

  /**
   * Iuran Komite: boleh dicicil; begitu total >= `rules.komiteAmount` siswa lunas.
   */
  private applyKomiteRules(student: Student | null, amount: Prisma.Decimal, rules: CashRules) {
    if (!student) {
      throw new BadRequestException("studentId wajib diisi untuk kategori KOMITE.");
    }
    const max = rules.komiteAmount;
    const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

    if (student.statusKomiteLunas) {
      throw new BadRequestException(`Iuran komite ${student.name} sudah lunas (${rupiah(max)}).`);
    }

    const newTotal = student.totalKomitePaid.plus(amount);
    if (newTotal.gt(toDecimal(max))) {
      const remaining = toDecimal(max).minus(student.totalKomitePaid);
      throw new BadRequestException(
        `Iuran komite maksimal ${rupiah(max)}. ` +
          `Sisa yang boleh dibayar untuk ${student.name}: ${rupiah(toNumber(remaining))}.`,
      );
    }

    return {
      totalKomitePaid: newTotal,
      statusKomiteLunas: newTotal.gte(toDecimal(max)),
    };
  }

  /**
   * Kunci baris siswa selama transaksi supaya dua pembayaran bersamaan tidak
   * menimpa total satu sama lain (lost update).
   */
  private async lockStudent(tx: Prisma.TransactionClient, studentId: string): Promise<Student> {
    await tx.$queryRaw`SELECT id FROM students WHERE id = ${studentId} FOR UPDATE`;
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException(`Siswa tidak ditemukan: ${studentId}`);
    return student;
  }

  private serialize(income: Prisma.IncomeGetPayload<{ include: typeof INCOME_INCLUDE }>) {
    return {
      ...income,
      amount: toNumber(income.amount),
      student: income.student
        ? {
            ...income.student,
            totalKasPaid: toNumber(income.student.totalKasPaid),
            totalKomitePaid: toNumber(income.student.totalKomitePaid),
          }
        : null,
      proofs: income.proofs.map((proof) => ({
        ...proof,
        url: `/uploads/${proof.fileName}`,
      })),
    };
  }
}
