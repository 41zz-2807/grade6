import { Module } from "@nestjs/common";
import { PopupInfoController } from "./popup-info.controller";
import { PopupInfoService } from "./popup-info.service";

@Module({
  controllers: [PopupInfoController],
  providers: [PopupInfoService],
  exports: [PopupInfoService],
})
export class PopupInfoModule {}
