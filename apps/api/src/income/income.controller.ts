import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { IncomeService } from "./income.service";
import { CreateIncomeDto, QueryIncomeDto } from "./dto/create-income.dto";
import { proofUploadOptions } from "../common/upload/upload.config";
import { MAX_PROOFS_PER_TRANSACTION } from "../common/constants/cash-rules";

@Controller("incomes")
export class IncomeController {
  constructor(private readonly service: IncomeService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor("proofs", MAX_PROOFS_PER_TRANSACTION, proofUploadOptions()),
  )
  create(@Body() dto: CreateIncomeDto, @UploadedFiles() files: Express.Multer.File[] = []) {
    return this.service.create(dto, files);
  }

  @Get()
  findAll(@Query() query: QueryIncomeDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
