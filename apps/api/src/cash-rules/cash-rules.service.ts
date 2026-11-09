import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CASH_RULE_SETTING_KEYS,
  CashRules,
  DEFAULT_CASH_RULES,
} from "../common/constants/cash-rules";

/**
 * Sumber tunggal nilai iuran kas & komite.
 *
 * Nilai disimpan di tabel `settings` supaya bisa diubah admin tanpa deploy.
 * Kalau key-nya belum ada, dipakai default dari `DEFAULT_CASH_RULES`.
 */
@Injectable()
export class CashRulesService {
  private readonly logger = new Logger(CashRulesService.name);
  private cache: { rules: CashRules; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CashRules> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.rules;

    const rows = await this.prisma.setting.findMany({
      where: { key: { in: Object.values(CASH_RULE_SETTING_KEYS) } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((row) => [row.key, row.value]));

    const rules: CashRules = {
      kasMonthly: this.readNumber(map.get(CASH_RULE_SETTING_KEYS.kasMonthly), DEFAULT_CASH_RULES.kasMonthly),
      kasMaxMonths: this.readNumber(map.get(CASH_RULE_SETTING_KEYS.kasMaxMonths), DEFAULT_CASH_RULES.kasMaxMonths),
      komiteAmount: this.readNumber(map.get(CASH_RULE_SETTING_KEYS.komiteAmount), DEFAULT_CASH_RULES.komiteAmount),
    };

    // Cache singkat supaya setiap pembuatan income tidak query 3 baris settings.
    this.cache = { rules, expiresAt: Date.now() + 30_000 };
    return rules;
  }

  async update(input: Partial<CashRules>): Promise<CashRules> {
    this.validate(input);
    const current = await this.get();

    const next: CashRules = { ...current, ...input };
    const entries: [string, number][] = [];
    if (input.kasMonthly !== undefined) entries.push([CASH_RULE_SETTING_KEYS.kasMonthly, input.kasMonthly]);
    if (input.kasMaxMonths !== undefined) entries.push([CASH_RULE_SETTING_KEYS.kasMaxMonths, input.kasMaxMonths]);
    if (input.komiteAmount !== undefined) entries.push([CASH_RULE_SETTING_KEYS.komiteAmount, input.komiteAmount]);

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
    );

    this.cache = null;
    this.logger.log(
      `Iuran diperbarui: kas ${next.kasMonthly}/bln x${next.kasMaxMonths} bln, komite ${next.komiteAmount}`,
    );
    return next;
  }

  private validate(input: Partial<CashRules>) {
    if (input.kasMonthly !== undefined && (!Number.isInteger(input.kasMonthly) || input.kasMonthly <= 0)) {
      throw new BadRequestException("kasMonthly harus bilangan bulat lebih besar dari 0.");
    }
    if (input.kasMaxMonths !== undefined && (!Number.isInteger(input.kasMaxMonths) || input.kasMaxMonths <= 0)) {
      throw new BadRequestException("kasMaxMonths harus bilangan bulat lebih besar dari 0.");
    }
    if (input.komiteAmount !== undefined && (!Number.isInteger(input.komiteAmount) || input.komiteAmount <= 0)) {
      throw new BadRequestException("komiteAmount harus bilangan bulat lebih besar dari 0.");
    }
  }

  private readNumber(raw: string | undefined, fallback: number): number {
    const value = Number(raw);
    return raw !== undefined && raw.trim() !== "" && Number.isFinite(value) && value > 0
      ? value
      : fallback;
  }
}
