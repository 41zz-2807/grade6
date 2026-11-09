"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/admin-api";
import { RupiahInput } from "@/components/admin/rupiah-input";
import { formatRupiah } from "@/lib/format";

const RECIPIENTS = ["Toko ATK", "Percetakan", "Bengkel", "Listrik & Air", "Transportasi", "Lainnya"];

export default function PengeluaranPage() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Peringatan validasi hanya muncul setelah form disentuh/di-submit, supaya
  // halaman tidak langsung menampilkan "nominal 0" dan tidak muncul lagi
  // sesudah submit sukses (nominal sengaja dikosongkan untuk entri berikutnya).
  const [touched, setTouched] = useState(false);

  const amountNumber = Number(amount || 0);
  const validation =
    !recipient.trim() ? "Isi penerima/penerima dana." :
    !amountNumber || amountNumber <= 0 ? "Masukkan nominal lebih besar dari 0." :
    paymentMethod === "TRANSFER" && files.length === 0 ? "Pembayaran TRANSFER wajib mengunggah minimal 1 bukti." :
    "";

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
      body.append("recipient", recipient.trim());
      body.append("amount", String(amountNumber));
      body.append("paymentMethod", paymentMethod);
      if (date) body.append("date", new Date(date).toISOString());
      if (description.trim()) body.append("description", description.trim());
      files.forEach((file) => body.append("proofs", file));

      const result = await apiFetch<{ id: string; amount: number }>("/api/expenses", {
        method: "POST",
        body,
      });
      setMsg({ kind: "success", text: `Pengeluaran ${formatRupiah(result.amount)} tercatat.` });
      setAmount("");
      setDescription("");
      setFiles([]);
      setTouched(false);
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Input Pengeluaran"
        description="Catat pengeluaran kas: belanja ATK, biaya kegiatan, dan lainnya."
      />

      <SectionCard>
        {/* noValidate: validasi ditangani handler `submit` + aturan server, bukan
            bubble bawaan browser yang gayanya tidak konsisten. */}
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Penerima / Toko" htmlFor="recipient" required>
            <input
              id="recipient"
              required
              list="recipient-list"
              className={inputClass}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Ketik atau pilih dari daftar"
            />
            <datalist id="recipient-list">
              {RECIPIENTS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>

          <div className="flex flex-wrap gap-2">
            {RECIPIENTS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRecipient(r);
                  setTouched(true);
                }}
                className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {r}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nominal (Rp)" htmlFor="amount" required>
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
            <Field label="Keterangan" htmlFor="description">
              <input
                id="description"
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opsional, mis. alat tulis kelas 6"
              />
            </Field>
          </div>

          <Field
            label="Bukti Pembayaran"
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
            {busy ? "Menyimpan..." : "Simpan Pengeluaran"}
          </Button>
        </form>
      </SectionCard>
    </>
  );
}
