/**
 * Proxy masuk (satu-satunya port yang dipublish: 3000 -> host 3004).
 *
 * Kenapa perlu ada, bukan pakai `rewrites` Next.js:
 *
 *   Next.js 14 tidak mengekspos IP socket klien - `request.ip` selalu null di
 *   middleware maupun route handler, dan Next hanya memasang X-Forwarded-For
 *   kalau klien tidak mengirimnya. Kalau X-Forwarded-For dari klien diteruskan
 *   begitu saja, penyerang bisa MEMPALSU IP-nya. Akibatnya:
 *     - rate limit bisa dilewati (limit dihitung per IP palsu)
 *     - login_logs merekam IP palsu, jadi alert Telegram menyesatkan
 *
 *   Di sini socket IP dibaca langsung, dan X-Forwarded-For dari klien SELALU
 *   ditimpa. NestJS dikonfigurasi `trust proxy: 'loopback'`, jadi ia hanya
 *   percaya header ini yang datang dari proxy di localhost.
 *
 *   Request /api dan /uploads diteruskan ke NestJS, sisanya ke Next.js.
 *   Tidak ada dependency tambahan - murni modul bawaan Node.
 */
const http = require("node:http");

const PORT = Number(process.env.WEB_PORT || 3000);
const API_PORT = Number(process.env.API_PORT || 3001);
const NEXT_PORT = Number(process.env.NEXT_PORT || 3002);
const HOST = "127.0.0.1";

// Request /api dan /uploads ditangani NestJS, sisanya Next.js.
const server = http.createServer((req, res) => {
  // NestJS memakai global prefix "api", jadi /uploads/* perlu ditulis ulang
  // menjadi /api/uploads/* sebelum diteruskan.
  let targetPath = req.url;
  let port;

  if (targetPath === "/api" || targetPath.startsWith("/api/")) {
    port = API_PORT;
  } else if (targetPath === "/uploads" || targetPath.startsWith("/uploads/")) {
    port = API_PORT;
    targetPath = `/api${targetPath}`;
  } else {
    port = NEXT_PORT;
  }

  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  // Header dari klien dibuang lalu diganti dengan IP asli socket.
  headers["x-forwarded-for"] = req.socket.remoteAddress || "unknown";
  delete headers["x-real-ip"];

  const upstream = http.request(
    { host: HOST, port, path: targetPath, method: req.method, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ statusCode: 502, message: `Upstream tidak tersedia: ${error.message}` }));
  });

  // Putuskan upstream kalau klien batal (mis. upload dihentikan halfway).
  res.on("close", () => {
    if (!res.writableEnded) upstream.destroy();
  });

  req.pipe(upstream);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] http://0.0.0.0:${PORT} -> API :${API_PORT} | Next :${NEXT_PORT}`);
});
