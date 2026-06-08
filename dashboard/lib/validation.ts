// Boundary validation schemas. Centralised + framework-free so server actions
// and tests share one source of truth.
import { z } from "zod";

export const endpointSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    targetUrl: z.string().url().startsWith("https://", "URL must be https://"),
    // Flat fee, and the per-token fallback when usage is absent.
    costPerRequest: z.coerce.number().positive().max(1000),
    // "Header-Name: value" lines → parsed/validated separately by parseHeaders.
    headers: z.string().trim().min(1),
    // Phase 2 metering. Token costs are per single token (USD).
    meteringMode: z.enum(["flat", "per_token"]).default("flat"),
    inputTokenCost: z.coerce.number().min(0).max(1).default(0),
    outputTokenCost: z.coerce.number().min(0).max(1).default(0),
  })
  .refine(
    (d) =>
      d.meteringMode === "flat" ||
      d.inputTokenCost > 0 ||
      d.outputTokenCost > 0,
    { message: "Per-token mode needs a token price.", path: ["inputTokenCost"] },
  );

export const topUpSchema = z.object({
  amount: z.coerce.number().positive().min(5).max(10000),
});

const optionalPositive = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().positive().optional(),
);

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  monthlyBudget: optionalPositive,
});

export const projectEndpointSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  targetUrl: z.string().url().startsWith("https://", "URL must be https://"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/, "Slug: lowercase letters, numbers, hyphens only"),
  costPerRequest: z.coerce.number().positive().max(1000),
  headers: z.string().trim().min(1),
});

export const projectKeyLimit = optionalPositive;

export type EndpointInput = z.infer<typeof endpointSchema>;
export type TopUpInput = z.infer<typeof topUpSchema>;
