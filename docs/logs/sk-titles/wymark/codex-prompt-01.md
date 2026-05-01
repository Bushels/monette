# Codex Prompt — Wymark + Swift Current Worked Example

**Audience:** Codex CLI (gpt-5.5, model_reasoning_effort=xhigh)
**Branch:** `feat/sk-titles-2026-01-18`
**Working dir:** `C:\Users\kyle\Agriculture\Monette\`

---

## Project context

You're working on the Monette Ledger — the public farmland atlas at https://github.com/Bushels/monette / https://monette-ledger.vercel.app. It maps land controlled (owned, leased, sold, rented-back) by Monette Farms during the CCAA proceedings.

The atlas's parcel layer is currently driven by a static pipeline:
- Per-property XLSX files at `docs/Land/*.xlsx` are parsed by `scripts/build_quarters_geojson.py` into `quarters.geojson` (~1,166 polygons).
- Then `scripts/build_quarters_data_js.py` builds the runtime JS file `quarters-data.js` keyed by property id (e.g., `"wymark"`, `"swift-current"`).
- `data.js` holds the property-level records (id, name, lat, lng, totals, rumored sales, status flags, etc.).

**New input as of this work:** three ISC-style title export CSVs at `docs/Land/Monette - file {1,2,3}.csv` listing all land titled to MONETTE FARMS LTD. as of 2026-01-18 (mid-CCAA). 559 surface parcels across 20 SK Rural Municipalities. We want to use this as anchor truth to reconcile the SK portion of the parcel layer.

**Important:** these CSVs are *not* the full Monette footprint. Other Monette entities, leased/rented-back land, and (per the Hafford precedent) even some land Monette operated for years isn't titled to MFL. Existing parcels in `quarters-data.js` that don't appear in the CSV must be **kept** and flagged for follow-up — never silently deleted.

## The worked-example task

Your task is to be the **architect-and-implementer for the Wymark + Swift Current pair**. We want both:
1. The reconciled per-property parcel data (proposed deltas to `quarters-data.js`).
2. A *documented methodology* that Claude (Opus 4.7) can replicate for the remaining 12 SK areas without burning further Codex budget on per-area review.

Wymark and Swift Current are paired because the audit shows a property-id reassignment between them (17 parcels currently filed under `wymark` belong to `swift-current` per the CSV). We're handing you the harder of the two pairings as the worked example so the playbook covers everything subsequent areas might face.

## The anchor-truth principle (THE rule for every decision)

For each parcel, the question is: *what does the CSV say?*
- **CSV says titled to MFL** → confirmed MFL-titled. Goes on the map under the right property.
- **CSV doesn't include a parcel currently on the map** → keep on map, FLAG for follow-up. Never delete. Reasons it might not be in CSV: pre-2026-01-18 sale, lease, titled to a different Monette entity (Monette Land Corporation, DMO Holdings, etc.), or rented-back from an unrelated owner.
- **CSV says titled to MFL under property A, currently on map under property B** → REASSIGN-in to property A. Update the property-id bucket. Don't delete.

Property-id assignment for ambiguous RMs uses township + range, not RM alone (some RMs straddle multiple properties).

## Inputs you have

### Audit data (start here)
- `docs/logs/sk-titles/audit-summary.md` — top-line view of all 14 properties
- `docs/logs/sk-titles/audit-wymark.md` — Wymark diff (22 KEEP, 0 ADD, 0 REASSIGN-in, 82 FLAG)
- `docs/logs/sk-titles/audit-swift-current.md` — Swift Current diff (0 current, 14 ADD, 17 REASSIGN-in)
- `docs/logs/sk-titles/parsed.json` — canonical normalized CSVs (440KB, easy to query)
- `docs/logs/sk-titles/audit.json` — full machine-readable audit (gitignored, 2.2MB)

### Source CSVs (local-only, not committed)
- `docs/Land/Monette - file 1.csv`
- `docs/Land/Monette - file 2.csv`
- `docs/Land/Monette - file 3.csv`

### Current map data
- `quarters-data.js` — current parcels per property; key the `wymark` and `swift-current` arrays
- `data.js` — property records; lines 616–717 are wymark, lines 806–812 are swift-current

### Existing intel + context for these properties
- The wymark record in `data.js` (lines 616–805) has rich data: purchaser rumor (Carefoot Acres / Waldeck), feedlot proposal, Phase 2 sale tracking, affidavit-vs-quarter-count mismatch.
- The swift-current record in `data.js` (lines 806–812) is `geometryStatus: "point-only"` with a 49,775-ac claim and `tags: ["court-file","origin","needs-geometry"]`. It's a known empty-geometry property — exactly what the new CSV data can populate.
- Memory hints worth checking: there are documented community tips about Stewart Valley sales, Carefoot Acres at Waldeck, and the feedlot proposal at SE-18-12-14-W3.

### Pipeline reference
- `scripts/build_quarters_geojson.py` — how polygons are computed from DLS legal descriptions. **Don't run it as part of this task** — your job is the data-layer reconciliation, not pipeline rebuild.
- `scripts/parse_isc_titles.py` — how CSVs are normalized (already done, you can read but don't need to modify).
- `scripts/audit_isc_vs_quarters.py` — how the diff is generated.

### Wymark cross-reference data
- `docs/Land/Wymark.xlsx` (~95 quarter records — original SAMA-derived data with assessment, soil, crop, acres)
- `docs/Land/Wymark.pdf` (Monette Land Tender Information Package)

## Outputs to produce

### 1. Reconciled data deltas (the core deliverable)

Write a single file: **`docs/logs/sk-titles/wymark/proposed-deltas.json`**.

Structure:
```json
{
  "branch": "feat/sk-titles-2026-01-18",
  "snapshot_date": "2026-01-18",
  "properties": {
    "wymark": {
      "add":     [...],   // new parcel records to insert
      "keep":    [...],   // existing records, mark as MFL-verified-titled
      "flag":    [...],   // existing records to keep but flag (with reason)
      "remove":  [...],   // EMPTY in this task — never delete
      "reassign_out": [...] // records to MOVE OUT of this property to a different one
    },
    "swift-current": { same shape },
    "_other_affected": { ... } // any other property your reassign decisions touch
  },
  "decisions_log": [
    {
      "id": "WY-01",
      "decision": "...",
      "rationale": "...",
      "evidence": ["audit-wymark.md line N", "Wymark.xlsx sheet 1 row N", "data.js:618 ..."]
    }, ...
  ]
}
```

Each parcel record under `add`/`keep`/`flag`/`reassign_out` should match the existing `quarters-data.js` schema (loc, parcel_no, rm, ac, soil, assessment, geometry, title, etc.). For ADDs that are LSDs (40-ac subdivisions), document how you propose to compute geometry — defer to the pipeline if needed.

### 2. Methodology playbook (the replication asset)

Write **`docs/logs/sk-titles/wymark/methodology.md`** — a prescriptive recipe Claude can run for any other SK area. Sections to include:
- Step-by-step decision tree (how to triage each audit bucket: ADD, KEEP, REASSIGN-in, FLAG)
- How to handle LSD-vs-quarter granularity mismatches (CSVs sometimes list 4 separate LSDs where current data has 1 quarter)
- How to handle property-id reassignments without breaking referential integrity
- How to cross-reference with property-level XLSX/PDF (when present at `docs/Land/`)
- How to layer rumored-sale/court-doc intel on top of the geometric reconciliation (the "knowledge layer")
- The FLAG taxonomy (subtypes — sold, leased, other-entity, unknown — with detection heuristics)
- What to do when CSV evidence and existing memory disagree
- Edge cases you encountered + how you resolved them

### 3. Per-property narrative

Write **`docs/logs/sk-titles/wymark/wymark-narrative.md`** and **`docs/logs/sk-titles/wymark/swift-current-narrative.md`**.

Each should explain in plain English what changed for the property, why, what intel was applied (e.g., "82 wymark FLAGs include the 5 Carefoot Acres Phase 2 sale quarters per data.js:667"), and what's still uncertain after this pass.

### 4. Decisions/findings summary for Claude

Append a section **`## Codex round-1 worked example — findings`** to `docs/logs/sk-titles-2026-01-18.md`. Include:
- Architectural surprises Claude should know about for Waves A–E
- Any flagged risks or unverified assumptions
- Recommended changes to the wave ordering or to `scripts/parse_isc_titles.py`'s RM-to-property crosswalk if you found mistakes
- Skills/tools you used (will be merged into the existing skills tracker)

## Constraints

- **Do not modify `quarters-data.js` or `data.js` directly** — produce deltas only. Claude will apply them after analysis + sign-off.
- **Do not run the pipeline build** — no `python scripts/build_quarters_geojson.py` etc.
- **Do not commit** — leave files staged or untracked. Claude will review + commit.
- **Don't touch other properties' data** unless your reassignment decisions force a cross-property write.
- **Stay on branch `feat/sk-titles-2026-01-18`** — verify with `git branch --show-current` before any write.
- **Run on `model_reasoning_effort = xhigh`**.

## Why this matters

This is the worked example. The methodology you produce will be applied (by Claude, replicating your pattern) to 12 more areas. Quality of the methodology > volume of work. If you find that the audit script missed something, or the RM-to-property crosswalk is wrong somewhere outside Wymark/Swift Current, flag it in the findings summary so Claude doesn't propagate the mistake.

If you discover that Wymark + Swift Current are unusually intertwined and a clean separation isn't possible without losing intel, **say so** rather than forcing a clean answer. The fallback is documenting what we know and proceeding without splitting them — that's also valuable.

Document everything. The next 12 areas depend on it.
