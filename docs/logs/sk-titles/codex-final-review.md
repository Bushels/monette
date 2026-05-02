# Codex Final Review — SK Titles Update

## Verdict

NEEDS-FIXES. The branch is structurally close: branch is `feat/sk-titles-2026-01-18`, the live range contains 13 commits, the title audit reconciles 559/559 CSV parcels with `unmatched: 0`, the three cross-property reassign paths preserve parcel ownership without cross-property duplication, `data.js` parses, and the LSD snake math is correct. I would not merge yet because the mechanical ADD path still creates overlapping same-geometry map features for duplicate legal locations, and the post-Phase-4 knowledge layer still tells the public that newly mapped Swift Current / Regina South geometry is point-only or pending.

## Methodology fidelity

Mostly faithful for KEEP / FLAG / REASSIGN, incomplete for ADD.

- The generator and applier preserve the core decision tree: CSV anchor truth, no delete path, full target-state replacement, `reassign_out` skipped on source, `reassign_in` applied on target.
- Duplicate-title collapse works for existing current features. Examples: Wymark 22 title rows collapse to 19 map features; Calderbank 141 title rows collapse to 113 final rows after 3 ADDs; NW-7-13-14-W3 under Swift Current carries 2 CSV parcel numbers on 1 current feature.
- Wymark bespoke FLAG taxonomy is correct in final data, despite the review brief's warning. Final Wymark FLAGs include `sold_rumor_carefoot_waldeck:5` and `feedlot_proposal_title_gap:4`, plus the RM-based subtypes.
- Drift: `build_deltas_from_audit.py` groups KEEP rows by parcel/location but builds ADD rows one-for-one from audit ADD rows. That misses the round-1 "title rows != map features" rule for new records.
- Final duplicate same-location ADD groups, all with identical geometry:
  - `regina-south`: `NE-3-16-18-W2` x2, `NW-3-16-18-W2` x2, `SE-3-16-18-W2` x3, `NE-34-15-18-W2` x2, `SE-35-15-18-W2` x2.
  - `swift-current`: `LSD-10-24-13-14-W3` x2, `LSD-15-24-13-14-W3` x2.
  - `vanguard`: `SE-6-12-12-W3` x2.
- This creates 8 duplicate legal-location groups and 9 extra rendered rows unless the product explicitly wants one feature per title parcel. Current renderer keys parcel state as `property_id:loc`, so these stacked rows collide in UI/state terms.

## Cross-property reassign correctness

The reassigns are clean as property moves.

- Wymark -> Swift Current: final `wymark` has 85 rows (`19 KEEP + 66 FLAG`) and final `swift-current` has 30 rows (`16 REASSIGN_IN + 14 ADD`). The 16 moved records are not still present under Wymark.
- Raymore -> Regina South: parcel `SW-31-25-19-W2` / `108266823` is no longer in `raymore` and is present under `regina-south`. Later full-state regeneration converted its final reconciliation bucket to `KEEP`, but the move itself is preserved.
- Vanguard -> `__neville__` -> Vanguard: final `quarters-data.js` has no `__neville__` key and `vanguard` has 108 rows. The fold succeeded.
- Cross-property duplicate check found no duplicate parcel numbers introduced by this branch's reassigns. The only duplicate parcel number in the whole quarters file is an existing Genoa split (`258118300114`) inside Genoa.
- Apply idempotency is sound for a given delta file because arrays are replaced wholesale from `keep + flag + add + reassign_in`, not appended.

## Phase 3 surgery audit

The numeric surgery is correct; the public/status prose is stale after Phase 4.

- `node --check data.js` passes.
- All 12 affected SK properties carry `mflTitleSnapshot`.
- For all 12 affected properties, `data.js parcels` equals `quarters[pid].length`, and `mflTitledRecords + flaggedRecords == totalRecords`.
- Verified snapshot totals:
  - `admiral` 15 total / 2 titled / 13 flagged.
  - `calderbank` 113 / 113 / 0.
  - `hafford` 158 / 2 / 156.
  - `kamsack` 81 / 39 / 42.
  - `outlook` 24 / 10 / 14.
  - `ponteix` 130 / 85 / 45.
  - `prince-albert` 20 / 12 / 8.
  - `raymore` 121 / 4 / 117.
  - `regina-south` 126 / 126 / 0.
  - `swift-current` 30 / 30 / 0.
  - `vanguard` 108 / 80 / 28.
  - `wymark` 85 / 19 / 66.
- Hafford carries the Walter Farms / rented-back significance prose and the int-RM defensive subtypes (`rm_no_436_*`, etc.). That does not appear to be rendered publicly today, so the ugly subtype strings are not a merge blocker.
- Merge fix needed: `swift-current` and `regina-south` still have `geometryStatus:"point-only"` and `needs-geometry` tags even though they now have parcel polygons. Their significance text still says geometry is pending Phase 4. `calderbank` and `vanguard` significance text also says ADD geometry is pending after Phase 4 has run.

## Polygon math correctness

The DLS math is good; the remaining nulls are intentional but metadata is imprecise.

- Quarter math in `compute_sk_titles_polygons.py` mirrors `build_quarters_geojson.py`: same meridian constants, baseline latitude, section snake, quarter offsets, and longitude scaling.
- LSD math passes the required pressure test:
  - `LSD-1` maps to south row / east column: SE corner.
  - `LSD-16` maps to north row / east column: NE corner.
  - `LSDs 1-4` run east to west on the south edge.
  - `LSDs 13-16` run west to east on the north edge.
- Phase 4 left exactly 2 null-geometry records:
  - `calderbank`: `BLK-A-PLAN-101641991`, parcel `151739321`.
  - `vanguard`: `BLK-B-PLAN-101658124`, parcel `150833482`.
- The renderer skips null geometry before GeoJSON creation (`if (!row || !row.loc || !row.geometry) return`), so those two records will not render. That behavior is correct.
- Minor fix: those planned-parcel records still say `geometry_action:"compute_quarter_polygon_from_dls"`. That should be renamed to a planned-parcel/cadastral-pending action so the metadata does not tell the next agent to run quarter math on a non-quarter.

## Audit script coherence

The audit script is coherent for the title-vs-current reconciliation, but it does not catch duplicate ADD geometry.

- I did not run `scripts/audit_isc_vs_quarters.py` directly because it writes `audit.json`, `audit-summary.md`, and per-property audit docs; the brief also said no source edits other than this review. I re-ran the same audit logic read-only in Node.
- Read-only audit result:
  - CSV parcels total: 559.
  - Matched by parcel number: 521.
  - Matched by `(loc, rm)` only: 38.
  - Unmatched: 0.
- Final per-property audit output matches the branch story: no final ADD / REASSIGN buckets from the audit's current-state perspective, because applied records now exist under their target properties.
- The `reassign_out` logic correctly distinguishes "claimed by another property's CSV" from true FLAG by indexing other-property CSV parcel numbers and `(loc, rm)` keys.
- Limitation: unique feature counts use object identity for current records. Once duplicate ADD rows are written as separate objects with the same `loc`, same `rm`, and same polygon, the audit treats them as distinct features. Add a duplicate `property_id:loc` / same-geometry guard.

## Open risks for merge

- NEEDS-FIX: Duplicate same-location ADD records create overlapping polygons and duplicate `property_id:loc` UI keys. Collapse them into one map feature with multiple CSV title matches, or explicitly change the renderer/data model to support stacked title parcels by including `parcel_no` in the feature key and drawer identity.
- NEEDS-FIX: `data.js` still advertises Swift Current and Regina South as point-only / needs-geometry after Phase 4. This is exactly the public-facing credibility problem the branch is supposed to solve.
- SHOULD-FIX: Phase 3 significance text says geometry is pending for Swift Current, Regina South, Calderbank, and Vanguard. Update those notes to post-Phase-4 truth and call out the two planned-parcel skips separately.
- SHOULD-FIX: planned-parcel leftovers are intentional, but their `geometry_action` value is wrong. Rename away from quarter DLS math.
- NON-BLOCKING: Hafford int-RM subtypes are defensible internally but ugly. If `flagSubtypes` gets rendered later, map `rm_no_436` / `rm_no_437` back to public RM names.

## Recommendations for follow-up (post-merge)

- Add a CI or review-time data assertion: no duplicate `property_id:loc` records with identical geometry unless an explicit `stackedTitleRecords:true` field exists.
- Add a read-only audit mode to `scripts/audit_isc_vs_quarters.py` so final reviewers can re-run the audit without touching generated docs.
- Add a Phase 4 close script that updates property-level `geometryStatus`, tags, and `mflTitleSnapshot.significance` after polygon computation.
- Replace Neville Plan N3619 placeholders with true cadastral geometry when SAMA/ISC plan geometry is available.
- Keep the Hafford / Walter Farms wording under public-copy review. The title snapshot strongly supports "not MFL-titled as of 2026-01-18"; it does not independently prove Walter Farms title transfer.
