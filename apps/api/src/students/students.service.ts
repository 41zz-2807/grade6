import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Student } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStudentDto, QueryStudentDto, UpdateStudentDto } from "./dto/student.dto";
import { toNumber } from "../common/utils/money";
import { CashRulesService } from "../cash-rules/cash-rules.service";
import { kasMaxTotal } from "../common/constants/cash-rules";
import { decodeCsvBuffer, dropBlankRows, duplicateKey, normalizeCell, parseCsv } from "../common/utils/csv";
import {
  MAX_STUDENT_IMPORT_BYTES,
  MAX_STUDENT_IMPORT_ROWS,
  MAX_STUDENT_NAME_LENGTH,
  STUDENT_IMPORT_NAME_HEADERS,
} from "../common/constants/import-rules";

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashRules: CashRulesService,
  ) {}

  async create(dto: CreateStudentDto) {
    try {
      const student = await this.prisma.student.create({ data: { name: dto.name } });
      return this.serialize(student);
    } catch (error) {
      // Tanpa penanganan ini, NIS duplikat jadi 500 berisi detail internal.
      throw this.translatePrismaError(error);
    }
  }

  async findAll(query: QueryStudentDto) {
    const where: Prisma.StudentWhereInput = {
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.statusKasLunas !== undefined ? { statusKasLunas: query.statusKasLunas } : {}),
      ...(query.statusKomiteLunas !== undefined
        ? { statusKomiteLunas: query.statusKomiteLunas }
        : {}),
    };

    const [students, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.take,
        take: query.take,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items: await Promise.all(students.map((student) => this.serialize(student))),
      total,
      page: query.page,
      take: query.take,
    };
  }

  async findOne(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException(`Siswa tidak ditemukan: ${id}`);
    return this.serialize(student);
  }

  async update(id: string, dto: UpdateStudentDto) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Siswa tidak ditemukan: ${id}`);

    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
        },
      });
      return this.serialize(student);
    } catch (error) {
      throw this.translatePrismaError(error);
    }
  }

  /**
   * Hapus siswa. Ditolak bila sudah punya transaksi karena Income memakai
   * onDelete: Restrict - arsip keuangan tidak boleh hilang diam-diam.
   */
  /** Terjemahkan error Prisma umum menjadi pesan yang bisa dibaca pengguna. */
  private translatePrismaError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        // Jaring pengaman bila nanti ada kolom unik lain yang ditambahkan.
        return new BadRequestException("Data sudah ada (nilai duplikat).");
      }
      if (error.code === "P2025") {
        return new NotFoundException("Data tidak ditemukan.");
      }
    }
    return error;
  }

  async remove(id: string) {
    const incomeCount = await this.prisma.income.count({ where: { studentId: id } });
    if (incomeCount > 0) {
      throw new BadRequestException(
        `Siswa tidak bisa dihapus: masih ada ${incomeCount} transaksi pemasukan. ` +
          `Hapus transaksinya atau keep sebagai arsip.`,
      );
    }
    await this.prisma.student.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Import siswa dari file CSV.
   *
   * Sifatnya idempoten: nama yang sudah ada (di database maupun di baris lain
   * dalam file yang sama) DILEWATI, bukan error dan bukan duplikat baru. Jadi
   * aman meng-upload ulang file yang sama tanpa efek samping.
   *
   * Matching hanya bisa by nama karena tabel `students` tidak punya NIS/kolom
   * unik lain - spasi berulang dan huruf besar-kecil dinormalisasi sebelum
   * dibandingkan.
   *
   * Baris yang bermasalah tidak membatalkan import: yang valid tetap masuk,
   * dan masalahnya dikembalikan per nomor baris supaya bisa ditampilkan ke admin.
   */
  async importCsv(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("File CSV wajib dipilih.");
    if (file.size === 0) throw new BadRequestException("File CSV kosong (0 byte).");
    if (file.size > MAX_STUDENT_IMPORT_BYTES) {
      const mb = (MAX_STUDENT_IMPORT_BYTES / (1024 * 1024)).toFixed(0);
      throw new BadRequestException(
        `Ukuran file melebihi batas ${mb} MB. Bagi file menjadi beberapa bagian.`,
      );
    }

    const rows = dropBlankRows(parseCsv(decodeCsvBuffer(file.buffer)));
    if (rows.length === 0) throw new BadRequestException("File CSV tidak berisi data.");

    const headers = rows[0].map((h) => duplicateKey(h));
    const nameIndex = headers.findIndex((h) => STUDENT_IMPORT_NAME_HEADERS.includes(h));
    if (nameIndex === -1) {
      throw new BadRequestException(
        `Kolom nama tidak ditemukan. Header yang terbaca: ${headers.filter(Boolean).join(", ") || "(kosong)"}. ` +
          `Pakai template resmi yang bisa diunduh dari halaman Siswa.`,
      );
    }

    const dataRows = rows.slice(1);
    if (dataRows.length === 0) {
      throw new BadRequestException("File CSV hanya berisi header, tidak ada baris data.");
    }
    if (dataRows.length > MAX_STUDENT_IMPORT_ROWS) {
      throw new BadRequestException(
        `Maksimal ${MAX_STUDENT_IMPORT_ROWS} baris per import, file ini berisi ${dataRows.length} baris. ` +
          `Bagi file menjadi beberapa bagian.`,
      );
    }

    // Satu query untuk seluruh nama yang ada; sisip many bisa punya ribuan baris.
    const existing = await this.prisma.student.findMany({ select: { name: true } });
    const seen = new Set(existing.map((s) => duplicateKey(s.name)));

    const toCreate: string[] = [];
    const skipped: { row: number; name: string }[] = [];
    const errors: { row: number; message: string }[] = [];

    dataRows.forEach((row, index) => {
      // +1 supaya cocok dengan nomor baris yang dilihat di Excel (header = baris 1).
      const rowNumber = index + 2;
      const name = normalizeCell(row[nameIndex] ?? "");

      if (!name) {
        errors.push({ row: rowNumber, message: "Nama kosong." });
        return;
      }
      if (name.length > MAX_STUDENT_NAME_LENGTH) {
        errors.push({
          row: rowNumber,
          message: `Nama ${name.length} karakter, maksimal ${MAX_STUDENT_NAME_LENGTH}.`,
        });
        return;
      }
      if (seen.has(duplicateKey(name))) {
        skipped.push({ row: rowNumber, name });
        return;
      }

      seen.add(duplicateKey(name));
      toCreate.push(name);
    });

    if (toCreate.length > 0) {
      await this.prisma.student.createMany({ data: toCreate.map((name) => ({ name })) });
    }

    return {
      totalRows: dataRows.length,
      created: toCreate.length,
      createdNames: toCreate,
      skipped,
      errors,
    };
  }

  /** Tampilan siswa + sisa tagihan & progress iuran. */
  private async serialize(student: Student) {
    const rules = await this.cashRules.get();
    const maxTotal = kasMaxTotal(rules);
    const totalKasPaid = toNumber(student.totalKasPaid);
    const totalKomitePaid = toNumber(student.totalKomitePaid);
    const monthsPaid = Math.floor(totalKasPaid / rules.kasMonthly);

    return {
      id: student.id,
      name: student.name,
      statusKasLunas: student.statusKasLunas,
      statusKomiteLunas: student.statusKomiteLunas,
      totalKasPaid,
      totalKomitePaid,
      kas: {
        monthly: rules.kasMonthly,
        maxMonths: rules.kasMaxMonths,
        monthsPaid,
        remainingMonths: Math.max(0, rules.kasMaxMonths - monthsPaid),
        remainingAmount: Math.max(0, maxTotal - totalKasPaid),
      },
      komite: {
        total: rules.komiteAmount,
        remainingAmount: Math.max(0, rules.komiteAmount - totalKomitePaid),
      },
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }
}
