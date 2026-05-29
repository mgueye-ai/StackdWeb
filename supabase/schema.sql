-- =============================================================================
-- StackdWeb — Supabase schema
-- Run once in: Supabase → SQL Editor → New query → Run
-- Project: https://supabase.com/dashboard/project/jlwtcmauxcauscriagey
-- =============================================================================
--
-- WHAT USES THIS:
--   • waitlist_signups  → optional backup when /api/waitlist saves to Supabase
--   • orders            → Stripe checkout via /api/create-checkout + webhook
--
-- Primary email list: Resend (Waitlist segment) — no SQL required for that.
-- Post-launch passcode: Vercel env var — no SQL required.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. WAITLIST (active now — optional Supabase backup)
-- -----------------------------------------------------------------------------

create table if not exists public.waitlist_signups (
  id bigint generated always as identity primary key,
  email text not null,
  source text not null default 'hero' check (source in ('hero', 'cta')),
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

-- Inserts only via /api/waitlist using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- No public read/write policies.


-- -----------------------------------------------------------------------------
-- 2. ORDERS (post-launch — Stripe shop, not built yet)
-- -----------------------------------------------------------------------------

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  email text not null,
  product text not null check (product in ('stackd', 'stackd_up')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'refunded')
  ),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

-- Inserts/updates only via server-side Stripe webhook using service role.


-- -----------------------------------------------------------------------------
-- 3. HELPFUL VIEWS (optional — for dashboard / admin)
-- -----------------------------------------------------------------------------

create or replace view public.waitlist_stats as
select
  count(*) as total_signups,
  count(*) filter (where source = 'hero') as hero_signups,
  count(*) filter (where source = 'cta') as cta_signups,
  max(created_at) as latest_signup
from public.waitlist_signups;

-- Revoke public access to views; use service role or Supabase dashboard only.
revoke all on public.waitlist_stats from anon, authenticated;


-- -----------------------------------------------------------------------------
-- Done. Verify in Table Editor:
--   • waitlist_signups
--   • orders (empty until Stripe is connected)
-- -----------------------------------------------------------------------------
