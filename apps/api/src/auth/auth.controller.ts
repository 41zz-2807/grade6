import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { CSRF_COOKIE, SESSION_COOKIE } from "../common/constants/auth-rules";

const COOKIE_BASE = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
} as const;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly captcha: CaptchaService,
  ) {}

  /** CAPTCHA dikirim terpisah supaya form bisa request ulang tanpa submit login. */
  @Public()
  @Get("captcha")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  issueCaptcha() {
    return this.captcha.issue();
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  // Batas ketat per-IP, terpisah dari lockout per-akun di AuthService.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.login(dto, {
      ip: this.clientIp(req),
      userAgent: req.get("user-agent") ?? undefined,
    });

    this.writeSessionCookies(req, res, result.accessToken, result.expiresIn, {
      rotateCsrf: true,
    });

    return { user: result.user, expiresIn: result.expiresIn };
  }

  /**
   * Perpanjang sesi selama admin masih aktif.
   *
   * Inilah yang membuat "auto logout setelah 5 menit idle" bekerja: token sesi
   * berumur 5 menit, dan tiap ada aktivitas frontend memanggil endpoint ini
   * untuk mendapat token baru. Diam > 5 menit -> token lama kedaluwarsa ->
   * request ini 401 -> frontend mengarahkan ke halaman login.
   *
   * CSRF token yang ada DIPAKAI ULANG (bukan diacak ulang) dan hanya
   * diperpanjang umurnya. Kalau diacak setiap refresh, dua request yang
   * tumpang tindih bisa membuat cookie berbeda dan memicu 403 yang membingungkan.
   */
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, expiresIn } = await this.service.refresh(user);
    this.writeSessionCookies(req, res, accessToken, expiresIn, { rotateCsrf: false });
    return { user, expiresIn };
  }

  /** Otorisasi dari cookie sesi; dipakai frontend untuk cek session masih hidup. */
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  /** Ganti password sendiri dari panel admin. */
  @Post("change-password")
  @HttpCode(200)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  /** Riwayat login terbaru (halaman keamanan). */
  @Get("login-logs")
  loginLogs(@Query("take") take?: string) {
    return this.service.recentLoginLogs(take ? Number(take) : 30);
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Flag secure harus sama persis dengan saat cookie dibuat, kalau tidak
    // clearCookie tidak akan menghapusnya di beberapa browser.
    const secure = this.isSecure(req);
    res.clearCookie(SESSION_COOKIE, { ...COOKIE_BASE, secure });
    res.clearCookie(CSRF_COOKIE, { ...COOKIE_BASE, httpOnly: false, secure });
    return { loggedOut: true };
  }

  private clientIp(req: Request): string {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  }

  /**
   * Tulis cookie sesi + cookie CSRF dengan umur yang sama.
   *
   * Umur keduanya harus selalu sama: kalau cookie sesi diperpanjang tapi cookie
   * CSRF tidak, CSRF akan habis duluan dan semua request POST berikutnya gotoh
   * 403 "Token CSRF tidak ada" alih-alih mengarahkan user login ulang.
   */
  private writeSessionCookies(
    req: Request,
    res: Response,
    accessToken: string,
    expiresInMinutes: number,
    { rotateCsrf }: { rotateCsrf: boolean },
  ): void {
    const secure = this.isSecure(req);
    const maxAge = expiresInMinutes * 60_000;

    res.cookie(SESSION_COOKIE, accessToken, { ...COOKIE_BASE, secure, maxAge });

    // Token CSRF sengaja TIDAK httpOnly supaya frontend bisa membacanya dan
    // mengirimkannya balik di header.
    const csrfToken = rotateCsrf
      ? randomBytes(32).toString("base64url")
      : req.cookies?.[CSRF_COOKIE] ?? randomBytes(32).toString("base64url");

    res.cookie(CSRF_COOKIE, csrfToken, {
      ...COOKIE_BASE,
      httpOnly: false,
      secure,
      maxAge,
    });
  }

  private isSecure(req: Request): boolean {
    return req.protocol === "https" || req.get("x-forwarded-proto") === "https";
  }
}
