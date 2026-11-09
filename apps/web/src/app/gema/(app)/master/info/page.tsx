"use client";

import { Pencil, Plus } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrud } from "@/lib/use-crud";
import { formatTanggalWaktu } from "@/lib/format";

type Popup = {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  order: number;
  startAt: string | null;
  endAt: string | null;
};

type Form = { title: string; content: string; order: number; isActive: boolean; startAt: string; endAt: string };

const EMPTY: Form = { title: "", content: "", order: 0, isActive: true, startAt: "", endAt: "" };

/** Ubah ISO dari API jadi format yang dipakai <input type="datetime-local"> (UTC). */
function toLocalInput(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

export default function InfoPopupPage() {
  const crud = useCrud<Popup, Form>({
    list: "/api/popup-infos",
    base: "/api/popup-infos",
    defaults: EMPTY,
    toForm: (item) => ({
      title: item.title,
      content: item.content,
      order: item.order,
      isActive: item.isActive,
      startAt: toLocalInput(item.startAt),
      endAt: toLocalInput(item.endAt),
    }),
    labels: { create: "Popup ditambahkan.", update: "Popup diperbarui.", remove: "Popup dihapus." },
  });

  return (
    <>
      <PageHeader
        title="Info Popup"
        description="Pengumuman yang muncul di modal Informasi pada halaman publik."
      />

      <SectionCard title={crud.editingId ? "Ubah Popup" : "Tambah Popup"}>
        <form onSubmit={crud.submit} className="space-y-4">
          <Field label="Judul" htmlFor="title" required>
            <input
              id="title"
              required
              className={inputClass}
              value={crud.form.title}
              onChange={(e) => crud.setForm({ ...crud.form, title: e.target.value })}
              placeholder="Jadwal Iuran Kas Kelas"
            />
          </Field>

          <Field label="Isi" htmlFor="content" required>
            <textarea
              id="content"
              required
              rows={4}
              className={inputClass}
              value={crud.form.content}
              onChange={(e) => crud.setForm({ ...crud.form, content: e.target.value })}
              placeholder="Iuran kas kelas Rp 15.000 per bulan..."
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Urutan" htmlFor="order" hint="Angka kecil tampil dulu.">
              <input
                id="order"
                type="number"
                className={inputClass}
                value={crud.form.order}
                onChange={(e) => crud.setForm({ ...crud.form, order: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Mulai Tampil" htmlFor="startAt" hint="Kosong = tanpa batas.">
              <input
                id="startAt"
                type="datetime-local"
                className={inputClass}
                value={crud.form.startAt}
                onChange={(e) => crud.setForm({ ...crud.form, startAt: e.target.value })}
              />
            </Field>
            <Field label="Berhenti Tampil" htmlFor="endAt" hint="Kosong = tanpa batas.">
              <input
                id="endAt"
                type="datetime-local"
                className={inputClass}
                value={crud.form.endAt}
                onChange={(e) => crud.setForm({ ...crud.form, endAt: e.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={crud.form.isActive}
              onChange={(e) => crud.setForm({ ...crud.form, isActive: e.target.checked })}
              className="h-4 w-4"
            />
            Aktif
          </label>

          <StatusMessage kind={crud.msg?.kind ?? "info"}>{crud.msg?.text}</StatusMessage>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={crud.busy}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              {crud.editingId ? "Simpan Perubahan" : "Tambah Popup"}
            </Button>
            {crud.editingId ? (
              <Button type="button" variant="outline" onClick={crud.reset}>
                Batal
              </Button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title={`Daftar Popup (${crud.items.length})`}>
        {crud.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada popup.</p>
        ) : (
          <ul className="space-y-2">
            {crud.items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={item.isActive ? "success" : "secondary"}>
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                      <Badge variant="outline">Urutan {item.order}</Badge>
                      {item.startAt ? (
                        <span className="text-[11px] text-muted-foreground">
                          {formatTanggalWaktu(item.startAt)}
                          {item.endAt ? ` s/d ${formatTanggalWaktu(item.endAt)}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => crud.startEdit(item)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden />
                      Ubah
                    </Button>
                    <DeleteButton onConfirm={() => crud.remove(item.id)} />
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
