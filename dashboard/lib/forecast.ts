// Burn-rate forecast: at the recent pace, when does the budget run out?
// Pure + deterministic so it's unit-testable.

import { formatShortDate } from "@/lib/format";

export interface Depletion {
  days: number;
  dateLabel: string; // "Jun 25"
}

/**
 * Average the last 7 COMPLETE days of spend (excluding today's partial day)
 * and project when the balance hits zero. Returns null when there is nothing
 * meaningful to say: no balance, no recent spend, or more than a year away.
 */
export function forecastDepletion(
  balance: number,
  dailyCosts: number[], // oldest -> newest, last entry = today (partial)
  today: Date = new Date(),
): Depletion | null {
  if (balance <= 0) return null;
  const complete = dailyCosts.slice(0, -1); // drop today's partial day
  const window = complete.slice(-7);
  if (window.length === 0) return null;
  const avg = window.reduce((sum, c) => sum + c, 0) / window.length;
  if (avg <= 1e-9) return null;
  const days = balance / avg;
  if (days > 365) return null;
  const date = new Date(today.getTime() + days * 86_400_000);
  return { days, dateLabel: formatShortDate(date.toISOString()) };
}
