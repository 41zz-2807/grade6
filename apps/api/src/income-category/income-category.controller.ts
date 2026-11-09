import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("income-categories")
export class IncomeCategoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.incomeCategory.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { incomes: true } } },
    });
  }
}
