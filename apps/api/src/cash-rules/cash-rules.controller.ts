import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsPositive } from "class-validator";
import { CashRulesService } from "./cash-rules.service";
import { kasMaxTotal } from "../common/constants/cash-rules";

export class UpdateCashRulesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  kasMonthly?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  kasMaxMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  komiteAmount?: number;
}

@Controller("cash-rules")
export class CashRulesController {
  constructor(private readonly service: CashRulesService) {}

  @Get()
  async get() {
    const rules = await this.service.get();
    return { ...rules, kasMaxTotal: kasMaxTotal(rules) };
  }

  @Patch()
  async update(@Body() dto: UpdateCashRulesDto) {
    const rules = await this.service.update(dto);
    return { ...rules, kasMaxTotal: kasMaxTotal(rules) };
  }
}
