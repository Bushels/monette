# Wymark Narrative

## What Changed

Wymark is no longer treated as one clean 101-feature MFL-titled block.

After the 2026-01-18 CSV reconciliation:

- 19 unique Wymark map features are confirmed MFL-titled at the snapshot date.
- Those 19 features are backed by 22 CSV title rows, all in RM Lac Pelletier 107.
- 16 unique current Wymark features should move out to `swift-current`.
- 66 current Wymark features remain mapped but flagged for follow-up.
- `remove` stays empty.

The audit's headline "82 FLAG" for Wymark is correct from Wymark's incoming view, but it is not the final action split. Swift Current's audit proves that 17 title rows inside those flags are really reassignments into Swift Current, collapsing to 16 unique map features.

## Why

The CSV lists land titled to MONETTE FARMS LTD. as of 2026-01-18. It does not list the full Monette operating footprint, land titled to other entities, rented-back land, or sold land still carried in older map context.

That makes the rule simple:

- CSV confirms MFL title: keep under Wymark and mark verified.
- CSV points to Swift Current: move the property bucket after geometry review.
- CSV omits a current Wymark feature: keep it mapped and flag it.

## What Stayed Wymark-Verified

The verified Wymark core is the RM Lac Pelletier T11/R13-R14/W3 set listed in `audit-wymark.md:92-115`.

These are not new parcels. They are existing Wymark map features now upgraded to MFL-title-confirmed status for the 2026-01-18 snapshot.

## What Moved Out

The 16 unique move-out features are current Wymark records that Swift Current's CSV rows claim under RM Swift Current 137.

Important detail: `audit-swift-current.md:56-59` has two CSV title rows for `NW-7-13-14-W3`, but the current map has one feature. Final application should attach both title references to one geometry unless the renderer is deliberately changed.

Several move-outs are LSD-level CSV records matched to older Wymark quarter/partial-quarter features. Those need DLS geometry recomputation before final map application.

## What Remains Flagged

The 66 Wymark follow-up flags break down as:

- 31 RM Lac Pelletier 107 features absent from the MFL CSV.
- 28 RM Swift Current 137 legacy Wymark features absent from the Swift Current CSV set.
- 5 RM Excelsior 166 Carefoot/Waldeck sale-intel features.
- 2 RM Coulee 136 features.

These are not deletions. They are "keep mapped, title status unresolved under this MFL-only CSV snapshot."

## Intel Applied

Carefoot/Waldeck:

- `data.js:667-715` identifies five rumored Carefoot/Waldeck quarters totaling 746.70 titled acres / 739.70 cultivated acres.
- `data.js:672-676` ties the court-affidavit Phase 2 result to 485 acres / $1.78M / $3,670 per acre.
- The 746.70-acre five-quarter package does not match the 485-acre affidavit line.
- These five parcels are absent from the MFL CSV, so they stay flagged as sale/title-history follow-up.

Feedlot proposal:

- `data.js:646-665` identifies the Section 18-12-14-W3 feedlot-proposal block.
- `Wymark.pdf` page 6 lists Location No. 19 at `SE-18-12-14-W3`, Lac Pelletier/Pelletier Lot, with feedlot/winter feeding infrastructure.
- The four Section 18 parcels are absent from the MFL CSV, so the public title claim needs fresh ISC verification before it is stated as MFL-owned.

Waldeck Lot:

- `Wymark.pdf` page 4 lists Location No. 13 at `NW-17-16-12-W3`, Waldeck Lot, with grain storage, fertilizer storage, shops, office, and feedlot/winter feeding.
- `Wymark.xlsx` rows 117-118 split `NW-17-16-12-W3` into two parcel rows, including a 13.69-acre included-assessment subparcel.
- That supports the existing carve-out suspicion, but it does not close title/sale status.

## Still Uncertain

- Whether all five Carefoot/Waldeck quarters were sold, leased back, partly retained, or split from the 485-acre Phase 2 affidavit line.
- Whether Section 18-12-14-W3 is titled to another Monette entity, a related party, or no longer MFL-titled.
- Whether the 28 residual RM Swift Current 137 Wymark features belong with Wymark, Swift Current, another entity, or a sold/rented-back layer.
- Whether Wymark's property-level totals in `data.js:618` should be recalculated after Claude applies the final geometry changes.

## Bottom Line

Wymark is still a valid public property layer, but it needs status bands:

- MFL-title-confirmed Wymark core.
- Swift Current reassign-outs.
- Sale/intel flags.
- Other title-history flags.

Do not publish this as a clean ownership map until those bands are visible.
