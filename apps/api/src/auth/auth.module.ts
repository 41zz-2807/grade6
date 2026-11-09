import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { TelegramService } from "./telegram.service";
import { DailyReportService } from "./daily-report.service";
import { DailyReportController } from "./daily-report.controller";
import { ReportsModule } from "../reports/reports.module";
import { DatabaseBackupService } from "../common/backup/database-backup.service";
import { SESSION_IDLE_MINUTES } from "../common/constants/auth-rules";

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ReportsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          // Umur token = idle timeout, bukan batas login. Sesi aktif
          // diperpanjang lewat POST /api/auth/refresh (lihat SESSION_IDLE_MINUTES).
          expiresIn: `${config.get<string>("SESSION_IDLE_MINUTES", String(SESSION_IDLE_MINUTES))}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController, DailyReportController],
  providers: [AuthService, CaptchaService, TelegramService, DailyReportService, DatabaseBackupService],
  exports: [JwtModule, CaptchaService, TelegramService, DailyReportService],
})
export class AuthModule {}
