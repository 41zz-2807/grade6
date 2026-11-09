/**
 * Batas & aturan import siswa dari file CSV.
 *
 * Semua angka ada di sini supaya bisa diubah tanpa menyentuh service.
 */

/** Maksimal ukuran file CSV (1 MB). Cukup untuk ratusan siswa. */
export const MAX_STUDENT_IMPORT_BYTES = 1024 * 1024;

/** Maksimal baris data per import, tidak menghitung header. */
export const MAX_STUDENT_IMPORT_ROWS = 500;

/** Panjang nama mengikuti kolom `students.name` (VarChar(120)). */
export const MAX_STUDENT_NAME_LENGTH = 120;

/**
 * Header kolom yang diterima sebagai "nama siswa".
 * Lowercase & spasi sudah dirapatkan sebelum dicocokkan, jadi "Nama Lengkap",
 * "nama_lengkap", dan "NAMA" semua kena.
 */
export const STUDENT_IMPORT_NAME_HEADERS = [
  "nama",
  "nama lengkap",
  "nama_lengkap",
  "namalengkap",
  "name",
  "student name",
];

/** Nama file template yang diunduh admin. */
export const STUDENT_IMPORT_TEMPLATE_FILENAME = "template-import-siswa.csv";

/** Isi template. Nama fiktif - jelas bukan data siswa sungguhan. */
export const STUDENT_IMPORT_TEMPLATE_CSV =
  [
    "nama",
    "Ahmad Fauzi",
    "Budi Santoso",
    "Citra Lestari",
    "Dewi Anggraini",
  ].join("\n") + "\n";
