import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "auth:public";

/** Menandai route yang boleh diakses tanpa login (health, auth/captcha, dll). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
