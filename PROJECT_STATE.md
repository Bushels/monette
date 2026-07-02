# PROJECT_STATE.md

## Active task
**DONE (2026-07-02): Official SISP "for sale" layer.** Added the FTI Consulting SISP
land-sale listings to the public atlas as an authoritative for-sale overlay.
Built + browser-verified + deployed to production (`vercel --prod`, custom domain
https://monette.buperac.com). The dormant Layer-2 listing overlay is now data-driven.

Shape: `window.MONETTE_DATA.sisp` (global: monitor, milestones, appraisals, broker
roster) + `window.MONETTE_DATA.sispByProperty` (per-id map, 30 entries) in data.js.
`seedQuarter()` lights `listed-for-sale` on OWNED quarters of listed/likely props
(confirmed=solid pill, likely=provisional dashed pill). New always-on gold map
outline layer `monette-parcel-forsale-outline` (view-map.jsx). Per-property SISP
detail block in property-drawer.jsx (broker, price, links, bid deadline, source).

Tiers: 15 `listed` (confirmed) · 11 `likely` · 2 `retained` (AB) · 1 `excluded`
(Regina) · 1 `unknown` (Outlook Seeds). US (Premier MT $96M portfolio + camps,
Clark CO Genoa $9.34M, Southwest AZ Aguila $22M + Tonopah $10M) are public listings
with prices; SK/MB are broker-direct/data-room-gated (Hammond lead + Sutton-Harrison
Eddystone + Royal LePage The Pas). Sources: FTI SISP page + Teaser + Monitor Second
Report + engaged brokers.

**Codex review round 1 (gpt-5.5/xhigh) → BLOCKER, fixed same day:** per-parcel
"for sale" outlines now require SOURCE-BACKED tenure (owner-table hit or real
parcel `q.owner` field); dominant-inference / hash-fallback / synthetic parcels
never light. Also: `q.owner` ownership branch (MT 220 parcels now pill correctly),
genoa 7,051-vs-4,079 divergence disclosed, hafford `residual` banner, href scheme
guard, defensive date parse. "For sale" count: 809 quarters (365 solid + 444
provisional), browser-verified; eddystone/raymore/the-pas intentionally 0 on map
(notes in their SISP blocks). Redeployed to production post-fix.

## Known blockers
1. **swift-current + the-pas** are confirmed-listed but have NO real quarter
   geometry (the-pas is synthetic samples), so they show the drawer SISP block but
   don't paint on the map (known parcel-pipeline gap, pre-existing).
2. **BC broker not yet named** (FTI page "Coming Soon", listings slated ~week of
   July 6, 2026). `bc-ranches` + `goats-peak` are `likely` until BC goes live —
   re-check the FTI SISP page after ~July 6 and upgrade to `listed`.
3. **eddystone quarter-owners table is broken** (pre-existing, surfaced by the
   Codex review): keys don't match parcel loc format AND only Monette rows were
   loaded (totals show a single owner despite ~62% third-party acres) — so every
   parcel falls through to dominant-owner inference. Ownership pills there are
   inference, not evidence, and no SISP outlines can light. Fix = rebuild
   quarter-owners.js eddystone map from the XLSX with matching loc keys.
4. **raymore has no quarter-owners table** (122 parcels) — same consequence.

## Next action
1. DONE 2026-07-02: Codex review (2 rounds, gpt-5.5/xhigh) → GREENLIGHT after
   evidence-gate fix. Committed + pushed as 99b3fb1 (snow-watcher landing) +
   e5a9939 (SISP layer) on feat/seeding-calibration.
2. Re-check FTI SISP page ~July 6 for the named BC broker + BC listings;
   upgrade bc-ranches/goats-peak to `listed` when live.
3. Fix the eddystone quarter-owners table (blocker #3) so its parcels can
   carry evidence-backed pills + SISP outlines; source a raymore owner table.
4. Branch hygiene (separate pass): main is 65 files behind feat/seeding-
   calibration; production content lives on feat. Merge feat → main when ready.
5. Remaining untracked strays pending their own land/shelve/delete decisions:
   dust_aod_map.py + dust_goes_animation.py, docs/logs/sk-titles/, 2 docs plans.

## Parked (prior task — GEE seeding calibration, May 2026)
GEE per-property seeding pipeline (scripts/gee_pipeline/*, imagery-data.js) — last
active commit 2632275 on `feat/seeding-calibration`. Northern SK/MB baseline window
was ERA5-calendar-blocked pending ~May 21 publish. See docs/logs/seeding-calibration.md.
