"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchList } from "./admin-api";

type Message = { kind: "success" | "error"; text: string } | null;

type CrudOptions<T, F> = {
  /** Path daftar, mis. "/api/students". */
  list: string;
  /** Path dasar untuk create/update/delete, mis. "/api/students". */
  base: string;
  defaults: F;
  /** Ubah item API menjadi nilai form. */
  toForm: (item: T) => F;
  /** Pesan sukses setelah create/update/delete. */
  labels?: { create?: string; update?: string; remove?: string };
};

/**
 * Plumbing CRUD yang dipakai semua halaman master: ambil daftar, submit form
 * (create atau update), dan hapus. Menghemat pengulangan fetch/error handling
 * di tiap halaman.
 */
export function useCrud<T extends { id: string }, F extends object>({
  list,
  base,
  defaults,
  toForm,
  labels = {},
}: CrudOptions<T, F>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Message>(null);
  const [form, setForm] = useState<F>(defaults);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchList<T>(list));
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function reset() {
    setForm(defaults);
    setEditingId(null);
  }

  function startEdit(item: T) {
    setForm(toForm(item));
    setEditingId(item.id);
    setMsg(null);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (editingId) {
        await apiFetch(`${base}/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
        setMsg({ kind: "success", text: labels.update ?? "Perubahan disimpan." });
      } else {
        await apiFetch(base, { method: "POST", body: JSON.stringify(form) });
        setMsg({ kind: "success", text: labels.create ?? "Data ditambahkan." });
      }
      reset();
      await reload();
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setMsg(null);
    try {
      await apiFetch(`${base}/${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      setMsg({ kind: "success", text: labels.remove ?? "Data dihapus." });
      await reload();
    } catch (err) {
      setMsg({ kind: "error", text: (err as { message: string }).message });
    }
  }

  return {
    items,
    loading,
    busy,
    msg,
    form,
    setForm,
    editingId,
    reset,
    startEdit,
    submit,
    remove,
    reload,
    setMsg,
  };
}
