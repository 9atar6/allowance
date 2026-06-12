import "server-only"; // build error if ever imported into a client component

// Service-role client — BYPASSES RLS and can call service_role-locked RPCs
// (issue_proxy_key). NEVER expose this; use only inside server actions / route
// handlers, and always scope writes to the authenticated user's id.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

export function createAdminClient() {
  return createSupabaseClient(
    supabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
