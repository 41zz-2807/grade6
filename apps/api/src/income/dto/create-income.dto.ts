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
import { IncomeCategoryType, PaymentMethod } from "@prisma/client";

export class CreateIncomeDto {
  /** Tanggal transaksi (ISO). Default: sekarang. */
  @IsOptional()
  @IsDateString({}, { message: "date harus format ISO-8601" })
  date?: string;

  /** Wajib untuk KAS_KELAS & KOMITE, opsional untuk UMUM. */
  @IsOptional()
  @IsUUID("4", { message: "studentId harus UUID yang valid" })
  studentId?: string;

  @IsEnum(IncomeCategoryType, { message: "category harus KAS_KELAS, KOMITE, atau UMUM" })
  category!: IncomeCategoryType;

  /** Nominal Rupiah penuh. KAS_KELAS tidak harus kelipatan iuran bulanan. */
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

  @IsUUID("4", { message: "academicYearId harus UUID yang valid" })
  academicYearId!: string;
}

export class QueryIncomeDto {
  @IsOptional()
  @IsUUID("4")
  studentId?: string;

  @IsOptional()
  @IsEnum(IncomeCategoryType)
  category?: IncomeCategoryType;

  @IsOptional()
  @IsUUID("4")
  academicYearId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  take = 50;
}
