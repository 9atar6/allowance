-- =============================================================================
-- CLEANUP MIGRATION — 2026-06-10
--
-- Drops everything left dead by the Model-A pivot (the prepaid/auto-reload
-- experiment). Destructive on purpose, which is why it lives here and NOT in
-- the idempotent db/schema.sql.
--
-- Run ONCE in the Supabase SQL editor, AFTER the current db/schema.sql.
-- Safe to re-run (everything is IF EXISTS).
--
-- What stays, deliberately:
--   - wallet_transactions + txn_type enum: historical ledger (debits still
--     write to it via debit_wallet).
--   - wallets.stripe_customer_id / stripe_subscription_id / plan columns:
--     used by the live Pro subscription flow.
-- =============================================================================

-- Dead functions (auto-reload + prepaid credit rail).
drop function if exists public.set_auto_reload(uuid, text, text, numeric, boolean);
drop function if exists public.set_auto_reload_enabled(boolean);
drop function if exists public.wallets_needing_auto_reload();
drop function if exists public.mark_auto_reload_attempted(uuid);
drop function if exists public.credit_wallet(uuid, numeric, public.txn_type, text);

-- Dead columns on wallets.
alter table public.wallets drop column if exists auto_reload_enabled;
alter table public.wallets drop column if exists auto_reload_amount;
alter table public.wallets drop column if exists auto_reload_attempted_at;
alter table public.wallets drop column if exists stripe_payment_method_id;

-- Superseded function overloads (older signatures replaced by v3/v4+).
drop function if exists public.issue_proxy_key(uuid, text, text, uuid);
drop function if exists public.issue_proxy_key(uuid, text, text, uuid, uuid, numeric);
drop function if exists public.issue_proxy_key(uuid, text, text, uuid, uuid, numeric, text);
drop function if exists public.create_endpoint(text, text, numeric, jsonb);

-- Verify: these should all return zero rows.
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname like '%auto_reload%';
--   select column_name from information_schema.columns
--    where table_name = 'wallets' and column_name like 'auto_reload%';
