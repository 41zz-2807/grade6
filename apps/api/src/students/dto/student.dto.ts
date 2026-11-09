import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

/**
 * Buang spasi di awal & akhir nama.
 *
 * Tanpa ini, nama yang diketik dengan spasi di depan (mis. "  AISYAH TAYA
 * AQILAH") tersimpan apa adanya. Akibatnya: kolom nama di laporan PDF
 * bergeser, dan pengecekan nama duplikat bisa lolos karena "Ahmad" dan
 * "  Ahmad" dianggap berbeda.
 */
const trimName = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateStudentDto {
  @Transform(trimName)
  @IsString()
  // Setelah di-trim, nama consisting only of spaces menjadi string kosong.
  // `@IsString()` sendiri menerima "" , jadi harus ditolak eksplisit.
  @IsNotEmpty({ message: "Nama siswa tidak boleh kosong." })
  @MaxLength(120)
  name!: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @Transform(trimName)
  @IsString()
  @IsNotEmpty({ message: "Nama siswa tidak boleh kosong." })
  @MaxLength(120)
  name?: string;
}

export class QueryStudentDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  statusKasLunas?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  statusKomiteLunas?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  take = 50;
}
