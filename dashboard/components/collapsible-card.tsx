import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Optional right-aligned content in the header (e.g. a hint). */
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * A neumorphic section that collapses/expands. Native <details>, accessible,
 * keyboard-friendly, no JS. Open by default.
 */
export function CollapsibleCard({
  title,
  aside,
  defaultOpen = true,
  className,
  children,
}: Props) {
  return (
    <details open={defaultOpen} className={cn("neu group", className)}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-7 py-5">
        <span className="flex items-center gap-2.5">
          <svg
            className="chevron text-[var(--text-faint)] transition-transform"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {title}
          </span>
        </span>
        {aside && <span className="text-xs text-[var(--text-faint)]">{aside}</span>}
      </summary>
      <div className="px-7 pb-7">{children}</div>
    </details>
  );
}
