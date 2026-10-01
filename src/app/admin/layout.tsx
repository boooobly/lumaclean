import type { Metadata } from "next";
import { Golos_Text, Onest } from "next/font/google";
import "../styles/tokens.css";
import "./admin.css";

const displayFont = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-admin-display",
  display: "swap",
});
const textFont = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-admin-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LumaClean — Рабочее пространство",
    template: "%s · LumaClean",
  },
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${displayFont.variable} ${textFont.variable}`}>
      <body className="lc-admin">{children}</body>
    </html>
  );
}
