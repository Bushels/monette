# Swift Current Narrative

## What Changed

Swift Current moves from a point-only placeholder toward a real parcel layer.

Before this pass, `data.js:806-812` had Swift Current as:

- `parcels: 0`
- `titled: 49775`
- `geometryStatus: "point-only"`
- `tags: ["court-file","origin","needs-geometry"]`

The 2026-01-18 CSV adds concrete title evidence:

- 31 CSV title rows in RM Swift Current 137.
- 14 ADD rows with no current map feature.
- 17 REASSIGN title rows currently filed under Wymark.
- Those 17 REASSIGN rows collapse to 16 unique current Wymark map features.

## Why

`scripts/parse_isc_titles.py:45` maps RM Swift Current 137 to `swift-current` with high confidence and the note that these are Stewart Valley T13 rows. The parsed CSV confirms the Swift Current set is T13/R13-R14/W3.

That is a better property-id assignment than leaving those features in Wymark just because the older Wymark sale-package XLSX included them.

## New ADD Geometry

The 14 ADD rows in `audit-swift-current.md:9-22` are all LSD title rows.

They should be added only after DLS LSD polygon computation:

- Keep `geometry: null` in the proposed delta.
- Use the CSV `loc`, `parcel_no`, `title_number`, `ext`, and `title_text` as source metadata.
- Do not borrow full-quarter Wymark geometry for these.

Two duplicate-location warnings matter:

- `LSD-10-24-13-14-W3` appears twice with different parcel numbers.
- `LSD-15-24-13-14-W3` appears twice with different parcel numbers.

Final application should avoid double-rendering the same polygon unless the map deliberately supports stacked title records.

## Reassigned Geometry

The 17 REASSIGN title rows in `audit-swift-current.md:26-59` currently point to Wymark features.

Clean quarter-level move examples:

- `NE-7-13-13-W3`
- `SE-7-13-13-W3`
- `SE-8-13-13-W3`
- `SW-8-13-13-W3`
- `NW-18-13-14-W3`
- `SW-18-13-14-W3`
- `SE-24-13-14-W3`
- `SE-25-13-14-W3`
- `NE-7-13-14-W3`

Granularity-risk examples:

- `LSD-6-19-13-13-W3` matched current `SW-19-13-13-W3`.
- `LSD-16-13-13-14-W3` matched current `NE-13-13-14-W3`.
- `LSD-10-14-13-14-W3` matched current `NE-14-13-14-W3`.
- `LSD-14-14-13-14-W3` matched current `NW-14-13-14-W3`.
- `LSD-6-14-13-14-W3` matched current `SW-14-13-14-W3`.
- `LSD-16-24-13-14-W3` matched current `NE-24-13-14-W3`.

Those should be recomputed from the CSV legal description before final map application.

## Intel Applied

Swift Current has less property-specific narrative than Wymark in `data.js`. The important existing intel is structural:

- It is a court-file family-origin asset.
- It is point-only and needs geometry.
- The title CSV now gives the first concrete geometry candidates.

No Carefoot/Waldeck sale intel should move to Swift Current just because some Wymark geometry moves. Sale rumors attached to Wymark Excelsior/Waldeck parcels stay in Wymark's flagged knowledge layer.

## Still Uncertain

- The CSV-confirmed 31 title rows do not reconcile the full `data.js:808` 49,775-acre Swift Current claim.
- The point-only court-file total may include other entities, leased land, non-MFL title, or acreage outside this CSV set.
- The final geometry count may be lower than 31 because duplicate legal locations should probably aggregate into one map feature.
- LSD rows need real DLS geometry before public map rendering.

## Bottom Line

Swift Current is ready for a first geometry build, but only as a title-confirmed subset:

- 14 new LSD title rows.
- 16 unique Wymark source features moving in.
- Geometry recomputation required before final public rendering.
- No reduction to the broader 49,775-acre court-file claim until separate evidence reconciles that number.
