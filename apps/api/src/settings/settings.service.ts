import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Setting } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertSettingDto } from "./dto/setting.dto";

const MASK = "********";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Semua setting, nilai `isSecret` disamarkan. */
  async findAll() {
    const settings = await this.prisma.setting.findMany({ orderBy: { key: "asc" } });
    return settings.map((setting) => this.mask(setting));
  }

  async findOne(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Pengaturan tidak ditemukan: ${key}`);
    return this.mask(setting);
  }

  async upsert(dto: UpsertSettingDto) {
    const data: Prisma.SettingUpdateInput = {
      value: dto.value,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.isSecret !== undefined ? { isSecret: dto.isSecret } : {}),
    };

    const setting = await this.prisma.setting.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        value: dto.value,
        description: dto.description ?? null,
        isSecret: dto.isSecret ?? false,
      },
      update: data,
    });

    return this.mask(setting);
  }

  private mask(setting: Setting) {
    if (!setting.isSecret || !setting.value) return setting;
    return { ...setting, value: MASK };
  }
}
