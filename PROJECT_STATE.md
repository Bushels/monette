# PROJECT_STATE.md

## Last verified lineages before production merge
- `main`: `ef564d4` — Montana May 6 rerun, Codex audit, and research references.
- `feat/seeding-calibration`: `327da86` — current Hammond asking prices and Atlas sales UX.

## Active task
**DONE (2026-07-14): Full `feat/seeding-calibration` integration into `main`.**
The complete feature lineage is merged into the production branch, including the
GEE seeding-calibration work, snow watcher, official SISP layer, evidence-gated
for-sale outlines, and the current Hammond Realty public asking-price refresh.

## Current public Atlas state
- Atlas is the homepage. The retired Register route redirects to `#map`.
- Hovering a publicly priced property shows its asking price; clicking opens the
  full package breakdown and broker links.
- The top navigation and Atlas toolbar derive their sales totals from the same
  per-property records used by the map and drawer.
- Hammond inventory checked 2026-07-14: 18 farmland packages, 132,019.08 broker-
  listed acres, and $773,851,040 CAD total asking price.
- The separate $10,000,000 Swift Current processing-facility listing is not
  attached to the atlas's 49,775-acre Swift Current land rollup.
- Public binding-bid deadline: 2026-10-15; target closing: 2026-11-30.

## SK Titles shipped state
- 559/559 CSV parcels reconciled (unmatched: 0).
- 1,410 records across 14 SK property buckets carry `mflTitleSnapshot` metadata.
- Swift Current has 28 records; Regina South has 120 records.
- 159 polygons are computed through DLS quarter math, LSD math, and Plan N3619
  placeholders.
- The runtime audit asserts `property_id:loc` uniqueness across all 1,410 rows.
- Farmland-wide marker cleanup remains in place; facility and sold-asset markers
  remain visible.

## SISP evidence rules
- Solid gold outlines require a confirmed listing and source-backed parcel tenure.
- Provisional outlines identify likely in-scope land without a public asking price.
- Dominant-owner inference, hash fallbacks, and synthetic parcels do not receive a
  confirmed for-sale outline.
- Broker acreage and atlas file acreage remain separate wherever they differ.

## Known data gaps
1. Eddystone's quarter-owner keys do not match parcel locations and the source
   table is incomplete; its parcels cannot carry evidence-backed SISP outlines.
2. Raymore has no quarter-owner table, so its public package prices are shown at
   property level without quarter-specific sale outlines.
3. Several point-only or synthetic properties still need defensible parcel geometry.

## Working-tree exclusions
The existing untracked SK-title log directory, two planning documents, and two dust
visualization scripts were not included in this production merge.

## Next action
Confirm the production deployment from `main` and visually smoke-test the public
domain after the host finishes building.
