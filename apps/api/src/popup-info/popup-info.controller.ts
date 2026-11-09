import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { PopupInfoService } from "./popup-info.service";
import { CreatePopupInfoDto, UpdatePopupInfoDto } from "./dto/popup-info.dto";

@Controller("popup-infos")
export class PopupInfoController {
  constructor(private readonly service: PopupInfoService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePopupInfoDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePopupInfoDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
