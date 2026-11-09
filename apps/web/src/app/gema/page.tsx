import { redirect } from "next/navigation";
import { getSession, hasSessionCookie } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function GemaPage() {
  const user = await getSession();
  if (user) redirect("/gema/dashboard");
  // Sama seperti layout: cookie sesi yang sudah tidak valid berarti sesi habis
  // karena idle, bukan kunjungan pertama.
  redirect((await hasSessionCookie()) ? "/gema/login?expired=1" : "/gema/login");
}
