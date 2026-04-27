-- One-off reset before the public launch on monette.buperac.com.
-- Wipes the smoke-test vote inserted during Supabase wiring so the
-- community starts from a clean slate with zero counts everywhere.
truncate table public.votes;
