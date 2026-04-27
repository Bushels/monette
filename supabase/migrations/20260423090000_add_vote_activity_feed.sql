-- Public, anonymized vote activity for the homepage feed.
--
-- Raw vote rows stay locked down. This view deliberately excludes voter
-- fingerprints and free-text notes while exposing enough detail to show what
-- the community is voting on.

create or replace view public.vote_activity_feed
with (security_barrier = true)
as
  select
    id,
    prop_id,
    quarter_loc,
    category,
    value,
    created_at
  from public.votes;

grant select on public.vote_activity_feed to anon;
