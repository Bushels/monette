# Satellite Seeding Project — Living Status

**Last updated:** 2026-04-28 evening
**Last session retrospective:** `docs/superpowers/specs/2026-04-28-session-retrospective.md`
**Last Codex review:** background id `b53izop76`, surfaced in the retrospective above

This is the canonical entrypoint for understanding where the satellite seeding project stands. Updated after every milestone session per the workflow established in `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md`.

---

## One-paragraph summary

A SAR + cropland-mask change-detection pipeline that produces per-parcel `seeded: true | false | null` calls with confidence percentages for all 14 mapped Monette Farms properties (~213k acres, 1,260 parcels). Built end-to-end on Google Earth Engine via Application Default Credentials → ADC. Architecturally complete and verified at full-territory scale (Phases 0–5 done, 24 commits as of 2026-04-28). **Codex post-shipping review surfaced 1 critical and 5 high-severity defects that must be fixed before any public surface displays the data** — see "Known issues" below.

---

## Architecture pointers (where things live)

**Spec + plan + retrospective:**
- `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` — the contract (rev 4, post-Codex-audit + back-patches)
- `docs/superpowers/specs/2026-04-28-phenology-priors.md` — Gemini-produced per-territory threshold table
- `docs/superpowers/plans/2026-04-28-monette-satellite-seeding-foundation.md` — Phase 0–3 implementation plan with divergence notes
- `docs/superpowers/specs/2026-04-28-session-retrospective.md` — what shipped, lessons, Codex findings, next pickup
- `docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md` — this file

**Producer code (`scripts/gee_pipeline/`):**
- `auth.py` — SA → ADC → user-OAuth fallback chain. Currently using ADC (`gronningk@gmail.com` → project `monette-494717`).
- `qc.py` — snow/freeze/precip predicates. 13 unit tests.
- `applicability.py` — CDL/ACI crop class → applicability enum. 9 unit tests.
- `confidence.py` — confidence-scoring formula. 9 unit tests.
- `decision_rule.py` — tri-state seeded decision. 11 unit tests.
- `relative_orbit.py` + `orbits.json` — orbit picker (now historical; v1 dropped orbit pinning).
- `t0_baseline.py` — adaptive T0 baseline export with hybrid S2/ERA5 snow QC + `InsufficientBaselineError`.
- `pipeline.py` — single-parcel orchestrator. End-to-end verified on Hafford (insufficient_baseline path) and Raymore (active path).

**Producer entrypoints (`scripts/`):**
- `upload_parcels_asset.py` — one-time GEE FeatureCollection upload.
- `build_imagery_data_js.py` — bulk pipeline runner; default = Hafford 158 parcels; `--parcels-list <file>` for arbitrary subsets. Writes `imagery-data.js` + mirror to `public/imagery-data.js`.

**Live GEE assets** at `projects/monette-494717/assets/monette/`:
- `parcels_v1` — FeatureCollection of 1,260 parcels
- `sar_baseline_2026/sk` — multi-orbit median (mid-SK only — Hafford has 0 pixels)
- `sar_baseline_2026/mt` — full Big Horn coverage
- `sar_baseline_2026/co` — Genoa coverage
- `sar_baseline_2026/mb` — does NOT exist (caught by `InsufficientBaselineError`; spring 2026 thaw too late within ERA5 publication window)

**Live data:**
- `imagery-data.js` (581 KB, root + mirrored to `public/`) — Phase 5 deliverable. 1,260 parcel records, all schema-compliant.

---

## Current data distribution (Phase 5 round 4, 2026-04-28)

| Territory | Total | Active | Insuf | Out-season | Perennial |
|---|---:|---:|---:|---:|---:|
| SK (10 properties) | 850 | 420 (49%) | 354 (42%) | 76 (9%) | 0 |
| MB Eddystone | 165 | 0 | 163 | 2 | 0 |
| MT Big Horn | 220 | 115 (52%) | 8 | 69 | 28 |
| AZ Aguila | 23 | 0 | 23 | 0 | 0 |
| CO Genoa | 2 | 0 | 0 | 0 | 2 |
| **TOTAL** | **1,260** | **535** | **550** | **145** | **30** |

Active parcels' ΔVH ranges per property are in the retrospective. **The Prince-Albert ΔVH cluster (mean +9.32 dB across 19/19 parcels, 100% confidence) is a code defect (see Bucket A below), not a real signal.**

---

## Known issues — must address before public surface

Categorized into 3 fix buckets. **Phase 4 UI work should NOT proceed until Bucket A + B land** so the data on the map is honest.

### 🔴 Bucket A — Math correctness (~1–2 hr code + 30–60 min GEE recompute)

Both items affect the trustworthiness of every "active" call in the dataset.

1. **PA anomaly: SAR metric is unstable** (`pipeline.py` lines 228–256).
   - `pipeline.py` computes `mean(T1/T0)` per pixel then logs at the end. A few near-zero T0 pixels dominate the mean and inflate ΔVH wildly.
   - Live Codex diagnostic: payload says `+10.894 dB` on PA NW-32-51-23-W2; ratio-of-means says `+4.567 dB`. Three-fold discrepancy.
   - **Fix:** switch to ratio-of-means: `mean_dvh_db = 10*log10(mean(T1_VH) / mean(T0_VH))`. Or median-pixel-dB. Add guard on lower-percentile T0 denominators.
   - **After fix:** rerun full Phase 5 (~25 min) to regenerate `imagery-data.js`.

2. **T0 snow QC math is wrong** (`t0_baseline.py` lines ~177–178).
   - `s2.median().eq(11)` takes median of class LABELS — meaningless. Should be `s2.map(lambda im: im.eq(11)).mean()`.
   - We divide ERA5 `snow_cover` by 100 — but GEE catalog says it's already 0–1.
   - **Fix:** correct both. SK + MT + CO baselines may have silently included snowy/freeze-transition scenes; need to recompute.
   - **After fix:** delete + rerun T0 for SK + MT + CO (~30–45 min serialized).

### 🟠 Bucket B — Schema completeness (~1–2 hr work + 25 min GEE rerun)

Required by spec §5; currently emit-as-null. Phase 4 UI needs these to render the optical-features panel and the audit data.

3. **Top-level `baseline_window`** field missing from output. Add to `build_imagery_data_js.py` build_payload.
4. **`dvv_db` always null** (`pipeline.py:316`). Compute alongside `dvh_db` using same ratio-of-means approach.
5. **`optical` always null** (`pipeline.py:320`). Compute NDTI + BSI + NDVI per parcel, attach `optical: { ndti, bsi, ndvi, source_scene }` per spec §4.6.
6. **`baseline_quality: "fresh"` hardcoded** (`pipeline.py:319`). Should be `null` for non-SAR branches (insufficient_baseline, perennial, out-of-season) and `"fresh"|"backfill"` for actual SAR branches based on T0 asset metadata.
7. **Wet-soil precip penalty never fires** (`pipeline.py:292` hardcodes `precip_mm_24h=0.0`). Compute per-T1-scene precip from ERA5 daily and pass into `compute_confidence`.

### 🟡 Bucket C — Production readiness (v1.5; ~3–4 hr)

Unblocks scheduled weekly runs. Not required for v1 internal use but required before reliable production.

8. **Server-side `reduceRegions` per territory shard + Export to table asset.** Current client-side per-parcel `getInfo()` loop won't scale to scheduled runs — risk of latency/quota failures.
9. **S1 collection filtering incomplete.** Add `ee.Filter.listContains` for VV + VH polarization, resolution filter, `.select(["VV","VH"])`, edge masking.
10. **ERA5 lag is now ~9 days** (was assumed 5–7). `t0_baseline.py:128` should query latest available ERA5 date dynamically + mark `baseline_quality: "backfill"` when the requested window extends beyond it.

### 🟢 Smaller items

- `prior_crop="unknown"` defaults to `applicability="active"` — 386 records affected. Default to `unmapped` instead.
- `calibration/az_co_applicability_overrides.json` doesn't exist despite spec §0e gate.
- `CDL_CLASS_TO_NAME` and `ACI_CLASS_TO_NAME` maps are subset; expand based on Phase 5 actual classes encountered.

---

## Pending non-fix work

- **Phase 4 UI** — mode toggle + drawer satellite-row + Farm Progress counter. After Bucket A + B.
- **Mid-May calendar item** — rerun SK T0 once ERA5 publishes through May ~21 (catches northern SK spring thaw → unblocks Hafford active calls).
- **Phase 7** — vote-label loop (Supabase exporter + drawer disagreement UI).
- **Phase 8** — per-territory threshold calibration once ~50–100 vote labels accrue.

---

## Kickoff prompts for the next session

Paste-able. Each is self-contained — load it into a fresh Claude session and the work proceeds.

### Prompt 1 — Bucket A (run this first)

```
Resume the Monette satellite seeding project. Current state at
docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md.

Goal: land Bucket A fixes (math correctness) and re-deliver a clean
imagery-data.js. This unblocks the Phase 4 UI work that's queued behind it.

Two fixes:

1. SAR metric instability (Critical, surfaced by Codex review b53izop76).
   pipeline.py currently computes `mean(T1/T0)` per pixel then logs.
   Few near-zero T0 pixels dominate; PA's +10.894 dB payload is really
   only +4.567 dB by ratio-of-means. Switch to ratio-of-means:
       mean_dvh_db = 10 * log10(mean(T1_VH) / mean(T0_VH))
   Same for dvv_db. Add a guard: if mean_T0 is null/zero, return
   insufficient_baseline.

2. T0 snow QC math wrong (High, t0_baseline.py:~177-178).
   `s2.median().eq(11)` is wrong — it takes the median of class labels.
   Should be `s2.map(lambda im: im.eq(11)).mean()` (mean of binary mask).
   Also drop the `.divide(100.0)` from ERA5 snow_cover — GEE catalog
   says it's already 0..1.

After fixes:
  - Run pytest gee_pipeline/ → confirm 42 still pass
  - Run pipeline.py on PA NW-32-51-23-W2 → verify dvh_db is now ~+4.5
    (not +10.9)
  - Delete existing sar_baseline_2026/{sk,mt,co} via ee.data.deleteAsset
  - Re-run t0_baseline.py sk mt co (~30-45 min serialized)
  - Re-run build_imagery_data_js.py with full --parcels-list (~25 min)
  - Verify distribution: PA active parcels should have lower mean dvh
    and confidence not all 100%; other properties unchanged
  - Commit each step with substantive messages

Workflow: subagent-driven for the discrete TDD/run tasks; main session
orchestrates and polls. Always verify a Phase X by running the produce
→ distribution review → fix → re-run loop. Codex review before
declaring Bucket A done — same pattern as 2026-04-28's b53izop76.

Stop after Bucket A is committed. Bucket B + Phase 4 are separate
prompts.
```

### Prompt 2 — Bucket B (run after Bucket A lands)

```
Resume the Monette satellite seeding project. Bucket A complete at
commit <SHA>. Next: Bucket B (schema completeness) per Codex findings
in docs/superpowers/specs/2026-04-28-session-retrospective.md.

Five gaps to fill in pipeline.py + build_imagery_data_js.py output so
the spec section 5 schema is actually complete:

1. Top-level `baseline_window` in build_payload (spec section 5).
2. Compute `dvv_db` using same ratio-of-means approach as `dvh_db`
   (Bucket A established the pattern).
3. Replace null `optical` with computed sub-block `optical: { ndti, bsi,
   ndvi, source_scene }` per spec section 4.6. Use Sentinel-2
   COPERNICUS/S2_SR_HARMONIZED, 14-day window matching T1, ±3 day for
   each parcel. NDVI < 0.25 precondition for NDTI/BSI per spec.
4. Thread `baseline_quality` through _build_record: null for non-SAR
   branches (insufficient_baseline, perennial, out-of-season), "fresh"
   when current T0 is from this season's window, "backfill" when the
   T0 was built from archived imagery (we backfilled MT 2026 due to
   ERA5 lag).
5. Wire wet-soil precip penalty: in pipeline.py, compute T1 scene
   median precip from ERA5 over the parcel and pass it into
   compute_confidence(precip_mm_24h=...) instead of hardcoded 0.0.

After fixes:
  - pytest still passes
  - Pipeline run on a sample of 5-10 parcels, verify each new field is
    populated correctly
  - Full Phase 5 rerun (~25-40 min, longer due to optical computes)
  - Verify: zero records with `optical: null`, all active records have
    dvv_db computed, baseline_quality matches the actual baseline
    state, some parcels show non-zero precip and lower confidence
  - Codex review of the schema-fix delta
  - Commit each step

Stop after Bucket B is committed + Codex review re-verifies clean.
Phase 4 UI is the next prompt.
```

### Prompt 3 — Phase 4 UI (run after Bucket B lands)

```
Resume the Monette satellite seeding project. Bucket A + B complete; the
v1 producer now emits clean spec section 5 records. Next: Phase 4 UI
integration so the imagery-data.js data renders on monette.buperac.com.

Spec section 6 has the complete fill-encoding tables. Five surfaces to
wire:

1. Atlas map mode toggle in view-map.jsx — add Seeding mode alongside
   the existing Tenure / Vigor (and a Harvest placeholder for v2).
   Mutually exclusive. Persist to localStorage. Default: Seeding mode
   on Apr 1 - Jun 30 per spec section 2.

2. CRITICAL: extend buildPreparedMapData() in view-map.jsx:586-590 to
   copy seeding_seeded, seeding_confidence, seeding_applicability, and
   polygon_quality into Mapbox feature properties. Without this, the
   fill expressions can't read the new fields. Codex's rev-3 audit
   flagged this.

3. Drawer satellite-row in property-drawer.jsx — alongside vote tally,
   show "🛰 Likely seeded (X%)" / "Likely not seeded (X%)" / "Uncertain
   (X%)" / "Perennial alfalfa" / "Out of season" / "No current scene"
   per parcel, plus collapsible optical features panel (raw NDTI/BSI/
   NDVI + source_scene date).

4. Farm Progress satellite counter in view-dossiers-index.jsx — add
   "🛰 Satellite signal: A of 14 properties likely seeded" line under
   existing vote-confirmed counter. Per-property cell gets a second
   stacked progress bar.

5. CSS for the new mode pills, polygon-QC dashed-outline distinction,
   and disagreement icon when satellite + vote disagree.

Plan doesn't have detailed Phase 4 tasks. Suggest writing a small
follow-up plan first via superpowers:writing-plans, then dispatching
subagents per surface (1 + 2 together since they share view-map.jsx;
3 + 4 each on their own; 5 across all).

Always:
  - Test in local preview before committing each surface
  - Verify the mode toggle persists across reloads
  - Verify drawer disagreement UI fires correctly
  - Codex review of the JSX/CSS before declaring done

Spec section 6 has all the color values, fill ramps, and copy text.
Don't re-invent — match the spec.
```

---

## Reference index (what to read for context)

| Topic | Path |
|---|---|
| Design contract (spec, rev 4) | `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` |
| Implementation plan (Phase 0-3) with divergence notes | `docs/superpowers/plans/2026-04-28-monette-satellite-seeding-foundation.md` |
| Phenology calibration table (Gemini) | `docs/superpowers/specs/2026-04-28-phenology-priors.md` |
| Last session retrospective + Codex findings | `docs/superpowers/specs/2026-04-28-session-retrospective.md` |
| **This file** (canonical project status) | `docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md` |
| GEE platform gotchas (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/gee_setup_gotchas.md` |
| Workflow practices (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md` |

---

## Commit log this project (24 commits as of 2026-04-28)

```
294a127 docs(retro): append Codex post-shipping review findings
75f5847 docs(retro): 2026-04-28 session retrospective + standing workflow practices
007a6ba fix(gee): pipeline robustness fixes + Phase 5 full-territory imagery-data.js
bb66ad7 chore(data): commit Phase 3 Hafford-subset imagery-data.js (158 parcels)
86d60ef feat(gee): graduate build_imagery_data_js.py from placeholder to GEE-driven
437f131 feat(gee): add single-parcel pipeline orchestrator (Phase 2 scaffold)
56d9b88 docs(spec): record v1 orbit-pinning drop in section 4.2
91f9c06 fix(gee): drop orbit pinning + hybrid S2/ERA5 snow QC + plan back-patch
f399cd5 feat(gee): detect insufficient_baseline upfront + document MB 2026 state
126c5e7 fix(gee): make T0 baseline robust to ERA5/S2 gaps over small bboxes
b4b2750 feat(gee): wire ADC fallback into auth.py + refactor scripts to use it
e073357 feat(gee): add auth helper supporting service-account or user-OAuth init
d90c1c0 chore(gee): switch GEE project ID from gen-lang-client-0259467098 to monette-494717
5a8d08e feat(gee): add Sentinel-1 relative-orbit picker per territory
475a3f8 docs(plan): correct Task 1b boundary test + qc test count
92de9d6 docs(spec): record CDL 2025 availability finding (Phase 0d)
91158c4 docs: add Gemini-produced phenology calibration table (Task 1a)
743fa75 feat(gee): add tri-state seeded decision rule with unit tests
19710a6 feat(gee): add snow/freeze/precip QC predicates with unit tests
968d9aa feat(gee): add confidence-scoring formula with unit tests
e947a6f feat(gee): add CDL/ACI applicability classifier with unit tests
3ffa6eb chore(gee): add package scaffolding for satellite seeding pipeline tests
569a247 docs(plan): add Phase 0-3 implementation plan for satellite seeding
d219faa docs: add Monette satellite seeding v1 design spec (rev 4)
```
