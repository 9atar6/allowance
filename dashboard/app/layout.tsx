import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allowance",
  description: "An API debit card for AI builders and agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
