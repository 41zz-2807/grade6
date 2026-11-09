import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramService } from "./telegram.service";
import { ReportExportService } from "../reports/report-export.service";
import { TransactionType } from "../reports/dto/report-filter.dto";
import { DatabaseBackupService } from "../common/backup/database-backup.service";
import { formatRupiah } from "../common/utils/money";
import { fileStamp, formatDate } from "../common/utils/datetime";

const JOB_NAME = "daily-balance-report";

/** Key di tabel `settings` untuk mengatur laporan harian. */
export const DAILY_REPORT_KEYS = {
  enabled: "telegram.dailyReportEnabled",
  time: "telegram.dailyReportTime",
} as const;

/**
 * Laporan saldo global harian ke Telegram.
 *
 * Jadwal **dinamis**: jam & status aktif dibaca dari tabel `settings`, bukan
 * hardcode. Karena itu cron memakai `SchedulerRegistry` (bukan dekorator
 * `@Cron`) supaya bisa didaftarkan ulang setiap kali pengaturan diubah.
 *
 * Zona waktu memakai `APP_TIMEZONE` (Asia/Jakarta), bukan zona container,
 * supaya jadwal tetap benar walau `TZ` berubah.
 */
@Injectable()
export class DailyReportService implements OnModuleInit {
  private readonly logger = new Logger(DailyReportService.name);
  private cronExpression = "0 7 * * *";
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly scheduler: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly exporter: ReportExportService,
    private readonly backup: DatabaseBackupService,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  /** Baca pengaturan dari DB lalu (daftarkan ulang) cron-nya. */
  async reload() {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [DAILY_REPORT_KEYS.enabled, DAILY_REPORT_KEYS.time] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value.trim()]));

    this.enabled = map.get(DAILY_REPORT_KEYS.enabled) === "true";
    const time = map.get(DAILY_REPORT_KEYS.time) || "07:00";
    const next = toCronExpression(time);
    this.cronExpression = next;

    this.removeJob();
    if (!this.enabled) {
      this.logger.log("Laporan harian Telegram: NONAKTIF.");
      return { enabled: false, expression: null };
    }

    this.scheduler.addCronJob(
      JOB_NAME,
      new CronJob(
        next,
        () => void this.run("cron"),
        null,
        true,
        this.config.get<string>("APP_TIMEZONE", "Asia/Jakarta"),
      ),
    );
    this.logger.log(
      `Laporan harian Telegram: AKTIF setiap ${time} (cron "${next}").`,
    );
    return { enabled: true, expression: next, time };
  }

  async getStatus() {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [DAILY_REPORT_KEYS.enabled, DAILY_REPORT_KEYS.time] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value.trim()]));
    return {
      enabled: this.enabled,
      time: map.get(DAILY_REPORT_KEYS.time) || "07:00",
      cronExpression: this.enabled ? this.cronExpression : null,
      timezone: this.config.get<string>("APP_TIMEZONE", "Asia/Jakarta"),
    };
  }

  async update(input: { enabled?: boolean; time?: string }) {
    if (input.time !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
        throw new BadRequestException("Format jam harus HH:MM (24 jam), contoh 07:00.");
      }
      await this.prisma.setting.upsert({
        where: { key: DAILY_REPORT_KEYS.time },
        create: { key: DAILY_REPORT_KEYS.time, value: input.time, description: "Jam kirim laporan saldo harian (WIB)" },
        update: { value: input.time },
      });
    }
    if (input.enabled !== undefined) {
      await this.prisma.setting.upsert({
        where: { key: DAILY_REPORT_KEYS.enabled },
        create: {
          key: DAILY_REPORT_KEYS.enabled,
          value: String(input.enabled),
          description: "Aktifkan laporan saldo harian otomatis",
        },
        update: { value: String(input.enabled) },
      });
    }
    return this.reload();
  }

  /**
   * Kirim laporan harian: pesan ringkasan, PDF SELURUH arus kas, dan backup
   * database. Dikirim terpisah supaya kegagalan salah satu (Telegram lambat,
   * pg_dump gagal) tidak menggagalkan yang lain.
   */
  async run(trigger: "cron" | "manual" = "manual") {
    try {
      const [incomeAgg, expenseAgg, incomeCount, expenseCount, kasLunas, komiteLunas, totalStudents] =
        await this.prisma.$transaction([
          this.prisma.income.aggregate({ _sum: { amount: true } }),
          this.prisma.expense.aggregate({ _sum: { amount: true } }),
          this.prisma.income.count(),
          this.prisma.expense.count(),
          this.prisma.student.count({ where: { statusKasLunas: true } }),
          this.prisma.student.count({ where: { statusKomiteLunas: true } }),
          this.prisma.student.count(),
        ]);

      const total = (v: unknown) => Number(v ?? 0);
      const totalIncome = total(incomeAgg._sum.amount);
      const totalExpense = total(expenseAgg._sum.amount);
      const balance = totalIncome - totalExpense;

      const lines = [
        "📊 *Laporan Kas Harian*",
        `Tanggal: ${formatDate()}`,
        "",
        `Saldo: *${formatRupiah(balance)}*`,
        `Total pemasukan: ${formatRupiah(totalIncome)} (${incomeCount}×)`,
        `Total pengeluaran: ${formatRupiah(totalExpense)} (${expenseCount}×)`,
        "",
        `Siswa lunas kas: ${kasLunas}/${totalStudents}`,
        `Siswa lunas komite: ${komiteLunas}/${totalStudents}`,
        "",
        "Terlampir: PDF seluruh arus kas + backup database.",
        "_GIIS Grade 6 Jannatul Firdaus_",
      ];

      this.logger.log(`Mengirim laporan harian (${trigger}): saldo ${formatRupiah(balance)}`);
      const delivered = await this.telegram.send(lines.join("\n"));
      const pdf = await this.sendCashFlowPdf();
      const backup = await this.sendBackup();

      return { triggered: trigger, balance, totalIncome, totalExpense, delivered, pdf, backup };
    } catch (error) {
      this.logger.error(
        `Gagal mengirim laporan harian: ${error instanceof Error ? error.message : error}`,
      );
      return { triggered: trigger, delivered: false, pdf: false, backup: false, error: String(error) };
    }
  }

  /**
   * PDF detail SELURUH pemasukan & pengeluaran (tanpa filter tanggal), jadi
   * setiap kiriman berisi riwayat lengkap. Memakai exporter laporan yang ada.
   */
  private async sendCashFlowPdf(): Promise<boolean> {
    try {
      const buffer = await this.exporter.toPdf({ type: TransactionType.ALL });
      return await this.telegram.sendDocument(
        `grade6_laporan_${fileStamp()}.pdf`,
        buffer,
        "Laporan seluruh arus kas - GIIS Grade 6",
        "application/pdf",
      );
    } catch (error) {
      this.logger.error(
        `Gagal membuat/mengirim PDF arus kas: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  private async sendBackup(): Promise<boolean> {
    try {
      const { fileName, buffer } = await this.backup.create();
      return await this.telegram.sendDocument(
        fileName,
        buffer,
        "Backup database harian (restore: psql < file .sql.gz yang sudah di-gunzip)",
        "application/gzip",
      );
    } catch (error) {
      this.logger.error(
        `Gagal membuat/mengirim backup database: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  private removeJob() {
    if (this.scheduler.doesExist("cron", JOB_NAME)) {
      this.scheduler.deleteCronJob(JOB_NAME);
    }
  }
}

/** "07:30" -> "30 7 * * *". Menolak format lain. */
export function toCronExpression(time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return "0 7 * * *";
  return `${Number(match[2])} ${Number(match[1])} * * *`;
}
