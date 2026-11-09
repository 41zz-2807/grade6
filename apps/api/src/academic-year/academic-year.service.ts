import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAcademicYearDto, UpdateAcademicYearDto } from "./dto/create-academic-year.dto";

@Injectable()
export class AcademicYearService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcademicYearDto) {
    this.assertMonths(dto.startMonth, dto.endMonth);

    // Hanya boleh ada satu masa ajaran aktif.
    if (dto.isActive) await this.deactivateOthers();

    return this.prisma.academicYear.create({
      data: {
        name: dto.name,
        startMonth: dto.startMonth,
        endMonth: dto.endMonth,
        isActive: dto.isActive,
      },
    });
  }

  findAll() {
    return this.prisma.academicYear.findMany({ orderBy: { name: "desc" } });
  }

  async findOne(id: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException(`Masa ajaran tidak ditemukan: ${id}`);
    return year;
  }

  async update(id: string, dto: UpdateAcademicYearDto) {
    const existing = await this.findOne(id);
    this.assertMonths(
      dto.startMonth ?? existing.startMonth,
      dto.endMonth ?? existing.endMonth,
    );

    if (dto.isActive) await this.deactivateOthers();

    return this.prisma.academicYear.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.startMonth !== undefined ? { startMonth: dto.startMonth } : {}),
        ...(dto.endMonth !== undefined ? { endMonth: dto.endMonth } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async setActive(id: string) {
    await this.findOne(id);
    await this.deactivateOthers();
    return this.prisma.academicYear.update({ where: { id }, data: { isActive: true } });
  }

  /** Masa ajaran tidak boleh dihapus selama masih ada transaksi yang memakainya. */
  async remove(id: string) {
    await this.findOne(id);
    const incomeCount = await this.prisma.income.count({ where: { academicYearId: id } });
    if (incomeCount > 0) {
      throw new BadRequestException(
        `Masa ajaran tidak bisa dihapus: masih dipakai oleh ${incomeCount} transaksi pemasukan.`,
      );
    }
    await this.prisma.academicYear.delete({ where: { id } });
    return { deleted: true };
  }

  private assertMonths(startMonth: number, endMonth: number) {
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
      throw new BadRequestException(
        "startMonth dan endMonth harus antara 1 (Januari) dan 12 (Desember).",
      );
    }
  }

  private async deactivateOthers() {
    await this.prisma.academicYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }
}
