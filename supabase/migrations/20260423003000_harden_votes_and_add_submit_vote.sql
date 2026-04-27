-- Lock down raw vote rows and force anon clients through a single RPC.
-- The public site only needs aggregate tallies plus insert/change semantics
-- for one visitor's own vote. Raw select/update on public.votes is not needed.

drop policy if exists "anon_read_votes" on public.votes;
drop policy if exists "anon_insert_votes" on public.votes;
drop policy if exists "anon_update_votes" on public.votes;

revoke all on table public.votes from anon;

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
grant select on public.vote_tallies to anon;
