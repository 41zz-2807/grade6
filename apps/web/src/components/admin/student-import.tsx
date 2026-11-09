"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard, StatusMessage, inputClass } from "@/components/admin/page-parts";
import { apiFetch } from "@/lib/admin-api";

export type StudentImportResult = {
  totalRows: number;
  created: number;
  createdNames: string[];
  skipped: { row: number; name: string }[];
  errors: { row: number; message: string }[];
};

const TEMPLATE_URL = "/api/students/import-template";

/**
 * Import siswa massal dari CSV.
 *
 * Sengaja memakai `<input type="file">` biasa, bukan komponen dialog: file
 * dibaca browser lalu dikirim sebagai multipart, dan endpoint/backend memvalidasi
 * isi file (bukan hanya ekstensi).
 */
export function StudentImport({
  onImported,
}: {
  /** Dipanggil setelah import sukses supaya daftar siswa di-refresh. */
  onImported: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [result, setResult] = useState<StudentImportResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMsg({ kind: "error", text: "Pilih file CSV dulu." });
      return;
    }

    setBusy(true);
    setMsg(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const data = await apiFetch<StudentImportResult>("/api/students/import", {
        method: "POST",
        body,
      });
      setResult(data);
      setMsg({
        kind: data.errors.length > 0 ? "info" : "success",
        text:
          `${data.created} siswa ditambahkan dari ${data.totalRows} baris` +
          (data.skipped.length > 0 ? `, ${data.skipped.length} dilewati` : "") +
          (data.errors.length > 0 ? `, ${data.errors.length} bermasalah` : "") +
          ".",
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await onImported();
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Import Siswa dari CSV"
      description="Kolom wajib: nama. Nama yang sudah ada dilewati, jadi aman meng-upload ulang file yang sama."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="student-csv" className="block text-sm font-medium">
            File CSV
          </label>
          <input
            id="student-csv"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className={inputClass}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setMsg(null);
              setResult(null);
            }}
            aria-describedby="student-csv-hint"
          />
          <p id="student-csv-hint" className="text-xs text-muted-foreground">
            Maksimal 500 baris per upload. Baris pertama harus berisi header{" "}
            <code className="rounded bg-muted px-1">nama</code>.
          </p>
        </div>

        <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !file}>
            <Upload className="mr-1 h-4 w-4" aria-hidden />
            {busy ? "Mengimpor..." : "Import Siswa"}
          </Button>
          <Button variant="outline" asChild>
            <a href={TEMPLATE_URL} download>
              <Download className="mr-1 h-4 w-4" aria-hidden />
              Unduh Template CSV
            </a>
          </Button>
        </div>
      </form>

      {result && (result.skipped.length > 0 || result.errors.length > 0) ? (
        <div className="mt-4 space-y-3 border-t pt-4">
          {result.skipped.length > 0 ? (
            <details className="rounded-md border bg-amber-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-amber-900">
                {result.skipped.length} nama dilewati (sudah ada)
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
                {result.skipped.slice(0, 50).map((s) => (
                  <li key={`${s.row}-${s.name}`}>
                    Baris {s.row}: {s.name}
                  </li>
                ))}
              </ul>
              {result.skipped.length > 50 ? (
                <p className="mt-1 text-xs text-amber-800">
                  ...dan {result.skipped.length - 50} lainnya.
                </p>
              ) : null}
            </details>
          ) : null}

          {result.errors.length > 0 ? (
            <details className="rounded-md border bg-red-50 px-3 py-2" open>
              <summary className="cursor-pointer text-sm font-medium text-red-900">
                {result.errors.length} baris bermasalah (dilewati)
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-red-800">
                {result.errors.slice(0, 50).map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {result.errors.length > 50 ? (
                <p className="mt-1 text-xs text-red-800">
                  ...dan {result.errors.length - 50} lainnya.
                </p>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
