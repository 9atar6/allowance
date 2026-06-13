import { LogoMark } from "@/components/logo";

/** The one wordmark used on every page. Keep it identical everywhere. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-[var(--text)]">
      <LogoMark size={26} />
      <span className="font-display text-[19px] lowercase">allowance</span>
    </span>
  );
}
