import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateAcademicYearDto {
  @IsString()
  @MaxLength(40)
  name!: string;

  @Type(() => Number)
  @IsInt({ message: "startMonth harus angka bulan (1-12)" })
  @Min(1)
  @Max(12)
  startMonth!: number;

  @Type(() => Number)
  @IsInt({ message: "endMonth harus angka bulan (1-12)" })
  @Min(1)
  @Max(12)
  endMonth!: number;

  @IsBoolean()
  isActive = false;
}

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "startMonth harus angka bulan (1-12)" })
  @Min(1)
  @Max(12)
  startMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "endMonth harus angka bulan (1-12)" })
  @Min(1)
  @Max(12)
  endMonth?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
