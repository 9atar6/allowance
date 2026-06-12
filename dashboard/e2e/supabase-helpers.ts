// =============================================================================
// Tier-2 helpers: create a disposable Supabase user, sign in with a password,
// and forge the @supabase/ssr session cookie so Playwright lands on the
// dashboard already authenticated (magic links can't be clicked in CI).
// =============================================================================
import { createClient, type Session } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** True when the env carries enough credentials for the authed journey. */
export function tier2Available(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
}

export interface TestUser {
  id: string;
  email: string;
  session: Session;
}

export async function createSignedInUser(): Promise<TestUser> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.getallowance.dev`;
  const password = `E2e!${crypto.randomUUID()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`could not create test user: ${createErr?.message}`);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signedIn.session) {
    throw new Error(`could not sign in test user: ${signInErr?.message}`);
  }

  return { id: created.user.id, email, session: signedIn.session };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await admin.auth.admin.deleteUser(userId); // cascades to all user rows
}

/**
 * Encode the session the way @supabase/ssr stores it:
 * name sb-<projectRef>-auth-token, value "base64-" + base64url(JSON), chunked
 * into <name>.0, <name>.1, ... when longer than 3180 chars.
 */
export function sessionCookies(
  session: Session,
): Array<{ name: string; value: string; domain: string; path: string }> {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");

  const MAX_CHUNK = 3180;
  const common = { domain: "localhost", path: "/" };
  if (value.length <= MAX_CHUNK) return [{ name, value, ...common }];

  const cookies = [];
  for (let i = 0; i * MAX_CHUNK < value.length; i++) {
    cookies.push({
      name: `${name}.${i}`,
      value: value.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK),
      ...common,
    });
  }
  return cookies;
}
