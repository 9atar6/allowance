// Plan definitions — the single source of truth for tiers + quotas the UI reads.
// The worker enforces FREE_MONTHLY_REQUESTS at the edge (see proxy/src/config.ts);
// keep the two in sync.

export type PlanTier = "free" | "pro" | "enterprise";

export const FREE_MONTHLY_REQUESTS = 5_000;
export const PRO_MONTHLY_REQUESTS = 1_000_000;
export const PRO_PRICE_USD = 20;

/** Included monthly request quota for a plan. null = custom/unlimited. */
export function monthlyQuota(plan: PlanTier): number | null {
  if (plan === "free") return FREE_MONTHLY_REQUESTS;
  if (plan === "pro") return PRO_MONTHLY_REQUESTS;
  return null; // enterprise
}

export function planLabel(plan: PlanTier): string {
  if (plan === "pro") return "Pro";
  if (plan === "enterprise") return "Enterprise";
  return "Free";
}
