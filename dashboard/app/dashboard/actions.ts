"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseHeaders } from "@/lib/headers";
import { generateProxyKey } from "@/lib/keys";
import { purgeProxyKeyCache } from "@/lib/proxy-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  attachServiceSchema,
  connectionSchema,
  projectSchema,
} from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  generatedKey?: string; // returned ONCE for a freshly minted proxy key
}

/**
 * Revoke a proxy key (soft delete via is_active=false). RLS scopes the update
 * to the owner. NOTE: the edge proxy caches resolved keys for up to
 * KV_CONTEXT_TTL_SECONDS, so a revoked key may keep working until that snapshot
 * expires (≤60s by default).
 */
export async function revokeProxyKey(keyId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Read the hash first (RLS-scoped) so we can purge the edge cache.
  const { data: keyRow } = await supabase
    .from("proxy_keys")
    .select("key_hash")
    .eq("id", keyId)
    .single();

  const { error } = await supabase
    .from("proxy_keys")
    .update({ is_active: false })
    .eq("id", keyId); // RLS: only the owner's row matches

  if (error) return { ok: false, error: "Could not revoke key." };

  // Evict the edge cache so the key dies immediately (best-effort).
  if (keyRow?.key_hash) await purgeProxyKeyCache(keyRow.key_hash as string);

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Rotate a key with zero downtime: mint a fresh key with the same name and
 * caps, and give the old key a 24h grace window (expires_at) so running
 * agents keep working while configs are updated. The new key is returned once.
 */
export async function rotateProxyKey(keyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // RLS-scoped read: only the owner's key resolves.
  const { data: old } = await supabase
    .from("proxy_keys")
    .select("id, project_id, daily_limit, monthly_limit, name, is_active")
    .eq("id", keyId)
    .single();
  if (!old || !old.is_active) {
    return { ok: false, error: "Key not found or already revoked." };
  }

  const { key, keyHash, keyPrefix } = generateProxyKey();
  const admin = createAdminClient();
  const { error: issueError } = await admin.rpc("issue_proxy_key", {
    p_user_id: user.id,
    p_key_hash: keyHash,
    p_key_prefix: keyPrefix,
    p_project_id: old.project_id,
    p_daily_limit: old.daily_limit,
    p_name: old.name,
    p_monthly_limit: old.monthly_limit,
  });
  if (issueError) return { ok: false, error: "Could not mint the new key." };

  // Grace window on the old key (RLS-scoped). If this fails the new key still
  // works; the old one just stays alive until manually revoked.
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("proxy_keys")
    .update({ expires_at: expiresAt })
    .eq("id", keyId);

  revalidatePath("/dashboard");
  return { ok: true, generatedKey: key };
}

/**
 * Permanently delete a revoked key. RLS only permits deleting the owner's
 * inactive keys, so an active key can never be removed without revoking first.
 * Usage history is untouched (usage_events does not reference proxy_keys).
 */
export async function deleteProxyKey(keyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proxy_keys")
    .delete()
    .eq("id", keyId)
    .eq("is_active", false)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "Could not remove the key. Revoke it first." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Projects ─────────────────────────────────────────────────────────────────

/** Create a project (a bundle of services billed to one key). */
export async function createProject(formData: FormData): Promise<ActionResult> {
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    monthlyBudget: formData.get("monthlyBudget"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_project", {
    p_name: parsed.data.name,
    p_monthly_budget: parsed.data.monthlyBudget ?? null,
  });
  if (error) return { ok: false, error: "Could not create project." };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mint a project key (routes to all services in the project), optional daily cap. */
export async function createProjectKey(
  projectId: string,
  dailyLimit: number | null,
  name?: string | null,
  monthlyLimit?: number | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Verify ownership (RLS-scoped).
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (!project) return { ok: false, error: "Project not found." };

  const { key, keyHash, keyPrefix } = generateProxyKey();

  const admin = createAdminClient();
  const { error } = await admin.rpc("issue_proxy_key", {
    p_user_id: user.id,
    p_key_hash: keyHash,
    p_key_prefix: keyPrefix,
    p_project_id: projectId,
    p_daily_limit: dailyLimit,
    p_name: name?.trim() || null,
    p_monthly_limit: monthlyLimit ?? null,
  });
  if (error) return { ok: false, error: "Could not create key." };

  revalidatePath("/dashboard");
  return { ok: true, generatedKey: key };
}

// ── Connections (reusable APIs) ──────────────────────────────────────────────

/** Create a reusable connection (an API defined once, attached to projects). */
export async function createConnection(formData: FormData): Promise<ActionResult> {
  const parsed = connectionSchema.safeParse({
    name: formData.get("name"),
    targetUrl: formData.get("targetUrl"),
    costPerRequest: formData.get("costPerRequest"),
    headers: formData.get("headers"),
    meteringMode: formData.get("meteringMode") ?? undefined,
    inputTokenCost: formData.get("inputTokenCost") ?? undefined,
    outputTokenCost: formData.get("outputTokenCost") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  // No header is valid (APIs without auth); a malformed one is not.
  const headers = parsed.data.headers ? parseHeaders(parsed.data.headers) : {};
  if (!headers) return { ok: false, error: 'Headers must be "Name: value" lines.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_endpoint", {
    p_name: parsed.data.name,
    p_target_url: parsed.data.targetUrl,
    p_cost_per_request: parsed.data.costPerRequest,
    p_auth_headers: headers,
    p_metering_mode: parsed.data.meteringMode,
    p_input_token_cost: parsed.data.inputTokenCost,
    p_output_token_cost: parsed.data.outputTokenCost,
  });
  if (error) return { ok: false, error: "Could not create connection." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Delete a connection (cascades to its project attachments). RLS-scoped. */
export async function deleteConnection(endpointId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("endpoints").delete().eq("id", endpointId);
  if (error) return { ok: false, error: "Could not delete connection." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Attach an existing connection to a project under a slug. */
export async function attachService(formData: FormData): Promise<ActionResult> {
  const parsed = attachServiceSchema.safeParse({
    projectId: formData.get("projectId"),
    endpointId: formData.get("endpointId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("attach_service", {
    p_project_id: parsed.data.projectId,
    p_endpoint_id: parsed.data.endpointId,
    p_slug: parsed.data.slug,
  });
  if (error) {
    return { ok: false, error: "Could not attach (slug taken, or already attached?)." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Detach a connection from a project (removes the route; keeps the connection). */
export async function detachService(projectServiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_services")
    .delete()
    .eq("id", projectServiceId);
  if (error) return { ok: false, error: "Could not detach service." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export interface TestCallResult {
  ok: boolean;
  status?: number;
  message: string;
}

/**
 * Fire one real proxied call through a freshly minted key so the user sees the
 * whole pipeline work without leaving the dashboard. The plaintext key exists
 * only in the browser right after minting; it transits here over TLS and is
 * never stored or logged.
 */
export async function testProxyCall(
  plainKey: string,
  slug: string,
): Promise<TestCallResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const prefix = process.env.PROXY_KEY_PREFIX || "alw_live_";
  if (!plainKey.startsWith(prefix) || plainKey.length > 200) {
    return { ok: false, message: "That does not look like an Allowance key." };
  }
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
    return { ok: false, message: "Invalid service slug." };
  }

  const { PROXY_URL } = await import("@/lib/proxy-url");
  let res: Response;
  try {
    res = await fetch(`${PROXY_URL}/v1/proxy/${slug}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${plainKey}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, message: "Could not reach the proxy. Try again." };
  }

  // Map the proxy's documented error bodies to human guidance.
  let errorCode: string | undefined;
  try {
    const body = (await res.json()) as { error?: string };
    errorCode = body?.error;
  } catch {
    /* non-JSON upstream body is fine */
  }

  if (res.status === 401) {
    return { ok: false, status: 401, message: "The key was not accepted. Mint a new one and retry." };
  }
  if (errorCode === "unknown_service") {
    return { ok: false, status: 404, message: `No service is attached under /${slug}.` };
  }
  if (res.status === 402) {
    return { ok: false, status: 402, message: "A cap is already at zero. Raise your budget and retry." };
  }
  if (res.status === 502 || res.status === 504) {
    return { ok: false, status: res.status, message: "Routing worked, but your provider did not answer. Check the connection's base URL." };
  }
  if (res.status >= 500) {
    return { ok: false, status: res.status, message: `Your provider returned ${res.status}. The call was not charged.` };
  }

  // Any non-5xx upstream answer means the whole pipeline worked: auth, slug
  // routing, credential injection, forward, metering.
  return {
    ok: true,
    status: res.status,
    message:
      res.status === 200
        ? "Your key works. The call was metered against your budget."
        : `Routed and metered. Your provider answered ${res.status} for GET /models (some APIs do not have that route, which is fine).`,
  };
}

/** Set the spend budget (USD). Free — this is a cap, not a payment. */
export async function setBudget(amount: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.rpc("set_budget", { p_amount: amount });
  if (error) return { ok: false, error: "Could not set budget." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Set the low-balance alert threshold (USD). null/0 disables alerts. */
export async function setLowBalanceThreshold(
  value: number | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.rpc("set_low_balance_threshold", {
    p_threshold: value,
  });
  if (error) return { ok: false, error: "Could not save the threshold." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Delete a project (cascades to its services). RLS-scoped. */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: "Could not delete project." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
