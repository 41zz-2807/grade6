import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id: string;
  username: string;
}

/** User hasil verifikasi JWT,di-resolve dari request. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
