-- The Monette Ledger — Supabase schema
-- One row per vote so we can show "5 say owned, 2 say sold" tallies honestly,
-- and so we can rate-limit / deduplicate by voter_fingerprint later.

create extension if not exists "pgcrypto";

-- ── votes ─────────────────────────────────────────────────────────────
-- Each anonymous visitor can submit multiple vote rows (one per category).
-- The UI shows aggregate counts via the `vote_tallies` view below.
create table if not exists public.votes (
  id                uuid primary key default gen_random_uuid(),
  prop_id           text not null,                     -- e.g. 'vanguard'
  quarter_loc       text not null,                     -- e.g. 'NW-26-10-16-W3'
  category          text not null check (category in ('ownership','listing','season')),
  value             text not null,                     -- e.g. 'owned-monette','listed-for-sale','seeded'
  voter_fingerprint text,                              -- hashed IP+UA, optional
  note              text,                              -- optional free-text justification
  created_at        timestamptz default now()
);

create index if not exists votes_prop_quarter_idx on public.votes (prop_id, quarter_loc);
create index if not exists votes_created_idx      on public.votes (created_at desc);

-- Aggregate view — the site reads from this for the pill counters.
create or replace view public.vote_tallies as
  select prop_id, quarter_loc, category, value, count(*)::int as n
  from   public.votes
  group  by prop_id, quarter_loc, category, value;

-- ── tips / headlines ──────────────────────────────────────────────────
-- Users submitting photos or textual reports land here; editors promote
-- the good ones into the ticker/editorial view by toggling `published`.
create table if not exists public.tips (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('tip','headline')) default 'tip',
  prop_id      text,                                  -- optional — which property it's about
  body         text not null,
  author       text,
  photo_url    text,
  published    boolean not null default false,        -- editorial gate
  created_at   timestamptz default now()
);

create index if not exists tips_published_idx on public.tips (published, created_at desc);

-- ── Row-Level Security ────────────────────────────────────────────────
-- Anon clients can INSERT votes and tips, and SELECT the public views.
-- They CANNOT update or delete anyone's row — that requires service_role.
alter table public.votes enable row level security;
alter table public.tips  enable row level security;

drop policy if exists "anon_read_votes"   on public.votes;
drop policy if exists "anon_insert_votes" on public.votes;
drop policy if exists "anon_read_tips"    on public.tips;
drop policy if exists "anon_insert_tips"  on public.tips;

create policy "anon_read_votes"   on public.votes for select to anon using (true);
create policy "anon_insert_votes" on public.votes for insert to anon with check (true);

-- Tips: anyone can read published ones; anyone can submit a new one.
create policy "anon_read_tips"    on public.tips  for select to anon using (published = true);
create policy "anon_insert_tips"  on public.tips  for insert to anon with check (true);

-- Grant SELECT on the aggregate view to anon so counts render without a join.
grant select on public.vote_tallies to anon;
