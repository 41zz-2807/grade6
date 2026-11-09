import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpsertSettingDto } from "./dto/setting.dto";

@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":key")
  findOne(@Param("key") key: string) {
    return this.service.findOne(key);
  }

  @Patch()
  upsert(@Body() dto: UpsertSettingDto) {
    return this.service.upsert(dto);
  }
}
