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
  external_ref     text,                        -- Stripe PI id / proxy request id
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
  request_id      text not null unique,   -- Lago idempotency key
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

-- credit_wallet: service_role ONLY — Stripe top-ups / refunds. Idempotent.
create or replace function public.credit_wallet(
  p_user_id uuid, p_amount numeric, p_type public.txn_type, p_external_ref text
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_wallet_id uuid; v_new_bal numeric(14,6);
begin
  if p_amount <= 0 then raise exception 'credit amount must be positive'; end if;
  if exists (select 1 from public.wallet_transactions
              where type = p_type and external_ref = p_external_ref) then
    return true;  -- already credited
  end if;

  update public.wallets set balance = balance + p_amount
   where user_id = p_user_id
   returning id, balance into v_wallet_id, v_new_bal;
  if not found then raise exception 'wallet not found for user %', p_user_id; end if;

  insert into public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_after, external_ref)
  values (v_wallet_id, p_user_id, p_type, p_amount, v_new_bal, p_external_ref);
  return true;
end; $$;

-- issue_proxy_key: service_role ONLY — stores hash, plaintext never reaches DB.
create or replace function public.issue_proxy_key(
  p_user_id uuid, p_key_hash text, p_key_prefix text, p_endpoint_id uuid default null
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.proxy_keys (user_id, key_hash, key_prefix, endpoint_id)
  values (p_user_id, p_key_hash, p_key_prefix, p_endpoint_id)
  returning id into v_id;
  return v_id;
end; $$;

-- ── Privilege lockdown ───────────────────────────────────────────────────────
revoke all on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric) from public;
revoke all on function public.get_endpoint_credentials(uuid)                     from public;
revoke all on function public.get_proxy_context(text)                            from public;
revoke all on function public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int) from public;
revoke all on function public.credit_wallet(uuid,numeric,public.txn_type,text)   from public;
revoke all on function public.issue_proxy_key(uuid,text,text,uuid)               from public;

grant execute on function public.create_endpoint(text,text,numeric,jsonb,text,numeric,numeric) to authenticated;

grant execute on function public.get_endpoint_credentials(uuid)                   to service_role;
grant execute on function public.get_proxy_context(text)                          to service_role;
grant execute on function public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int) to service_role;
grant execute on function public.credit_wallet(uuid,numeric,public.txn_type,text) to service_role;
grant execute on function public.issue_proxy_key(uuid,text,text,uuid)             to service_role;

-- Done. Verify with:  select tablename from pg_tables where schemaname='public';
