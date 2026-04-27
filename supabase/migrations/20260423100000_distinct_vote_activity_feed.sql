-- Keep the public activity feed readable by showing the latest row for each
-- property / quarter / vote choice. Aggregate counts still live in
-- vote_tallies; this feed is for recency, not volume.

create or replace view public.vote_activity_feed
with (security_barrier = true)
as
  select distinct on (prop_id, quarter_loc, category, value)
    id,
    prop_id,
    quarter_loc,
    category,
    value,
    created_at
  from public.votes
  order by prop_id, quarter_loc, category, value, created_at desc;

grant select on public.vote_activity_feed to anon;
