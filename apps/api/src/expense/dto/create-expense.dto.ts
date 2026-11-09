import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class CreateExpenseDto {
  @IsOptional()
  @IsDateString({}, { message: "date harus format ISO-8601" })
  date?: string;

  @IsString()
  @MaxLength(160)
  recipient!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 0 },
    { message: "amount harus angka bulat (Rupiah penuh, tanpa sen)" },
  )
  @IsPositive({ message: "amount harus lebih besar dari 0" })
  @IsInt({ message: "amount harus bilangan bulat" })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(PaymentMethod, { message: "paymentMethod harus TRANSFER atau CASH" })
  paymentMethod!: PaymentMethod;
}

export class QueryExpenseDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  take = 50;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsDateString({}, { message: "date harus format ISO-8601" })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  recipient?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 0 },
    { message: "amount harus angka bulat (Rupiah penuh, tanpa sen)" },
  )
  @IsPositive({ message: "amount harus lebih besar dari 0" })
  @IsInt({ message: "amount harus bilangan bulat" })
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: "paymentMethod harus TRANSFER atau CASH" })
  paymentMethod?: PaymentMethod;
}
