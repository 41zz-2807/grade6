"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { PageHeader, SectionCard, Field, inputClass, StatusMessage } from "@/components/admin/page-parts";
import { DeleteButton } from "@/components/admin/delete-button";
import { StudentImport } from "@/components/admin/student-import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrud } from "@/lib/use-crud";
import { formatRupiah } from "@/lib/format";

type Student = {
  id: string;
  name: string;
  statusKasLunas: boolean;
  statusKomiteLunas: boolean;
  totalKasPaid: number;
  totalKomitePaid: number;
  kas: {
    monthly: number;
    monthsPaid: number;
    maxMonths: number;
    remainingMonths: number;
    remainingAmount: number;
  };
  komite: { total: number; remainingAmount: number };
};

type Form = { name: string };

const EMPTY: Form = { name: "" };

export default function SiswaPage() {
  const crud = useCrud<Student, Form>({
    list: "/api/students?take=200",
    base: "/api/students",
    defaults: EMPTY,
    toForm: (item) => ({ name: item.name }),
    labels: { create: "Siswa ditambahkan.", update: "Data siswa diperbarui.", remove: "Siswa dihapus." },
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return crud.items;
    return crud.items.filter((s) => s.name.toLowerCase().includes(q));
  }, [crud.items, search]);

  const kasLunas = crud.items.filter((s) => s.statusKasLunas).length;
  const komiteLunas = crud.items.filter((s) => s.statusKomiteLunas).length;

  return (
    <>
      <PageHeader title="Siswa" description="Data siswa, progress iuran, dan status lunas." />

      <SectionCard title={crud.editingId ? "Ubah Siswa" : "Tambah Siswa"}>
        <form onSubmit={crud.submit} className="space-y-4">
          <Field label="Nama Lengkap" htmlFor="name" required>
            <input
              id="name"
              required
              className={inputClass}
              value={crud.form.name}
              onChange={(e) => crud.setForm({ ...crud.form, name: e.target.value })}
              placeholder="Ahmad Fauzi"
            />
          </Field>

          <StatusMessage kind={crud.msg?.kind ?? "info"}>{crud.msg?.text}</StatusMessage>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={crud.busy}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              {crud.editingId ? "Simpan Perubahan" : "Tambah Siswa"}
            </Button>
            {crud.editingId ? (
              <Button type="button" variant="outline" onClick={crud.reset}>
                Batal
              </Button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <StudentImport onImported={crud.reload} />

      <SectionCard
        title={`Daftar Siswa (${filtered.length}/${crud.items.length})`}
        description={`Lunas kas: ${kasLunas} · Lunas komite: ${komiteLunas}`}
      >
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            className={inputClass}
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Cari nama siswa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari siswa"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {crud.items.length === 0 ? "Belum ada siswa." : "Tidak ada siswa yang cocok."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={item.statusKasLunas ? "success" : "secondary"}>
                        Kas {item.statusKasLunas ? "Lunas" : `${item.kas.monthsPaid}/${item.kas.maxMonths} bln`}
                      </Badge>
                      <Badge variant={item.statusKomiteLunas ? "success" : "secondary"}>
                        Komite {item.statusKomiteLunas ? "Lunas" : formatRupiah(item.komite.remainingAmount)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      Kas dibayar {formatRupiah(item.totalKasPaid)} · Komite {formatRupiah(item.totalKomitePaid)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => crud.startEdit(item)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden />
                      Ubah
                    </Button>
                    <DeleteButton
                      onConfirm={() => crud.remove(item.id)}
                      confirmText="Hapus siswa ini? Kalau sudah ada transaksi, siswa tidak bisa dihapus."
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
