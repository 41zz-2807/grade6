/**
 * Parser CSV minimal untuk import siswa.
 *
 * Cukup untuk file yang dihasilkan Excel / Google Sheets: pemisah koma, tanda
 * kutip untuk nama yang mengandung koma atau baris baru, tanda kutip ganda
 * (`""`) sebagai escape, dan line ending CRLF maupun LF.
 *
 * Sengaja tidak memakai dependency CSV: aturan mainannya pendek dan stabil,
 * dan menambah paket untuk ini berarti menambah permukaan serang di produksi
 * (lihat catatan `npm audit` di agents.md).
 */

export interface ParsedCsv {
  rows: string[][];
}

/** Buang BOM UTF-8/UTF-16 dan kembalikan teksnya dalam encoding yang benar. */
export function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // UTF-16BE: tidak ada codec bawaan yang menulis rune BMP langsung, jadi
    // ditukar ke LE dulu.
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  return buffer.toString("utf8");
}

/** Parse teks CSV menjadi array of baris & kolom. */
export function parseCsv(input: string): ParsedCsv["rows"] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // Baris terakhir tanpa line ending di akhir file.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Buang baris yang seluruh selnya kosong (sisa dari trailing newline di akhir file). */
export function dropBlankRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

/** Rapatkan spasi berulang & trim - "  Ahmad   Fauzi " -> "Ahmad Fauzi". */
export function normalizeCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Kunci pembanding duplikat: lowercase + spasi dirapatkan. */
export function duplicateKey(value: string): string {
  return normalizeCell(value).toLowerCase();
}
