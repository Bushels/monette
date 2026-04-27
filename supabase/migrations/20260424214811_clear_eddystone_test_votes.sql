-- Clear internal test votes cast on Eddystone during the 2026-04-24 audit QA.
-- Eddystone was first flagged headline:true on this date after the landowner
-- audit; all votes on this property to date were cast by the ledger team
-- (three entries visible in the live vote feed: NE-12-26-13-W1 seeded,
-- NE-1-26-12-W1 sprayer spotted, NE-1-25-11-W1 harvested). No legitimate
-- community votes on Eddystone exist yet. Safe to truncate the prop.

delete from public.votes where prop_id = 'eddystone';
