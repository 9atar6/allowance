import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

/** The single marketing nav. Identical on every public page so nothing shifts. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-20 bg-[var(--bg)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/docs"
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            Docs
          </Link>
          <Link href="/login" className="btn-accent px-4 py-2 text-sm font-medium">
            Sign in
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
