import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outside the box — Letterboxd Stats",
  description:
    "Outside the box: kostenlose Auswertung deiner Letterboxd-Bibliothek — Ratings und Top-Genres ohne Pro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-sans)] antialiased">
        {children}
      </body>
    </html>
  );
}
