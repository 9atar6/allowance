import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const TITLE = "Allowance: pocket money for software.";
const DESCRIPTION =
  "Your apps and agents get one key with a hard cap. At zero, the answer is no. Leaked? Revoke it and it's dead everywhere in seconds. Works with any API.";

export const metadata: Metadata = {
  metadataBase: new URL("https://getallowance.dev"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Allowance",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Allowance — pocket money for software" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        {/* The OpenNext/Cloudflare build runs esbuild with keepNames, which
            injects calls to its `__name` helper into the function next-themes
            serializes into its inline anti-FOUC script. That helper lives only
            in the server bundle, so the browser throws "__name is not defined"
            on every page. Define it as a harmless identity before that inline
            script runs — must stay first in <body>, ahead of ThemeProvider. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "globalThis.__name=globalThis.__name||function(t){return t};",
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
