import { Controller, Get, Query, Res, StreamableFile } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { BankAccountsService } from "../bank-accounts/bank-accounts.service";
import { PopupInfoService } from "../popup-info/popup-info.service";
import { ReportsService } from "../reports/reports.service";
import { ReportExportService } from "../reports/report-export.service";
import { Public } from "../common/decorators/public.decorator";
import { TransactionType } from "../reports/dto/report-filter.dto";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PublicReportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  /** Halaman berikutnya untuk daftar transaksi. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 10;
}

/**
 * API publik (tanpa login) untuk halaman depan.
 *
 * Semua method di sini diberi @Public() sehingga melewati JwtAuthGuard.
 * Rate limit-nya lebih ketat dari API admin supaya halaman publik tidak
 * bisa dipakai untuk mengikis database.
 *
 * Catatan privasi: nama siswa TIDAK dikembalikan secara utuh. Setting
 * `public.showStudentName` di tabel settings bisa mengubahnya, tapi
 * default-nya dimasker karena iuran siswa termasuk data pribadi.
 */
@Controller("public")
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankAccounts: BankAccountsService,
    private readonly popups: PopupInfoService,
    private readonly reports: ReportsService,
    private readonly exporter: ReportExportService,
  ) {}

  /** Rekening tujuan transfer - hanya 1 (rekening berflag isPublic). */
  @Public()
  @Get("rekening")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  rekening() {
    return this.bankAccounts.findPublic();
  }

  /** Summary cards: saldo, total pemasukan, total pengeluaran. */
  @Public()
  @Get("summary")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async summary(@Query() query: PublicReportQueryDto) {
    const summary = await this.reports.summary({
      from: query.from,
      to: query.to,
      type: TransactionType.ALL,
    });
    return {
      saldo: summary.balance,
      totalPemasukan: summary.totalIncome,
      totalPengeluaran: summary.totalExpense,
      jumlahTransaksi: summary.transactionCount,
    };
  }

  /** Transaksi terakhir (default 10) + penanda halaman berikutnya. */
  @Public()
  @Get("transactions")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async transactions(@Query() query: PublicReportQueryDto) {
    const showName = await this.showStudentName();
    const result = await this.reports.transactions({
      from: query.from,
      to: query.to,
      type: TransactionType.ALL,
      page: query.page,
      take: query.take,
    });

    return {
      items: result.items.map((trx) => ({
        id: trx.id,
        type: trx.type,
        date: trx.date,
        category: trx.category,
        // Nama siswa dimasker kecuali diaktifkan lewat setting.
        counterparty: trx.studentId
          ? showName
            ? trx.counterparty
            : maskName(trx.counterparty)
          : trx.counterparty,
        description: trx.description,
        amount: trx.amount,
        paymentMethod: trx.paymentMethod,
        // Bukti transaksi tidak ditampilkan di publik (dokumen pribadi).
        proofCount: trx.proofCount > 0 ? 1 : 0,
      })),
      total: result.total,
      page: result.page,
      take: result.take,
      totalPages: result.totalPages,
      hasNextPage: result.page < result.totalPages,
    };
  }

  /** Informasi popup yang aktif pada rentang waktu sekarang. */
  @Public()
  @Get("popup")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async popup() {
    const popups = await this.popups.findPublic();
    return popups.map((popup) => ({
      id: popup.id,
      title: popup.title,
      content: popup.content,
    }));
  }

  /** Download laporan PDF (ringkasan, tanpa nama siswa & tanpa bukti). */
  @Public()
  @Get("laporan.pdf")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async laporanPdf(
    @Query() query: PublicReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const showName = await this.showStudentName();
    const buffer = await this.exporter.toPdf(
      { from: query.from, to: query.to, type: TransactionType.ALL },
      { publicView: true, showStudentName: showName },
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${this.exporter.filename("pdf")}"`);
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(buffer);
  }

  private async showStudentName(): Promise<boolean> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: "public.showStudentName" },
    });
    return setting?.value === "true";
  }
}

/** "Ahmad Fauzi" -> "A**** F***", "Rina" -> "R***". */
function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] + "*".repeat(Math.max(2, part.length - 1)))
    .join(" ");
}

