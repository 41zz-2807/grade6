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
import { AcademicYearService } from "./academic-year.service";
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
} from "./dto/create-academic-year.dto";

@Controller("academic-years")
export class AcademicYearController {
  constructor(private readonly service: AcademicYearService) {}

  @Post()
  create(@Body() dto: CreateAcademicYearDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/activate")
  setActive(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.setActive(id);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
