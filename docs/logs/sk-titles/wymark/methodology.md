# Wymark + Swift Current Reconciliation Methodology

Snapshot: 2026-01-18  
Worked example scope: `wymark` plus `swift-current` only  
Output artifact: `docs/logs/sk-titles/wymark/proposed-deltas.json`

## Decision Tree

Use the CSV as title-owner anchor truth for MONETTE FARMS LTD. as of 2026-01-18.

1. For every CSV row, find the current map match by `parcel_no` first, then `(loc, rm)`.
2. If CSV row matches current parcel under the same property, put it in `keep`.
3. If CSV row has no current match, put it in `add` and set geometry to pending pipeline computation.
4. If CSV row matches a current parcel under another property, put it in `reassign_in` for the CSV property and `reassign_out` for the source property.
5. For every current parcel not confirmed by that property's CSV rows, keep it on the map and put it in `flag`.
6. Leave `remove` empty unless a later sign-off explicitly authorizes deletion.

For this pair:

- Wymark: 22 CSV title rows became 19 unique `keep` map features.
- Wymark: 82 audit flags split into 16 unique `reassign_out` features plus 66 true follow-up flags.
- Swift Current: 14 net-new CSV rows became `add`.
- Swift Current: 17 REASSIGN title rows became 16 unique `reassign_in` features because `NW-7-13-14-W3` has two title rows for one current map feature.

## ADD

ADD means CSV says MFL title exists and no matching current map feature exists.

Required handling:

- Build a schema-compatible proposed record with `loc`, `parcel_no`, `rm`, `ac`, `soil`, `assessment`, `geometry`, `title`, `source`, and `owner`.
- Set `owner` to `MONETTE FARMS LTD.`.
- Set `geometry` to `null` until the DLS pipeline computes the polygon.
- Set `ac` from CSV estimate only as a placeholder.
- Preserve `title_number`, `ext`, `csv_source`, and `title_text` in reconciliation metadata.

Swift Current example:

- `audit-swift-current.md:9-22` lists 14 ADD rows.
- All 14 are LSD rows in RM Swift Current 137.
- `LSD-10-24-13-14-W3` and `LSD-15-24-13-14-W3` each appear twice with different parcel numbers. Do not double-render without confirming whether the runtime should show stacked title records or one aggregated map feature.

## KEEP

KEEP means CSV and current map agree on the property.

Required handling:

- Keep the current geometry and current property id.
- Mark the feature `mfl_titled_verified_at_snapshot`.
- Attach every CSV title row that confirms the same current map feature.
- Do not duplicate the feature just because multiple title rows point to one legal location.

Wymark example:

- `audit-wymark.md:92-115` lists 22 KEEP title rows.
- These collapse to 19 unique map features.
- The confirmed Wymark CSV rows are all RM Lac Pelletier 107, concentrated in T11/R13-R14/W3.

## REASSIGN

REASSIGN means CSV says the parcel belongs under property A, but current map stores it under property B.

Required handling:

- Add the current feature to `reassign_out` under the source property.
- Add the corresponding target feature to `reassign_in` under the CSV property.
- Preserve source property id, target property id, current parcel object, and CSV matches.
- Do not drop knowledge-layer metadata just because the property bucket changes.
- If CSV granularity differs from current geometry, recompute geometry before final apply.

Swift Current/Wymark example:

- `audit-swift-current.md:24-59` lists 17 title rows currently filed under `wymark`.
- Those 17 rows are 16 unique current Wymark features.
- `NW-7-13-14-W3` has two CSV parcel numbers, `144531996` and `144589168`, pointing to one current Wymark feature.
- Several REASSIGN rows are LSD-level CSV rows matched to quarter-level or partial-quarter Wymark records. Do not move the old polygon as final truth without recomputing the DLS LSD geometry.

## LSD Granularity

LSD means Legal Subdivision, a 40-acre Dominion Land Survey subunit.

Decision rules:

- If CSV row is LSD and current map has no feature, create an ADD record with `geometry: null` and `geometry_action: compute_lsd_polygon_from_dls`.
- If CSV row is LSD and current map has a quarter feature, do not assume the quarter polygon is correct.
- If four LSDs form a quarter, aggregate only after verifying all four title rows and parcel numbers.
- If multiple parcel numbers share one `loc`, keep all title metadata but avoid accidental overlapping duplicate polygons.

Worked examples:

- Section 13-13-14-W3 has multiple Swift Current LSD title rows; one was matched through current Wymark parcel `150531612`.
- Section 24-13-14-W3 has duplicate ADD title rows for the same LSD locations.
- `scripts/parse_isc_titles.py:94-109` estimates LSD acres as 40, but that is a placeholder, not final SAMA acreage.

## Cross-Reference Workflow

When `docs/Land/<Property>.xlsx` exists:

1. Count data rows, unique legal locations, and unique parcel numbers.
2. Check whether the map pipeline collapses title rows into fewer geometry features.
3. Pull row-level evidence for major reassignments, sale rumors, buildings, and acreage conflicts.
4. Use XLSX acreage/assessment/soil as context, not as title-owner truth when CSV disagrees.

For Wymark:

- `Wymark.xlsx` sheet `1-Wymark` has 131 data rows, 101 unique legal locations, and 14,943.03 titled acres.
- RM split in the XLSX is 67 rows RM Swift Current 137, 55 rows RM Lac Pelletier 107, 6 rows RM Excelsior 166, and 3 rows RM Coulee 136.
- Carefoot/Waldeck rows are `Wymark.xlsx` rows 115-120.
- Section 18 feedlot-proposal rows are `Wymark.xlsx` rows 70-71 and 94-95.

When `docs/Land/<Property>.pdf` exists:

- Use it for infrastructure and tender-context evidence.
- Do not use it to override CSV title ownership without title history.
- Cite page/location labels where possible.

For Wymark:

- `Wymark.pdf` page 4 lists Location No. 13, `NW-17-16-12-W3`, Waldeck Lot, including grain storage, fertilizer storage, shops, office, and feedlot/winter feeding.
- `Wymark.pdf` page 6 lists Location No. 19, `SE-18-12-14-W3`, Lac Pelletier/Pelletier Lot, including feedlot/winter feeding.

## Knowledge Layer

Separate geometry/title reconciliation from public-context intel.

Geometry/title layer:

- CSV confirms MFL title as of 2026-01-18.
- Current map geometry gives existing polygon context.
- XLSX gives sale-package acreage, assessment, soil, and crop context.

Knowledge layer:

- Court-file sale results.
- Community tips.
- Tender-package infrastructure.
- Feedlot proposals.
- Buyer rumors.

Rules:

- If CSV confirms title and knowledge says sold before snapshot, escalate to court/title history review.
- If CSV does not confirm title but knowledge is important, keep the parcel and flag it.
- If community intel names a buyer, label it as community intel unless a court or title source confirms it.
- Public copy should say "local reports indicate" or "community intel reports" until title/court evidence closes the loop.

Wymark examples:

- The five Carefoot/Waldeck parcels stay in `flag` because they are absent from the MFL CSV, even though `data.js:667-715` carries detailed sale intel.
- The four Section 18-12-14-W3 feedlot-proposal parcels stay in `flag` because they are absent from the MFL CSV, even though `data.js:646-665` carries feedlot context.

## FLAG Taxonomy

Use these subtypes in deltas and narratives:

- `sold_rumor_carefoot_waldeck`: current map has sale intel, CSV does not confirm MFL title. Pull title history and Monitor sale report.
- `feedlot_proposal_title_gap`: current map has feedlot/regulatory intel, CSV does not confirm MFL title. Pull current ISC title and RM records.
- `legacy_swift_current_rm_not_in_mfl_csv`: current Wymark record is in RM Swift Current 137 but is not in the Swift Current CSV set. Review township/range and title history.
- `lac_pelletier_not_in_mfl_csv`: current Wymark RM Lac Pelletier parcel absent from CSV. Check sale, other entity, lease/rent-back, or title export coverage.
- `coulee_not_in_mfl_csv`: current Wymark RM Coulee parcel absent from CSV. Check title history and older sale-package source.
- `unknown_not_in_mfl_csv`: use only when no better subtype fits.

Do not use `flag` to imply error. It means "keep mapped, title status unresolved under this CSV snapshot."

## CSV vs Memory

If CSV and memory disagree:

1. Treat the CSV as anchor truth only for MFL title on 2026-01-18.
2. Treat memory, community tips, and older docs as knowledge-layer evidence.
3. If a court document proves a sale before 2026-01-18, court/title history can override the CSV assumption, but document the conflict.
4. If memory says MFL owned a parcel and CSV omits it, do not delete; flag and pull title history.
5. If memory says a parcel was sold but CSV still lists MFL title, flag as sale-status conflict.

## Edge Cases From This Pair

- Audit reports REASSIGN only from the target property's view. Wymark's audit showed 82 FLAGs, but 16 unique features are actually Swift Current `reassign_out`.
- Audit counts title rows; map features are usually legal-location polygons. Do not assume counts are directly comparable.
- Current `quarters-data.js` is one long generated line, so use `audit.json` and per-property audit markdown for review evidence.
- RM-only crosswalk is too blunt for final application. For this pair, RM Swift Current 137 CSV rows are T13/R13-R14/W3 and look coherent for `swift-current`, but future areas should add township/range guards.
- Point-only properties can receive CSV geometry without resolving the entire court-file acreage claim. Swift Current's `data.js:808` 49,775-acre claim is not reconciled by this 31-row CSV subset.
- Existing public intel can be valuable and still not be title truth. Keep it visible, flagged, and source-labeled.
