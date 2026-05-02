# Codex Post-Merge Audit — SK Titles + atlas-hide-property-markers

## Verdict

SHIPPED-WITH-FOLLOW-UPS.

The SK title fixes are mostly clean: `data.js` and `quarters-data.js` parse, the 12 SK title snapshot totals match the live quarter arrays, the 8 pre-fix `(loc, rm)` duplicate groups collapsed from 17 records to 8 records with no CSV title metadata dropped, and the marker-hide implementation is architecturally consistent.

Not `SHIPPED-CLEAN` because the renderer-risk invariant is stricter than the fix: `view-map.jsx` keys parcel identity as `property_id:loc`, and post-merge `vanguard` still has 2 duplicate `property_id:loc` groups. One is the exact round-2 `SE-6-12-12-W3` location, now deduped within `(loc, rm)` but still colliding at runtime because another Vanguard record has the same `loc`.

## Round-2 fix verification

### BLOCKER 1 - Duplicate same-loc ADD records

Partially resolved.

- Current `(loc, rm)` duplicate groups in `quarters-data.js`: `0`.
- Pre-fix duplicate groups from `64d2e91^`: `8`.
- Pre-fix duplicate records: `17`.
- Post-fix records for those same `(loc, rm)` groups: `8`.
- Dropped duplicate records: `9`, matching the intended 6 Regina South + 2 Swift Current + 1 Vanguard drop.
- Canonical selection matched the stated rule for all 8 groups: geometry-bearing record preserved, expected top-level parcel number retained, and all prior CSV match rows preserved.
- Merged CSV match check: every group had `missing_csv_match_count: 0`.

Collapsed groups verified:

| Property | Location | Before | After | CSV matches preserved |
|---|---:|---:|---:|---:|
| `regina-south` | `NE-34-15-18-W2` | 2 | 1 | 2/2 |
| `regina-south` | `SE-35-15-18-W2` | 2 | 1 | 2/2 |
| `regina-south` | `NE-3-16-18-W2` | 2 | 1 | 2/2 |
| `regina-south` | `NW-3-16-18-W2` | 2 | 1 | 2/2 |
| `regina-south` | `SE-3-16-18-W2` | 3 | 1 | 3/3 |
| `swift-current` | `LSD-10-24-13-14-W3` | 2 | 1 | 2/2 |
| `swift-current` | `LSD-15-24-13-14-W3` | 2 | 1 | 2/2 |
| `vanguard` | `SE-6-12-12-W3` / `VILLAGE OF NEVILLE` | 2 | 1 | 2/2 |

Remaining renderer-key duplicates:

| Property | `loc` | Top-level parcel numbers | Max geometry coord diff | Why it matters |
|---|---|---:|---:|---|
| `vanguard` | `SW-31-11-12-W3` | `143506021`, `143344469` | `4.1e-7` | Both render as `vanguard:SW-31-11-12-W3`. |
| `vanguard` | `SE-6-12-12-W3` | `143320384`, `151624166` | `4.1e-7` | This is still a `property_id:loc` collision after the `(loc, rm)` fix. |

This is the only material follow-up. The dedup script fixed the stated `(loc, rm)` problem, but the actual runtime key in `view-map.jsx` is `property_id:loc` (`imageryKey(propId, loc)` and parcel feature `properties.id`). Future dedup needs to validate that key directly, or the renderer needs a parcel-number-aware feature id.

### BLOCKER 2 - Swift Current + Regina South stale point-only status

Resolved.

- `swift-current`: `parcels:28`, `mflTitleSnapshot.totalRecords:28`, `quarters-data.js` rows: `28`, geometry rows: `28`, null geometry rows: `0`.
- `swift-current` now has `geometryStatus:"polygons"`, `locationPrecision:"parcel"`, and tags `["court-file","origin","mfl-csv-2026-01-18"]`.
- `regina-south`: `parcels:120`, `mflTitleSnapshot.totalRecords:120`, `quarters-data.js` rows: `120`, geometry rows: `120`, null geometry rows: `0`.
- `regina-south` now has `geometryStatus:"polygons"`, `locationPrecision:"parcel"`, and no `needs-geometry` tag.

The copy is accurate and does not overclaim. Both records explicitly distinguish the court-file headline acre claim from the narrower 2026-01-18 MFL title-anchor subset.

### SHOULD-FIX 1 - Phase 4 stale significance prose

Resolved, with one acceptable caveat.

- No `mflTitleSnapshot.significance` field contains stale `geometry pending Phase 4`, `to be computed`, or `TBD` language.
- The word `pending` remains in three legitimate places:
  - `calderbank`: one planned parcel pending cadastral data.
  - `vanguard`: one planned parcel pending cadastral data.
  - `wymark`: sale-status flags pending fresh ISC pulls.

Those are current-state caveats, not stale Phase 4 prose.

### SHOULD-FIX 2 - Planned-parcel `geometry_action` mismatch

Resolved for the two null planned parcels.

- Null geometry records in `quarters-data.js`: `2`.
- `calderbank` `BLK-A-PLAN-101641991` / parcel `151739321`: `geometry_action:"planned_parcel_cadastral_pending"`.
- `vanguard` `BLK-B-PLAN-101658124` / parcel `150833482`: `geometry_action:"planned_parcel_cadastral_pending"`.
- Renderer safety remains intact: `quarterGeojsonFromRealData()` skips rows with no `geometry`.

Caveat: `compute_quarter_polygon_from_dls` still appears on 131 geometry-bearing records: 119 Regina South quarters, 2 Vanguard quarters, and 10 Vanguard town-lot placeholders. The quarter records are legitimate. The 10 `LOT-...-PLAN-N3619` records are not null and do render, but their metadata still reads like quarter-DLS math; low-priority cleanup if metadata precision matters.

## Atlas marker-hide review

Architecturally sound, with one expected behavior tradeoff.

- `hideMapMarker:true` is present on exactly the five intended Montana sub-properties:
  - `mt-fly-creek`
  - `mt-st-xavier-camp4`
  - `mt-nieden-camp1`
  - `mt-ragland`
  - `mt-ragland-camp1`
- No unexpected `properties[]` records have `hideMapMarker:true`.
- Controls kept their markers: `bc-ranches`, `aguila`, `genoa`, `outlook-seeds`, `goats-peak`, `lethbridge-pea-protein`, and `tonopah` all have `hideMapMarker:false`.
- `index.html` cache-bust is bumped to `data.js?v=37`.
- `view-map.jsx` suppresses both circle and label feature emission in the point-only branch, and suppresses label feature emission in the polygon-mapped branch. This mirrors the sold-asset marker filter pattern.

Side effects:

- Hidden Montana sub-properties no longer have `PROPERTY_POINT_LAYER` hover/click targets because those point features are not emitted. That is consistent with hiding the markers.
- Left-rail navigation and direct property routes still open/focus those sub-properties using their `lat/lng`.
- Montana parcel polygons remain under the parent `montana` quarter data, so clicking a parcel polygon selects/routes to `montana`, not the five child property ids. That was already the data model; the marker-hide change just removes the redundant child point click target.
- If child-level map-click selection matters later, add invisible hit targets or split Montana parcel ownership by child property id. Do not bring the visible pins back unless the UX goal changes.

## Post-merge state integrity

Checks run:

- `git branch --show-current` -> `main`.
- `git rev-parse --short HEAD` -> `8a6b42a`.
- `node --check data.js` -> passed.
- `node --check quarters-data.js` -> passed.
- Read-only VM load of `window.MONETTE_DATA` and `window.MONETTE_QUARTERS_REAL` -> passed.
- Did not run `npm run build`.
- Did not run `scripts/audit_isc_vs_quarters.py` directly because it writes generated audit docs; used a read-only harness against `docs/logs/sk-titles/parsed.json` and current `quarters-data.js`.

Loaded object integrity:

- `MONETTE_QUARTERS_REAL` property keys: `16`.
- Total quarter records loaded: `1412`.
- Quarter keys missing from `data.js`: `0`.
- SK title snapshot properties: `12`.
- `data.js parcels == quarters-data.js row count == mflTitleSnapshot.totalRecords` for all 12 SK title snapshot properties.

SK snapshot counts verified:

| Property | `data.js parcels` | `quarters-data.js` rows | `mflTitleSnapshot.totalRecords` |
|---|---:|---:|---:|
| `admiral` | 15 | 15 | 15 |
| `calderbank` | 113 | 113 | 113 |
| `hafford` | 158 | 158 | 158 |
| `kamsack` | 81 | 81 | 81 |
| `outlook` | 24 | 24 | 24 |
| `ponteix` | 130 | 130 | 130 |
| `prince-albert` | 20 | 20 | 20 |
| `raymore` | 121 | 121 | 121 |
| `vanguard` | 107 | 107 | 107 |
| `wymark` | 85 | 85 | 85 |
| `swift-current` | 28 | 28 | 28 |
| `regina-south` | 120 | 120 | 120 |

Read-only audit math:

- Parsed unique surface parcels: `559`.
- Matched by top-level `parcel_no`: `512`.
- Matched by `(loc, rm)` only: `47`.
- Unmatched: `0`.

The old round-2 split was `521` parcel-number matches and `38` loc/rm-only matches. The 9-record shift is expected after dedup because 9 former top-level parcel numbers now live inside merged `reconciliation.csv_matches` arrays rather than as top-level `parcel_no` values. The reconciliation still lands at `559/559` with `unmatched:0`.

Non-SK regression check:

- Compared `2a2a28a` to `HEAD` for `quarters-data.js` keys `montana`, `eddystone`, `aguila`, and `genoa`.
- Counts are unchanged and JSON is identical for all four keys:
  - `montana`: `220 -> 220`
  - `eddystone`: `165 -> 165`
  - `aguila`: `23 -> 23`
  - `genoa`: `2 -> 2`
- Non-SK `data.js` changes are limited to the five intended Montana `hideMapMarker:true` flags.

Production readiness:

- No parse blocker.
- No cache-bust blocker.
- Null geometries are limited to the two planned parcels and are skipped before GeoJSON creation.
- Public copy for Swift Current and Regina South is materially better than round-2 and correctly avoids reconciling the full court-file acreage claims from the title snapshot subset.
- Remaining public/render risk is the two Vanguard duplicate `property_id:loc` groups. They are not a hard page-load failure, but they are exactly the kind of stacked-feature/key-collision issue this review process was meant to catch.

## Follow-ups (not blocking, since shipped)

1. Fix the residual Vanguard duplicate renderer keys.
   - Either collapse duplicate `property_id:loc` rows into one map feature with merged `csv_matches`, or deliberately change the renderer identity to include `parcel_no`.
   - Do not stop at `(loc, rm)` uniqueness; assert `property_id:loc` uniqueness unless an explicit `stackedTitleRecords:true` model exists.
   - Specific rows to review: `vanguard:SW-31-11-12-W3` and `vanguard:SE-6-12-12-W3`.

2. Add a no-write audit mode.
   - `scripts/audit_isc_vs_quarters.py` should support a read-only summary mode for release gates.
   - It should also index merged `reconciliation.csv_matches` so deduped parcel numbers do not look like loc/rm-only matches.

3. Add a duplicate-feature invariant to the review script.
   - Fail on duplicate `property_id:loc` rows with near-identical geometry.
   - Allow exceptions only with an explicit stacked-title model and drawer behavior.

4. Optional metadata cleanup.
   - Rename the 10 Vanguard `LOT-...-PLAN-N3619` `geometry_action:"compute_quarter_polygon_from_dls"` values to a town-lot placeholder action if the metadata is used for future automation.

5. Optional UX follow-up for Montana child selection.
   - Current marker-hide behavior is acceptable, but it intentionally removes child point hover/click targets. If child-level map clicks matter, implement invisible hit targets or child-owned parcel features rather than restoring visible markers.

## Closing note

Methodology drift across the three Codex passes:

- Round 1 established the durable rule: title rows are not map features. Wymark and Swift Current proved that parcel/title exports collapse through legal-location features, duplicate extensions, and reassign boundaries.
- Round 2 found the production-facing failure mode: data could reconcile `559/559` and still be wrong in the renderer because `view-map.jsx` keys UI state by `property_id:loc`.
- This post-merge pass confirms the main fix worked for `(loc, rm)` duplicates and stale copy, but also proves the final invariant has to match the runtime identity, not the reconciliation script identity.

Future title-export waves should close with four assertions before merge: `unmatched:0`, `data.js` totals match quarter rows, no stale public status prose, and no duplicate runtime feature keys. The last one is the lesson that cost us this follow-up.
