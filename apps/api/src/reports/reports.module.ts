import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportExportService } from "./report-export.service";
import { RekapIuranService } from "./rekap-iuran.service";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportService, RekapIuranService],
  exports: [ReportsService, ReportExportService, RekapIuranService],
})
export class ReportsModule {}
