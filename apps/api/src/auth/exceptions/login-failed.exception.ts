import { UnauthorizedException } from "@nestjs/common";

/**
 * Login gagal, dengan flag informsional apakah CAPTCHA sudah wajib diisi.
 * `message` sengaja dibuat generik ("Username atau password salah") supaya
 * tidak membocorkan apakah username-nya terdaftar.
 */
export class LoginFailedException extends UnauthorizedException {
  constructor(message: string, readonly captchaRequired: boolean) {
    super({ statusCode: 401, error: "Unauthorized", message, captchaRequired });
  }
}
