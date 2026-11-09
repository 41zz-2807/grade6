import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SESSION_COOKIE } from "../constants/auth-rules";
import { AuthUser } from "../decorators/current-user.decorator";

/**
 * Guard global: semua endpoint wajib login kecuali yang ditandai @Public().
 * Token dibaca dari cookie httpOnly, bukan dari header, supaya tidak bisa
 * dicuri lewat XSS.
 */
@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token: string | undefined = request.cookies?.[SESSION_COOKIE];

    if (!token) {
      throw new UnauthorizedException("Sesi tidak ditemukan, silakan login.");
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; username: string }>(token);
      request.user = { id: payload.sub, username: payload.username } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException("Sesi tidak valid atau sudah kedaluwarsa.");
    }
  }
}
