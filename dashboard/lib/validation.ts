// Boundary validation schemas. Centralised + framework-free so server actions
// and tests share one source of truth.
import { z } from "zod";

/**
 * SSRF guard: only allow https URLs to public hosts. Blocks loopback, private
 * ranges, link-local (incl. cloud metadata 169.254.169.254), and .local.
 */
export function isPublicHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local")) return false;
  if (h === "0.0.0.0" || h === "::1") return false;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  if (/^fc|^fd/.test(h)) return false; // IPv6 unique-local
  return true;
}

const httpsPublicUrl = z
  .string()
  .url()
  .refine(isPublicHttpsUrl, "URL must be https and a public host");

const optionalPositive = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().positive().optional(),
);

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  monthlyBudget: optionalPositive,
});

// A reusable connection (an API defined once, attached to projects separately).
export const connectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetUrl: httpsPublicUrl,
  costPerRequest: z.coerce.number().min(0).max(1000),
  // Optional: APIs without auth (or with auth in the URL) need no header.
  headers: z.string().trim().default(""),
  meteringMode: z.enum(["flat", "per_token"]).default("flat"),
  inputTokenCost: z.coerce.number().min(0).max(1).default(0),
  outputTokenCost: z.coerce.number().min(0).max(1).default(0),
});

// Attach an existing connection to a project under a slug.
export const attachServiceSchema = z.object({
  projectId: z.string().uuid(),
  endpointId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/, "Slug: lowercase letters, numbers, hyphens only"),
});
