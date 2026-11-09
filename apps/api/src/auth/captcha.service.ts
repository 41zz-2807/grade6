import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { CAPTCHA_TTL_SECONDS } from "../common/constants/auth-rules";

export interface CaptchaChallenge {
  /** Pertanyaan yang ditampilkan, mis. "7 + 8". */
  question: string;
  /** Token bertanda tangan; dikirim balik bersama jawaban. */
  token: string;
  expiresIn: number;
}

/**
 * CAPTCHA hitung sederhana, tanpa layanan pihak ketiga.
 *
 * Token = base64url(payload).base64url(HMAC-SHA256(payload, secret))
 * Payload berisi jawaban + waktu kedaluwarsa, jadi:
 *   - client tidak bisa menebak/membuat jawaban sendiri (tanpa secret)
 *   - jawaban lama tidak bisa dipakai ulang setelah kedaluwarsa
 *
 * Kalau nanti mau pindah ke reCAPTCHA/hCaptcha, ganti hanya isi service ini -
 * verify() tetap punya kontrak yang sama.
 */
@Injectable()
export class CaptchaService {
  constructor(private readonly config: ConfigService) {}

  issue(): CaptchaChallenge {
    const a = randomInt(2, 10);
    const b = randomInt(2, 10);
    const usePlus = randomInt(0, 2) === 0;
    const answer = usePlus ? a + b : a * b;

    const payload = Buffer.from(
      JSON.stringify({ a: answer, exp: Date.now() + CAPTCHA_TTL_SECONDS * 1000 }),
    ).toString("base64url");

    return {
      question: usePlus ? `${a} + ${b} = ?` : `${a} × ${b} = ?`,
      token: `${payload}.${this.sign(payload)}`,
      expiresIn: CAPTCHA_TTL_SECONDS,
    };
  }

  verify(token: string | undefined, answer: unknown): void {
    if (!token || answer === undefined || answer === null || answer === "") {
      throw new UnauthorizedException("CAPTCHA wajib diisi.");
    }

    const [payload, signature] = token.split(".");
    if (!payload || !signature) {
      throw new UnauthorizedException("CAPTCHA tidak valid.");
    }

    // timingSafeEqual butuh panjang buffer sama.
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthorizedException("CAPTCHA tidak valid.");
    }

    let data: { a: number; exp: number };
    try {
      data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("CAPTCHA tidak valid.");
    }

    if (typeof data.a !== "number" || Date.now() > data.exp) {
      throw new UnauthorizedException("CAPTCHA kedaluwarsa, muat ulang.");
    }

    if (Number(answer) !== data.a) {
      throw new UnauthorizedException("Jawaban CAPTCHA salah.");
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.config.getOrThrow<string>("JWT_SECRET"))
      .update(payload)
      .digest("base64url");
  }
}
