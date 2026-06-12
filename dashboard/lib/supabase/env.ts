// Server-side Supabase target. Prefers the non-public names (read at RUNTIME,
// so E2E can point a production build at the staging project) and falls back
// to the NEXT_PUBLIC_ values, which Next inlines at build time.
export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!;
}

export function supabaseAnonKey(): string {
  return (process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
}
