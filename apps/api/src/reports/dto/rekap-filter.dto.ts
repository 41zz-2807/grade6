import { IsOptional, IsUUID } from "class-validator";

export class RekapFilterDto {
  /**
   * Masa ajaran yang direkap.
   * Kalau kosong, dipakai masa ajaran yang sedang aktif.
   */
  @IsOptional()
  @IsUUID("4")
  academicYearId?: string;
}
