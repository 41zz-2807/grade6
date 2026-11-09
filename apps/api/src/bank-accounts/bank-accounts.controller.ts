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
import { BankAccountsService } from "./bank-accounts.service";
import { CreateBankAccountDto, UpdateBankAccountDto } from "./dto/bank-account.dto";

@Controller("bank-accounts")
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBankAccountDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateBankAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
