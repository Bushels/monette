# Seeding Calibration Log - 2026-04-30

Public rule: show only seeded acres, status, and confidence. Keep method details private.

## Operating Pattern

1. Audit geometry before running GEE.
2. Smoke-test 3 representative quarters.
3. Full-run one property only when the smoke test agrees with current direction.
4. Use `--merge-existing` so property updates do not wipe the rest of `imagery-data.js`.
5. Rebuild and verify served `public/imagery-data.js`.

## Lessons So Far

- Calderbank proved the workflow: clean geometry, full rerun, seeded acres moved from about 161 ac to about 1,117 ac.
- Raymore proved the first false-positive correction: the earlier run showed about 639 likely seeded acres across 4 parcels, but local snow reports exposed a missing active-observation snow/freeze gate.
- Raymore corrected rerun after the snow/freeze gate: 0 likely seeded acres, 120 active parcels, 18,775 active-read acres, 97 parcels / about 15,184 acres confidence-withheld for snow/freeze risk, and 23 parcels / about 3,591 acres with no confident call.
- Green-parcel retest after the snow/freeze gate covered 187 previously green parcels. 166 parcels / about 34,910 acres survived as likely seeded; 15 parcels / about 2,262 acres were confidence-withheld for snow/freeze risk; 6 Montana parcels / about 2,726 acres dropped to no confident call.
- By property on the green-parcel retest: Calderbank held 7/7 green parcels; Vanguard held 46/46; Ponteix held 36/39 with 3 withheld; Prince Albert moved 12/12 to confidence-withheld; Montana held 77/83 with 6 no-call.
- Ponteix is the first strong seeded-area expansion, but the snow/freeze retest reduced the public green count from 39 parcels / about 6,171 ac to 36 parcels / about 5,694 ac. The 3 removed parcels are confidence-withheld, not called unseeded.
- Vanguard produced the strongest clean Saskatchewan signal so far: clean geometry, no low-QC parcels, and the April 30 run moved seeded acres to about 7,258 ac across 46 seeded parcels.
- Hafford is not ready for seeded-acre reporting because fresh smoke tests still return `insufficient_baseline`.
- Progress bars must use active GEE-read acres as the denominator, not total titled acres.
- A property-level rerun must preserve all other property records. `--merge-existing` is now required for scoped reruns.
- Zero-acre source records are acreage-rollup risks even when their geometry and satellite reads are valid.
- The rolling 14-day run window matters. A rerun can change confidence even when the latest radar observation date is still the same.
- Field reports override model confidence when they expose a missing QC condition. High numeric confidence can still be a false positive if snow/frozen surface is not explicitly gated on the active observation date and the local area around the parcel.

## Current Property Order

- Snow-gated green calls currently held: Calderbank (7 parcels / about 1,117 ac), Ponteix (36 parcels / about 5,694 ac), Vanguard (46 parcels / about 7,258 ac), Montana (77 parcels / about 20,841 ac).
- Snow/freeze blocked: Raymore (97 parcels / about 15,184 active-read acres withheld) and Prince Albert (12 parcels / about 1,785 active-read acres withheld). Rerun these first after the next useful thaw/snow-free image window.
- Clean Saskatchewan areas already strong enough to keep watching: Vanguard, Ponteix, Calderbank.
- Needs full calibration review before public confidence: Montana, because it has strong title/geometry sourcing but 66 low-QC imagery records and 6 formerly green parcels dropped to no-call on retest.
- Needs baseline/applicability work before seeded-acre reporting: Hafford, Admiral, Kamsack, Wymark, Eddystone. These currently show no active seeded-acre read.
- Low-priority active watch: Outlook has active read acres but 0 seeded acres and 4 low-QC records.
