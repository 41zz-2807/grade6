import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PopupInfo } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePopupInfoDto, UpdatePopupInfoDto } from "./dto/popup-info.dto";

@Injectable()
export class PopupInfoService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.popupInfo.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
  }

  async findOne(id: string) {
    const popup = await this.prisma.popupInfo.findUnique({ where: { id } });
    if (!popup) throw new NotFoundException(`Popup tidak ditemukan: ${id}`);
    return popup;
  }

  async create(dto: CreatePopupInfoDto) {
    this.assertWindow(dto.startAt, dto.endAt);
    return this.prisma.popupInfo.create({
      data: {
        title: dto.title,
        content: dto.content,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  async update(id: string, dto: UpdatePopupInfoDto) {
    const existing = await this.findOne(id);
    const startAt = dto.startAt !== undefined ? dto.startAt : existing.startAt?.toISOString();
    const endAt = dto.endAt !== undefined ? dto.endAt : existing.endAt?.toISOString();
    this.assertWindow(startAt, endAt);

    return this.prisma.popupInfo.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.startAt !== undefined
          ? { startAt: dto.startAt ? new Date(dto.startAt) : null }
          : {}),
        ...(dto.endAt !== undefined ? { endAt: dto.endAt ? new Date(dto.endAt) : null } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.popupInfo.delete({ where: { id } });
    return { deleted: true };
  }

  /** Popup yang boleh ditampilkan ke publik: aktif + dalam rentang waktu. */
  async findPublic(): Promise<PopupInfo[]> {
    const now = new Date();
    return this.prisma.popupInfo.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  private assertWindow(startAt?: string | null, endAt?: string | null) {
    if (!startAt || !endAt) return;
    if (new Date(endAt) <= new Date(startAt)) {
      throw new BadRequestException("endAt harus setelah startAt.");
    }
  }
}
