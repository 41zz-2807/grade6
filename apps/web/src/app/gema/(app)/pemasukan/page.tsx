"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, fetchList } from "@/lib/admin-api";
import { RupiahInput } from "@/components/admin/rupiah-input";
import { formatRupiah } from "@/lib/format";

type Student = {
  id: string;
  name: string;
  statusKasLunas: boolean;
  statusKomiteLunas: boolean;
  kas: {
    monthly: number;
    monthsPaid: number;
    maxMonths: number;
    remainingMonths: number;
    remainingAmount: number;
  };
  komite: { total: number; remainingAmount: number };
};

type Year = { id: string; name: string; isActive: boolean };
type Rules = { kasMonthly: number; kasMaxMonths: number; komiteAmount: number; kasMaxTotal: number };

const CATEGORIES = [
  { value: "KAS_KELAS", label: "Iuran Kas Kelas" },
  { value: "KOMITE", label: "Iuran Komite" },
  { value: "UMUM", label: "Pemasukan Umum" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

export default function PemasukanPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);

  const [category, setCategory] = useState<CategoryValue>("KAS_KELAS");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [academicYearId, setAcademicYearId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Peringatan validasi hanya muncul setelah form benar-benar disentuh/di-submit.
  // Tanpa ini, halamanDiam-diam langsung menampilkan "Masukkan nominal lebih besar
  // dari 0" (form masih kosong), danboxtab itu muncul lagi sesudah submit sukses
  // karena nominal sengaja dikosongkan lagi.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    fetchList<Student>("/api/students?take=200").then(setStudents).catch(() => undefined);
    apiFetch<Year[]>("/api/academic-years")
      .then((list) => {
        setYears(list);
        const aktif = list.find((y) => y.isActive);
        if (aktif) setAcademicYearId(aktif.id);
      })
      .catch(() => undefined);
    apiFetch<Rules>("/api/cash-rules").then(setRules).catch(() => undefined);
  }, []);

  const needsStudent = category !== "UMUM";
  const student = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  );

  // Validasi dasar di klien. Server tetap memvalidasi ulang (authoritative).
  const amountNumber = Number(amount || 0);
  const validation = useMemo(() => {
    if (needsStudent && !studentId) return "Pilih siswa untuk kategori ini.";
    if (needsStudent && !student) return "Siswa tidak ditemukan.";
    if (!amountNumber || amountNumber <= 0) return "Masukkan nominal lebih besar dari 0.";
    if (category === "KAS_KELAS" && rules) {
      if (student?.statusKasLunas) return "Iuran kas kelas siswa ini sudah lunas.";
      if (amountNumber > (student?.kas.remainingAmount ?? 0)) {
        return `Maksimal ${rules.kasMaxMonths} bulan (${formatRupiah(rules.kasMaxTotal)}).`;
      }
    }
    if (category === "KOMITE") {
      if (student?.statusKomiteLunas) return "Iuran komite siswa ini sudah lunas.";
      if (rules && (student?.komite.remainingAmount ?? 0) - amountNumber < 0) {
        return `Maksimal ${formatRupiah(rules.komiteAmount)} per masa ajaran.`;
      }
    }
    if (paymentMethod === "TRANSFER" && files.length === 0) {
      return "Pembayaran TRANSFER wajib mengunggah minimal 1 bukti.";
    }
    return "";
  }, [amountNumber, category, files.length, needsStudent, paymentMethod, rules, student, studentId]);

  /** Tombol pintasan isi nominal sesuai aturan kategori. */
  function quickFill(months: number) {
    if (!rules || !student) return;
    setAmount(String(rules.kasMonthly * months));
    setTouched(true);
  }
  function fillRemainingKas() {
    if (!student) return;
    setAmount(String(student.kas.remainingAmount));
    setTouched(true);
  }
  function fillKomiteRemaining() {
    if (!student) return;
    setAmount(String(student.komite.remainingAmount));
    setTouched(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setTouched(true);
    if (validation) {
      setMsg({ kind: "error", text: validation });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("category", category);
      body.append("amount", String(amountNumber));
      body.append("paymentMethod", paymentMethod);
      body.append("academicYearId", academicYearId);
      if (date) body.append("date", new Date(date).toISOString());
      if (description.trim()) body.append("description", description.trim());
      if (needsStudent && studentId) body.append("studentId", studentId);
      files.forEach((file) => body.append("proofs", file));

      const result = await apiFetch<{ id: string; amount: number }>("/api/incomes", {
        method: "POST",
        body,
      });
      setMsg({ kind: "success", text: `Pemasukan ${formatRupiah(result.amount)} tercatat.` });
      // Form dikosongkan untuk entri berikutnya; peringatan validasi ikut dimatikan
      // supaya pesan "nominal 0" tidak muncul di samping pesan berhasil.
      setAmount("");
      setDescription("");
      setFiles([]);
      setTouched(false);
      const refreshed = await fetchList<Student>("/api/students?take=200");
      setStudents(refreshed);
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Input Pemasukan" description="Catat iuran kas kelas, iuran komite, atau pemasukan umum." />

      <SectionCard>
        {/* noValidate: validasi ditangani handler `submit` + aturan server.
            Tanpa ini, constraint HTML5 memblokir submit sebelum handler jalan
            dan hanya memunculkan bubble bawaan browser yang gayanya beda. */}
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kategori" htmlFor="category" required>
              <select
                id="category"
                className={inputClass}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as CategoryValue);
                  setAmount("");
                  setTouched(true);
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            {needsStudent ? (
              <Field label="Siswa" htmlFor="studentId" required>
                <select
                  id="studentId"
                  required
                  className={inputClass}
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    setAmount("");
                    setTouched(true);
                  }}
                >
                  <option value="">-- pilih siswa --</option>
                  {students.map((s) => {
                    const lunas =
                      category === "KAS_KELAS" ? s.statusKasLunas : s.statusKomiteLunas;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {lunas ? " (lunas)" : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
            ) : null}
          </div>

          {student ? <StudentInfo student={student} category={category} rules={rules} /> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nominal (Rp)" htmlFor="amount" required>
              {/* type="text" + format ribuan: input type=number tidak bisa
                  menerima pemisah ribuan. State tetap menyimpan digit mentah. */}
              <RupiahInput
                id="amount"
                value={amount}
                onChange={(digits) => {
                  setAmount(digits);
                  setTouched(true);
                }}
              />
            </Field>
            <Field label="Tanggal Transaksi" htmlFor="date" hint="Kosong = hari ini.">
              <input
                id="date"
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>

          {category === "KAS_KELAS" && student && rules ? (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">Pintasan:</span>
              {[1, 3, 6].map((m) => (
                <Button key={m} type="button" variant="outline" size="sm" onClick={() => quickFill(m)}>
                  {m} bulan
                </Button>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={fillRemainingKas}>
                Bayar sisa ({student.kas.remainingMonths} bln)
              </Button>
            </div>
          ) : null}

          {category === "KOMITE" && student ? (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">Pintasan:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(String(rules?.komiteAmount ?? 75000))}
              >
                Penuh
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={fillKomiteRemaining}>
                Bayar sisa
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Metode Pembayaran" htmlFor="paymentMethod" required>
              <select
                id="paymentMethod"
                className={inputClass}
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as "CASH" | "TRANSFER");
                  setTouched(true);
                }}
              >
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer (wajib bukti)</option>
              </select>
            </Field>
            <Field label="Masa Ajaran" htmlFor="academicYearId" required>
              <select
                id="academicYearId"
                required
                className={inputClass}
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
              >
                <option value="">-- pilih --</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.isActive ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Keterangan" htmlFor="description">
            <input
              id="description"
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsional"
            />
          </Field>

          <Field
            label="Bukti Transfer"
            htmlFor="proofs"
            hint="JPG, PNG, WEBP, atau PDF. Maks 5 file, 10 MB per file. Wajib bila metode Transfer."
          >
            <div className="space-y-2">
              <input
                id="proofs"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files ?? []));
                  setTouched(true);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
              />
              {files.length > 0 ? (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Hapus ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Field>

          {touched && validation ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{validation}</p>
          ) : null}
          <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

          <Button type="submit" disabled={busy}>
            <Save className="mr-1 h-4 w-4" aria-hidden />
            {busy ? "Menyimpan..." : "Simpan Pemasukan"}
          </Button>
        </form>
      </SectionCard>
    </>
  );
}

function StudentInfo({
  student,
  category,
  rules,
}: {
  student: Student;
  category: CategoryValue;
  rules: Rules | null;
}) {
  if (category === "UMUM") return null;

  // Kas dan komite sengaja dipisah (bukan union) supaya tipe tetap narrow.
  const detail =
    category === "KAS_KELAS"
      ? {
          lunas: student.statusKasLunas,
          line: (
            <>
              Terbayar {student.kas.monthsPaid}/{student.kas.maxMonths} bulan · sisa{" "}
              <strong className="text-foreground">
                {formatRupiah(student.kas.remainingAmount)}
              </strong>{" "}
              ({student.kas.remainingMonths} bulan)
            </>
          ),
          hint: rules
            ? `Nominal bebas; bulan lunas dihitung per ${formatRupiah(rules.kasMonthly)}.`
            : null,
        }
      : {
          lunas: student.statusKomiteLunas,
          line: (
            <>
              Iuran komite {formatRupiah(student.komite.total)} · sisa{" "}
              <strong className="text-foreground">
                {formatRupiah(student.komite.remainingAmount)}
              </strong>
            </>
          ),
          hint: "Boleh dibayar sebagian, maksimal sebesar sisa tagihan.",
        };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{student.name}</p>
        <Badge variant={detail.lunas ? "success" : "secondary"}>
          {detail.lunas ? "Lunas" : "Belum lunas"}
        </Badge>
      </div>
      <p className="mt-1 text-muted-foreground tabular-nums">{detail.line}</p>
      {detail.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{detail.hint}</p> : null}
    </div>
  );
}
