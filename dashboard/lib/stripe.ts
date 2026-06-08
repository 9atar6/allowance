import "server-only";

// Server-side Stripe client. Uses the account's default API version (no pinned
// literal to drift). STRIPE_SECRET_KEY is server-only — never exposed.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  // Fail fast at module load rather than mid-checkout.
  throw new Error("STRIPE_SECRET_KEY is not configured");
}

export const stripe = new Stripe(key);
