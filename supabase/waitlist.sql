-- Run in the Supabase SQL editor for the Stackd project.
-- Creates the waitlist table used by /api/waitlist.

create table if not exists public.waitlist_signups (
  id bigint generated always as identity primary key,
  email text not null,
  source text not null default 'hero' check (source in ('hero', 'cta')),
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

-- No public policies: inserts go through the service role in /api/waitlist only.
