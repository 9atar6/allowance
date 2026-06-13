-- =============================================================================
-- Allowance — Phase 0 full setup (paste into Supabase SQL Editor → Run)
-- Idempotent-ish: safe to re-run. Runs as the `postgres` role.
-- =============================================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ── Enum (guarded so re-runs don't error) ────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'txn_type') then
    create type public.txn_type as enum ('topup', 'debit', 'refund', 'adjustment');
  end if;
end $$;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Public profile mirror of auth.users (no secrets).';

-- ── wallets ──────────────────────────────────────────────────────────────────
-- Authoritative prepaid balance. NUMERIC(14,6) USD — exact decimal, no floats.
create table if not exists public.wallets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  balance      numeric(14, 6) not null default 0 check (balance >= 0),
  currency     text not null default 'USD' check (currency = 'USD'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.wallets.balance is
  'Exact prepaid balance in USD. Never mutated directly by clients.';

-- ── wallet_transactions (append-only ledger) ─────────────────────────────────
create table if not exists public.wallet_transactions (
  id               uuid primary key default gen_random_uuid(),
  wallet_id        uuid not null references public.wallets (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  type             public.txn_type not null,
  amount           numeric(14, 6) not null,   -- signed: + credit, - debit
  balance_after    numeric(14, 6) not null,
  external_ref     text,                        -- payment ref / proxy request id
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create unique index if not exists wallet_txns_type_extref_uniq
  on public.wallet_transactions (type, external_ref)
  where external_ref is not null;
create index if not exists wallet_txns_wallet_created_idx
  on public.wallet_transactions (wallet_id, created_at desc);
comment on table public.wallet_transactions is 'Append-only money ledger. Never UPDATE/DELETE.';

-- ── endpoints (Vault-referenced creds) ───────────────────────────────────────
create table if not exists public.endpoints (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 80),
  target_url         text not null check (target_url ~ '^https://'),
  -- Phase 1 flat fee. Still charged in 'flat' mode and as the per_token
  -- fallback when an upstream response carries no token usage.
  cost_per_request   numeric(14, 6) not null check (cost_per_request > 0),
  -- Phase 2 metering. 'per_token' bills input/output tokens parsed from the
  -- upstream's `usage` object; costs are per single token (USD).
  metering_mode      text not null default 'flat'
                       check (metering_mode in ('flat', 'per_token')),
  input_token_cost   numeric(16, 10) not null default 0 check (input_token_cost >= 0),
  output_token_cost  numeric(16, 10) not null default 0 check (output_token_cost >= 0),
  vault_secret_id    uuid not null,   -- opaque pointer into vault.secrets
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists endpoints_user_idx on public.endpoints (user_id) where is_active;
comment on column public.endpoints.vault_secret_id is
  'FK-by-convention into vault.secrets.id. Decryptable only via service_role RPC.';

-- ── proxy_keys (hash only — plaintext never stored) ──────────────────────────
create table if not exists public.proxy_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  key_hash     text not null unique,   -- hex SHA-256 of the full key
  key_prefix   text not null,          -- non-secret display prefix
  endpoint_id  uuid references public.endpoints (id) on delete set null,
  is_active    boolean not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists proxy_keys_hash_idx on public.proxy_keys (key_hash) where is_active;
comment on table public.proxy_keys is 'Issued proxy keys. Plaintext shown once, never stored.';

-- ── usage_events (zero-logging: no bodies/headers/tokens) ────────────────────
create table if not exists public.usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  endpoint_id     uuid references public.endpoints (id) on delete set null,
  request_id      text not null unique,   -- settlement idempotency key
  cost            numeric(14, 6) not null,
  status_code     int,
  chunk_count     int,
  prompt_tokens   int,                     -- from upstream usage (per_token mode)
  completion_tokens int,
  duration_ms     int,
  created_at      timestamptz not null default now()
);
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);
comment on table public.usage_events is 'Per-request metering. No bodies, headers, tokens or PII.';

-- =============================================================================
-- Triggers
-- =============================================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
drop trigger if exists set_updated_at on public.wallets;
create trigger set_updated_at before update on public.wallets
  for each row execute function public.tg_set_updated_at();
drop trigger if exists set_updated_at on public.endpoints;
create trigger set_updated_at before update on public.endpoints
  for each row execute function public.tg_set_updated_at();

-- New auth.users → provision profile + zero-balance wallet.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Row Level Security — DENY BY DEFAULT
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.endpoints           enable row level security;
alter table public.proxy_keys          enable row level security;
alter table public.usage_events        enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- wallets: READ own only. No client writes (no self-crediting).
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets
  for select to authenticated using (user_id = auth.uid());

-- wallet_transactions: READ own only.
drop policy if exists "wallet_txns_select_own" on public.wallet_transactions;
create policy "wallet_txns_select_own" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid());

-- endpoints: CRUD own.
drop policy if exists "endpoints_select_own" on public.endpoints;
create policy "endpoints_select_own" on public.endpoints
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "endpoints_insert_own" on public.endpoints;
create policy "endpoints_insert_own" on public.endpoints
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "endpoints_update_own" on public.endpoints;
create policy "endpoints_update_own" on public.endpoints
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "endpoints_delete_own" on public.endpoints;
create policy "endpoints_delete_own" on public.endpoints
  for delete to authenticated using (user_id = auth.uid());

-- proxy_keys: READ own + revoke (update is_active).
drop policy if exists "proxy_keys_select_own" on public.proxy_keys;
create policy "proxy_keys_select_own" on public.proxy_keys
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "proxy_keys_update_own" on public.proxy_keys;
create policy "proxy_keys_update_own" on public.proxy_keys
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- usage_events: READ own only.
drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events
  for select to authenticated using (user_id = auth.uid());

-- =============================================================================
-- SECURITY DEFINER RPCs — the only paths to Vault decryption + money movement
-- =============================================================================

-- create_endpoint: client-callable; encrypts the upstream headers into Vault.
-- p_auth_headers is a JSON map, e.g.
--   {"Authorization":"Bearer sk-...","OpenAI-Organization":"org-..."}
-- jsonb at the boundary = validated JSON; stored as text inside Vault.
create or replace function public.create_endpoint(
  p_name              text,
  p_target_url        text,
  p_cost_per_request  numeric,
  p_auth_headers      jsonb,
  p_metering_mode     text default 'flat',
  p_input_token_cost  numeric default 0,
  p_output_token_cost numeric default 0
)
returns uuid language plpgsql security definer
set search_path = public, vault, pg_temp as $$
declare
  v_user_id   uuid := auth.uid();
  v_secret_id uuid;
  v_endpoint  uuid;
begin
  if v_user_id is null then raise exception 'auth required'; end if;
  if jsonb_typeof(p_auth_headers) <> 'object' then
    raise exception 'p_auth_headers must be a JSON object of header name -> value';
  end if;
  if p_metering_mode not in ('flat', 'per_token') then
    raise exception 'invalid metering_mode';
  end if;
  v_secret_id := vault.create_secret(
    p_auth_headers::text,   -- the JSON header map, encrypted at rest by Vault
    'endpoint:' || gen_random_uuid()::text,
    'Allowance upstream credentials (JSON header map)'
  );
  insert into public.endpoints
    (user_id, name, target_url, cost_per_request, vault_secret_id,
     metering_mode, input_token_cost, output_token_cost)
  values (v_user_id, p_name, p_target_url, p_cost_per_request, v_secret_id,
          p_metering_mode, p_input_token_cost, p_output_token_cost)
  returning id into v_endpoint;
  return v_endpoint;
end; $$;

-- get_endpoint_credentials: service_role ONLY — decrypted header.
create or replace function public.get_endpoint_credentials(p_endpoint_id uuid)
returns text language plpgsql security definer
set search_path = public, vault, pg_temp as $$
declare v_secret_id uuid; v_plain text;
begin
  select vault_secret_id into v_secret_id
    from public.endpoints where id = p_endpoint_id and is_active;
  if v_secret_id is null then return null; end if;
  select decrypted_secret into v_plain
    from vault.decrypted_secrets where id = v_secret_id;
  return v_plain;
end; $$;

-- get_proxy_context: service_role ONLY — edge read model for KV warming.
create or replace function public.get_proxy_context(p_key_hash text)
returns jsonb language plpgsql security definer
set search_path = public, vault, pg_temp as $$
declare v_row record;
begin
  select k.user_id, w.balance, e.id as endpoint_id, e.target_url,
         e.cost_per_request, e.is_active as endpoint_active, e.vault_secret_id,
         e.metering_mode, e.input_token_cost, e.output_token_cost
  into v_row
  from public.proxy_keys k
  join public.wallets w on w.user_id = k.user_id
  left join public.endpoints e on e.id = k.endpoint_id
  where k.key_hash = p_key_hash and k.is_active;

  if not found then return null; end if;

  return jsonb_build_object(
    'user_id',           v_row.user_id,
    'balance',           v_row.balance,
    'endpoint_id',       v_row.endpoint_id,
    'target_url',        v_row.target_url,
    'cost_per_request',  v_row.cost_per_request,
    'metering_mode',     coalesce(v_row.metering_mode, 'flat'),
    'input_token_cost',  coalesce(v_row.input_token_cost, 0),
    'output_token_cost', coalesce(v_row.output_token_cost, 0),
    'endpoint_active',   coalesce(v_row.endpoint_active, false),
    'upstream_header',   (select decrypted_secret
                           from vault.decrypted_secrets where id = v_row.vault_secret_id)
  );
end; $$;

-- debit_wallet: service_role ONLY — atomic x402 hard-stop + ledger. Idempotent.
create or replace function public.debit_wallet(
  p_user_id uuid, p_endpoint_id uuid, p_cost numeric, p_request_id text,
  p_status_code int default null, p_chunk_count int default null, p_duration_ms int default null,
  p_prompt_tokens int default null, p_completion_tokens int default null
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_wallet_id uuid; v_new_bal numeric(14,6);
begin
  if exists (select 1 from public.usage_events where request_id = p_request_id) then
    return true;  -- already settled
  end if;

  update public.wallets set balance = balance - p_cost
   where user_id = p_user_id and balance >= p_cost
   returning id, balance into v_wallet_id, v_new_bal;
  if not found then return false; end if;  -- caller returns 402

  insert into public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_after, external_ref, metadata)
  values (v_wallet_id, p_user_id, 'debit', -p_cost, v_new_bal, p_request_id,
          jsonb_build_object('endpoint_id', p_endpoint_id));

  insert into public.usage_events
    (user_id, endpoint_id, request_id, cost, status_code, chunk_count,
     prompt_tokens, completion_tokens, duration_ms)
  values (p_user_id, p_endpoint_id, p_request_id, p_cost, p_status_code,
          p_chunk_count, p_prompt_tokens, p_completion_tokens, p_duration_ms);
  return true;
end; $$;

-- (credit_wallet was removed with the Model-A pivot — the budget is set
--  directly via set_budget. Dropped in the LEGACY CLEANUP section below.)

-- (issue_proxy_key is defined ONCE, in its latest form, further down — see the
--  PER-KEY MONTHLY LIMIT section.)

-- ── Privilege lockdown ───────────────────────────────────────────────────────
revoke all on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric) from public;
revoke all on function public.get_endpoint_credentials(uuid)                     from public;
revoke all on function public.get_proxy_context(text)                            from public;
revoke all on function public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int) from public;

grant execute on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric) to authenticated;

grant execute on function public.get_endpoint_credentials(uuid)                   to service_role;
grant execute on function public.get_proxy_context(text)                          to service_role;
grant execute on function public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int) to service_role;

-- =============================================================================
-- PROJECTS — group several services under one key, with optional budgets.
-- Additive + idempotent: safe to run on the existing live database. Keys made
-- before this upgrade (bound to a single endpoint) keep working unchanged.
-- =============================================================================

create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  monthly_budget  numeric(14, 6) check (monthly_budget is null or monthly_budget > 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id) where is_active;

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- Route services within a project by a URL slug; cap a key's daily spend.
alter table public.endpoints  add column if not exists project_id uuid references public.projects (id) on delete cascade;
alter table public.endpoints  add column if not exists slug text;
create unique index if not exists endpoints_project_slug_uniq
  on public.endpoints (project_id, slug) where project_id is not null;
alter table public.proxy_keys add column if not exists project_id uuid references public.projects (id) on delete set null;
alter table public.proxy_keys add column if not exists daily_limit numeric(14, 6);

-- RLS: own rows only.
alter table public.projects enable row level security;
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects for select to authenticated using (user_id = auth.uid());
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects for delete to authenticated using (user_id = auth.uid());

-- create_project: client-callable.
create or replace function public.create_project(p_name text, p_monthly_budget numeric default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'auth required'; end if;
  insert into public.projects (user_id, name, monthly_budget)
  values (v_user, p_name, p_monthly_budget) returning id into v_id;
  return v_id;
end; $$;

-- create_endpoint v2: optional project_id + slug (for project routing).
drop function if exists public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric);
create or replace function public.create_endpoint(
  p_name text, p_target_url text, p_cost_per_request numeric, p_auth_headers jsonb,
  p_metering_mode text default 'flat', p_input_token_cost numeric default 0, p_output_token_cost numeric default 0,
  p_project_id uuid default null, p_slug text default null
)
returns uuid language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_secret_id uuid; v_endpoint uuid;
begin
  if v_user_id is null then raise exception 'auth required'; end if;
  if jsonb_typeof(p_auth_headers) <> 'object' then raise exception 'p_auth_headers must be a JSON object'; end if;
  if p_metering_mode not in ('flat','per_token') then raise exception 'invalid metering_mode'; end if;
  if p_project_id is not null then
    if not exists (select 1 from public.projects where id = p_project_id and user_id = v_user_id) then
      raise exception 'project not found';
    end if;
    if p_slug is null or p_slug !~ '^[a-z0-9-]{1,40}$' then
      raise exception 'a project endpoint needs a slug matching ^[a-z0-9-]{1,40}$';
    end if;
  end if;
  v_secret_id := vault.create_secret(p_auth_headers::text, 'endpoint:' || gen_random_uuid()::text, 'Allowance upstream credentials (JSON header map)');
  insert into public.endpoints
    (user_id, name, target_url, cost_per_request, vault_secret_id, metering_mode, input_token_cost, output_token_cost, project_id, slug)
  values (v_user_id, p_name, p_target_url, p_cost_per_request, v_secret_id, p_metering_mode, p_input_token_cost, p_output_token_cost, p_project_id, p_slug)
  returning id into v_endpoint;
  return v_endpoint;
end; $$;

-- issue_proxy_key v2: a key is bound to a single endpoint OR a project; optional daily cap.
drop function if exists public.issue_proxy_key(uuid,text,text,uuid);
create or replace function public.issue_proxy_key(
  p_user_id uuid, p_key_hash text, p_key_prefix text,
  p_endpoint_id uuid default null, p_project_id uuid default null, p_daily_limit numeric default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.proxy_keys (user_id, key_hash, key_prefix, endpoint_id, project_id, daily_limit)
  values (p_user_id, p_key_hash, p_key_prefix, p_endpoint_id, p_project_id, p_daily_limit)
  returning id into v_id;
  return v_id;
end; $$;

-- get_proxy_context v2: project keys return a `routes` array (slug -> endpoint);
-- single-endpoint keys keep the original flat shape. Both gain `daily_limit`.
create or replace function public.get_proxy_context(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare k record; v_routes jsonb;
begin
  select pk.user_id, w.balance, pk.endpoint_id, pk.project_id, pk.daily_limit
  into k
  from public.proxy_keys pk
  join public.wallets w on w.user_id = pk.user_id
  where pk.key_hash = p_key_hash and pk.is_active;
  if not found then return null; end if;

  if k.project_id is not null then
    select jsonb_agg(jsonb_build_object(
      'slug', e.slug,
      'endpoint_id', e.id,
      'target_url', e.target_url,
      'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    ))
    into v_routes
    from public.endpoints e
    where e.project_id = k.project_id and e.is_active and e.slug is not null;

    return jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'daily_limit', k.daily_limit,
      'project_id', k.project_id, 'routes', coalesce(v_routes, '[]'::jsonb)
    );
  end if;

  return (
    select jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'daily_limit', k.daily_limit,
      'endpoint_id', e.id, 'target_url', e.target_url, 'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'endpoint_active', coalesce(e.is_active, false),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    )
    from public.endpoints e where e.id = k.endpoint_id
  );
end; $$;

-- Privilege lockdown for the new/updated functions.
revoke all on function public.create_project(text,numeric) from public;
revoke all on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric,uuid,text) from public;
revoke all on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric) from public;
grant execute on function public.create_project(text,numeric) to authenticated;
grant execute on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric,uuid,text) to authenticated;
grant execute on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric) to service_role;

-- =============================================================================
-- BILLING / PLANS  (freemium: free | pro | enterprise)
--
-- We charge for the gateway, never the upstream AI. The prepaid balance stays a
-- spend-control feature; the *plan* is what gates quota + features. Polar holds
-- the money; these columns mirror the subscription state for fast reads.
-- =============================================================================
alter table public.wallets add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'enterprise'));
alter table public.wallets add column if not exists plan_status text not null default 'active';
alter table public.wallets add column if not exists stripe_customer_id text;
alter table public.wallets add column if not exists stripe_subscription_id text;
alter table public.wallets add column if not exists current_period_end timestamptz;

comment on column public.wallets.plan is
  'Billing tier. Drives the monthly request quota + feature gating.';

-- set_plan: service_role ONLY — called by the Polar subscription webhook.
-- (stripe_* column names are historical; they store the payment provider's ids.)
create or replace function public.set_plan(
  p_user_id uuid,
  p_plan text,
  p_status text default 'active',
  p_customer_id text default null,
  p_subscription_id text default null,
  p_period_end timestamptz default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_plan not in ('free', 'pro', 'enterprise') then
    raise exception 'invalid plan %', p_plan;
  end if;
  update public.wallets
     set plan                   = p_plan,
         plan_status            = p_status,
         stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
         stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
         current_period_end     = coalesce(p_period_end, current_period_end),
         updated_at             = now()
   where user_id = p_user_id;
end; $$;

revoke all on function public.set_plan(uuid,text,text,text,text,timestamptz) from public;
grant execute on function public.set_plan(uuid,text,text,text,text,timestamptz) to service_role;

-- get_proxy_context v4: returns the wallet `plan` (free-tier cap) AND the
-- project's `monthly_budget` (project-wide USD cap), both enforced at the edge.
create or replace function public.get_proxy_context(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare k record; v_routes jsonb;
begin
  select pk.user_id, w.balance, w.plan, pk.endpoint_id, pk.project_id, pk.daily_limit,
         pj.monthly_budget
  into k
  from public.proxy_keys pk
  join public.wallets w on w.user_id = pk.user_id
  left join public.projects pj on pj.id = pk.project_id
  where pk.key_hash = p_key_hash and pk.is_active;
  if not found then return null; end if;

  if k.project_id is not null then
    select jsonb_agg(jsonb_build_object(
      'slug', e.slug,
      'endpoint_id', e.id,
      'target_url', e.target_url,
      'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    ))
    into v_routes
    from public.endpoints e
    where e.project_id = k.project_id and e.is_active and e.slug is not null;

    return jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit,
      'project_id', k.project_id, 'monthly_budget', k.monthly_budget,
      'routes', coalesce(v_routes, '[]'::jsonb)
    );
  end if;

  return (
    select jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit,
      'endpoint_id', e.id, 'target_url', e.target_url, 'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'endpoint_active', coalesce(e.is_active, false),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    )
    from public.endpoints e where e.id = k.endpoint_id
  );
end; $$;

-- =============================================================================
-- NAMED KEYS  (label each key + track last use)
-- =============================================================================
alter table public.proxy_keys add column if not exists name text;
alter table public.proxy_keys add column if not exists last_used_at timestamptz;

-- issue_proxy_key v3: adds an optional human label (p_name).
drop function if exists public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric);
create or replace function public.issue_proxy_key(
  p_user_id uuid, p_key_hash text, p_key_prefix text,
  p_endpoint_id uuid default null, p_project_id uuid default null,
  p_daily_limit numeric default null, p_name text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.proxy_keys (user_id, key_hash, key_prefix, endpoint_id, project_id, daily_limit, name)
  values (p_user_id, p_key_hash, p_key_prefix, p_endpoint_id, p_project_id, p_daily_limit, nullif(btrim(p_name), ''))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text) from public;
grant execute on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text) to service_role;

-- =============================================================================
-- USAGE ANALYTICS  (Pro): daily + per-service rollups, RLS-scoped via auth.uid()
-- =============================================================================
create or replace function public.my_daily_usage(p_days int default 14)
returns table(day date, requests bigint, cost numeric)
language sql security definer set search_path = public as $$
  select date_trunc('day', created_at at time zone 'utc')::date as day,
         count(*)::bigint as requests,
         coalesce(sum(cost), 0)::numeric as cost
  from public.usage_events
  where user_id = auth.uid()
    and created_at >= ((now() at time zone 'utc')::date - (greatest(p_days, 1) - 1))
  group by 1
  order by 1;
$$;

create or replace function public.my_service_usage(p_days int default 30)
returns table(endpoint_id uuid, requests bigint, cost numeric)
language sql security definer set search_path = public as $$
  select endpoint_id,
         count(*)::bigint as requests,
         coalesce(sum(cost), 0)::numeric as cost
  from public.usage_events
  where user_id = auth.uid()
    and created_at >= ((now() at time zone 'utc')::date - (greatest(p_days, 1) - 1))
  group by endpoint_id
  order by cost desc;
$$;

revoke all on function public.my_daily_usage(int) from public;
revoke all on function public.my_service_usage(int) from public;
grant execute on function public.my_daily_usage(int) to authenticated;
grant execute on function public.my_service_usage(int) to authenticated;

-- =============================================================================
-- LOW-BALANCE ALERTS  (email when balance drops below a user-set threshold)
-- =============================================================================
alter table public.wallets add column if not exists low_balance_threshold numeric(14, 6);
alter table public.wallets add column if not exists low_balance_alerted_at timestamptz;

-- User sets their own threshold (null/0 disables). Clears the alert latch.
create or replace function public.set_low_balance_threshold(p_threshold numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.wallets
     set low_balance_threshold = case when coalesce(p_threshold, 0) > 0 then p_threshold else null end,
         low_balance_alerted_at = null,
         updated_at = now()
   where user_id = auth.uid();
end; $$;
revoke all on function public.set_low_balance_threshold(numeric) from public;
grant execute on function public.set_low_balance_threshold(numeric) to authenticated;

-- service_role: wallets that are below threshold and not alerted in the last 24h.
create or replace function public.wallets_needing_low_balance_alert()
returns table(user_id uuid, email text, balance numeric, threshold numeric)
language sql security definer set search_path = public, auth, pg_temp as $$
  select w.user_id, u.email, w.balance, w.low_balance_threshold
  from public.wallets w
  join auth.users u on u.id = w.user_id
  where w.low_balance_threshold is not null
    and w.balance < w.low_balance_threshold
    and (w.low_balance_alerted_at is null
         or w.low_balance_alerted_at < now() - interval '24 hours');
$$;

-- service_role: latch the alert so we email at most once per 24h while low.
create or replace function public.mark_low_balance_alerted(p_user_id uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.wallets set low_balance_alerted_at = now() where user_id = p_user_id;
$$;

revoke all on function public.wallets_needing_low_balance_alert() from public;
revoke all on function public.mark_low_balance_alerted(uuid) from public;
grant execute on function public.wallets_needing_low_balance_alert() to service_role;
grant execute on function public.mark_low_balance_alerted(uuid) to service_role;

-- (Auto-reload was removed with the Model-A pivot. Its leftover columns and
--  functions are dropped in the LEGACY CLEANUP section below.)

-- =============================================================================
-- REUSABLE CONNECTIONS  (define an API once → attach it to many projects)
--
-- An "endpoint" is now a reusable connection (project_id/slug left null). A
-- project attaches a connection via project_services with a per-project slug.
-- =============================================================================
create table if not exists public.project_services (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  endpoint_id uuid not null references public.endpoints (id) on delete cascade,
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (project_id, slug),
  unique (project_id, endpoint_id)
);
alter table public.project_services enable row level security;
drop policy if exists "project_services_select_own" on public.project_services;
create policy "project_services_select_own" on public.project_services
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "project_services_delete_own" on public.project_services;
create policy "project_services_delete_own" on public.project_services
  for delete to authenticated using (user_id = auth.uid());
-- Inserts go through attach_service (validates slug + cross-ownership).

create or replace function public.attach_service(
  p_project_id uuid, p_endpoint_id uuid, p_slug text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'auth required'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'slug must match ^[a-z0-9-]{1,40}$';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id and user_id = v_user) then
    raise exception 'project not found';
  end if;
  if not exists (select 1 from public.endpoints where id = p_endpoint_id and user_id = v_user) then
    raise exception 'connection not found';
  end if;
  insert into public.project_services (user_id, project_id, endpoint_id, slug)
  values (v_user, p_project_id, p_endpoint_id, p_slug)
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.attach_service(uuid,uuid,text) from public;
grant execute on function public.attach_service(uuid,uuid,text) to authenticated;

-- One-time migration: move existing project-bound endpoints into the new model
-- (idempotent — safe to re-run; existing project keys keep working).
insert into public.project_services (user_id, project_id, endpoint_id, slug)
select e.user_id, e.project_id, e.id, e.slug
from public.endpoints e
where e.project_id is not null and e.slug is not null
on conflict do nothing;
update public.endpoints set project_id = null, slug = null where project_id is not null;

-- get_proxy_context v5: project routes come from project_services (the new
-- model) UNION any legacy project-bound endpoints (pre-migration safety).
create or replace function public.get_proxy_context(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare k record; v_routes jsonb;
begin
  select pk.user_id, w.balance, w.plan, pk.endpoint_id, pk.project_id, pk.daily_limit,
         pj.monthly_budget
  into k
  from public.proxy_keys pk
  join public.wallets w on w.user_id = pk.user_id
  left join public.projects pj on pj.id = pk.project_id
  where pk.key_hash = p_key_hash and pk.is_active;
  if not found then return null; end if;

  if k.project_id is not null then
    with routes_cte as (
      select ps.slug, e.id, e.target_url, e.cost_per_request, e.metering_mode,
             e.input_token_cost, e.output_token_cost, e.vault_secret_id
      from public.project_services ps
      join public.endpoints e on e.id = ps.endpoint_id
      where ps.project_id = k.project_id and e.is_active
      union all
      select e.slug, e.id, e.target_url, e.cost_per_request, e.metering_mode,
             e.input_token_cost, e.output_token_cost, e.vault_secret_id
      from public.endpoints e
      where e.project_id = k.project_id and e.is_active and e.slug is not null
    )
    select jsonb_agg(jsonb_build_object(
      'slug', slug, 'endpoint_id', id, 'target_url', target_url,
      'cost_per_request', cost_per_request,
      'metering_mode', coalesce(metering_mode, 'flat'),
      'input_token_cost', coalesce(input_token_cost, 0),
      'output_token_cost', coalesce(output_token_cost, 0),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = vault_secret_id)
    ))
    into v_routes from routes_cte;

    return jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit,
      'project_id', k.project_id, 'monthly_budget', k.monthly_budget,
      'routes', coalesce(v_routes, '[]'::jsonb)
    );
  end if;

  return (
    select jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit,
      'endpoint_id', e.id, 'target_url', e.target_url, 'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'endpoint_active', coalesce(e.is_active, false),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    )
    from public.endpoints e where e.id = k.endpoint_id
  );
end; $$;

-- =============================================================================
-- MODEL A (control layer / BYOK): the balance is a FREE budget cap the user
-- sets, not real money. No provider payments flow through Allowance.
-- =============================================================================

-- User sets their spend budget (free). Calls 402 when remaining hits zero.
create or replace function public.set_budget(p_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then
    raise exception 'budget must be between 0 and 1,000,000';
  end if;
  update public.wallets
     set balance = p_amount, low_balance_alerted_at = null, updated_at = now()
   where user_id = auth.uid();
end; $$;
revoke all on function public.set_budget(numeric) from public;
grant execute on function public.set_budget(numeric) to authenticated;

-- =============================================================================
-- PER-KEY MONTHLY LIMIT  (completes the limits story: key/day, key/month,
-- project/month, account budget)
-- =============================================================================
alter table public.proxy_keys add column if not exists monthly_limit numeric(14, 6);

-- issue_proxy_key v4: adds an optional per-key monthly USD cap.
drop function if exists public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text);
create or replace function public.issue_proxy_key(
  p_user_id uuid, p_key_hash text, p_key_prefix text,
  p_endpoint_id uuid default null, p_project_id uuid default null,
  p_daily_limit numeric default null, p_name text default null,
  p_monthly_limit numeric default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.proxy_keys
    (user_id, key_hash, key_prefix, endpoint_id, project_id, daily_limit, name, monthly_limit)
  values
    (p_user_id, p_key_hash, p_key_prefix, p_endpoint_id, p_project_id,
     p_daily_limit, nullif(btrim(p_name), ''), p_monthly_limit)
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric) from public;
grant execute on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric) to service_role;

-- get_proxy_context v6: also returns the key's monthly_limit (both key shapes).
create or replace function public.get_proxy_context(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare k record; v_routes jsonb;
begin
  select pk.user_id, w.balance, w.plan, pk.endpoint_id, pk.project_id,
         pk.daily_limit, pk.monthly_limit, pj.monthly_budget
  into k
  from public.proxy_keys pk
  join public.wallets w on w.user_id = pk.user_id
  left join public.projects pj on pj.id = pk.project_id
  where pk.key_hash = p_key_hash and pk.is_active
    and (pk.expires_at is null or pk.expires_at > now());
  if not found then return null; end if;

  -- Touch last_used_at, throttled to once/hour. Piggybacks on the cache-miss
  -- path (the edge calls this at most every KV TTL), so no extra round-trips.
  update public.proxy_keys
     set last_used_at = now()
   where key_hash = p_key_hash
     and (last_used_at is null or last_used_at < now() - interval '1 hour');

  if k.project_id is not null then
    with routes_cte as (
      select ps.slug, e.id, e.target_url, e.cost_per_request, e.metering_mode,
             e.input_token_cost, e.output_token_cost, e.vault_secret_id
      from public.project_services ps
      join public.endpoints e on e.id = ps.endpoint_id
      where ps.project_id = k.project_id and e.is_active
      union all
      select e.slug, e.id, e.target_url, e.cost_per_request, e.metering_mode,
             e.input_token_cost, e.output_token_cost, e.vault_secret_id
      from public.endpoints e
      where e.project_id = k.project_id and e.is_active and e.slug is not null
    )
    select jsonb_agg(jsonb_build_object(
      'slug', slug, 'endpoint_id', id, 'target_url', target_url,
      'cost_per_request', cost_per_request,
      'metering_mode', coalesce(metering_mode, 'flat'),
      'input_token_cost', coalesce(input_token_cost, 0),
      'output_token_cost', coalesce(output_token_cost, 0),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = vault_secret_id)
    ))
    into v_routes from routes_cte;

    return jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit, 'monthly_limit', k.monthly_limit,
      'project_id', k.project_id, 'monthly_budget', k.monthly_budget,
      'routes', coalesce(v_routes, '[]'::jsonb)
    );
  end if;

  return (
    select jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit, 'monthly_limit', k.monthly_limit,
      'endpoint_id', e.id, 'target_url', e.target_url, 'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'endpoint_active', coalesce(e.is_active, false),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    )
    from public.endpoints e where e.id = k.endpoint_id
  );
end; $$;

-- =============================================================================
-- DELEGATED SUB-BUDGETS ("pocket money") — v9
-- =============================================================================
-- A parent key can mint child keys carved from its own access: same project
-- (same routes), an optional lifetime spend cap (budget_limit), and an optional
-- expiry. A child is valid only while its parent is active and unexpired, so
-- revoking a parent grounds all its children at once. One level deep in v1
-- (a child cannot itself have children).
alter table public.proxy_keys
  add column if not exists parent_key_id uuid references public.proxy_keys (id) on delete cascade;
alter table public.proxy_keys
  add column if not exists budget_limit numeric(14, 6)
    check (budget_limit is null or budget_limit > 0);
create index if not exists proxy_keys_parent_idx on public.proxy_keys (parent_key_id)
  where parent_key_id is not null;

-- get_proxy_context v7: returns budget_limit + parent_key_id, and a child key
-- resolves only when its parent is still active and unexpired.
create or replace function public.get_proxy_context(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare k record; v_routes jsonb;
begin
  select pk.user_id, w.balance, w.plan, pk.endpoint_id, pk.project_id,
         pk.daily_limit, pk.monthly_limit, pk.budget_limit, pk.parent_key_id,
         pj.monthly_budget
  into k
  from public.proxy_keys pk
  join public.wallets w on w.user_id = pk.user_id
  left join public.projects pj on pj.id = pk.project_id
  where pk.key_hash = p_key_hash and pk.is_active
    and (pk.expires_at is null or pk.expires_at > now())
    -- child keys die with their parent
    and (pk.parent_key_id is null or exists (
      select 1 from public.proxy_keys parent
      where parent.id = pk.parent_key_id and parent.is_active
        and (parent.expires_at is null or parent.expires_at > now())
    ));
  if not found then return null; end if;

  update public.proxy_keys
     set last_used_at = now()
   where key_hash = p_key_hash
     and (last_used_at is null or last_used_at < now() - interval '1 hour');

  if k.project_id is not null then
    with routes_cte as (
      select ps.slug, e.id, e.target_url, e.cost_per_request, e.metering_mode,
             e.input_token_cost, e.output_token_cost, e.vault_secret_id
      from public.project_services ps
      join public.endpoints e on e.id = ps.endpoint_id
      where ps.project_id = k.project_id and e.is_active
      union all
      select e.slug, e.id, e.target_url, e.cost_per_request, e.metering_mode,
             e.input_token_cost, e.output_token_cost, e.vault_secret_id
      from public.endpoints e
      where e.project_id = k.project_id and e.is_active and e.slug is not null
    )
    select jsonb_agg(jsonb_build_object(
      'slug', slug, 'endpoint_id', id, 'target_url', target_url,
      'cost_per_request', cost_per_request,
      'metering_mode', coalesce(metering_mode, 'flat'),
      'input_token_cost', coalesce(input_token_cost, 0),
      'output_token_cost', coalesce(output_token_cost, 0),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = vault_secret_id)
    ))
    into v_routes from routes_cte;

    return jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit, 'monthly_limit', k.monthly_limit,
      'budget_limit', k.budget_limit,
      'project_id', k.project_id, 'monthly_budget', k.monthly_budget,
      'routes', coalesce(v_routes, '[]'::jsonb)
    );
  end if;

  return (
    select jsonb_build_object(
      'user_id', k.user_id, 'balance', k.balance, 'plan', coalesce(k.plan, 'free'),
      'daily_limit', k.daily_limit, 'monthly_limit', k.monthly_limit,
      'budget_limit', k.budget_limit,
      'endpoint_id', e.id, 'target_url', e.target_url, 'cost_per_request', e.cost_per_request,
      'metering_mode', coalesce(e.metering_mode, 'flat'),
      'input_token_cost', coalesce(e.input_token_cost, 0),
      'output_token_cost', coalesce(e.output_token_cost, 0),
      'endpoint_active', coalesce(e.is_active, false),
      'upstream_header', (select decrypted_secret from vault.decrypted_secrets where id = e.vault_secret_id)
    )
    from public.endpoints e where e.id = k.endpoint_id
  );
end; $$;

-- Mint a child key from a parent, authenticated by the PARENT'S hash (the edge
-- verifies the parent key, then calls this). Returns the new child id, or null
-- if the parent is invalid/inactive/expired, is itself a child, or has no
-- project. service_role / proxy_worker only.
create or replace function public.issue_child_key(
  p_parent_key_hash text, p_child_key_hash text, p_child_key_prefix text,
  p_budget_limit numeric, p_expires_at timestamptz default null,
  p_name text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare parent record; v_id uuid;
begin
  if p_budget_limit is null or p_budget_limit <= 0 or p_budget_limit > 1000000 then
    return null;
  end if;
  select id, user_id, project_id, parent_key_id, is_active, expires_at
    into parent
  from public.proxy_keys
  where key_hash = p_parent_key_hash;
  if not found or not parent.is_active then return null; end if;
  if parent.expires_at is not null and parent.expires_at <= now() then return null; end if;
  if parent.parent_key_id is not null then return null; end if;  -- one level only
  if parent.project_id is null then return null; end if;          -- project keys only

  insert into public.proxy_keys
    (user_id, key_hash, key_prefix, project_id, parent_key_id, budget_limit,
     expires_at, name)
  values
    (parent.user_id, p_child_key_hash, p_child_key_prefix, parent.project_id,
     parent.id, p_budget_limit, p_expires_at, nullif(btrim(p_name), ''))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.issue_child_key(text,text,text,numeric,timestamptz,text) from public, anon, authenticated;
grant execute on function public.issue_child_key(text,text,text,numeric,timestamptz,text) to service_role, proxy_worker;

-- =============================================================================
-- LEGACY CLEANUP (all IF EXISTS — no-ops on fresh databases)
-- =============================================================================
-- Drops everything left dead by the Model-A pivot (the prepaid/auto-reload
-- experiment). Kept here so one paste of this file fully describes the DB.

drop function if exists public.set_auto_reload(uuid, text, text, numeric, boolean);
drop function if exists public.set_auto_reload_enabled(boolean);
drop function if exists public.wallets_needing_auto_reload();
drop function if exists public.mark_auto_reload_attempted(uuid);
drop function if exists public.credit_wallet(uuid, numeric, public.txn_type, text);

alter table public.wallets drop column if exists auto_reload_enabled;
alter table public.wallets drop column if exists auto_reload_amount;
alter table public.wallets drop column if exists auto_reload_attempted_at;
alter table public.wallets drop column if exists stripe_payment_method_id;

drop function if exists public.issue_proxy_key(uuid, text, text, uuid);
drop function if exists public.create_endpoint(text, text, numeric, jsonb);

-- =============================================================================
-- FIXES
-- =============================================================================
-- Allow zero-cost connections ("Blank = doesn't count" in the UI). The original
-- check demanded > 0, which rejected free/untracked services.
alter table public.endpoints drop constraint if exists endpoints_cost_per_request_check;
alter table public.endpoints add constraint endpoints_cost_per_request_check
  check (cost_per_request >= 0);

-- Owners may permanently delete their REVOKED keys (active keys are protected:
-- you must revoke first, which also evicts the edge cache).
drop policy if exists "proxy_keys_delete_revoked_own" on public.proxy_keys;
create policy "proxy_keys_delete_revoked_own" on public.proxy_keys
  for delete using (auth.uid() = user_id and not is_active);

-- =============================================================================
-- Restricted worker role (least privilege for the edge proxy)
-- =============================================================================
-- The Cloudflare Worker only ever calls 4 RPCs. This role can execute exactly
-- those and touch nothing else: no tables, no other functions, no vault.
-- (The RPCs are SECURITY DEFINER, so they still work internally.)
-- Pair with a JWT whose role claim is "proxy_worker" (see docs/RUNBOOK.md).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'proxy_worker') then
    create role proxy_worker nologin;
  end if;
end $$;
grant proxy_worker to authenticator;          -- lets PostgREST assume the role
grant usage on schema public to proxy_worker;
revoke all on all tables    in schema public from proxy_worker;
revoke all on all functions in schema public from proxy_worker;
grant execute on function public.get_proxy_context(text) to proxy_worker;
grant execute on function public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int) to proxy_worker;
grant execute on function public.wallets_needing_low_balance_alert() to proxy_worker;
grant execute on function public.mark_low_balance_alerted(uuid) to proxy_worker;
-- issue_child_key is granted again here (its earlier grant in the sub-budgets
-- section runs BEFORE this revoke-all and would otherwise be stripped).
grant execute on function public.issue_child_key(text,text,text,numeric,timestamptz,text) to proxy_worker;

-- =============================================================================
-- debit_wallet v2: always record a served call (may go negative once)
-- =============================================================================
-- v1 refused the debit when balance < cost. But settlement runs AFTER the call
-- was served: refusing meant the call was free and unmetered, and per-token
-- connections (flat estimate 0) could ride that loop forever at $0 budget.
-- v2 debits unconditionally; the final call may push the balance slightly
-- negative, and the edge gate (balance <= 0 -> 402) stops the next one.
alter table public.wallets drop constraint if exists wallets_balance_check;
create or replace function public.debit_wallet(
  p_user_id uuid, p_endpoint_id uuid, p_cost numeric, p_request_id text,
  p_status_code int default null, p_chunk_count int default null, p_duration_ms int default null,
  p_prompt_tokens int default null, p_completion_tokens int default null
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_wallet_id uuid; v_new_bal numeric(14,6);
begin
  if exists (select 1 from public.usage_events where request_id = p_request_id) then
    return true;  -- already settled
  end if;

  update public.wallets set balance = balance - p_cost
   where user_id = p_user_id
   returning id, balance into v_wallet_id, v_new_bal;
  if not found then return false; end if;  -- no wallet (should not happen)

  insert into public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_after, external_ref, metadata)
  values (v_wallet_id, p_user_id, 'debit', -p_cost, v_new_bal, p_request_id,
          jsonb_build_object('endpoint_id', p_endpoint_id));

  insert into public.usage_events
    (user_id, endpoint_id, request_id, cost, status_code, chunk_count,
     prompt_tokens, completion_tokens, duration_ms)
  values (p_user_id, p_endpoint_id, p_request_id, p_cost, p_status_code,
          p_chunk_count, p_prompt_tokens, p_completion_tokens, p_duration_ms);
  return true;
end; $$;

-- =============================================================================
-- Key rotation (zero-downtime)
-- =============================================================================
-- Rotating mints a fresh key and gives the old one a 24h grace window via
-- expires_at, so running agents keep working while configs are updated.
-- get_proxy_context (above) rejects keys past their expires_at.
alter table public.proxy_keys add column if not exists expires_at timestamptz;

-- =============================================================================
-- Privilege hardening (Supabase linter 0011 / 0028 / 0029)
-- =============================================================================
-- Postgres auto-grants EXECUTE on new functions to anon + authenticated.
-- Backend-only RPCs must never be callable with the public anon key, and
-- user-facing RPCs must require a signed-in session.

-- Stop future functions from being auto-exposed.
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- Backend-only (worker / Polar webhook / triggers): service_role + proxy_worker only.
revoke execute on function public.get_proxy_context(text) from anon, authenticated, public;
revoke execute on function public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int) from anon, authenticated, public;
revoke execute on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric) from anon, authenticated, public;
revoke execute on function public.set_plan(uuid,text,text,text,text,timestamptz) from anon, authenticated, public;
revoke execute on function public.wallets_needing_low_balance_alert() from anon, authenticated, public;
revoke execute on function public.mark_low_balance_alerted(uuid) from anon, authenticated, public;
revoke execute on function public.get_endpoint_credentials(uuid) from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.tg_set_updated_at() from anon, authenticated, public;

-- User-facing RPCs: signed-in users only (each checks auth.uid() internally).
revoke execute on function public.create_project(text,numeric) from anon, public;
revoke execute on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric,uuid,text) from anon, public;
revoke execute on function public.attach_service(uuid,uuid,text) from anon, public;
revoke execute on function public.set_budget(numeric) from anon, public;
revoke execute on function public.set_low_balance_threshold(numeric) from anon, public;
revoke execute on function public.my_daily_usage(int) from anon, public;
revoke execute on function public.my_service_usage(int) from anon, public;
grant execute on function public.create_project(text,numeric) to authenticated;
grant execute on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric,uuid,text) to authenticated;
grant execute on function public.attach_service(uuid,uuid,text) to authenticated;
grant execute on function public.set_budget(numeric) to authenticated;
grant execute on function public.set_low_balance_threshold(numeric) to authenticated;
grant execute on function public.my_daily_usage(int) to authenticated;
grant execute on function public.my_service_usage(int) to authenticated;

-- Pin the trigger helper's search_path (linter 0011).
alter function public.tg_set_updated_at() set search_path = public;

-- =============================================================================
-- Ephemeral keys + monthly allowance (v7)
-- =============================================================================

-- issue_proxy_key v5: optional expiry (ephemeral keys: 1h/24h/7d/never).
-- Earlier overloads are dropped so exactly one signature remains exposed.
drop function if exists public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric);
drop function if exists public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text);
drop function if exists public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric);
create or replace function public.issue_proxy_key(
  p_user_id uuid, p_key_hash text, p_key_prefix text,
  p_endpoint_id uuid default null, p_project_id uuid default null,
  p_daily_limit numeric default null, p_name text default null,
  p_monthly_limit numeric default null, p_expires_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.proxy_keys
    (user_id, key_hash, key_prefix, endpoint_id, project_id, daily_limit, name,
     monthly_limit, expires_at)
  values
    (p_user_id, p_key_hash, p_key_prefix, p_endpoint_id, p_project_id,
     p_daily_limit, nullif(btrim(p_name), ''), p_monthly_limit, p_expires_at)
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric,timestamptz) from public, anon, authenticated;
grant execute on function public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric,timestamptz) to service_role;

-- Monthly allowance: the budget refills itself to a chosen amount on the 1st
-- (UTC). "Allowance", literally. Null = off (manual budget only).
alter table public.wallets add column if not exists monthly_allowance numeric(14, 6);
alter table public.wallets add column if not exists allowance_reset_month text;

create or replace function public.set_monthly_allowance(p_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 1000000) then
    raise exception 'allowance must be between 0 and 1,000,000';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    update public.wallets set monthly_allowance = null, updated_at = now()
     where user_id = auth.uid();
  else
    -- Enabling also applies the first refill immediately, so the UI reflects it.
    update public.wallets
       set monthly_allowance = p_amount,
           balance = p_amount,
           allowance_reset_month = to_char(now() at time zone 'utc', 'YYYY-MM'),
           low_balance_alerted_at = null,
           updated_at = now()
     where user_id = auth.uid();
  end if;
end; $$;
revoke all on function public.set_monthly_allowance(numeric) from public, anon;
grant execute on function public.set_monthly_allowance(numeric) to authenticated;

-- Cron-called: refill every wallet whose allowance has not run this month yet.
create or replace function public.reset_monthly_allowances()
returns integer language sql security definer set search_path = public as $$
  with bumped as (
    update public.wallets
       set balance = monthly_allowance,
           allowance_reset_month = to_char(now() at time zone 'utc', 'YYYY-MM'),
           low_balance_alerted_at = null,
           updated_at = now()
     where monthly_allowance is not null
       and allowance_reset_month is distinct from to_char(now() at time zone 'utc', 'YYYY-MM')
    returning 1
  )
  select count(*)::int from bumped;
$$;
revoke all on function public.reset_monthly_allowances() from public, anon, authenticated;
grant execute on function public.reset_monthly_allowances() to service_role;
grant execute on function public.reset_monthly_allowances() to proxy_worker;

-- =============================================================================
-- Spend webhooks (v8): POST to a user URL when budget consumption crosses
-- 50% / 80% / 100% of the baseline (the amount the budget was last set or
-- auto-refilled to). Fired from the worker cron; each threshold fires once
-- per baseline (re-armed whenever the budget is set or refilled).
-- =============================================================================
alter table public.wallets add column if not exists spend_webhook_url text;
alter table public.wallets add column if not exists budget_baseline numeric(14, 6);
alter table public.wallets add column if not exists webhook_fired_mask int not null default 0;

-- set_budget v2: also records the baseline and re-arms the webhook thresholds.
create or replace function public.set_budget(p_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then
    raise exception 'budget must be between 0 and 1,000,000';
  end if;
  update public.wallets
     set balance = p_amount,
         budget_baseline = nullif(p_amount, 0),
         webhook_fired_mask = 0,
         low_balance_alerted_at = null,
         updated_at = now()
   where user_id = auth.uid();
end; $$;

-- set_monthly_allowance v2: enabling also sets the baseline and re-arms.
create or replace function public.set_monthly_allowance(p_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 1000000) then
    raise exception 'allowance must be between 0 and 1,000,000';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    update public.wallets set monthly_allowance = null, updated_at = now()
     where user_id = auth.uid();
  else
    update public.wallets
       set monthly_allowance = p_amount,
           balance = p_amount,
           budget_baseline = p_amount,
           webhook_fired_mask = 0,
           allowance_reset_month = to_char(now() at time zone 'utc', 'YYYY-MM'),
           low_balance_alerted_at = null,
           updated_at = now()
     where user_id = auth.uid();
  end if;
end; $$;

-- reset_monthly_allowances v2: a refill is a fresh baseline; re-arm webhooks.
create or replace function public.reset_monthly_allowances()
returns integer language sql security definer set search_path = public as $$
  with bumped as (
    update public.wallets
       set balance = monthly_allowance,
           budget_baseline = monthly_allowance,
           webhook_fired_mask = 0,
           allowance_reset_month = to_char(now() at time zone 'utc', 'YYYY-MM'),
           low_balance_alerted_at = null,
           updated_at = now()
     where monthly_allowance is not null
       and allowance_reset_month is distinct from to_char(now() at time zone 'utc', 'YYYY-MM')
    returning 1
  )
  select count(*)::int from bumped;
$$;

-- User-facing: set or clear the webhook URL (https only).
create or replace function public.set_spend_webhook(p_url text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if p_url is not null and btrim(p_url) <> '' and p_url !~ '^https://' then
    raise exception 'webhook URL must start with https://';
  end if;
  update public.wallets
     set spend_webhook_url = nullif(btrim(coalesce(p_url, '')), ''),
         webhook_fired_mask = 0,
         updated_at = now()
   where user_id = auth.uid();
end; $$;
revoke all on function public.set_spend_webhook(text) from public, anon;
grant execute on function public.set_spend_webhook(text) to authenticated;

-- Cron-called: wallets whose consumption crossed a not-yet-fired threshold.
-- Bitmask: 50% -> 1, 80% -> 2, 100% -> 4.
create or replace function public.wallets_needing_spend_webhook()
returns table(
  user_id uuid, url text, balance numeric, baseline numeric,
  new_mask int, thresholds int[]
)
language sql security definer set search_path = public as $$
  with calc as (
    select w.user_id, w.spend_webhook_url as url, w.balance, w.budget_baseline as baseline,
           w.webhook_fired_mask as fired,
           case when w.balance <= 0 then 100.0
                else (1 - w.balance / w.budget_baseline) * 100.0 end as pct
    from public.wallets w
    where w.spend_webhook_url is not null and w.budget_baseline > 0
  ),
  crossed as (
    select c.*,
      (case when c.pct >= 50  then 1 else 0 end
       | case when c.pct >= 80  then 2 else 0 end
       | case when c.pct >= 100 then 4 else 0 end) as due_mask
    from calc c
  )
  select user_id, url, balance, baseline,
         (fired | due_mask) as new_mask,
         array_remove(array[
           case when (due_mask & 1) <> 0 and (fired & 1) = 0 then 50 end,
           case when (due_mask & 2) <> 0 and (fired & 2) = 0 then 80 end,
           case when (due_mask & 4) <> 0 and (fired & 4) = 0 then 100 end
         ], null) as thresholds
  from crossed
  where (due_mask | fired) <> fired;
$$;

-- Cron-called: latch the fired thresholds after a successful POST.
create or replace function public.mark_spend_webhook_sent(p_user_id uuid, p_mask int)
returns void language sql security definer set search_path = public as $$
  update public.wallets set webhook_fired_mask = p_mask, updated_at = now()
  where user_id = p_user_id;
$$;

-- handle_new_user v2: new accounts start with a $10 budget (it is a FREE cap,
-- not money). A $0 default meant the very first proxied call answered 402,
-- which made onboarding fail before the user ever saw the product work.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.wallets (user_id, balance, budget_baseline)
    values (new.id, 10, 10)
    on conflict (user_id) do nothing;
  return new;
end; $$;

revoke all on function public.wallets_needing_spend_webhook() from public, anon, authenticated;
revoke all on function public.mark_spend_webhook_sent(uuid, int) from public, anon, authenticated;
grant execute on function public.wallets_needing_spend_webhook() to service_role, proxy_worker;
grant execute on function public.mark_spend_webhook_sent(uuid, int) to service_role, proxy_worker;

-- Done. Verify with:  select tablename from pg_tables where schemaname='public';
