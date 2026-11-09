import { Controller, Get, Query, Res, StreamableFile } from "@nestjs/common";
import { Response } from "express";
import { ReportsService } from "./reports.service";
import { ReportExportService } from "./report-export.service";
import { RekapIuranService } from "./rekap-iuran.service";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { RekapFilterDto } from "./dto/rekap-filter.dto";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ReportExportService,
    private readonly rekap: RekapIuranService,
  ) {}

  /** Ringkasan saldo global + rincian per kategori + status lunas siswa. */
  @Get("summary")
  summary(@Query() query: ReportFilterDto) {
    return this.reports.summary(query);
  }

  /** Daftar transaksi detail (pemasukan + pengeluaran) dengan pagination. */
  @Get("transactions")
  transactions(@Query() query: ReportFilterDto) {
    return this.reports.transactions(query);
  }

  @Get("export/pdf")
  async pdf(@Query() query: ReportFilterDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.exporter.toPdf(query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${this.exporter.filename("pdf")}"`);
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(buffer);
  }

  @Get("export/excel")
  async excel(@Query() query: ReportFilterDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.exporter.toExcel(query);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${this.exporter.filename("xlsx")}"`);
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(buffer);
  }

  /**
   * Rekap iuran kas kelas per bulan (data saja, tanpa PDF).
   * Dipakai panel admin untuk menampilkan ringkasan singkat di atas tombol unduh.
   */
  @Get("rekap-iuran")
  rekapIuran(@Query() query: RekapFilterDto) {
    return this.rekap.build(query.academicYearId);
  }

  /**
   * Rekap iuran kas kelas per bulan dalam PDF: tabel nama siswa x bulan,
   * bulan yang sudah dibayar dicentang hijau, yang belum garis strip.
   */
  @Get("export/rekap-pdf")
  async rekapPdf(@Query() query: RekapFilterDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.rekap.toPdf(query.academicYearId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${this.rekap.filename()}"`);
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(buffer);
  }

  /**
   * Rekap iuran komite per kelas dalam PDF: tabel nama siswa x status komite
   * (lunas/partially/belum) beserta sisa bayar. A4 portrait, 1 halaman.
   */
  @Get("export/rekomite-pdf")
  async rekomitePdf(@Query() query: RekapFilterDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.rekap.toPdfKomite(query.academicYearId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${this.rekap.filenameKomite("rekap-komite-")}"`);
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(buffer);
  }
}
