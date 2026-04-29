# Satellite Seeding Project — Living Status

**Last updated:** 2026-04-29 mid-day (satellite pivot complete — community voting removed)
**Latest session retrospectives:**
- `docs/superpowers/specs/2026-04-28-session-retrospective.md` (Phase 0–5 v1 ship + initial Codex findings)
- `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md` (Bucket A: 3-round Codex review loop, all findings landed)
- `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md` (Bucket B: schema completeness, Codex-as-architect new workflow)
- `docs/superpowers/specs/2026-04-29-satellite-pivot-retrospective.md` (Satellite pivot: community voting removed, Atlas now satellite-driven main page)

**Codex review history:**
- `b53izop76` — initial post-shipping review (3 buckets surfaced)
- `b08awunq3` — Bucket A round-1 review (3 new BLOCKERs)
- `bd5gaxmye` — Bucket A round-2 review (1 new BLOCKER + perf hints)
- `b5ajsddp7` — Bucket B architecture pressure-test (NEW workflow: Codex-as-architect feeding into the implementer)
- `bl5l9zfxa` — Bucket B round-1 review (1 BLOCKER: optical band-name bug; window + cloud filter refinements)
- `beyzs2ym9` — Bucket B final review (GREENLIGHT; Phase 4 unblocked; v1.5 risks captured under "Pending non-fix work")
- `b05w54lpy` — Satellite pivot architecture pressure-test (6-step removal plan, surfaced 5 missed coupling files + pre-existing `vigorColorFor` bug)
- `bwgf1888o` — Satellite pivot review (BLOCKER: migration SQL bugs + drawer guardrails missed; all addressed in `7bf8284`)

This is the canonical entrypoint for understanding where the satellite seeding project stands. Updated after every milestone session per the workflow established in `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md`.

---

## One-paragraph summary

A SAR + cropland-mask change-detection pipeline that produces per-parcel `seeded: true | false | null` calls with confidence percentages for all 14 mapped Monette Farms properties (~213k acres, 1,260 parcels). Built end-to-end on Google Earth Engine via Application Default Credentials → ADC. **Buckets A + B + Satellite Pivot are now complete** (22 code commits spanning a29ab80..7bf8284). Bucket A landed math correctness; Bucket B added schema completeness; the Satellite Pivot removed the entire community voting feature and consolidated to a satellite-driven Atlas as the main page (Tenure / Vigor / Seeding modes; Seeding default during Apr 1 – Jun 30; confidence-modulated fill ramp; drawer satellite-row with optical features panel). The DROP migration for the 4 voting Supabase tables is committed but **NOT yet executed** — awaiting user authorization. Bucket C (server-side `reduceRegions`, ERA5 lag handling) remains as production-readiness work.

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

## Current data distribution (post-Bucket-A, 2026-04-28 late-evening)

| Territory | Total | Active | Insuf | Out-season | Perennial |
|---|---:|---:|---:|---:|---:|
| SK (10 properties) | 850 | 420 (49%) | 354 (42%) | 76 (9%) | 0 |
| MB Eddystone | 165 | 0 | 163 | 2 | 0 |
| MT Big Horn | 220 | 113 (51%) | 10 | 69 | 28 |
| AZ Aguila | 23 | 0 | 23 | 0 | 0 |
| CO Genoa | 2 | 0 | 0 | 0 | 2 |
| **TOTAL** | **1,260** | **533** | **552** | **145** | **30** |

Distribution shifts vs the pre-Bucket-A snapshot:
- 2 MT parcels flipped active → insufficient_baseline. Tighter CDL+common-mask reduced their valid pixel support below threshold. Expected.
- All other applicability counts unchanged.

### Active ΔVH (dB) summary post-Bucket-A

| Territory | n active | mean | median | min | max |
|---|---:|---:|---:|---:|---:|
| SK (all) | 420 | -0.625 | -0.372 | -3.483 | +4.567 |
| **PA only** (subset of SK) | **19** | **+2.318** | **+2.758** | **-1.012** | **+4.567** |
| MT | 113 | +2.714 | +2.665 | -0.762 | +6.495 |

**The PA anomaly is resolved.** Pre-Bucket-A: PA mean was +9.317 dB, max +13.094 dB, all 19 parcels at 100% confidence. Post-Bucket-A: mean +2.318 dB, max +4.567 dB, confidence spread across the histogram. The mean-of-ratios artifact + snow-QC bug + CDL mask error compounded to produce the inflated cluster; all three are fixed.

### Confidence histogram (active parcels)

| Bucket | Pre-Bucket-A | Post-Bucket-A |
|---|---:|---:|
| 100% | 246 | 176 |
| 90–99% | 23 | 20 |
| 75–89% | 46 | 33 |
| 50–74% | 69 | 36 |
| <50% | 151 | 268 |

The shift toward `<50%` is the intended effect: cleaner SAR math + realistic cropland_coverage means fewer parcels accidentally cleared the high-confidence thresholds.

### cropland_coverage post-Bucket-A

| Territory | mean | median | min | max | notes |
|---|---:|---:|---:|---:|---|
| SK | 0.921 | 0.949 | 0.000 | 1.000 | Was 0.575–0.666 cluster (projection-mismatch artifact); now real |
| MB | 0.656 | 0.784 | 0.000 | 1.000 | All insufficient_baseline regardless |
| MT | 0.656 | 0.760 | 0.000 | 1.000 | CDL filter now excludes forest/water/developed/pasture |
| AZ | 0.528 | 0.552 | 0.000 | 1.000 | All insufficient_baseline regardless |
| CO | 0.000 | 0.000 | 0.000 | 0.000 | Both Genoa parcels are perennial alfalfa; cc=0 anomaly to investigate (non-blocking) |

`polygon_quality=low` (cc < 0.50): 12 → 130. The OLD count was hidden by the artifactual 0.6+ cropland_coverage cluster; the new count is honest.

---

## Known issues — fix bucket status

Buckets A + B are now complete (Codex final review `beyzs2ym9` GREENLIGHT). Bucket C (production readiness) and Phase 4 UI integration remain.

### ✅ Bucket A — COMPLETE (3-round Codex review loop, 8 commits)

All math correctness defects shipped. Data refreshed.

**Round 1 fixes** (3994f35..ac8d6db):
1. ✅ ΔVH: `mean(T1/T0)` per-pixel-then-log → ratio-of-means (`a29ab80`).
2. ✅ T0 snow QC: `s2.median().eq(11)` → `s2.map(lambda im: im.eq(11)).mean()` (`0f797dc`).
3. ✅ ERA5 snow_cover scaling: dropped `.divide(100.0)` (`0f797dc`).
4. ✅ Symmetric T1/T0 zero/null guard + dead None checks dropped (`ac8d6db`).

**Round 2 fixes** (de7f62d..f76352b) — Codex round-1 surfaced 3 new BLOCKERs:
5. ✅ `cropland_coverage` = `mean()` of 0/1 mask (`de7f62d`); was projection-mismatch artifact via `count()/count()` over geographic-vs-Albers projections.
6. ✅ Common valid-pixel support across T1/T0/cropland before reduce (`b95b72a`); avoids per-band mask divergence biasing the ratio.
7. ✅ Phase 5 fails closed (`SystemExit(2)`) on any `status:"error"` record (`f76352b`); previously partial-failure runs were indistinguishable from clean ones.

**Round 3 fixes** (dd8d66f, 4a7cfe6) — Codex round-2 surfaced 1 new BLOCKER + perf hints:
8. ✅ CDL cropland filter (`dd8d66f`): replaced `cropland != 0` (which counted forest/water/developed/pasture as cropland) with `(1–60) ∪ (66–80) ∪ (195–254)` per USDA NASS legend. Defined as `CDL_CROPLAND_CLASSES_RANGES` module constant.
9. ✅ VV bands added to `common_mask` (defense in depth) (`4a7cfe6`).
10. ✅ 12 `.getInfo()` round-trips collapsed to 1 `stats.getInfo()` dict pull (`4a7cfe6`); active-parcel wall-clock saving ~30–40%.

**T0 baseline rebuild** (37 min wall-clock total):
- `sk` task `DW6QGG5KRH3NZH6PMNNX7U7F` SUCCEEDED at 04:40 UTC
- `mt` task `LCZTMBAWWGU7MEFBWYEEHFHI` SUCCEEDED at 04:20 UTC
- `co` task `YFMOOG7MRAQMY4LHV5XYW2ZD` SUCCEEDED at 04:28 UTC

**Phase 5 rerun** (`d7bf05e`): 1,260/1,260 parcels, 0 errors, fail-closed contract held.

**Verification:**
- pytest 42/42 (no test changes — these are pure-EE pipeline fixes)
- PA NW-32-51-23-W2 smoke test: dvh_db `+10.894` (pre-fix) → `+4.567` (post round-1) → `+4.567` (post round-3, unchanged) — exactly the Codex-cited ratio-of-means value.
- Distribution diff inline above shows the PA anomaly resolution + confidence-spread restoration.

### ✅ Bucket B — COMPLETE (Codex-as-architect new workflow, 5 commits)

All 5 schema-completeness items shipped. Data refreshed.

**Workflow demonstration:** Bucket B was the first round where Codex was used as an upfront *architect* (b5ajsddp7) before any code was written, contributing 6 design choices that fed directly into the implementer subagent prompt. Codex then reviewed the implementation (bl5l9zfxa), surfacing one critical bug (band-name mismatch on the SCL/cropland mask reducer key) plus two refinements (lookback-only window vs symmetric, drop CLOUDY_PIXEL_PERCENTAGE prefilter in favor of SCL+pixel-count truth). All addressed before committing the data refresh.

**Round 1 (af01c7a..516d482) — design fed by Codex b5ajsddp7:**
1. ✅ Schema plumbing (`af01c7a`): top-level `baseline_window` from `t0_baseline.BASELINE_WINDOWS`; `dvv_db` plumb-through (drop `_mean_dvv_db_value` Bucket-A TODO marker); `baseline_quality` conditional (`"fresh"` for active SAR, `null` for non-SAR); extended `_build_record` signature.
2. ✅ Wet-soil precip penalty (`aa70b34`): max precip across S1 contributing scene dates (per Codex's "no fake median scene date" rule); ERA5 m→mm with negative-artifact clamp; null-image guard for ERA5 lag.
3. ✅ Optical features (`516d482`): new `scripts/gee_pipeline/optical.py` module — single-best Sentinel-2 scene picker (NOT median composite per Codex), conservative SCL `{4 vegetation, 5 bare soils}` mask, parcel-mean NDVI gate at 0.25 for NDTI/BSI emission, min 50 valid pixels, 20m reduce.

**Round 2 (1c49f11) — addressed Codex bl5l9zfxa BLOCKER:**
4. ✅ Optical band-name fix + window refinements: `.rename("valid")` so the reducer key matches; ±3-day symmetric → 10-day lookback-only (avoid future-lookahead in public "as-of" output); drop `CLOUDY_PIXEL_PERCENTAGE < 30` prefilter (SCL + 50-pixel count is parcel-scale truth).

**Phase 5 rerun (`30d6881`):** 1,260 parcels, exit 0, fail-closed contract held.

**Field coverage post-Bucket-B:**
- `dvv_db` (active branches): **533 / 533** (100% — every active record)
- `baseline_quality` `"fresh"`: 533 (= active count)
- `baseline_quality` `null`: 727 (= non-active count, perfect)
- `optical` populated: **1087 / 1260** (86%)
  - full `ndvi+ndti+bsi`: 882 (NDVI < 0.25, parcel mostly bare soil — indices meaningful)
  - NDVI-only (gate fired): 205 (NDVI ≥ 0.25, established canopy — NDTI/BSI suppressed)
- `ndvi_mean` populated: 1087 (= optical count, side-effect of same compute)
- top-level `baseline_window`: present (sk/mb/mt/co; AZ correctly excluded since no T0 tracked)
- Precip penalty firings: 0 (verified honest: PA's 3 contributing scenes had max 0.07 mm 24h-prior; the 13 mm peak day in the broader window fell on non-S1 days, which Codex's design correctly does NOT penalize)

**The 173 optical:null records** are honest "no qualifying scene" results, concentrated in northern SK (lingering snow → SCL classifies cropland as snow-affected) and AZ desert (SCL outcomes for irrigated cropland differ).

**Verification:**
- pytest 42/42 (no test changes — these are pure-EE pipeline fields)
- Smoke test passed: PA NW-32-51-23-W2 dvh_db=4.567 / dvv_db=3.584 / baseline_quality=fresh / last_obs_date=2026-04-26 / optical=null (PA likely lingering snow); Hafford optical fully populated (NDVI=0.141 → NDTI=0.103, BSI=0.161, scene 2026-04-21); Montana optical NDVI=0.403 → NDTI/BSI correctly nulled by gate.
- Confidence histogram unchanged from post-Bucket-A (precip didn't fire; SAR math untouched in Bucket B).

### ✅ Satellite Pivot — COMPLETE (Codex-as-architect for strategic removal, 7 commits)

The community voting feature (season votes for seeded/sprayed/harvested + ownership votes + listing votes) was removed entirely. Atlas (`#map`) is now the satellite-driven main page; Farm Progress page (`#dossiers` index) was killed; `#dossier/<slug>` route preserved for individual articles; `#dossiers` silent-redirects to `#map` via `replaceState`. Codex pressure-test `b05w54lpy` produced the 6-step removal plan; Codex review `bwgf1888o` caught the migration SQL bugs + drawer guardrails which landed in the post-review fix commit.

**Workflow demonstration:** First time using Codex-as-architect for a strategic *removal* (not just feature increment). Codex's pressure-test surfaced 5 files that I'd missed in the initial scope (`tutorial.jsx`, `view-editorial.jsx`, `quarter-panel.jsx`, `vote-board.jsx`, plus 4 localStorage keys). Codex Q1 framed as "what coupling am I missing?" was the key prompt.

**Commits (43f6a98..7bf8284):**
1. ✅ `43f6a98` — operator-relationship layer + supporting data (separate feature; in-flight workdir cleanup before pivot)
2. ✅ `6dfebf6` — quiesce voting backend (Supabase reads/writes); supabase-client.js 319→104 lines; localStorage cleanup of `monette.voter.fp`, `monette.myvotes.v1`, `monette.activity.v1`, `monette.q.v4.*`
3. ✅ `d99433d` — kill Farm Progress page; `#dossiers` silent-redirects to `#map`
4. ✅ `c50e6e2` — remove all vote UI/copy/tutorial/live feed (11 files, −914 net lines); `tutorial.jsx`, `vote-board.jsx`, `view-dossiers-index.jsx` deleted
5. ✅ `bb550d6` — Seeding mode added to Atlas + drawer satellite-row + `vigorColorFor` fix (pre-existing crash bug Codex Q8 surfaced; Bucket B's NDVI population made it imminent)
6. ✅ `bd492e0` — DROP migration SQL written (NOT executed yet; awaiting user authorization)
7. ✅ `7bf8284` — Codex review (`bwgf1888o`) post-fix: corrected migration SQL (`quarter_current_state` is a VIEW; `submit_vote` signature is `text x 6`); drawer guardrails for `prior_crop="unknown"` badge + `last_obs_date` SAR-presence check; stale vote copy in mobile legend / point-only drawer / `config.template.js`; confidence-modulated `seedingFillColor` ramp

**Atlas state post-pivot:**
- Mode toggle: Tenure / Vigor / Seeding (mutually exclusive; localStorage `monette.atlas.mode`; Seeding default Apr 1 – Jun 30)
- 533 active-window parcels: 99 confirmed-seeded (green ramp by confidence), 135 not-yet-seeded (red ramp), remainder uncertain (amber)
- Polygon-quality=low parcels render with dashed outline (separate `PARCEL_SEEDING_OUTLINE_LAYER`)

**Drawer state post-pivot:**
- Satellite-row per parcel: 🛰 status + confidence + `last_obs_date` (suppressed when `dvh_db` is null) + cropland coverage
- Collapsible optical features panel (NDTI/BSI/NDVI + source_scene)
- "Crop type unmapped" badge on `prior_crop="unknown"` records (177 active records — Codex `beyzs2ym9` Q5 guardrail)

**Pre-existing bugs surfaced + fixed during pivot:**
- `vigorColorFor` undefined → defined with 4-stop NDVI ramp (Codex `b05w54lpy` Q8)
- `vote-board.jsx` orphan referencing `window.QUARTER_STATES` → file deleted
- Migration SQL bugs caught at review (`quarter_current_state` is VIEW; `submit_vote` signature) — would have failed at execution

**Pending: SQL migration execution.** The DROP migration at `supabase/migrations/20260429000000_drop_voting_tables.sql` is committed and validated against the actual schema. **Awaiting user authorization** to execute against the Monette Supabase project. Same gate as the Bucket A T0 deletion — destructive shared-infrastructure changes need explicit "go."

### 🟡 Bucket C — Production readiness (v1.5; ~3–4 hr)

Unblocks scheduled weekly runs. Not required for v1 internal use but required before reliable production.

8. **Server-side `reduceRegions` per territory shard + Export to table asset.** Current client-side per-parcel `getInfo()` loop won't scale to scheduled runs — risk of latency/quota failures.
9. **S1 collection filtering incomplete.** Add `ee.Filter.listContains` for VV + VH polarization, resolution filter, `.select(["VV","VH"])`, edge masking.
10. **ERA5 lag is now ~9 days** (was assumed 5–7). `t0_baseline.py:128` should query latest available ERA5 date dynamically + mark `baseline_quality: "backfill"` when the requested window extends beyond it.

### 🟢 Smaller items

- `prior_crop="unknown"` defaults to `applicability="active"` — fewer records affected post-Bucket-A but still present. Default to `unmapped` instead.
- `calibration/az_co_applicability_overrides.json` doesn't exist despite spec §0e gate.
- `CDL_CLASS_TO_NAME` and `ACI_CLASS_TO_NAME` maps are subset; expand based on Phase 5 actual classes encountered.
- Genoa CO `cropland_coverage = 0` for both perennial parcels post-Bucket-A. Modal class resolves to alfalfa (perennial path engaged) so this is non-blocking, but the `cc=0` while `prior_crop=alfalfa` is a contradiction worth diagnosing — likely a pixel-alignment edge case at the small CO bbox.

---

## Pending non-fix work

- **Phase 4 UI** — mode toggle + drawer satellite-row + Farm Progress counter. NOW UNBLOCKED — Buckets A+B complete; the producer schema is honest and complete enough to drive UI. Codex `beyzs2ym9` flagged two UI guardrails for Phase 4:
  - **`prior_crop="unknown"` parcels (384 active records, 177 with seeded/not-seeded calls)** must NOT imply crop-specific certainty. The default applicability path for unmapped CDL/ACI classes is "active" (see `applicability.py`), so these records get tri-state seeding decisions but the prior_crop label is `"unknown"`. Phase 4 should display "Crop type unmapped" badge or treat them with extra confidence-band caution.
  - **`last_obs_date` defaults to `run_date` for non-SAR records.** Phase 4 must IGNORE `last_obs_date` when `dvh_db` is null OR `baseline_quality` is null. Otherwise the drawer would show a "last observed 2026-04-28" claim for parcels that had no actual SAR observation.
- **Bucket C — production readiness** (~3–4 hr): server-side `reduceRegions` per territory shard + Export to table asset (current per-parcel `getInfo()` loop won't scale to scheduled runs); S1 collection filter completeness (VV/VH listContains, resolution, edge masking — Codex flagged as worth doing now since `dvv_db` is live); ERA5 lag dynamic detection + `precip_data_partial` flag for parcels where contributing scenes hit the lag.
- **Mid-May calendar item** — rerun SK T0 once ERA5 publishes through May ~21 (catches northern SK spring thaw → unblocks Hafford active calls).
- **Phase 7** — ~~vote-label loop~~ **OBSOLETE.** With voting removed, the calibration source no longer exists. Alternative: agnonymous-tip-driven ground-truth labels submitted by operators reviewing satellite calls; or operator-internal review of satellite/court-data disagreements.
- **Phase 8** — per-territory threshold calibration. Original plan was "after ~50–100 vote labels accrue" but votes are gone. Calibration now needs an alternative source (agnonymous tips, operator review, or satellite-vs-court-record disagreement). Codex `beyzs2ym9` flagged three Phase-8 candidates that still apply regardless of label source:
  - **Precip window 24h → 48–72h.** Rain 2-3 days prior still affects SAR backscatter via residual soil moisture; the current 24h-before-acquisition window is conservative.
  - **Optical-null calibration by territory + parcel size.** Optical:null is concentrated: Kamsack 76, Montana 23, Eddystone 22, PA 20, Aguila 12. Plus tiny parcels can't reach `MIN_VALID_PIXELS=50` at 20 m scale after 80 m erosion (small AZ parcels and small Montana aliquots). v1.5 should switch to area-normalized threshold or expose `MIN_VALID_PIXELS` as a per-territory tunable.
  - **Per-territory NDTI/BSI percentile cutoffs.** v1 emits raw values; v1.5 calibrates against vote labels.

---

## Kickoff prompts for the next session

Paste-able. Each is self-contained — load it into a fresh Claude session and the work proceeds.

### Prompt 1 — Bucket A — ✅ COMPLETE 2026-04-28 late-evening

Shipped across 3 Codex review rounds (`b53izop76` → `b08awunq3` → `bd5gaxmye`). 8 code commits + 1 data commit (`a29ab80..d7bf05e`). See "Known issues — Bucket A — COMPLETE" section above for the full ledger and the post-rerun distribution diff.

### Prompt 2 — Bucket B — ✅ COMPLETE 2026-04-29 early-morning

Shipped via the new Codex-as-architect workflow: Codex `b5ajsddp7` did the upfront design pressure-test (single-best S2 scene vs median composite, max-precip-across-S1-contributing vs window-wide, conservative SCL `{4,5}` mask, parcel-mean NDVI gate, baseline_quality as v1 shortcut). Implementation in 4 commits on top of `bc55706` plus 1 data refresh: `af01c7a..30d6881`. Codex round-1 review (`bl5l9zfxa`) caught 1 critical band-name bug (`scl_mask.And(cropland_mask)` keeps "SCL" as band name; reducer was reading `"constant"`); fixed at `1c49f11`. Codex final review at `beyzs2ym9`.

Field coverage post-Bucket-B: dvv_db on 533/533 active, optical on 1087/1260 (86%), baseline_quality fresh-vs-null perfect, top-level `baseline_window` present. See "Known issues — Bucket B — COMPLETE" section above.

### Prompt 3 — Phase 4 UI — ✅ COMPLETE (rolled into Satellite Pivot 2026-04-29 mid-day)

Phase 4 was originally intended as a vote-aware UI extension. Mid-flight, the user pivoted to "kill voting entirely; satellite IS the headline." The Phase 4 deliverables (mode toggle, drawer satellite-row, fill encoding) all landed as part of the Satellite Pivot — see "Satellite Pivot — COMPLETE" section above. Farm Progress satellite counter became moot when the page was killed.

### Prompt 4 — Browser smoke test + SQL migration execution — NEXT-SESSION PICKUP

```
Resume the Monette satellite seeding project at HEAD 7bf8284. Buckets A+B
+ Satellite Pivot are complete in code. Two remaining steps before
declaring v1 fully shipped:

1. Browser smoke test against the local preview server. Run from C:
       cd C:\Users\kyle\Agriculture\Monette
       python -m http.server --directory C:/Users/kyle/Agriculture/Monette 8000
   then open http://localhost:8000 and verify:
   - Atlas loads with Seeding mode default (Apr–Jun window)
   - Mode toggle persists across reloads (Tenure / Vigor / Seeding)
   - Drawer satellite-row renders correctly for each applicability:
       active / perennial / out-of-season / insufficient_baseline /
       unmapped
   - "Crop type unmapped" badge appears on prior_crop="unknown"
     records (177 active records affected — pick any of those to verify)
   - last_obs_date is suppressed on non-SAR records (Aguila + Genoa
     parcels are insufficient_baseline; their drawers should NOT show a
     "Last obs" line)
   - Optical-features panel collapsible chrome works (Hafford or PA
     active parcel with optical populated is the test case)
   - #dossiers URL silent-redirects to #map (clean back button — open
     #dossiers, hit back, should not return to #dossiers)
   - No console errors related to undefined functions or missing globals
   - localStorage shows orphan vote keys (monette.voter.fp,
     monette.myvotes.v1, monette.activity.v1, monette.q.v4.*) cleared
     on the first visit

2. SQL migration execution (DESTRUCTIVE — needs explicit user "go"):
   Once the smoke test passes, the migration at
   supabase/migrations/20260429000000_drop_voting_tables.sql can be
   executed against the Monette Supabase project (tcsfwdljaedznqiucsdz).
   The Bushels Pro org's MCP connector at
   b5a4a7b9-c6ac-499f-8de3-efb29e0384b3 (per memory
   supabase_mcp_org_scoping.md) can run via apply_migration once
   authorized.

   The migration is idempotent + transactional. Verify post-execution:
       \d+ public.votes                  -- expected: not exists
       \d+ public.vote_tallies           -- expected: not exists
       \d+ public.quarter_current_state  -- expected: not exists
       \df public.submit_vote            -- expected: no rows
       \d+ public.tips                   -- expected: still exists
       SELECT count(*) FROM public.tips; -- expected: row count preserved
```

### Prompt 5 — Bucket C production readiness — FUTURE WORK

```
Resume the Monette satellite seeding project. Buckets A+B + Satellite
Pivot all complete. Next priority is Bucket C — production readiness
for scheduled weekly runs:

1. Server-side reduceRegions per territory shard + Export to table
   asset. Current per-parcel getInfo() loop won't scale to scheduled
   runs (latency + quota risk).

2. S1 collection filter completeness:
   - ee.Filter.listContains for VV + VH polarization
   - Resolution filter
   - Explicit .select(["VV", "VH"])
   - Edge masking
   Codex flagged this as worth doing now since dvv_db is live.

3. ERA5 lag dynamic detection:
   - Query latest available ERA5 date dynamically
   - Mark precip_data_partial: true when contributing scenes hit the lag
   - Mark baseline_quality: "backfill" when T0 source window extends
     beyond ERA5 publication

4. config.template.js audit (Codex Q8) — confirmed no longer stale post-
   pivot but verify after any future style changes.

5. vote_latest_seeded_per_prop migration definition was missing
   (Codex Q8). Now moot since the view is dropped, but flag for
   future migration audits: every view should have a discoverable
   creating migration in supabase/migrations/.

Plan doesn't have detailed Bucket C tasks. Suggest:
  - Write a small follow-up plan via superpowers:writing-plans before dispatching
  - Codex pressure-test the architectural choices upfront (server-side reduceRegions
    has subtle GEE patterns — Export.table.toAsset vs reduceRegions().getInfo();
    feature collection schema; territory shard boundaries for parallelism)
  - Subagent implementation per Codex's plan
  - Codex review of the diff
  - Phase 5 rerun on the new server-side path; verify distribution unchanged
    (the optimization is correctness-preserving — just compute placement)
  - Update memory + retrospective

Always:
  - pytest 42/42 before/after
  - Codex review before declaring Bucket C done
  - Standing practices 1–14 in session_workflow_practices.md apply
```

---

## Reference index (what to read for context)

| Topic | Path |
|---|---|
| **This file** (canonical project status) | `docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md` |
| Design contract (spec, rev 4) | `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` |
| Implementation plan (Phase 0-3) with divergence notes | `docs/superpowers/plans/2026-04-28-monette-satellite-seeding-foundation.md` |
| Phenology calibration table (Gemini) | `docs/superpowers/specs/2026-04-28-phenology-priors.md` |
| v1 ship retrospective | `docs/superpowers/specs/2026-04-28-session-retrospective.md` |
| Bucket A retrospective (3-round Codex review loop) | `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md` |
| Bucket B retrospective (Codex-as-architect debut) | `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md` |
| Satellite Pivot retrospective (community voting removed) | `docs/superpowers/specs/2026-04-29-satellite-pivot-retrospective.md` |
| GEE platform gotchas (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/gee_setup_gotchas.md` |
| Workflow practices — 14 standing practices (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md` |
| CLI reference (Codex/Gemini/Claude) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/cli_reference.md` |

---

## Commit log this project (45 commits as of 2026-04-29 mid-day)

```
7bf8284 fix(pivot): Codex post-review fixes — migration SQL, guardrails, stale copy
bd492e0 docs(supabase): write DROP migration for voting tables — DO NOT execute yet
bb550d6 feat(atlas): add Seeding mode, vigorColorFor fix, satellite-row in QuarterDetail
c50e6e2 chore(ui): remove community voting UI, copy, and live feed entirely
d99433d chore(ui): kill Farm Progress page; #dossiers silent-redirects to #map
6dfebf6 refactor(supa): quiesce voting backend — keep tips, remove vote reads/writes
43f6a98 feat(atlas): operator-relationship layer with popups + supporting data
30d6881 data(gee): regenerate imagery-data.js with Bucket B fields populated
1c49f11 fix(gee): Bucket B optical post-review — band-name + window + cloud filter
516d482 feat(gee): Bucket B commit 3 — optical features (NDTI/BSI/NDVI) per parcel
aa70b34 feat(gee): Bucket B commit 2 — wet-soil precip penalty wired in
af01c7a feat(gee): Bucket B commit 1 — schema plumbing (baseline_window, dvv_db, baseline_quality)
bc55706 docs(retro): Bucket A 3-round cleanup retrospective + status doc update
d7bf05e data(gee): regenerate imagery-data.js after Bucket A math fixes
4a7cfe6 perf(pipeline): VV in common_mask + single stats.getInfo() round-trip
dd8d66f fix(pipeline): replace CDL neq(0) with proper agricultural-class mask
f76352b fix(gee): Phase 5 fails closed when any parcel errored
b95b72a fix(gee): force T1/T0/cropland onto common valid-pixel support before reducing
de7f62d fix(gee): cropland_coverage uses mean of 0/1 mask, not count-of-counts (Bucket A round 2)
ac8d6db fix(gee): symmetric T1/T0 zero-guard + drop dead None checks (Bucket A polish)
0f797dc fix(gee): correct T0 snow QC math (S2 SCL aggregation + ERA5 scaling)
a29ab80 fix(gee): switch ΔVH computation to ratio-of-means
3994f35 docs: add canonical satellite seeding project status + next-session prompts
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
