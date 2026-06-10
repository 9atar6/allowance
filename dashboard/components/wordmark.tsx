import { LogoMark } from "@/components/logo";

/** The one wordmark used on every page. Keep it identical everywhere. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[var(--text)]">
      <LogoMark size={26} />
      Allowance
    </span>
  );
}
