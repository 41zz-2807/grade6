import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CaptchaService } from "./captcha.service";
import { TelegramService } from "./telegram.service";
import { LoginDto } from "./dto/login.dto";
import { LoginFailedException } from "./exceptions/login-failed.exception";
import { formatDateTime } from "../common/utils/datetime";
import {
  CAPTCHA_THRESHOLD,
  LOCK_MINUTES,
  LOCK_THRESHOLD,
  SESSION_IDLE_MINUTES,
} from "../common/constants/auth-rules";
import type { AuthUser } from "../common/decorators/current-user.decorator";

export interface LoginResult {
  user: { id: string; username: string };
  accessToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly captcha: CaptchaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Alur login:
   *   1. cek lock sementara (lockedUntil)
   *   2. kalau failedLoginCount >= 5 -> CAPTCHA wajib (validasi sebelum cek password)
   *   3. verifikasi passwordHash
   *   4. gagal -> naikkan counter, tulis LoginLog, tiap kelipatan 5 -> lock + Telegram
   *   5. sukses -> reset counter, unlock, tulis LoginLog, kirim notifikasi Telegram
   *
   * `failedLoginCount` HANYA di-reset saat login sukses, tidak saat lock aktif.
   * Itu supaya CAPTCHA tetap muncul setelah masa lock habis - kalau di-reset,
   * penyerang hanya perlu menunggu 15 menit untuk mendapat kesempatan tak terbatas lagi.
   */
  async login(dto: LoginDto, meta: { ip: string; userAgent?: string }): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });

    // Username tidak ada: tetap lakukan bcrypt dummy supaya waktu responsnya
    // tidak membocorkan username mana yang terdaftar.
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      await this.logAttempt(null, meta, false);
      // Tetap tanya CAPTCHA setelah beberapa kegagalan username lain, supaya
      // penyerang tidak bisa menebak-nebak username tanpa dihukum.
      throw new LoginFailedException("Username atau password salah.", true);
    }

    this.assertNotLocked(user.lockedUntil, user.username);
    this.verifyCaptchaIfRequired(user.failedLoginCount, dto);

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const failedLoginCount = await this.handleFailedAttempt(user, meta);
      throw new LoginFailedException(
        "Username atau password salah.",
        failedLoginCount >= CAPTCHA_THRESHOLD,
      );
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLogin: now },
    });
    await this.logAttempt(user.id, meta, true);

    this.telegram.notify(
      [
        "✅ *Login admin BERHASIL*",
        `User: \`${user.username}\``,
        `IP: \`${meta.ip}\``,
        `Waktu: ${this.formatTime(now)}`,
        meta.userAgent ? `UA: ${this.truncate(meta.userAgent, 120)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const { accessToken, expiresIn } = await this.signSession(user);

    return { user: { id: user.id, username: user.username }, accessToken, expiresIn };
  }

  /**
   * Perpanjang sesi yang sedang berjalan (sliding session).
   *
   * Dipanggil frontend ketika admin masih aktif. Token baru memberi_admin waktu
   * hidup baru, jadi selama ada aktivitas tiap <= SESSION_IDLE_MINUTES, sesi
   * tidak pernah berakhir.
   *
   * Kalau admin sudah diam lebih dari 5 menit, token lama sudah kedaluwarsa dan
   * request ini ditolak JwtAuthGuard dengan 401 - inilah yang memicu
   * "Sesi berakhir, silakan login kembali".
   *
   * Sengaja tidak memakai refresh token terpisah: menambah token yang lebih
   * panjang umur justru melemahkan aturan idle timeout. Perpanjang = ganti
   * token sesi biasa.
   */
  async refresh(user: AuthUser): Promise<{ accessToken: string; expiresIn: number }> {
    return this.signSession(user);
  }

  /** Umur token sesi dalam menit (idle timeout). */
  private sessionMinutes(): number {
    return Number(
      this.config.get<string>("SESSION_IDLE_MINUTES", String(SESSION_IDLE_MINUTES)),
    );
  }

  private async signSession(user: AuthUser): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresIn = this.sessionMinutes();
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
    });
    return { accessToken, expiresIn };
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Ganti password dari panel admin.
   *
   * Password LAMA wajib benar supaya sesi yang kebocoran tidak bisa langsung
   * dipakai mengambil alih akun. Sesi di luar yang ini ikut tidak berlaku
   * karena tokennya ditandatangani `JWT_SECRET` yang tidak berubah - kalau mau
   * memaksa logout semua sesi, rotasi `JWT_SECRET`.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User tidak ditemukan.");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      this.logger.warn(`${user.username}: percobaan ganti password dengan password lama salah.`);
      throw new UnauthorizedException("Password saat ini salah.");
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException("Password baru harus berbeda dari password lama.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Ganti password juga membuka kunci & mereset hitungan gagal login.
        lockedUntil: null,
        failedLoginCount: 0,
      },
    });

    this.logger.log(`Password untuk '${user.username}' diganti lewat panel admin.`);
    this.telegram.notify(
      [
        "🔐 *Password admin DIUBAH*",
        `User: \`${user.username}\``,
        `Waktu: ${formatDateTime()}`,
        "Kalau ini bukan Anda, segera hubungi operator sekolah.",
      ].join("\n"),
    );

    return { changed: true };
  }

  /** Riwayat login terbaru untuk halaman keamanan. */
  async recentLoginLogs(take = 30) {
    return this.prisma.loginLog.findMany({
      take: Math.min(Math.max(take, 1), 100),
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        success: true,
        timestamp: true,
        user: { select: { username: true } },
      },
    });
  }

  private assertNotLocked(lockedUntil: Date | null, username: string) {
    if (!lockedUntil || lockedUntil <= new Date()) return;
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000);
    throw new ForbiddenException(
      `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`,
    );
  }

  /**
   * Setelah CAPTCHA_THRESHOLD kegagalan, CAPTCHA wajib diisi. Error dibungkus
   * jadi LoginFailedException supaya flag `captchaRequired` ikut terkirim -
   * frontend baru tahu harus menampilkan field CAPTCHA.
   */
  private verifyCaptchaIfRequired(failedLoginCount: number, dto: LoginDto) {
    if (failedLoginCount < CAPTCHA_THRESHOLD) return;
    try {
      this.captcha.verify(dto.captchaToken, dto.captchaAnswer);
    } catch (error) {
      throw new LoginFailedException(
        error instanceof Error ? error.message : "CAPTCHA tidak valid.",
        true,
      );
    }
  }

  private async handleFailedAttempt(
    user: { id: string; username: string; failedLoginCount: number },
    meta: { ip: string; userAgent?: string },
  ): Promise<number> {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount % LOCK_THRESHOLD === 0;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCK_MINUTES * 60_000)
      : undefined;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        ...(lockedUntil ? { lockedUntil } : {}),
      },
    });
    await this.logAttempt(user.id, meta, false);

    if (shouldLock) {
      this.logger.warn(
        `${user.username} terkunci ${LOCK_MINUTES} menit setelah ${failedLoginCount} kali gagal.`,
      );
      this.telegram.notify(
        [
          "🚨 *PERINGATAN LOGIN ADMIN*",
          `${failedLoginCount} kali gagal login beruntun.`,
          `User: \`${user.username}\``,
          `IP: \`${meta.ip}\``,
          `Waktu: ${this.formatTime(new Date())}`,
          `Akun dikunci selama ${LOCK_MINUTES} menit.`,
          meta.userAgent ? `UA: ${this.truncate(meta.userAgent, 120)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } else if (failedLoginCount >= CAPTCHA_THRESHOLD) {
      this.telegram.notify(
        [
          "⚠️ *Percobaan login admin gagal*",
          `Gagal ke-${failedLoginCount}.`,
          `User: \`${user.username}\``,
          `IP: \`${meta.ip}\``,
          `Waktu: ${this.formatTime(new Date())}`,
        ].join("\n"),
      );
    }

    return failedLoginCount;
  }

  private async logAttempt(
    userId: string | null,
    meta: { ip: string; userAgent?: string },
    success: boolean,
  ) {
    await this.prisma.loginLog.create({
      data: {
        userId,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        success,
      },
    });
  }

  private formatTime(date: Date): string {
    return formatDateTime(date);
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}...` : value;
  }
}

/**
 * Hash bcrypt asli (password acak yang tidak pernah dipakai) supaya
 * `bcrypt.compare` melakukan pekerjaan yang sama persis ketika username
 * tidak ditemukan - waktu responsnya jadi tidak membocorkan username mana
 * yang terdaftar.
 */
const DUMMY_HASH = "$2a$12$gyMV2xICR8h1.8DSIr/6v.iTQMtvV0Cjp6AAoEgbuQRrU0lWnrWrq";
