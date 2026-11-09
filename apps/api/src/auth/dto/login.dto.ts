import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(1, { message: "username wajib diisi" })
  @MaxLength(60)
  username!: string;

  @IsString()
  @MinLength(1, { message: "password wajib diisi" })
  @MaxLength(200)
  password!: string;

  /** Wajib setelah 5x gagal (lihat CAPTCHA_THRESHOLD). */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  captchaToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  captchaAnswer?: string;
}
