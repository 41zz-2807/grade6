import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Response } from "express";
import { StudentsService } from "./students.service";
import { CreateStudentDto, QueryStudentDto, UpdateStudentDto } from "./dto/student.dto";
import {
  MAX_STUDENT_IMPORT_BYTES,
  STUDENT_IMPORT_TEMPLATE_CSV,
  STUDENT_IMPORT_TEMPLATE_FILENAME,
} from "../common/constants/import-rules";

@Controller("students")
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryStudentDto) {
    return this.service.findAll(query);
  }

  /**
   * Template CSV untuk import siswa.
   *
   * WAJIB dideklarasikan sebelum `@Get(":id")`: Nest mencocokkan route sesuai
   * urutan deklarasi, jadi kalau `:id` lebih dulu, request ke
   * "import-template" akan tertangkap ParseUUIDPipe dan jadi 400.
   *
   * Diawali BOM UTF-8 supaya Excel di Windows membuka nama ascii/non-ascii
   * dengan benar (tanpa BOM, Excel memakai encoding lokal).
   */
  @Get("import-template")
  importTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(STUDENT_IMPORT_TEMPLATE_CSV, "utf8"),
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${STUDENT_IMPORT_TEMPLATE_FILENAME}"`);
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(buffer);
  }

  /** Import siswa dari file CSV. Nama yang sudah ada dilewatkan. */
  @Post("import")
  @UseInterceptors(
    FileInterceptor("file", {
      // File CSV tidak perlu disimpan: dibaca di memori lalu dibuang. Dipakai
      // memoryStorage (bukan diskStorage milik bukti transfer) supaya file
      // impor tidak pernah nyangkut di UPLOAD_DIR.
      storage: memoryStorage(),
      limits: { fileSize: MAX_STUDENT_IMPORT_BYTES, files: 1 },
    }),
  )
  importCsv(@UploadedFile() file?: Express.Multer.File) {
    return this.service.importCsv(file);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
