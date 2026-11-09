import { Module } from "@nestjs/common";
import { IncomeCategoryController } from "./income-category.controller";

@Module({
  controllers: [IncomeCategoryController],
})
export class IncomeCategoryModule {}
