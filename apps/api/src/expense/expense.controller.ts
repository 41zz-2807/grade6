import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ExpenseService } from "./expense.service";
import {
  CreateExpenseDto,
  QueryExpenseDto,
  UpdateExpenseDto,
} from "./dto/create-expense.dto";
import { proofUploadOptions } from "../common/upload/upload.config";
import { MAX_PROOFS_PER_TRANSACTION } from "../common/constants/cash-rules";

@Controller("expenses")
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor("proofs", MAX_PROOFS_PER_TRANSACTION, proofUploadOptions()),
  )
  create(@Body() dto: CreateExpenseDto, @UploadedFiles() files: Express.Multer.File[] = []) {
    return this.service.create(dto, files);
  }

  @Get()
  findAll(@Query() query: QueryExpenseDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @UseInterceptors(
    FilesInterceptor("proofs", MAX_PROOFS_PER_TRANSACTION, proofUploadOptions()),
  )
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.service.update(id, dto, files);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
