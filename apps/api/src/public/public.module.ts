import { Module } from "@nestjs/common";
import { PublicController } from "./public.controller";
import { BankAccountsModule } from "../bank-accounts/bank-accounts.module";
import { PopupInfoModule } from "../popup-info/popup-info.module";
import { ReportsModule } from "../reports/reports.module";

@Module({
  imports: [BankAccountsModule, PopupInfoModule, ReportsModule],
  controllers: [PublicController],
})
export class PublicModule {}
