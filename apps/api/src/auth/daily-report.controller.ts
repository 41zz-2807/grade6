import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsBoolean, IsOptional, Matches } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { DailyReportService } from "./daily-report.service";

export class UpdateDailyReportDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Format jam harus HH:MM (24 jam), contoh 07:00." })
  time?: string;
}

@Controller("auth/daily-report")
export class DailyReportController {
  constructor(private readonly service: DailyReportService) {}

  @Get()
  status() {
    return this.service.getStatus();
  }

  @Patch()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  update(@Body() dto: UpdateDailyReportDto) {
    return this.service.update(dto);
  }

  /** Kirim sekarang - buat admin bisa memverifikasi tanpa menunggu jadwal. */
  @Post("send-now")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendNow() {
    return this.service.run("manual");
  }
}
