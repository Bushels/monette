-- Clear pre-launch/test vote noise from the public launch feed.
-- Scope is deliberately narrow: one Hafford quarter used during smoke testing
-- before the April 23 public vote-feed review.

delete from public.votes
where prop_id = 'hafford'
  and quarter_loc = 'SW-12-48-8-W3'
  and created_at < timestamptz '2026-04-23 00:00:00+00';
