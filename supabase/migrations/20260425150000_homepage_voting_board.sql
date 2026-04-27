-- Homepage voting board derived state.
-- STATUS_THRESHOLD = 3. If you change this value, also update the
-- threshold reference comment in vote-board.jsx.
--
-- This migration:
--   1. Creates public.quarter_current_state — derived per-quarter status.
--   2. Adds a season-progression guard to public.submit_vote so sprayed/harvested
--      votes are rejected when no prior seeded vote exists for the quarter.

-- 1. The derived view ----------------------------------------------------

create or replace view public.quarter_current_state as
with own_tally as (
  select prop_id, quarter_loc, value,
         count(distinct voter_fingerprint) as n,
         max(created_at) as last_at
  from public.votes
  where category = 'ownership'
  group by prop_id, quarter_loc, value
),
own_pick as (
  select distinct on (prop_id, quarter_loc)
         prop_id, quarter_loc,
         value as ownership_status,
         last_at as ownership_last_at
  from own_tally
  where n >= 3
  order by prop_id, quarter_loc, last_at desc, value asc
),
season_tally as (
  select prop_id, quarter_loc, value,
         count(distinct voter_fingerprint) as n,
         max(created_at) as last_at
  from public.votes
  where category = 'season'
  group by prop_id, quarter_loc, value
),
season_pick as (
  select distinct on (prop_id, quarter_loc)
         prop_id, quarter_loc,
         value as season_stage,
         last_at as season_last_at
  from season_tally
  where n >= 3
  order by prop_id, quarter_loc,
           case value
             when 'harvested' then 0
             when 'sprayed'   then 1
             when 'seeded'    then 2
             else 3
           end
)
select
  coalesce(o.prop_id, s.prop_id) as prop_id,
  coalesce(o.quarter_loc, s.quarter_loc) as quarter_loc,
  coalesce(o.ownership_status, 'unknown') as ownership_status,
  o.ownership_last_at,
  coalesce(s.season_stage, 'unworked') as season_stage,
  s.season_last_at
from own_pick o
full outer join season_pick s using (prop_id, quarter_loc);

grant select on public.quarter_current_state to anon;

-- 2. Replace submit_vote with progression-guarded version ----------------

create or replace function public.submit_vote(
  p_prop_id text,
  p_quarter_loc text,
  p_category text,
  p_value text,
  p_note text default null,
  p_voter_fingerprint text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop_id text := nullif(btrim(p_prop_id), '');
  v_quarter_loc text := nullif(btrim(p_quarter_loc), '');
  v_category text := nullif(btrim(p_category), '');
  v_value text := nullif(btrim(p_value), '');
  v_note text := nullif(btrim(p_note), '');
  v_fingerprint text := nullif(btrim(p_voter_fingerprint), '');
begin
  if v_prop_id is null then
    raise exception 'prop_id required';
  end if;

  if v_quarter_loc is null then
    raise exception 'quarter_loc required';
  end if;

  if v_category not in ('ownership', 'listing', 'season') then
    raise exception 'invalid category';
  end if;

  if v_value is null then
    raise exception 'value required';
  end if;

  if v_fingerprint is null then
    raise exception 'voter_fingerprint required';
  end if;

  if v_category = 'ownership' and v_value not in ('owned-monette', 'rented-monette', 'sold', 'returned-to-ll', 'unknown') then
    raise exception 'invalid ownership value';
  end if;

  if v_category = 'listing' and v_value not in ('not-listed', 'listed-for-sale', 'listed-for-rent') then
    raise exception 'invalid listing value';
  end if;

  if v_category = 'season' and v_value not in ('seeded', 'sprayed', 'harvested') then
    raise exception 'invalid season value';
  end if;

  -- NEW: progression guard. Sprayed and harvested require prior seeded.
  if v_category = 'season' and v_value in ('sprayed', 'harvested') then
    if not exists (
      select 1 from public.votes
      where prop_id = v_prop_id
        and quarter_loc = v_quarter_loc
        and category = 'season'
        and value = 'seeded'
    ) then
      raise exception 'progression: % requires a prior seeded vote on this quarter', v_value;
    end if;
  end if;

  if v_category in ('ownership', 'listing') then
    insert into public.votes (
      prop_id,
      quarter_loc,
      category,
      value,
      voter_fingerprint,
      note
    )
    values (
      v_prop_id,
      v_quarter_loc,
      v_category,
      v_value,
      v_fingerprint,
      v_note
    )
    on conflict (prop_id, quarter_loc, category, voter_fingerprint)
      where category in ('ownership', 'listing')
    do update
      set value = excluded.value,
          note = excluded.note,
          created_at = now();
    return;
  end if;

  insert into public.votes (
    prop_id,
    quarter_loc,
    category,
    value,
    voter_fingerprint,
    note
  )
  values (
    v_prop_id,
    v_quarter_loc,
    v_category,
    v_value,
    v_fingerprint,
    v_note
  )
  on conflict (prop_id, quarter_loc, category, value, voter_fingerprint)
    where category = 'season'
  do nothing;
end;
$$;

revoke all on function public.submit_vote(text, text, text, text, text, text) from public;
grant execute on function public.submit_vote(text, text, text, text, text, text) to anon;

-- Re-grant for parity with the baseline migration (20260423003000). Already
-- granted in 20260422000000_init.sql, so this is a no-op, but keeping it makes
-- the diff against the baseline read cleanly.
grant select on public.vote_tallies to anon;
