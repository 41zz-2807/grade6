import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { UploadsModule } from "./common/upload/uploads.module";
import { StudentsModule } from "./students/students.module";
import { IncomeModule } from "./income/income.module";
import { IncomeCategoryModule } from "./income-category/income-category.module";
import { ExpenseModule } from "./expense/expense.module";
import { AcademicYearModule } from "./academic-year/academic-year.module";
import { SettingsModule } from "./settings/settings.module";
import { AuthModule } from "./auth/auth.module";
import { CashRulesModule } from "./cash-rules/cash-rules.module";
import { BankAccountsModule } from "./bank-accounts/bank-accounts.module";
import { PopupInfoModule } from "./popup-info/popup-info.module";
import { ReportsModule } from "./reports/reports.module";
import { PublicModule } from "./public/public.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      // Batas GLOBAL untuk seluruh endpoint. Harus longgar - kalau ikut 10/menit,
      // dashboard dengan 10 request saja akan ikut terkunci.
      // Endpoint login memakai batas ketat sendiri lewat @Throttle (lihat AuthController).
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get<string>("API_RATE_WINDOW_MS", "60000")),
          limit: Number(config.get<string>("API_RATE_LIMIT", "300")),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    UploadsModule,
    AuthModule,
    CashRulesModule,
    BankAccountsModule,
    PopupInfoModule,
    ReportsModule,
    PublicModule,
    StudentsModule,
    IncomeModule,
    IncomeCategoryModule,
    ExpenseModule,
    AcademicYearModule,
    SettingsModule,
  ],
  providers: [
    // Urutan guard: throttle -> JWT -> CSRF.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
