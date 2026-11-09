import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function GemaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
