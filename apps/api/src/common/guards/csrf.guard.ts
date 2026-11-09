import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "node:crypto";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from "../constants/auth-rules";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Proteksi CSRF double-submit.
 *
 * Sesi disimpan di cookie, jadi request dari domain lain bisa memakai cookie itu
 * otomatis. Cookie sesi memakai SameSite=Lax yang menahan sebagian besar serangan,
 * tapi request dari subdomain/sibling masih bisa lolos - jadi tambahan ini dipakai.
 *
 * Aturan: untuk request yang mengubah data, header `X-CSRF-Token` harus sama
 * dengan cookie `gema_csrf`. JavaScript di domain lain tidak bisa membaca cookie
 * milik domain ini, jadi tidak bisa menyalin nilainya.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    if (SAFE_METHODS.has(request.method)) return true;
    if (!request.cookies?.[SESSION_COOKIE]) return true; // tidak ada sesi, biarkan JWT guard yang menolak

    const cookieToken: string = request.cookies[CSRF_COOKIE] ?? "";
    const headerToken: string = request.get(CSRF_HEADER) ?? "";

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException("Token CSRF tidak ada. Muat ulang halaman lalu coba lagi.");
    }

    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException("Token CSRF tidak cocok.");
    }

    return true;
  }
}
