/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // The image optimizer is not used by this app; disabling it removes the
  // /_next/image attack surface (GHSA-2xp9-vwfh-vxw4, GHSA-h64f-5h5j-jqjh).
  images: { unoptimized: true },
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  // /api dan /uploads ditangani docker/proxy.js (bukan rewrites) supaya IP klien
  // asli bisa diteruskan ke NestJS. Lihat komentar di file tersebut.

  // Header keamanan untuk halaman HTML. API punya set-nya sendiri (helmet di
  // apps/api/src/main.ts); ini untuk respons yang diserve Next.js.
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js menyuntikkan skrip inline; tanpa 'unsafe-inline' hydration rusak.
      "script-src 'self' 'unsafe-inline'",
      // Tailwind menyuntikkan <style> inline.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Bukti transfer dimuat lewat /uploads (proxy) - tetap origin sendiri.
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'self'",
    ].join("; ");

    const isDev = process.env.NODE_ENV !== "production";
    return [
      { source: "/:path*", headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        { key: "Strict-Transport-Security", value: isDev ? "0" : "max-age=31536000; includeSubDomains" },
      ] },
      // Halaman admin tidak boleh pernah di-cache proxy/CDN.
      { source: "/gema/:path*", headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ] },
      // Rekening & bukti: jangan pernah ikut ter-cache atau diindeks.
      { source: "/api/uploads/:path*", headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex" },
      ] },
      { source: "/uploads/:path*", headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex" },
      ] },
    ];
  },
};

export default nextConfig;
