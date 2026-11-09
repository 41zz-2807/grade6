import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kas Kelas & Komite | GIIS Grade 6 Jannatul Firdaus",
  description:
    "Informasi saldo, rekening transfer, dan ringkasan uang kas kelas & komite GIIS Grade 6 Jannatul Firdaus.",
  openGraph: {
    title: "Kas Kelas & Komite | GIIS Grade 6 Jannatul Firdaus",
    description: "Saldo, rekening transfer, dan ringkasan uang kas kelas & komite.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
