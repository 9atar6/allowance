// Server Supabase client — runs AS THE AUTHENTICATED USER (carries their JWT,
// so RLS and auth.uid() apply). Use this for all user-scoped reads/writes,
// including the create_endpoint RPC (which keys off auth.uid()).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // In Server Components, cookie writes throw — that's fine; the
          // middleware refreshes the session. Swallow only that case.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a Server Component — handled by middleware */
          }
        },
      },
    },
  );
}
