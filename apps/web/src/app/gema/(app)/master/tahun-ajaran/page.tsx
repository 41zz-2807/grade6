"use client";

import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrud } from "@/lib/use-crud";
import { apiFetch } from "@/lib/admin-api";

type Year = {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  isActive: boolean;
};

type Form = { name: string; startMonth: number; endMonth: number; isActive: boolean };

const EMPTY: Form = { name: "", startMonth: 7, endMonth: 6, isActive: false };
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function TahunAjaranPage() {
  const crud = useCrud<Year, Form>({
    list: "/api/academic-years",
    base: "/api/academic-years",
    defaults: EMPTY,
    toForm: (item) => ({ name: item.name, startMonth: item.startMonth, endMonth: item.endMonth, isActive: item.isActive }),
    labels: { create: "Masa ajaran ditambahkan.", update: "Masa ajaran diperbarui.", remove: "Masa ajaran dihapus." },
  });

  async function activate(id: string) {
    crud.setMsg(null);
    try {
      await apiFetch(`/api/academic-years/${id}/activate`, { method: "PATCH" });
      crud.setMsg({ kind: "success", text: "Masa ajaran aktif diganti." });
      await crud.reload();
    } catch (err) {
      crud.setMsg({ kind: "error", text: (err as { message: string }).message });
    }
  }

  return (
    <>
      <PageHeader
        title="Tahun Ajaran"
        description="Masa ajaran kas. Hanya satu yang bisa aktif pada saat yang sama."
      />

      <SectionCard title={crud.editingId ? "Ubah Masa Ajaran" : "Tambah Masa Ajaran"}>
        <form onSubmit={crud.submit} className="space-y-4">
          <Field label="Nama Masa Ajaran" htmlFor="name" required>
            <input
              id="name"
              required
              className={inputClass}
              value={crud.form.name}
              onChange={(e) => crud.setForm({ ...crud.form, name: e.target.value })}
              placeholder="2026/2027"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bulan Mulai" htmlFor="startMonth" required>
              <select
                id="startMonth"
                className={inputClass}
                value={crud.form.startMonth}
                onChange={(e) => crud.setForm({ ...crud.form, startMonth: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bulan Selesai" htmlFor="endMonth" required>
              <select
                id="endMonth"
                className={inputClass}
                value={crud.form.endMonth}
                onChange={(e) => crud.setForm({ ...crud.form, endMonth: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={crud.form.isActive}
              onChange={(e) => crud.setForm({ ...crud.form, isActive: e.target.checked })}
              className="h-4 w-4"
            />
            Jadikan masa ajaran aktif
          </label>

          <StatusMessage kind={crud.msg?.kind ?? "info"}>{crud.msg?.text}</StatusMessage>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={crud.busy}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              {crud.editingId ? "Simpan Perubahan" : "Tambah"}
            </Button>
            {crud.editingId ? (
              <Button type="button" variant="outline" onClick={crud.reset}>
                Batal
              </Button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title={`Masa Ajaran (${crud.items.length})`}>
        {crud.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada masa ajaran.</p>
        ) : (
          <ul className="space-y-2">
            {crud.items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {MONTHS[item.startMonth - 1]} s/d {MONTHS[item.endMonth - 1]}
                    </p>
                    {item.isActive ? <Badge variant="success">Aktif</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!item.isActive ? (
                      <Button variant="outline" size="sm" onClick={() => activate(item.id)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden />
                        Aktifkan
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => crud.startEdit(item)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden />
                      Ubah
                    </Button>
                    <DeleteButton
                      onConfirm={() => crud.remove(item.id)}
                      confirmText="Hapus masa ajaran ini? Tidak bisa dihapus kalau sudah dipakai transaksi."
                    />
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
