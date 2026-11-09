import { redirect } from "next/navigation";
import { getSession, hasSessionCookie } from "@/lib/server-session";
import { AdminNav } from "@/components/admin/admin-nav";
import { SessionKeepAlive } from "@/components/admin/session-keepalive";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard di server: tidak ada halaman admin yang ter-render tanpa sesi valid.
  const user = await getSession();
  if (!user) {
    // Cookie sesi masih ada tapi API menolaknya -> token kedaluwarsa karena
    // idle, beri tahu user kalau ini akibat sesi berakhir (bukan tamu baru).
    // Tanpa ini, reload halaman setelah 5 menit diam langsung ke login tanpa
    // penjelasan.
    redirect((await hasSessionCookie()) ? "/gema/login?expired=1" : "/gema/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* AdminNav hanya menyumbangkan <aside> sebagai flex item.
          Topbar & bottom bar-nya fixed, jadi tidak mengambil lebar dari <main>. */}
      <AdminNav username={user.username} />
      {/* pt-16 = ruang untuk topbar fixed, pb-20 = ruang untuk bottom bar fixed. */}
      <main className="min-w-0 flex-1 pb-20 pt-16 lg:pb-0 lg:pt-0">
        <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">{children}</div>
      </main>
      {/* Perpanjang sesi saat admin aktif; keluarkan ke login kalau idle 5 menit. */}
      <SessionKeepAlive />
    </div>
  );
}
