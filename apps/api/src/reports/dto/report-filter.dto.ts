import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max } from "class-validator";

export enum TransactionType {
  ALL = "ALL",
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export class ReportFilterDto {
  /** Tanggal mulai (ISO). */
  @IsOptional()
  @IsString()
  from?: string;

  /** Tanggal akhir (ISO, inklusif sampai 23:59:59). */
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID("4")
  academicYearId?: string;

  @IsOptional()
  @IsUUID("4")
  studentId?: string;

  @IsOptional()
  @IsIn(Object.values(TransactionType))
  type: TransactionType = TransactionType.ALL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(1000)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;
}
