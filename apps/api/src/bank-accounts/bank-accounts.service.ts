import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBankAccountDto, UpdateBankAccountDto } from "./dto/bank-account.dto";

/**
 * Rekening penampung iuran.
 *
 * Aturan: hanya boleh SATU rekening yang `isPublic = true`, karena halaman
 * publik hanya boleh menampilkan satu nomor rekening tujuan transfer.
 */
@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bankAccount.findMany({ orderBy: [{ isPublic: "desc" }, { createdAt: "asc" }] });
  }

  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`Rekening tidak ditemukan: ${id}`);
    return account;
  }

  async create(dto: CreateBankAccountDto) {
    await this.assertSinglePublic(dto.isPublic);
    return this.prisma.bankAccount.create({
      data: {
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountHolder: dto.accountHolder,
        isPublic: dto.isPublic ?? false,
        isActive: dto.isActive ?? true,
        description: dto.description ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    const existing = await this.findOne(id);
    const nextIsPublic = dto.isPublic ?? existing.isPublic;
    if (nextIsPublic) await this.assertSinglePublic(true, id);

    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
        ...(dto.accountNumber !== undefined ? { accountNumber: dto.accountNumber } : {}),
        ...(dto.accountHolder !== undefined ? { accountHolder: dto.accountHolder } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bankAccount.delete({ where: { id } });
    return { deleted: true };
  }

  /** Data rekening yang boleh ditampilkan di halaman publik. */
  async findPublic() {
    const account = await this.prisma.bankAccount.findFirst({
      where: { isPublic: true, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!account) return null;
    return {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      description: account.description,
    };
  }

  private async assertSinglePublic(wantPublic: boolean, exceptId?: string) {
    if (!wantPublic) return;
    const existing = await this.prisma.bankAccount.findMany({
      where: { isPublic: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        "Hanya boleh ada satu rekening publik. Nonaktifkan rekening publik yang lama terlebih dahulu.",
      );
    }
  }
}
