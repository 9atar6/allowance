// =============================================================================
// Resolve a key's context + the request path into the single endpoint to serve.
//
//  - single-endpoint key: always its one endpoint; forward strips /v1/proxy.
//  - project key: the first path segment after /v1/proxy is the service slug;
//    forward strips /v1/proxy/{slug}. Unknown slug -> 404.
// =============================================================================

import { PROXY_BASE_PATH } from "../config";
import type { ActiveRequest, ResolvedContext, ResolvedEndpoint } from "../types";

export type ResolveError = "inactive" | "unknown_service";

/** First path segment after the proxy base, e.g. "/v1/proxy/openai/x" -> "openai". */
export function serviceSlug(reqUrl: string): string | null {
  const { pathname } = new URL(reqUrl);
  const rest = pathname.startsWith(PROXY_BASE_PATH)
    ? pathname.slice(PROXY_BASE_PATH.length)
    : "";
  return rest.split("/").filter(Boolean)[0] ?? null;
}

function toActive(
  ctx: ResolvedContext,
  ep: ResolvedEndpoint,
  proxyPrefix: string,
): ActiveRequest {
  return {
    userId: ctx.userId,
    keyHash: ctx.keyHash,
    projectId: ctx.projectId,
    balance: ctx.balance,
    endpointId: ep.endpointId,
    targetUrl: ep.targetUrl,
    costPerRequest: ep.costPerRequest,
    meteringMode: ep.meteringMode,
    inputTokenCost: ep.inputTokenCost,
    outputTokenCost: ep.outputTokenCost,
    upstreamHeaders: ep.upstreamHeaders,
    proxyPrefix,
  };
}

export function resolveActive(
  ctx: ResolvedContext,
  reqUrl: string,
): { active: ActiveRequest | null; error: ResolveError | null } {
  if (ctx.single) {
    if (!ctx.single.endpointActive || !ctx.single.targetUrl) {
      return { active: null, error: "inactive" };
    }
    return { active: toActive(ctx, ctx.single, PROXY_BASE_PATH), error: null };
  }

  if (ctx.routes) {
    const slug = serviceSlug(reqUrl);
    if (!slug) return { active: null, error: "unknown_service" };
    const route = ctx.routes.find((r) => r.slug === slug);
    if (!route) return { active: null, error: "unknown_service" };
    return { active: toActive(ctx, route, `${PROXY_BASE_PATH}/${slug}`), error: null };
  }

  return { active: null, error: "inactive" };
}
