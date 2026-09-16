import {Golos_Text, Onest} from "next/font/google";
import "../site.css";
import "./articles.css";

const displayFont = Onest({subsets: ["latin", "cyrillic"], variable: "--font-lc-display", display: "swap"});
const textFont = Golos_Text({subsets: ["latin", "cyrillic"], variable: "--font-lc-text", display: "swap"});

export default function ArticlesLayout({children}: {children: React.ReactNode}) {
  return <div className={`journal ${displayFont.variable} ${textFont.variable}`}>{children}</div>;
}
