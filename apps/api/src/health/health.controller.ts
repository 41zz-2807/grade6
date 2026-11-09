import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    const db = await this.prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    return {
      status: "ok",
      service: "giis-grade6-kas-api",
      database: db.length === 1 ? "connected" : "unknown",
      timestamp: new Date().toISOString(),
    };
  }
}
