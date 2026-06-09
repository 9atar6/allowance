import type { Metadata } from "next";
import { Space_Grotesk, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Allowance — One key. Every API. A hard cap.",
  description:
    "Route all your API spend through one key, with a prepaid limit and an instant kill switch. Works with any API. Built for apps and AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        {/* Signature atmosphere: drifting indigo aurora + film grain */}
        <div className="atmosphere" aria-hidden>
          <div className="aurora" />
          <div className="grain" />
        </div>
        {children}
      </body>
    </html>
  );
}
