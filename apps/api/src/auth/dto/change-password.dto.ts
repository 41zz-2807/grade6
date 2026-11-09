import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: "Password saat ini wajib diisi" })
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: "Password baru minimal 8 karakter" })
  @MaxLength(200)
  @Matches(/[A-Za-z]/, { message: "Password baru harus mengandung huruf" })
  @Matches(/\d/, { message: "Password baru harus mengandung angka" })
  newPassword!: string;
}
