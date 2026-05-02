# Codex Post-Merge Audit — SK Titles + atlas-hide-property-markers

**Audience:** Codex CLI (gpt-5.5, model_reasoning_effort=xhigh)
**Branch:** `main`
**Working dir:** `C:\Users\kyle\Agriculture\Monette\`

---

## Project context

You did three previous Codex passes on this work:
1. **Round-1 worked example** (`5380074`): you methodologized the Wymark + Swift Current pair.
2. **Round-2 final review** (your output at [`docs/logs/sk-titles/codex-final-review.md`](codex-final-review.md)): you reviewed the 13-commit branch state through `2a2a28a` and returned **NEEDS-FIXES** with 2 BLOCKERS + 2 SHOULD-FIXES.

After your round-2 review, Claude (Opus 4.7) implemented fixes in commit `64d2e91`, made small docs updates (`97fb878`, `e53434d`), added a UX-polish marker-hide change (`76d14d6`), and **the user merged everything to main and pushed to origin Bushels/monette**. Two merge commits on main:
- `fdd806c` Merge feat/sk-titles-2026-01-18 — SK Titles Update
- `194dd32` Merge feat/atlas-hide-property-markers — UX polish

The user explicitly asked for **this final post-merge audit pass** to validate the post-NEEDS-FIXES state + the marker-hide work. The work is already shipped, so this audit is for confirmation + record-keeping. Findings here become follow-up commits, not pre-merge blockers.

## What you need to verify

### 1. Did `64d2e91` correctly address your round-2 findings?

**BLOCKER 1 (your finding): Duplicate same-loc ADD records**
You found 8 duplicate-loc groups in 3 properties:
- regina-south: NE-3-16-18-W2 ×2, NW-3-16-18-W2 ×2, SE-3-16-18-W2 ×3, NE-34-15-18-W2 ×2, SE-35-15-18-W2 ×2
- swift-current: LSD-10-24-13-14-W3 ×2, LSD-15-24-13-14-W3 ×2
- vanguard: SE-6-12-12-W3 ×2

The fix: new `scripts/_dedup_quarters_by_loc_rm.py` collapses (loc, rm) duplicates within each property's array, picking a canonical record (preferring non-null geometry, then KEEP > REASSIGN_IN > ADD > FLAG, then lowest parcel_no for stability). Merges every duplicate's `reconciliation.csv_matches` into the canonical record. Records dropped: regina-south 6, swift-current 2, vanguard 1 = 9 total. Plus the generator (`scripts/build_deltas_from_audit.py`) was patched to dedup ADDs by (loc, rm) the same way KEEP dedup works.

**Verify**: are there any remaining `(loc, rm)` duplicates in `quarters-data.js`? Did the canonical-pick logic preserve geometry-bearing records? Are the merged `csv_matches` arrays complete (no dropped title-row metadata)? Run the same duplicate-detection logic you used in round-2 against the merged state.

**BLOCKER 2 (your finding): swift-current + regina-south stale `geometryStatus:"point-only"` and `tags:[..."needs-geometry"...]`**
The fix: both records updated to `geometryStatus:"polygons"`, `locationPrecision:"parcel"`, tags now include `"mfl-csv-2026-01-18"` and dropped `"needs-geometry"`. The notes prose was rewritten to reflect post-snapshot truth.

**Verify**: are the `data.js` records consistent with the actual `quarters-data.js` state? Are the prose updates accurate (not over-claiming)?

**SHOULD-FIX 1 (your finding): Phase 4 stale significance prose**
The fix: `scripts/_update_data_js_totals.py`'s NARRATIVE block was updated to reflect Phase 4 having run (no more "geometry pending Phase 4"). All 12 SK property `mflTitleSnapshot.significance` fields regenerated.

**Verify**: read each significance field on the 12 affected properties. Any stale "pending" / "TBD" / "to be computed" prose left?

**SHOULD-FIX 2 (your finding): Planned-parcel `geometry_action` mismatch**
The fix: 2 leftover null-geometry BLK-X-PLAN-N records in calderbank + vanguard had their `reconciliation.geometry_action` renamed from `compute_quarter_polygon_from_dls` → `planned_parcel_cadastral_pending` with explanatory note.

**Verify**: are the 2 records correctly tagged? Any other places where the old action string remained?

### 2. Is `76d14d6` (atlas marker hide) architecturally sound?

**Change**: introduces `hideMapMarker:true` flag on 5 Montana sub-properties (mt-fly-creek, mt-st-xavier-camp4, mt-nieden-camp1, mt-ragland, mt-ragland-camp1). `view-map.jsx` adds `!property.hideMapMarker` checks in two places:
- Line ~700 (point-only branch): gates BOTH circle + label feature emission
- Line ~755 (polygon-mapped branch): gates label feature emission

Mirrors the existing `hideMapMarker` flag pattern used for sold assets (line 781 area).

**Verify**:
- Does the flag correctly suppress the visual markers?
- Are the right Montana sub-properties flagged (and only them)? Check that genuinely unmapped point-only assets like BC Ranches, Aguila, Genoa, Outlook Seeds, Goat's Peak, Lethbridge Pea Protein, Tonopah keep their markers (they're the only visual indicator since they have no parcel coverage).
- Any side effects on hover/click behavior, drawer-open routing, or property-list-to-map navigation that depend on the marker layers?
- Cache-bust correctly bumped (`data.js?v=37`)?

### 3. Post-merge regressions

The two `--no-ff` merges to main brought:
- 17 commits from feat/sk-titles-2026-01-18
- 1 commit from feat/atlas-hide-property-markers

**Verify**:
- `data.js` parses (`node --check data.js`)
- `quarters-data.js` parses
- The `MONETTE_QUARTERS_REAL` object loads correctly
- Per-property record counts match `data.js` `parcels` field for every SK property
- `mflTitleSnapshot.totalRecords` matches actual record count for every SK property
- No unintended changes to non-SK properties (montana, eddystone, aguila, genoa)
- Audit re-run shows `unmatched: 0` (run `python scripts/audit_isc_vs_quarters.py` read-only-ish — it does write the audit-X.md docs, but those are reference)

### 4. Production readiness

The user pushed to origin Bushels/monette and Vercel is wired to auto-deploy from main. Beyond data integrity, look for:
- Render path issues (any `geometry: null` records that would break Mapbox layers)
- Cache-bust adequacy (will users get the new data on next page load?)
- Public copy issues (anything in `mflTitleSnapshot.significance` that overclaims or contradicts other property record fields?)

## Inputs you have

- `main` HEAD: `8a6b42a` (latest is the PROJECT_STATE update)
- Round-2 review: [`docs/logs/sk-titles/codex-final-review.md`](codex-final-review.md)
- Round-1 methodology: [`docs/logs/sk-titles/wymark/methodology.md`](wymark/methodology.md)
- Methodology log: [`docs/logs/sk-titles-2026-01-18.md`](../sk-titles-2026-01-18.md)
- Audit data: `docs/logs/sk-titles/audit-summary.md` + per-property markdown
- Source CSVs (local-only): `docs/Land/Monette - file {1,2,3}.csv`

## Constraints

- **Do not modify any source files** — produce a written audit only.
- **Do not commit, push, or merge anything** — main is already shipped.
- **Do not run the build pipeline** (`npm run build`).
- **Stay on branch `main`** — verify with `git branch --show-current`.
- **Run on `model_reasoning_effort = xhigh`**.
- The audit script `scripts/audit_isc_vs_quarters.py` does write per-property markdown; that's acceptable since it's reference output. If you'd prefer not to touch the working tree at all, copy the script's logic into a one-shot Node/Python script for read-only verification.

## Deliverable

**`docs/logs/sk-titles/codex-post-merge-audit.md`**

Structure:

```markdown
# Codex Post-Merge Audit — SK Titles + atlas-hide-property-markers

## Verdict
SHIPPED-CLEAN | SHIPPED-WITH-FOLLOW-UPS | REGRESSION-FOUND

## Round-2 fix verification
(Did each of your 4 round-2 findings get resolved correctly? Walk through each.)

## Atlas marker-hide review
(Architecture sound? Side effects? Coverage right?)

## Post-merge state integrity
(Data consistency, parse checks, audit math, no unintended changes.)

## Follow-ups (not blocking, since shipped)
(Anything Claude should commit as a follow-up.)

## Closing note
(Methodology drift summary across all 3 Codex passes; lessons for future title-export reconciliation work.)
```

The user values an honest verdict here — if the fixes are clean, say so plainly. If anything still drifts, surface it for a follow-up commit. Don't sugarcoat or pad.
