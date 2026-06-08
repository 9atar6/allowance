/** Tiny className joiner (avoids pulling clsx for a few components). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
