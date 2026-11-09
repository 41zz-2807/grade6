import { BadRequestException, Controller, Get, NotFoundException, Param, Res, StreamableFile } from "@nestjs/common";
import { Response } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { uploadDirectory } from "./upload.config";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

@Controller("uploads")
export class UploadsController {
  /**
   * Menampilkan file bukti. Nama file selalu hasil uuid dari multer, tapi path
   * traversal tetap dicegah agar tidak bisa keluar dari UPLOAD_DIR.
   */
  @Get(":fileName")
  async serve(
    @Param("fileName") fileName: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeName = basename(fileName);
    if (safeName !== fileName || !safeName.includes(".")) {
      throw new BadRequestException("Nama file tidak valid.");
    }

    const ext = extname(safeName).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) throw new BadRequestException(`Tipe file tidak didukung: ${ext}`);

    const path = join(uploadDirectory(), safeName);
    if (!existsSync(path)) throw new NotFoundException(`Bukti tidak ditemukan: ${safeName}`);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(statSync(path).size));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");

    return new StreamableFile(createReadStream(path));
  }
}
