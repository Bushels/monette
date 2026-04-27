-- One-vote-per-visitor enforcement for the public launch.
--
-- The client sends a voter_fingerprint (UUID in localStorage) with every
-- insert and then upserts on conflict to change its pick. Poll categories
-- (ownership, listing) are single-choice: one row per (prop, quarter,
-- category, fingerprint). Season is multi-choice (seeded / sprayed /
-- harvested can all be true at once): one row per (prop, quarter, category,
-- value, fingerprint), so a visitor can log each season event exactly once.
create unique index if not exists votes_poll_uniq
  on public.votes (prop_id, quarter_loc, category, voter_fingerprint)
  where category in ('ownership', 'listing');

create unique index if not exists votes_season_uniq
  on public.votes (prop_id, quarter_loc, category, value, voter_fingerprint)
  where category = 'season';

-- Anon clients need UPDATE to change their own pick via upsert. RLS still
-- lets them only see/act on published rows; the partial indexes above make
-- the upsert resolve to their own prior vote rather than someone else's.
drop policy if exists "anon_update_votes" on public.votes;
create policy "anon_update_votes" on public.votes
  for update to anon using (true) with check (true);
