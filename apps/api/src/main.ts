import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { resolve, sep } from "node:path";
import type { Express } from "express";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { assertUploadDirIsSafe } from "./common/upload/upload.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Fail fast kalau folder upload mengarah ke public/ Next.js - file bukti
  // akan ikut ter-serve sebagai aset statis tanpa perlu login.
  assertUploadDirIsSafe(config.get<string>("UPLOAD_DIR", "/app/uploads"));

  app.setGlobalPrefix("api");

  // Security headers untuk respons API. Halaman HTML dikirim Next.js, jadi
  // header yang sama juga dipasang di next.config.mjs.
  app.use(
    helmet({
      // API hanya Serving JSON & berkas bukti, tidak pernah HTML.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { "default-src": ["'none'"], "frame-ancestors": ["'none'"] },
      },
      // Bukti transfer (gambar/PDF) dimuat oleh browser dari origin yang sama.
      crossOriginResourcePolicy: { policy: "same-site" },
      // Jangan bocorkan versi framework.
      hidePoweredBy: true,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  // CORS ketat. Aplikasi dilayani satu origin lewat docker/proxy.js, jadi dalam
  // kondisi normal tidak ada request lintas origin sama sekali - daftar ini
  // hanya untuk klien yang memang diizinkan (mis. domain publik).
  const allowedOrigins = (config.get<string>("ALLOWED_ORIGINS") ?? "https://bilmary.my.id")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Accept"],
    maxAge: 600,
  });
  new Logger("Bootstrap").log(`CORS diizinkan untuk: ${allowedOrigins.join(", ")}`);

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  // API selalu diakses lewat Next.js rewrite dari loopback. Tanpa ini
  // req.ip selalu "127.0.0.1": rate limit jadi satu bucket global untuk semua
  // pengguna, dan login_logs tidak mencatat IP asli penyerang.
  // 'loopback' hanya percaya X-Forwarded-For dari proxy di localhost, jadi
  // header tetap tidak bisa dipalsukan dari luar.
  expressApp.set("trust proxy", "loopback");
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableShutdownHooks();

  // Warm up the database connection before accepting traffic.
  const prisma = app.get(PrismaService);
  await prisma.$connect();

  const port = Number(config.get<string>("API_PORT", "3001"));
  await app.listen(port, "0.0.0.0");
  new Logger("Bootstrap").log(`API ready on http://0.0.0.0:${port}/api`);
  new Logger("Bootstrap").log(`Upload bukti: ${resolve(process.env.UPLOAD_DIR || "/app/uploads")}${sep}`);
}

bootstrap();
