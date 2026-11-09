"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/admin-api";

type Account = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isPublic: boolean;
  isActive: boolean;
  description: string | null;
};

const EMPTY = { bankName: "", accountNumber: "", accountHolder: "", isPublic: false, isActive: true, description: "" };

export default function RekeningPage() {
  const [items, setItems] = useState<Account[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await apiFetch<Account[]>("/api/bank-accounts"));
    } catch {
      setMsg({ kind: "error", text: "Gagal memuat daftar rekening." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (editingId) {
        await apiFetch(`/api/bank-accounts/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
        setMsg({ kind: "success", text: "Rekening diperbarui." });
      } else {
        await apiFetch("/api/bank-accounts", { method: "POST", body: JSON.stringify(form) });
        setMsg({ kind: "success", text: "Rekening ditambahkan." });
      }
      reset();
      await load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setMsg(null);
    try {
      await apiFetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      await load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    }
  }

  function edit(item: Account) {
    setForm({
      bankName: item.bankName,
      accountNumber: item.accountNumber,
      accountHolder: item.accountHolder,
      isPublic: item.isPublic,
      isActive: item.isActive,
      description: item.description ?? "",
    });
    setEditingId(item.id);
  }

  return (
    <>
      <PageHeader
        title="Rekening"
        description="Rekening penampung iuran. Hanya satu yang bisa ditampilkan di halaman publik."
      />

      <SectionCard title={editingId ? "Ubah Rekening" : "Tambah Rekening"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Bank" htmlFor="bankName" required>
              <input
                id="bankName"
                required
                className={inputClass}
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="Bank Syariah Indonesia"
              />
            </Field>
            <Field
              label="Nomor Rekening"
              htmlFor="accountNumber"
              required
              hint="Spasi dan tanda hubung otomatis dibuang."
            >
              <input
                id="accountNumber"
                required
                className={inputClass}
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                inputMode="numeric"
                placeholder="8871234509"
              />
            </Field>
          </div>

          <Field label="Atas Nama" htmlFor="accountHolder" required>
            <input
              id="accountHolder"
              required
              className={inputClass}
              value={form.accountHolder}
              onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
              placeholder="Komite Sekolah GIIS Grade 6 Jannatul Firdaus"
            />
          </Field>

          <Field label="Keterangan" htmlFor="description">
            <input
              id="description"
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opsional"
            />
          </Field>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="h-4 w-4"
              />
              Tampilkan di halaman publik
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              Aktif
            </label>
          </div>

          <StatusMessage kind={msg?.kind ?? "info"}>{msg?.text}</StatusMessage>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              {editingId ? "Simpan Perubahan" : "Tambah Rekening"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={reset}>
                Batal
              </Button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title={`Daftar Rekening (${items.length})`}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada rekening.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {item.bankName}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.accountNumber}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.accountHolder}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.isPublic ? <Badge variant="success">Publik</Badge> : <Badge variant="secondary">Internal</Badge>}
                      {!item.isActive ? <Badge variant="destructive">Nonaktif</Badge> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => edit(item)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden />
                      Ubah
                    </Button>
                    <DeleteButton onConfirm={() => remove(item.id)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
