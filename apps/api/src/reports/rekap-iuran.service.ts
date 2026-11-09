import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { IncomeCategoryType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CashRulesService } from "../cash-rules/cash-rules.service";
import { DEFAULT_CASH_RULES } from "../common/constants/cash-rules";
import { toNumber } from "../common/utils/money";
import { formatDateTimeId, todayStamp } from "../common/utils/datetime";

const SCHOOL_NAME_DEFAULT = "GIIS Grade 6 Jannatul Firdaus";

/** Nama bulan bahasa Indonesia. Hardcode, bukan `toLocaleDateString`, supaya
 *  hasilnya sama di image mana pun (bergantung pada ICU yang terpasang). */
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const MONTH_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Warna laporan.
const COLOR_TEXT = "#0f172a";
const COLOR_BODY = "#334155";
const COLOR_MUTED = "#64748b";
const COLOR_BORDER = "#cbd5e1";
const COLOR_ZEBRA = "#f8fafc";
const COLOR_GREEN = "#16a34a";

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

export type RekapMonth = { month: number; short: string; long: string };

export type RekapRow = {
  id: string;
  name: string;
  /** true = bulan itu sudah dibayar (urutan dari bulan awal masa ajaran). */
  paid: boolean[];
  /** Iuran komite sudah lunas untuk masa ajaran ini. */
  komiteLunas: boolean;
  /** Jumlah bulan kas yang sudah dibayar. */
  paidMonths: number;
  /** Total kas yang sudah dibayar ( rupiah ). */
  totalPaid: number;
  /** Sisa tagihan kas ( rupiah ). */
  remaining: number;
  /** Total iuran komite yang sudah dibayar per siswa. */
  totalKomitePaid: number;
};

export type RekapBundle = {
  academicYear: { id: string; name: string; startMonth: number; endMonth: number };
  months: RekapMonth[];
  rows: RekapRow[];
  kasMonthly: number;
  /** Target jumlah bulan yang boleh dibayar (min dari aturan & jumlah bulan masa ajaran). */
  targetMonths: number;
  komiteAmount: number;
  schoolName: string;
  totals: {
    students: number;
    lunas: number;
    belumLunas: number;
    komiteLunas: number;
    totalPaid: number;
    /** Tagihan kas seluruh kelas: target bulan x iuran bulanan x jumlah siswa. */
    totalTagihan: number;
    /** Tagihan komite seluruh kelas: iuran komite x jumlah siswa. */
    totalTagihanKomite: number;
  };
  /** Peringatan kalau aturan iuran tidak cocok dengan panjang masa ajaran. */
  warning: string | null;
};

/** Rekap iuran kas kelas per bulan.
 *
 * Aturan pengisian bulan (sumber kebenaran: `common/constants/cash-rules.ts`):
 *
 *   Months dibayar = floor(total kas yang sudah dibayar / iuran per bulan)
 *
 * dan bulan-bulan yang dicentang adalah bulan-bulan AWAL masa ajaran, berurutan.
 * Contoh (masa ajaran Jul s.d Mei, iuran Rp 15.000/bulan):
 *   - bayar Rp 165.000 -> 11 bulan -> Jul s.d Mei semua tercentang
 *   - bayar Rp 45.000  ->  3 bulan -> Jul, Agu, Sep tercentang
 *
 * Kenapa bukan "dari bulan tanggal pembayaran": bayar penuh Rp 165.000 tanggal
 * 5 Agustus akan menutup 11 bulan dari Agustus (Agustus s.d Juni) - Juni di
 * luar masa ajaran, jadi Juli terlihat belum bayar padahal lunas. Mengisi dari
 * awal masa ajaran membuat "lunas" (<= 11 bulan) selalu berarti semua kolom
 * tercentang, konsisten dengan status lunas di halaman siswa.
 */
@Injectable()
export class RekapIuranService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashRules: CashRulesService,
  ) {}

  /** Hitung matriks bulan + ringkasannya. */
  async build(academicYearId?: string): Promise<RekapBundle> {
    const rules = await this.cashRules.get();
    const kasMonthly = rules.kasMonthly > 0 ? rules.kasMonthly : DEFAULT_CASH_RULES.kasMonthly;
    const komiteAmount =
      rules.komiteAmount > 0 ? rules.komiteAmount : DEFAULT_CASH_RULES.komiteAmount;

    const academicYear = await this.resolveAcademicYear(academicYearId);
    const months = buildMonthList(academicYear.startMonth, academicYear.endMonth);
    // Aturan "maks 11 bulan" bisa lebih kecil dari panjang masa ajaran kalau
    // admin mengubah salah satunya. Targetnya yang lebih kecil supaya kolom
    // yang mustahil dibayar tidak pernah menggantung.
    const targetMonths = Math.max(1, Math.min(rules.kasMaxMonths, months.length));

    const students = await this.prisma.student.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        incomes: {
          where: {
            academicYearId: academicYear.id,
            category: {
              name: { in: [IncomeCategoryType.KAS_KELAS, IncomeCategoryType.KOMITE] },
            },
          },
          select: { amount: true, category: { select: { name: true } } },
        },
      },
    });

    const rows: RekapRow[] = students.map((student) => {
      let kasPaid = new Prisma.Decimal(0);
      let komitePaid = new Prisma.Decimal(0);
      for (const income of student.incomes) {
        if (income.category.name === IncomeCategoryType.KAS_KELAS) {
          kasPaid = kasPaid.plus(income.amount);
        } else if (income.category.name === IncomeCategoryType.KOMITE) {
          komitePaid = komitePaid.plus(income.amount);
        }
      }

      const totalPaid = toNumber(kasPaid);
      // Nominal kas TIDAK harus kelipatan iuran per bulan (mis. bayar Rp 50.000
      // untuk iuran Rp 15.000). Bulan lunas = pembulatan ke bawah, jadi Rp 50.000
      // menutup 3 bulan dan lebihnya menjadi kredit bulan ke-4.
      const paidMonths = Math.min(
        Math.floor(totalPaid / kasMonthly),
        targetMonths,
      );

      return {
        id: student.id,
        name: student.name,
        paid: months.map((_, index) => index < paidMonths),
        komiteLunas: toNumber(komitePaid) >= komiteAmount,
        paidMonths,
        totalPaid,
        remaining: Math.max(0, targetMonths * kasMonthly - totalPaid),
        totalKomitePaid: toNumber(komitePaid),
      };
    });

    const totalPaid = rows.reduce((sum, row) => sum + row.totalPaid, 0);

    return {
      academicYear: {
        id: academicYear.id,
        name: academicYear.name,
        startMonth: academicYear.startMonth,
        endMonth: academicYear.endMonth,
      },
      months,
      rows,
      kasMonthly,
      targetMonths,
      komiteAmount,
      schoolName: await this.schoolName(),
      totals: {
        students: rows.length,
        lunas: rows.filter((row) => row.paidMonths >= targetMonths).length,
        belumLunas: rows.filter((row) => row.paidMonths < targetMonths).length,
        komiteLunas: rows.filter((row) => row.komiteLunas).length,
        totalPaid,
        totalTagihan: rows.length * targetMonths * kasMonthly,
        totalTagihanKomite: rows.length * komiteAmount,
      },
      warning:
        rules.kasMaxMonths !== months.length
          ? `Jumlah bulan maksimal iuran (${rules.kasMaxMonths}) berbeda dari jumlah bulan masa ajaran (${months.length}). Yang dihitung adalah ${targetMonths} bulan.`
          : null,
    };
  }

  /** Laporan PDF: tabel nama siswa x bulan, bulan yang sudah dibayar dicentang hijau. */
  async toPdf(academicYearId?: string): Promise<Buffer> {
    const bundle = await this.build(academicYearId);
    const doc = new PDFDocument({ size: "A4", margin: 36, layout: "landscape" });

    // `doc.end()` harus dipanggil SETELAH semua konten ditulis, kalau tidak
    // PDFKit menutup dokumen duluan dan hasilnya file kecil yang kosong.
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const margin = 36;
    const usable = doc.page.width - margin * 2;

    // ---------------- Kop ----------------
    doc.fontSize(13).font("Helvetica-Bold").fillColor(COLOR_TEXT);
    doc.text("REKAP IURAN KAS KELAS", { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor(COLOR_BODY);
    doc.text(bundle.schoolName, { align: "center" });
    doc.moveDown(0.15);
    // Semua keterangan digabung ke SATU baris supaya tabel punya ruang lebih
    // banyak dan laporan (tabel + ringkasan) muat di satu halaman untuk kelas
    // dengan sampai sekitar 26 siswa. Selebihnya tabel pindah halaman dengan
    // header yang diulang.
    doc.fontSize(8).fillColor(COLOR_MUTED);
    doc.text(
      `Masa Ajaran ${bundle.academicYear.name}  •  ${bundle.months[0].long} - ${bundle.months[bundle.months.length - 1].long}  •  Iuran ${rupiah(bundle.kasMonthly)}/bulan (${bundle.targetMonths} bulan)  •  Komite ${rupiah(bundle.komiteAmount)}  •  Dibuat ${formatDateTimeId()}`,
      { align: "center" },
    );
    doc.moveDown(0.7);

    // ---------------- Layout kolom ----------------
    const headWidths = { no: 26, name: 165, komite: 44, bulan: 42, sisa: 66 };
    const fixedWidth =
      headWidths.no + headWidths.name + headWidths.komite + headWidths.bulan + headWidths.sisa;
    const monthWidth = Math.max(
      24,
      (usable - fixedWidth) / Math.max(1, bundle.months.length),
    );
    const totalWidth = fixedWidth + monthWidth * bundle.months.length;

    type Column = {
      label: string;
      width: number;
      align?: "left" | "center" | "right";
    };
    const columns: Column[] = [
      { label: "No", width: headWidths.no, align: "center" },
      { label: "Nama Siswa", width: headWidths.name, align: "left" },
      ...bundle.months.map<Column>((month) => ({
        label: month.short,
        width: monthWidth,
        align: "center",
      })),
      { label: "Komite", width: headWidths.komite, align: "center" },
      { label: "Bulan", width: headWidths.bulan, align: "center" },
      { label: "Sisa", width: headWidths.sisa, align: "right" },
    ];

    const rowHeight = 16;
    const tableTop = doc.y;

    const drawHeader = (y: number) => {
      doc.fontSize(8).font("Helvetica-Bold").fillColor(COLOR_TEXT);
      let x = margin;
      for (const column of columns) {
        doc.text(column.label, x, y + 4, {
          width: column.width,
          align: column.align ?? "center",
          lineBreak: false,
          ellipsis: true,
        });
        x += column.width;
      }
      doc
        .moveTo(margin, y + rowHeight - 4)
        .lineTo(margin + totalWidth, y + rowHeight - 4)
        .lineWidth(0.7)
        .strokeColor(COLOR_BORDER)
        .stroke();
    };

    drawHeader(tableTop);
    let y = tableTop + rowHeight;

    // ---------------- Baris siswa ----------------
    bundle.rows.forEach((row, index) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 48;
        drawHeader(y);
        y += rowHeight;
      }

      // Zebra biar baris mudah dibaca.
      if (index % 2 === 1) {
        doc.rect(margin, y, totalWidth, rowHeight).fill(COLOR_ZEBRA);
      }

      let x = margin;

      // No
      doc.fontSize(8).font("Helvetica").fillColor(COLOR_MUTED);
      doc.text(String(index + 1), x, y + 4, {
        width: headWidths.no,
        align: "center",
        lineBreak: false,
      });
      x += headWidths.no;

      // Nama
      doc.fillColor(COLOR_TEXT);
      doc.text(row.name, x, y + 4, {
        width: headWidths.name,
        align: "left",
        lineBreak: false,
        ellipsis: true,
      });
      x += headWidths.name;

      // Kolom bulan: centang hijau kalau sudah dibayar, garis strip kalau belum.
      for (const isPaid of row.paid) {
        const centerX = x + monthWidth / 2;
        if (isPaid) {
          drawCheck(doc, centerX, y + rowHeight / 2, 8);
        } else {
          drawDash(doc, centerX, y + rowHeight / 2, 8);
        }
        x += monthWidth;
      }

      // Kolom komite
      const komiteCenter = x + headWidths.komite / 2;
      if (row.komiteLunas) {
        drawCheck(doc, komiteCenter, y + rowHeight / 2, 8);
      } else {
        drawDash(doc, komiteCenter, y + rowHeight / 2, 8);
      }
      x += headWidths.komite;

      // Jumlah bulan terbayar
      doc.fontSize(8).font("Helvetica").fillColor(
        row.paidMonths >= bundle.targetMonths ? COLOR_GREEN : COLOR_BODY,
      );
      doc.text(`${row.paidMonths}/${bundle.targetMonths}`, x, y + 4, {
        width: headWidths.bulan,
        align: "center",
        lineBreak: false,
      });
      x += headWidths.bulan;

      // Sisa tagihan
      doc.fillColor(row.remaining === 0 ? COLOR_GREEN : COLOR_BODY);
      doc.text(rupiah(row.remaining), x, y + 4, {
        width: headWidths.sisa,
        align: "right",
        lineBreak: false,
      });

      y += rowHeight;
    });

    // ---------------- Ringkasan ----------------
    // Ringkasan sengaja dibuat ringkas (3 baris) supaya ikut muat di halaman
    // yang sama dengan tabel untuk kelas dengan jumlah siswa yang wajar.
    if (y > doc.page.height - 62) {
      doc.addPage();
      y = 48;
    }
    doc
      .moveTo(margin, y)
      .lineTo(margin + totalWidth, y)
      .lineWidth(0.7)
      .strokeColor(COLOR_BORDER)
      .stroke();
    y += 6;

    doc.fontSize(8).font("Helvetica-Bold").fillColor(COLOR_TEXT);
    doc.text(
      `RINGKASAN  •  Siswa: ${bundle.totals.students}  •  Lunas kas (${bundle.targetMonths}/${bundle.targetMonths} bulan): ${bundle.totals.lunas}  •  Belum lunas: ${bundle.totals.belumLunas}  •  Lunas komite: ${bundle.totals.komiteLunas}`,
      margin,
      y,
    );
    y += 11;

    doc.fontSize(8).font("Helvetica").fillColor(COLOR_BODY);
    doc.text(
      `Kas terkumpul: ${rupiah(bundle.totals.totalPaid)} dari tagihan ${rupiah(bundle.totals.totalTagihan)}  •  Sisa tagihan: ${rupiah(bundle.totals.totalTagihan - bundle.totals.totalPaid)}`,
      margin,
      y,
    );
    y += 14;

    // Legenda
    const legendY = y + 3;
    drawCheck(doc, margin + 5, legendY, 7);
    doc.fontSize(8).font("Helvetica").fillColor(COLOR_BODY);
    doc.text("sudah bayar", margin + 16, legendY - 5, { width: 90, lineBreak: false });
    drawDash(doc, margin + 86, legendY, 7);
    doc.text("belum bayar", margin + 97, legendY - 5, { width: 90, lineBreak: false });

    if (bundle.warning) {
      doc.fontSize(7).fillColor("#b45309");
      doc.text(`Catatan: ${bundle.warning}`, margin, legendY + 13, {
        width: totalWidth,
        lineBreak: false,
        ellipsis: true,
      });
    }

    doc.end();
    return done;
  }

  /** Laporan PDF: tabel nama siswa x status komite (lunas/partially/belum),
   * beserta sisa tagihan per siswa. A4 portrait, 1 halaman. */
  async toPdfKomite(academicYearId?: string): Promise<Buffer> {
    const bundle = await this.build(academicYearId);
    const doc = new PDFDocument({ size: "A4", margin: 36 });

    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const margin = 36;
    const usable = doc.page.width - margin * 2;

    // ---------------- Kop ----------------
    doc.fontSize(13).font("Helvetica-Bold").fillColor(COLOR_TEXT);
    doc.text("REKAP IURAN KOMITE KELAS", { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor(COLOR_BODY);
    doc.text(bundle.schoolName, { align: "center" });
    doc.moveDown(0.15);
    // Ringkasan per status komite di header
    doc.fontSize(8).fillColor(COLOR_MUTED);
    doc.text(
      `Masa Ajaran ${bundle.academicYear.name}  •  ${bundle.months[0].long} - ${bundle.months[bundle.months.length - 1].long}  •  Iuran komite ${rupiah(bundle.komiteAmount)}  •  Dibuat ${formatDateTimeId()}`,
      { align: "center" },
    );
    doc.moveDown(0.7);

    // ---------------- Layout kolom ----------------
    // Kolom: No, Nama, Status Komite, Sisa Bayar.
    // Tabel memakai SELURUH lebar halaman (A4 portrait, margin 36); kolom nama
    // yang mengisi sisa lebar. Sebelumnya totalnya tetap 307 pt, jadi kolom
    // "Sisa" berhenti di tengah halaman.
    const colNo = 30;
    const colStatus = 90;
    const colSisa = 140;
    const headWidths = {
      no: colNo,
      name: usable - colNo - colStatus - colSisa,
      status: colStatus,
      sisa: colSisa,
    };
    const fixedWidth = usable;

    const rowHeight = 17;
    const tableTop = doc.y;

    const drawHeader = (y: number) => {
      doc.fontSize(8).font("Helvetica-Bold").fillColor(COLOR_TEXT);
      let x = margin;
      // No
      doc.text("No", x, y + 4, { width: headWidths.no, align: "center", lineBreak: false });
      x += headWidths.no;
      // Nama
      doc.text("Nama Siswa", x, y + 4, { width: headWidths.name, align: "left", lineBreak: false, ellipsis: true });
      x += headWidths.name;
      // Status Komite
      doc.text("Status", x, y + 4, { width: headWidths.status, align: "center", lineBreak: false });
      x += headWidths.status;
      // Sisa
      doc.text("Sisa", x, y + 4, { width: headWidths.sisa, align: "right", lineBreak: false });
      // Bawah header
      doc
        .moveTo(margin, y + rowHeight - 4)
        .lineTo(margin + fixedWidth, y + rowHeight - 4)
        .lineWidth(0.7)
        .strokeColor(COLOR_BORDER)
        .stroke();
    };

    drawHeader(tableTop);
    let y = tableTop + rowHeight;

    // ---------------- Baris siswa ----------------
    // Urutkan: lunas dulu, lalu sebagian, lalu belum
    const sortedRows = [...bundle.rows].sort((a, b) => {
      const statusA = a.komiteLunas ? 0 : a.totalKomitePaid > 0 ? 1 : 2;
      const statusB = b.komiteLunas ? 0 : b.totalKomitePaid > 0 ? 1 : 2;
      return statusA - statusB;
    });

    let totalKomiteTerbayar = 0;
    sortedRows.forEach((row, index) => {
      totalKomiteTerbayar += row.totalKomitePaid || 0;

      if (y > doc.page.height - 70) {
        doc.addPage();
        y = 48;
        drawHeader(y);
      }

      // Zebra
      if (index % 2 === 1) {
        doc.rect(margin, y, fixedWidth, rowHeight).fill(COLOR_ZEBRA);
      }

      let x = margin;

      // No
      doc.fontSize(8).font("Helvetica").fillColor(COLOR_MUTED);
      doc.text(String(index + 1), x, y + 4, { width: headWidths.no, align: "center", lineBreak: false });
      x += headWidths.no;

      // Nama
      doc.fillColor(COLOR_TEXT);
      doc.text(row.name, x, y + 4, { width: headWidths.name, align: "left", lineBreak: false, ellipsis: true });
      x += headWidths.name;

      // Status Komite + Sisa Bayar
      const totalKomitePaid = row.totalKomitePaid;
      const sisa = bundle.komiteAmount - totalKomitePaid;
      const isLunas = totalKomitePaid >= bundle.komiteAmount;
      const isPartial = totalKomitePaid > 0 && !isLunas;

      let statusText = "";
      let sisaText = "";
      let statusColor = COLOR_BODY;

      if (isLunas) {
        statusText = "Lunas";
        statusColor = COLOR_GREEN;
        sisaText = "Rp 0";
      } else if (isPartial) {
        statusText = `Partial ${Math.round(totalKomitePaid)}`;
        statusColor = "#f5a623";
        sisaText = `Rp ${Math.round(sisa)}`;
      } else {
        statusText = "Belum Bayar";
        statusColor = "#e53e3e";
        sisaText = `Rp ${Math.round(bundle.komiteAmount)}`;
      }

      // Status Komite
      doc.fontSize(8).font("Helvetica-Bold").fillColor(statusColor);
      doc.text(statusText, x, y + 4, { width: headWidths.status, align: "center", lineBreak: false });
      x += headWidths.status;

      // Sisa Bayar
      doc.fontSize(8).font("Helvetica").fillColor(COLOR_BODY);
      doc.text(sisaText, x, y + 4, { width: headWidths.sisa, align: "right", lineBreak: false });

      y += rowHeight;
    });

    // ---------------- Ringkasan ----------------
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 48;
    }
    doc
      .moveTo(margin, y)
      .lineTo(margin + fixedWidth, y)
      .lineWidth(0.7)
      .strokeColor(COLOR_BORDER)
      .stroke();
    y += 7;

    doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR_TEXT);
    doc.text("RINGKASAN", margin, y);
    y += 12;

    doc.fontSize(8).font("Helvetica").fillColor(COLOR_BODY);
    doc.text(
      `Siswa: ${bundle.totals.students}  •  Lunas komite: ${bundle.totals.komiteLunas}  •  Belum lunas komite: ${bundle.totals.students - bundle.totals.komiteLunas}`,
      margin,
      y,
    );
    y += 12;
    doc.text(
      `Total tagihan komite: ${rupiah(bundle.totals.totalTagihanKomite)}  •  Terbayar: ${rupiah(totalKomiteTerbayar)}  •  Sisa: ${rupiah(bundle.totals.totalTagihanKomite - totalKomiteTerbayar)}`,
      margin,
      y,
    );
    y += 14;

    // Legenda
    const legendY = y + 3;
    doc.fontSize(8).font("Helvetica").fillColor(COLOR_BODY);
    doc.text("Lunas   |   Partial   |   Belum bayar", margin, legendY - 2, { width: fixedWidth, lineBreak: false });

    doc.end();
    return done;
  }

  /** Masa ajaran yang dipakai. */
  async resolveAcademicYear(academicYearId?: string) {
    if (academicYearId) {
      const found = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (!found) throw new NotFoundException(`Masa ajaran tidak ditemukan: ${academicYearId}`);
      return found;
    }
    const active = await this.prisma.academicYear.findFirst({
      where: { isActive: true },
      orderBy: { name: "desc" },
    });
    if (active) return active;

    const fallback = await this.prisma.academicYear.findFirst({ orderBy: { name: "desc" } });
    if (!fallback) {
      throw new BadRequestException(
        "Belum ada masa ajaran. Tambahkan dulu di Master Data > Tahun Ajaran.",
      );
    }
    return fallback;
  }

  /** Nama sekolah dari setting. */
  async schoolName(): Promise<string> {
    const setting = await this.prisma.setting.findUnique({ where: { key: "school.name" } });
    return setting?.value?.trim() || SCHOOL_NAME_DEFAULT;
  }

  /** Nama file PDF default. */
  filename(): string {
    return `rekap-iuran-kas-kelas-${todayStamp()}.pdf`;
  }

  /** Nama file PDF untuk rekomite. */
  filenameKomite(prefix = "rekap-komite-"): string {
    return `${prefix}${todayStamp()}.pdf`;
  }
}

/**
 * Daftar bulan masa ajaran, dari startMonth sampai endMonth (melingkar
 * kalender, mis. start 7 = Juli dan end 5 = Mei -> Jul s.d Mei).
 */
export function buildMonthList(startMonth: number, endMonth: number): RekapMonth[] {
  const months: RekapMonth[] = [];
  let month = startMonth;
  // Batas 24 supaya loop ini tidak pernah berputar tanpa akhir kalau data
  // masa ajaran rusak (startMonth == endMonth harusnya 1 bulan saja).
  for (let guard = 0; guard < 24; guard += 1) {
    months.push({
      month,
      short: MONTH_SHORT[month - 1],
      long: MONTH_LONG[month - 1],
    });
    if (month === endMonth) break;
    month = (month % 12) + 1;
  }
  return months;
}

/** Centang hijau.
 *
 * DIBUAT SEBAGAI GRAFIK VECTOR, bukan teks "✓". Font bawaan PDFKit
 * (Helvetica) memakai WinAnsiEncoding yang TIDAK punya U+2713 CHECK MARK,
 * jadi karakter itu akan tampil kotak rusak atau kosong. Menggambar garis
 * memberi centang yang tajam di ukuran berapa pun dan tanpa menambah font
 * ke image.
 */
function drawCheck(doc: PDFKit.PDFDocument, centerX: number, centerY: number, size: number) {
  doc
    .save()
    .strokeColor(COLOR_GREEN)
    .lineWidth(size * 0.18)
    .lineCap("round")
    .lineJoin("round")
    .moveTo(centerX - size * 0.38, centerY + size * 0.02)
    .lineTo(centerX - size * 0.08, centerY + size * 0.32)
    .lineTo(centerX + size * 0.4, centerY - size * 0.32)
    .stroke()
    .restore();
}

/** Garis strip abu-abu untuk bulan yang belum dibayar. */
function drawDash(doc: PDFKit.PDFDocument, centerX: number, centerY: number, size: number) {
  doc
    .save()
    .strokeColor(COLOR_BORDER)
    .lineWidth(1.1)
    .lineCap("round")
    .moveTo(centerX - size * 0.3, centerY)
    .lineTo(centerX + size * 0.3, centerY)
    .stroke()
    .restore();
}