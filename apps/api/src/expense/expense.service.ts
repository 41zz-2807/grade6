import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto, QueryExpenseDto, UpdateExpenseDto } from "./dto/create-expense.dto";
import { toDecimal, toNumber } from "../common/utils/money";
import { removeProofFiles, toUploadedProof } from "../common/upload/upload.config";
import { MIN_TRANSFER_PROOFS } from "../common/constants/cash-rules";

const EXPENSE_INCLUDE = {
  proofs: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto, files: Express.Multer.File[] = []) {
    const proofs = files.map(toUploadedProof);

    try {
      if (dto.paymentMethod === PaymentMethod.TRANSFER && proofs.length < MIN_TRANSFER_PROOFS) {
        throw new BadRequestException(
          `Bukti transfer wajib diunggah (minimal ${MIN_TRANSFER_PROOFS} file) untuk pembayaran TRANSFER.`,
        );
      }

      const expense = await this.prisma.expense.create({
        data: {
          date: dto.date ? new Date(dto.date) : new Date(),
          recipient: dto.recipient,
          amount: toDecimal(dto.amount),
          description: dto.description ?? null,
          paymentMethod: dto.paymentMethod,
          proofs: { create: proofs },
        },
        include: EXPENSE_INCLUDE,
      });

      return this.serialize(expense);
    } catch (error) {
      await removeProofFiles(proofs.map((p) => p.fileName));
      throw error;
    }
  }

  async findAll(query: QueryExpenseDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        include: EXPENSE_INCLUDE,
        orderBy: { date: "desc" },
        skip: (query.page - 1) * query.take,
        take: query.take,
      }),
      this.prisma.expense.count(),
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      total,
      page: query.page,
      take: query.take,
    };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) throw new NotFoundException(`Pengeluaran tidak ditemukan: ${id}`);
    return this.serialize(expense);
  }

  /**
   * Ubah pengeluaran. Bukti yang sudah ada tetap dipertahankan; file baru
   * (kalau ada) ditambahkan.
   */
  async update(id: string, dto: UpdateExpenseDto, files: Express.Multer.File[] = []) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Pengeluaran tidak ditemukan: ${id}`);

    const newProofs = files.map(toUploadedProof);
    const isTransfer = dto.paymentMethod ?? existing.paymentMethod;

    // Kalau diubah jadi TRANSFER, bukti wajib ada - boleh dari request ini
    // maupun bukti lama yang sudah tersimpan.
    const existingProofCount = await this.prisma.expenseProof.count({ where: { expenseId: id } });
    if (isTransfer === PaymentMethod.TRANSFER && existingProofCount + newProofs.length < MIN_TRANSFER_PROOFS) {
      await removeProofFiles(newProofs.map((p) => p.fileName));
      throw new BadRequestException(
        `Bukti transfer wajib diunggah (minimal ${MIN_TRANSFER_PROOFS} file) untuk pembayaran TRANSFER.`,
      );
    }

    try {
      const expense = await this.prisma.expense.update({
        where: { id },
        data: {
          ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
          ...(dto.recipient !== undefined ? { recipient: dto.recipient } : {}),
          ...(dto.amount !== undefined ? { amount: toDecimal(dto.amount) } : {}),
          ...(dto.description !== undefined ? { description: dto.description || null } : {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
          ...(newProofs.length > 0 ? { proofs: { create: newProofs } } : {}),
        },
        include: EXPENSE_INCLUDE,
      });
      return this.serialize(expense);
    } catch (error) {
      await removeProofFiles(newProofs.map((p) => p.fileName));
      throw error;
    }
  }

  /** Hapus pengeluaran beserta file buktinya di disk. */
  async remove(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { proofs: { select: { fileName: true } } },
    });
    if (!expense) throw new NotFoundException(`Pengeluaran tidak ditemukan: ${id}`);

    await this.prisma.expense.delete({ where: { id } });
    await removeProofFiles(expense.proofs.map((p) => p.fileName));
    return { deleted: true };
  }

  private serialize(expense: Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>) {
    return {
      ...expense,
      amount: toNumber(expense.amount),
      proofs: expense.proofs.map((proof) => ({
        ...proof,
        url: `/uploads/${proof.fileName}`,
      })),
    };
  }
}
