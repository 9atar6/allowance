-- =============================================================================
-- Allowance DB health check — READ-ONLY, safe to run any time.
-- Paste the whole file into the Supabase SQL Editor and run it: one row per
-- check, status PASS or FAIL. Everything should be PASS after db/schema.sql
-- has been pasted in full.
-- =============================================================================

select check_name, status from (

-- ── Row-level security ────────────────────────────────────────────────────────
select 10 as ord, 'RLS enabled on every public table' as check_name,
  case when not exists (
    select 1 from pg_tables where schemaname = 'public' and not rowsecurity
  ) then 'PASS' else 'FAIL: ' || coalesce((
    select string_agg(tablename, ', ') from pg_tables
    where schemaname = 'public' and not rowsecurity), '') end as status

union all
select 11, 'Revoked-key delete policy exists',
  case when exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proxy_keys'
      and policyname = 'proxy_keys_delete_revoked_own'
  ) then 'PASS' else 'FAIL' end

-- ── Schema shape (latest migrations applied) ─────────────────────────────────
union all
select 20, 'proxy_keys.expires_at exists (rotation / ephemeral keys)',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proxy_keys'
      and column_name = 'expires_at'
  ) then 'PASS' else 'FAIL' end

union all
select 21, 'wallets.monthly_allowance + allowance_reset_month exist',
  case when 2 = (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets'
      and column_name in ('monthly_allowance', 'allowance_reset_month')
  ) then 'PASS' else 'FAIL' end

union all
select 22, 'wallets balance >= 0 constraint dropped (debit_wallet v2)',
  case when not exists (
    select 1 from pg_constraint
    where conname = 'wallets_balance_check'
      and conrelid = 'public.wallets'::regclass
  ) then 'PASS' else 'FAIL: still present, re-paste schema' end

union all
select 23, 'endpoints cost check allows zero-cost connections',
  -- Postgres renders the constant with a cast: ">= (0)::numeric".
  case when exists (
    select 1 from pg_constraint
    where conname = 'endpoints_cost_per_request_check'
      and pg_get_constraintdef(oid) ~ '>=\s*\(?0\)?'
  ) then 'PASS' else 'FAIL' end

-- ── Functions: latest versions in place ──────────────────────────────────────
union all
select 30, 'exactly one issue_proxy_key overload (v5, 9 params)',
  case when 1 = (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'issue_proxy_key'
  ) and to_regprocedure('public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric,timestamptz)') is not null
  then 'PASS' else 'FAIL: stale overloads, re-paste schema' end

union all
select 31, 'get_proxy_context rejects expired keys',
  case when to_regprocedure('public.get_proxy_context(text)') is not null
    and pg_get_functiondef(to_regprocedure('public.get_proxy_context(text)')) ilike '%expires_at%'
  then 'PASS' else 'FAIL' end

union all
select 32, 'debit_wallet v2 (always records a served call)',
  case when to_regprocedure('public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int)') is not null
    and pg_get_functiondef(to_regprocedure('public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int)')) not ilike '%balance >= p_cost%'
  then 'PASS' else 'FAIL: v1 still installed' end

union all
select 33, 'allowance RPCs installed',
  case when to_regprocedure('public.set_monthly_allowance(numeric)') is not null
    and to_regprocedure('public.reset_monthly_allowances()') is not null
  then 'PASS' else 'FAIL' end

union all
select 35, 'spend webhook RPCs + columns installed (v8)',
  case when to_regprocedure('public.set_spend_webhook(text)') is not null
    and to_regprocedure('public.wallets_needing_spend_webhook()') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wallets'
        and column_name = 'spend_webhook_url'
    )
  then 'PASS' else 'FAIL' end

union all
select 36, 'new accounts start with a $10 budget (handle_new_user v2)',
  case when pg_get_functiondef(to_regprocedure('public.handle_new_user()')) like '%10, 10%'
  then 'PASS' else 'FAIL: re-paste schema' end

union all
select 37, 'sub-budget columns + issue_child_key installed (v9)',
  case when to_regprocedure('public.issue_child_key(text,text,text,numeric,timestamptz,text)') is not null
    and 2 = (
      select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'proxy_keys'
        and column_name in ('parent_key_id', 'budget_limit')
    )
    and pg_get_functiondef(to_regprocedure('public.get_proxy_context(text)')) ilike '%parent_key_id%'
  then 'PASS' else 'FAIL: re-paste schema' end

union all
select 44, 'proxy_worker can mint child keys',
  case when has_function_privilege('proxy_worker', 'public.issue_child_key(text,text,text,numeric,timestamptz,text)', 'execute')
  then 'PASS' else 'FAIL' end

union all
select 34, 'trigger helper search_path pinned (linter 0011)',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tg_set_updated_at'
      and p.proconfig::text ilike '%search_path%'
  ) then 'PASS' else 'FAIL' end

-- ── Restricted worker role ───────────────────────────────────────────────────
union all
select 40, 'proxy_worker role exists',
  case when exists (select 1 from pg_roles where rolname = 'proxy_worker')
  then 'PASS' else 'FAIL' end

union all
select 41, 'proxy_worker granted to authenticator (PostgREST can assume it)',
  case when exists (
    select 1 from pg_auth_members m
    join pg_roles r on r.oid = m.roleid
    join pg_roles g on g.oid = m.member
    where r.rolname = 'proxy_worker' and g.rolname = 'authenticator'
  ) then 'PASS' else 'FAIL' end

union all
select 42, 'proxy_worker can run its 7 RPCs (and only needs those)',
  case when
    has_function_privilege('proxy_worker', 'public.get_proxy_context(text)', 'execute')
    and has_function_privilege('proxy_worker', 'public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int)', 'execute')
    and has_function_privilege('proxy_worker', 'public.wallets_needing_low_balance_alert()', 'execute')
    and has_function_privilege('proxy_worker', 'public.mark_low_balance_alerted(uuid)', 'execute')
    and has_function_privilege('proxy_worker', 'public.reset_monthly_allowances()', 'execute')
    and has_function_privilege('proxy_worker', 'public.wallets_needing_spend_webhook()', 'execute')
    and has_function_privilege('proxy_worker', 'public.mark_spend_webhook_sent(uuid,int)', 'execute')
  then 'PASS' else 'FAIL' end

union all
select 43, 'proxy_worker has zero table privileges',
  case when not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'proxy_worker' and table_schema = 'public'
  ) then 'PASS' else 'FAIL' end

-- ── Privilege lockdown: backend RPCs unreachable by users ────────────────────
union all
select 50, 'anon cannot execute any backend RPC',
  case when
    not has_function_privilege('anon', 'public.get_proxy_context(text)', 'execute')
    and not has_function_privilege('anon', 'public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int)', 'execute')
    and not has_function_privilege('anon', 'public.set_plan(uuid,text,text,text,text,timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric,timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.reset_monthly_allowances()', 'execute')
  then 'PASS' else 'FAIL: anon can reach a backend RPC' end

union all
select 51, 'signed-in users cannot self-upgrade or touch wallets directly',
  case when
    not has_function_privilege('authenticated', 'public.set_plan(uuid,text,text,text,text,timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.debit_wallet(uuid,uuid,numeric,text,int,int,int,int,int)', 'execute')
    and not has_function_privilege('authenticated', 'public.issue_proxy_key(uuid,text,text,uuid,uuid,numeric,text,numeric,timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.get_proxy_context(text)', 'execute')
  then 'PASS' else 'FAIL: a user-reachable backend RPC' end

union all
select 52, 'signed-in users CAN use their own RPCs',
  case when
    has_function_privilege('authenticated', 'public.set_budget(numeric)', 'execute')
    and has_function_privilege('authenticated', 'public.set_monthly_allowance(numeric)', 'execute')
    and has_function_privilege('authenticated', 'public.create_project(text,numeric)', 'execute')
    and has_function_privilege('authenticated', 'public.attach_service(uuid,uuid,text)', 'execute')
  then 'PASS' else 'FAIL: a user RPC is missing its grant' end

-- ── Vault ────────────────────────────────────────────────────────────────────
union all
select 60, 'Supabase Vault installed (credential encryption)',
  case when exists (select 1 from pg_extension where extname = 'supabase_vault')
  then 'PASS' else 'FAIL' end

) checks
order by ord;
