import type { MetadataRoute } from "next";

/**
 * Admin panel tidak boleh diindeks mesin pencari.
 * Ini (@gema) adalah lapisan pertahanan tambahan - bukan pengaman utama.
 * Pengaman sesungguhnya: JWT + rate limit + CAPTCHA + lock akun.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/gema", "/gema/", "/api/"] }],
  };
}
