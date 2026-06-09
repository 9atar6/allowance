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
  endpointSchema,
  projectEndpointSchema,
  projectSchema,
} from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  generatedKey?: string; // returned ONCE for a freshly minted proxy key
}

/** Create an endpoint — credentials encrypted into Vault via create_endpoint. */
export async function createEndpoint(formData: FormData): Promise<ActionResult> {
  const parsed = endpointSchema.safeParse({
    name: formData.get("name"),
    targetUrl: formData.get("targetUrl"),
    costPerRequest: formData.get("costPerRequest"),
    headers: formData.get("headers"),
    meteringMode: formData.get("meteringMode") ?? "flat",
    inputTokenCost: formData.get("inputTokenCost") ?? 0,
    outputTokenCost: formData.get("outputTokenCost") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const headers = parseHeaders(parsed.data.headers);
  if (!headers) {
    return { ok: false, error: 'Headers must be "Name: value" lines.' };
  }

  // Runs as the authenticated user → create_endpoint keys off auth.uid().
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

  if (error) return { ok: false, error: "Could not create endpoint." };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mint a proxy key. Plaintext is returned once; only the hash is persisted. */
export async function createProxyKey(endpointId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Verify the endpoint belongs to this user (RLS-scoped read).
  const { data: endpoint } = await supabase
    .from("endpoints")
    .select("id")
    .eq("id", endpointId)
    .single();
  if (!endpoint) return { ok: false, error: "Endpoint not found." };

  const { key, keyHash, keyPrefix } = generateProxyKey();

  // issue_proxy_key is service_role-locked; scope it to the verified user id.
  const admin = createAdminClient();
  const { error } = await admin.rpc("issue_proxy_key", {
    p_user_id: user.id,
    p_key_hash: keyHash,
    p_key_prefix: keyPrefix,
    p_endpoint_id: endpointId,
  });
  if (error) return { ok: false, error: "Could not create key." };

  revalidatePath("/dashboard");
  return { ok: true, generatedKey: key };
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

/** Enable/disable an endpoint. Disabled endpoints 503 at the proxy. RLS-scoped. */
export async function setEndpointActive(
  endpointId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("endpoints")
    .update({ is_active: isActive })
    .eq("id", endpointId);

  if (error) return { ok: false, error: "Could not update endpoint." };
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

/** Add a service to a project (routed by its slug). Credentials go to Vault. */
export async function createProjectEndpoint(formData: FormData): Promise<ActionResult> {
  const parsed = projectEndpointSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    targetUrl: formData.get("targetUrl"),
    slug: formData.get("slug"),
    costPerRequest: formData.get("costPerRequest"),
    headers: formData.get("headers"),
    meteringMode: formData.get("meteringMode") ?? undefined,
    inputTokenCost: formData.get("inputTokenCost") ?? undefined,
    outputTokenCost: formData.get("outputTokenCost") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const headers = parseHeaders(parsed.data.headers);
  if (!headers) {
    return { ok: false, error: 'Headers must be "Name: value" lines.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_endpoint", {
    p_name: parsed.data.name,
    p_target_url: parsed.data.targetUrl,
    p_cost_per_request: parsed.data.costPerRequest,
    p_auth_headers: headers,
    p_metering_mode: parsed.data.meteringMode,
    p_input_token_cost: parsed.data.inputTokenCost,
    p_output_token_cost: parsed.data.outputTokenCost,
    p_project_id: parsed.data.projectId,
    p_slug: parsed.data.slug,
  });
  if (error) return { ok: false, error: "Could not add service (is the slug unique?)." };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mint a project key (routes to all services in the project), optional daily cap. */
export async function createProjectKey(
  projectId: string,
  dailyLimit: number | null,
  name?: string | null,
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
  const headers = parseHeaders(parsed.data.headers);
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

/** Delete a service (endpoint). RLS scopes it to the owner. */
export async function deleteService(endpointId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("endpoints").delete().eq("id", endpointId);
  if (error) return { ok: false, error: "Could not delete service." };
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
