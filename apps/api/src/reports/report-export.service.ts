import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { ReportsService, UnifiedTransaction } from "./reports.service";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { formatDate, formatDateTimeId, todayStamp } from "../common/utils/datetime";

const SCHOOL_NAME = "GIIS Grade 6 Jannatul Firdaus";
const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

/** "Ahmad Fauzi" -> "A**** F***", "Rina" -> "R***". Dipakai untuk tampilan publik. */
function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] + "*".repeat(Math.max(2, part.length - 1)))
    .join(" ");
}

export type ReportBundle = {
  summary: Awaited<ReturnType<ReportsService["summary"]>>;
  transactions: UnifiedTransaction[];
};

@Injectable()
export class ReportExportService {
  constructor(private readonly reports: ReportsService) {}

  async build(filter: ReportFilterDto): Promise<ReportBundle> {
    const [summary, transactions] = await Promise.all([
      this.reports.summary(filter),
      this.reports.allTransactions(filter),
    ]);
    return { summary, transactions };
  }

  /**
   * Laporan PDF.
   *
   * Memakai font bawaan PDFKit (Helvetica, WinAnsi/Latin-1). Nama siswa dengan
   * huruf di luar Latin-1 akan tampil kurang sempurna - tidak ada font
   * eksternal yang dibundel supaya image tetap kecil.
   *
   * `options.publicView` dipakai untuk PDF publik: nama siswa dimasker dan
   * kolom keterangan yang berpotensi memuat data pribadi dihilangkan.
   */
  async toPdf(
    filter: ReportFilterDto,
    options: { publicView?: boolean; showStudentName?: boolean } = {},
  ): Promise<Buffer> {
    const { summary, transactions } = await this.build(filter);
    const publicView = options.publicView === true;
    const showName = publicView ? options.showStudentName === true : true;
    const doc = new PDFDocument({ size: "A4", margin: 40, layout: "landscape" });
    // `doc.end()` baru dipanggil setelah semua konten ditulis - kalau dipanggil
    // lebih awal, PDF-nya jadi kosong.
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const period =
      filter.from || filter.to
        ? `${filter.from ? formatDate(new Date(filter.from)) : "awal"} - ${filter.to ? formatDate(new Date(filter.to)) : "sekarang"}`
        : "Semua periode";

    doc.fontSize(14).text(
      `Laporan Uang Kas - ${SCHOOL_NAME}${publicView ? " (Ringkasan Publik)" : ""}`,
      { align: "center" },
    );
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Periode: ${period}`, { align: "center" });
    doc.text(`Dibuat: ${formatDateTimeId()}`, { align: "center" });
    if (publicView) {
      doc.moveDown(0.2);
      doc.fontSize(7).fillColor("#666").text(
        "Dokumen ringkasan. Nama siswa disamarkan dan bukti transaksi tidak disertakan.",
        { align: "center" },
      );
      doc.fillColor("#000");
    }
    doc.moveDown(1);

    // Ringkasan
    doc.fontSize(11).text("RINGKASAN", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    const summaryRows: [string, string][] = [
      ["Total Pemasukan", rupiah(summary.totalIncome)],
      ["Total Pengeluaran", rupiah(summary.totalExpense)],
      ["Saldo", rupiah(summary.balance)],
      ["Jumlah Transaksi", String(summary.transactionCount)],
      [
        "Siswa Lunas Kas / Komite",
        `${summary.students.kasLunas} / ${summary.students.komiteLunas} dari ${summary.students.total}`,
      ],
    ];
    if (publicView) {
      // Ringkasan publik: laporan jumlah siswa cukup sebagai angka agregat.
      summaryRows.splice(4, 1);
    }
    for (const [label, value] of summaryRows) {
      doc.text(`${label}: ${value}`);
    }
    doc.moveDown(1);

    // Tabel transaksi
    const columns = publicView
      ? [
          { label: "No", width: 30, align: "center" as const },
          { label: "Tanggal", width: 80 },
          { label: "Jenis", width: 80 },
          { label: "Kategori", width: 110 },
          { label: "Penerima / Siswa", width: 200 },
          { label: "Metode", width: 90 },
          { label: "Jumlah", width: 120, align: "right" as const },
        ]
      : [
          { label: "No", width: 30, align: "center" as const },
          { label: "Tanggal", width: 70 },
          { label: "Jenis", width: 70 },
          { label: "Kategori", width: 80 },
          { label: "Penerima / Siswa", width: 130 },
          { label: "Keterangan", width: 170 },
          { label: "Metode", width: 65 },
          { label: "Bukti", width: 40, align: "center" as const },
          { label: "Jumlah", width: 90, align: "right" as const },
        ];
    const startX = 40;
    const startY = doc.y;
    const rowHeight = 16;

    const renderCell = (col: (typeof columns)[number], text: string, x: number, y: number) => {
      const pad = 4;
      const textX = col.align === "center" ? x : col.align === "right" ? x : x + pad;
      const textWidth = col.align === "center" ? col.width : col.width - pad;
      doc.text(text, textX, y, { width: textWidth, align: col.align ?? "left", ellipsis: true, lineBreak: false });
    };

    const drawHeader = (y: number) => {
      doc.fontSize(8).font("Helvetica-Bold");
      let x = startX;
      for (const col of columns) {
        renderCell(col, col.label, x, y);
        x += col.width;
      }
      doc.moveTo(startX, y + 11).lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y + 11).stroke();
      doc.font("Helvetica");
    };

    drawHeader(startY);
    let y = startY + rowHeight;

    if (transactions.length === 0) {
      doc.fontSize(9).text("Tidak ada transaksi pada periode ini.", startX, y);
      y += rowHeight;
    }

    transactions.forEach((trx, index) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 50;
        drawHeader(y);
        y += rowHeight;
      }
      const values = publicView
        ? [
            String(index + 1),
            formatDate(new Date(trx.date)),
            trx.type === "INCOME" ? "Masuk" : "Keluar",
            trx.category,
            trx.studentId && !showName ? maskName(trx.counterparty) : trx.counterparty,
            trx.paymentMethod,
            rupiah(trx.amount),
          ]
        : [
            String(index + 1),
            formatDate(new Date(trx.date)),
            trx.type === "INCOME" ? "Masuk" : "Keluar",
            trx.category,
            trx.counterparty,
            trx.description || "-",
            trx.paymentMethod,
            trx.proofCount > 0 ? `${trx.proofCount}` : "-",
            rupiah(trx.amount),
          ];
      doc.fontSize(8);
      let x = startX;
      columns.forEach((col, i) => {
        renderCell(col, values[i], x, y);
        x += col.width;
      });
      y += rowHeight;
    });

    // Total
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }
    doc.moveTo(startX, y).lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y).stroke();
    doc.font("Helvetica-Bold").fontSize(9);
    const amountCol = columns.length - 1;
    doc.text("SALDO", startX + 4, y + 4, {
      width: columns.slice(0, amountCol).reduce((s, c) => s + c.width, 0) - 4,
    });
    doc.text(rupiah(summary.balance), startX + columns.slice(0, amountCol).reduce((s, c) => s + c.width, 0), y + 4, {
      width: columns[amountCol].width - 4,
      align: "right",
    });

    doc.end();
    return done;
  }

  /** Laporan Excel (.xlsx) dengan sheet Ringkasan, Per Kategori, dan Transaksi. */
  async toExcel(filter: ReportFilterDto): Promise<Buffer> {
    const { summary, transactions } = await this.build(filter);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = SCHOOL_NAME;
    workbook.created = new Date();

    const period = filter.from || filter.to ? `${filter.from ?? "awal"} s/d ${filter.to ?? "sekarang"}` : "Semua periode";

    // --- Sheet 1: Ringkasan ---
    const summarySheet = workbook.addWorksheet("Ringkasan");
    summarySheet.columns = [{ width: 28 }, { width: 34 }];
    summarySheet.addRow(["LAPORAN UANG KAS", SCHOOL_NAME]).font = { bold: true, size: 14 };
    summarySheet.addRow(["Periode", period]);
    summarySheet.addRow(["Dibuat", formatDateTimeId()]);
    summarySheet.addRow([]);
    summarySheet.addRow(["RINDIKAN", ""]).font = { bold: true };
    summarySheet.addRow(["Total Pemasukan", summary.totalIncome]);
    summarySheet.addRow(["Total Pengeluaran", summary.totalExpense]);
    summarySheet.addRow(["Saldo", summary.balance]).font = { bold: true };
    summarySheet.addRow(["Jumlah Transaksi", summary.transactionCount]);
    summarySheet.addRow([]);
    summarySheet.addRow(["STATUS IURAN SISWA", ""]).font = { bold: true };
    summarySheet.addRow(["Total Siswa", summary.students.total]);
    summarySheet.addRow(["Lunas Kas Kelas", summary.students.kasLunas]);
    summarySheet.addRow(["Belum Lunas Kas Kelas", summary.students.kasBelumLunas]);
    summarySheet.addRow(["Lunas Komite", summary.students.komiteLunas]);
    summarySheet.addRow(["Belum Lunas Komite", summary.students.komiteBelumLunas]);
    ["B2", "B7", "B8", "B9", "B13", "B14", "B15", "B16"].forEach((ref) => {
      summarySheet.getCell(ref).numFmt = '"Rp" #,##0';
    });

    // --- Sheet 2: Per Kategori ---
    const categorySheet = workbook.addWorksheet("Per Kategori");
    categorySheet.columns = [
      { header: "Kategori", key: "label", width: 24 },
      { header: "Kode", key: "category", width: 16 },
      { header: "Jumlah Transaksi", key: "count", width: 20 },
      { header: "Total", key: "total", width: 20 },
    ];
    categorySheet.getRow(1).font = { bold: true };
    summary.incomeByCategory.forEach((row) => categorySheet.addRow(row));
    categorySheet.getColumn("total").numFmt = '"Rp" #,##0';
    categorySheet.addRow({ label: "TOTAL", count: summary.incomeByCategory.reduce((s, r) => s + r.count, 0), total: summary.totalIncome });
    categorySheet.getRow(categorySheet.rowCount).font = { bold: true };
    categorySheet.getRow(categorySheet.rowCount).getCell("total").numFmt = '"Rp" #,##0';

    // --- Sheet 3: Transaksi ---
    const trxSheet = workbook.addWorksheet("Transaksi");
    trxSheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Tanggal", key: "date", width: 14 },
      { header: "Jenis", key: "type", width: 10 },
      { header: "Kategori", key: "category", width: 16 },
      { header: "Penerima / Siswa", key: "counterparty", width: 26 },
      { header: "Keterangan", key: "description", width: 40 },
      { header: "Metode", key: "paymentMethod", width: 12 },
      { header: "Masa Ajaran", key: "academicYear", width: 14 },
      { header: "Jumlah Bukti", key: "proofCount", width: 14 },
      { header: "Jumlah", key: "amount", width: 18 },
    ];
    trxSheet.getRow(1).font = { bold: true };
    trxSheet.views = [{ state: "frozen", ySplit: 1 }];
    transactions.forEach((trx, index) => {
      trxSheet.addRow({
        no: index + 1,
        date: formatDate(new Date(trx.date)),
        type: trx.type === "INCOME" ? "Masuk" : "Keluar",
        category: trx.category,
        counterparty: trx.counterparty,
        description: trx.description || "-",
        paymentMethod: trx.paymentMethod,
        academicYear: trx.academicYear,
        proofCount: trx.proofCount,
        amount: trx.amount,
      });
    });
    trxSheet.getColumn("amount").numFmt = '"Rp" #,##0';
    if (transactions.length > 0) {
      trxSheet.autoFilter = { from: "A1", to: `J${transactions.length + 1}` };
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  filename(format: "pdf" | "xlsx"): string {
    return `laporan-uang-kas-${todayStamp()}.${format}`;
  }
}
