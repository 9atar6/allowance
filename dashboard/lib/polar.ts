import "server-only";

// Server-side Polar client (merchant of record). Lazy so builds/CI don't need
// the env; actions check configuration at call time and fail gracefully.
import { Polar } from "@polar-sh/sdk";

export function getPolar(): Polar | null {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new Polar({ accessToken });
}

/** The Polar product id for the Pro subscription ($20/mo). */
export function proProductId(): string | null {
  return process.env.POLAR_PRO_PRODUCT_ID ?? null;
}
