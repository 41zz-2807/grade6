import { Global, Module } from "@nestjs/common";
import { CashRulesController } from "./cash-rules.controller";
import { CashRulesService } from "./cash-rules.service";

@Global()
@Module({
  controllers: [CashRulesController],
  providers: [CashRulesService],
  exports: [CashRulesService],
})
export class CashRulesModule {}
