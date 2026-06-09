/** The one wordmark used on every page. Keep it identical everywhere. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[var(--text)]">
      <span className="neu-sm grid h-7 w-7 place-items-center text-[13px] text-accent">
        A
      </span>
      Allowance
    </span>
  );
}
