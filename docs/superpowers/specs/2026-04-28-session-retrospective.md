# Session Retrospective — 2026-04-28

**Topic:** Monette satellite seeding pipeline v1 (Phase 0 → Phase 5)
**Total commits:** 22
**Wall-clock:** ~7 hours, ~3 hours of which was GEE compute waits
**Pickup point for next session:** Phase 4 UI integration

---

## What shipped

Producer-side v1 of the satellite seeding detection pipeline, end-to-end verified at 1,260-parcel scale across all 14 mapped Monette properties.

| Layer | Files | Status |
|---|---|---|
| Spec + plan | `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` (rev 4), `docs/superpowers/plans/2026-04-28-monette-satellite-seeding-foundation.md` | Codex-audited (yes-with-revisions @ 82% confidence pre-shipping) |
| Auth | `scripts/gee_pipeline/auth.py` | SA → ADC → user-OAuth fallback; ADC active for v1 |
| Pure-function modules | `scripts/gee_pipeline/{qc,applicability,confidence,decision_rule}.py` | 42 passing unit tests |
| GEE algorithm | `scripts/gee_pipeline/{relative_orbit,t0_baseline,pipeline}.py` | All run end-to-end on real data |
| Producer | `scripts/{upload_parcels_asset,build_imagery_data_js}.py` | 1,260-parcel run produces clean schema-compliant output |
| Phenology priors | `docs/superpowers/specs/2026-04-28-phenology-priors.md` | Gemini-produced per-territory threshold table with citations |
| Live data | `imagery-data.js` (581 KB), GEE assets at `monette-494717/assets/monette/` | Phase 5 deliverable committed |

### Phase 5 distribution (the ground truth of what got built)

| Territory | Total | Active | Insuf. | Out-of-season | Perennial |
|---|---:|---:|---:|---:|---:|
| **SK (10 properties)** | 850 | 420 (49%) | 354 (42%) | 76 (9%) | 0 |
| **MB Eddystone** | 165 | 0 | 163 | 2 | 0 |
| **MT Big Horn** | 220 | 115 (52%) | 8 | 69 | 28 |
| **AZ Aguila** | 23 | 0 | 23 | 0 | 0 |
| **CO Genoa** | 2 | 0 | 0 | 0 | 2 |
| **TOTAL** | **1,260** | **535** | **550** | **145** | **30** |

---

## Architectural decisions made (and why)

| Decision | Rationale | Commit |
|---|---|---|
| Tri-state `seeded: true | false | null` (not pure binary) | Codex audit of rev 2 spec flagged that public "seeded ✓" claims were over-confident given v1 thresholds aren't calibrated against ground truth | spec rev 4 (`d219faa`) |
| Drop S1 orbit pinning | Empirical: SK bbox spans 4° latitude (Vanguard 49°N → Hafford 53°N), wider than a single S1 ground-track swath. Per-territory orbit picker chose orbit 129; that orbit doesn't fly over Hafford | `91f9c06` |
| Hybrid S2 SCL primary + ERA5 fallback for snow QC | ERA5 9km grid stays at ~68% snow even when 20m S2 pixels are bare; pure S2 fails on small bboxes (Eddystone, Genoa) when ±1-day window is empty | `91f9c06` |
| Eager `InsufficientBaselineError` detection | Cheap `qualifying.size().getInfo()` upfront avoids cryptic "Image with no bands" errors deep in the export | `f399cd5` |
| Asset-existence probe before reading T0 | MB has no T0 asset; `ee.Image()` would crash later. `ee.data.getAsset()` probe gives clean insufficient_baseline | `007a6ba` |
| ADC auth instead of service-account JSON keys | Org-policy `iam.disableServiceAccountKeyCreation` blocks SA-key creation on Cloud Identity orgs (auto-applied to personal Gmails using Cloud services) | `b4b2750` |
| Drop AZ-territory short-circuit; per-parcel applicability | Hardcoded "perennial_or_out_of_season" string wasn't in the Applicability Literal type → schema violation | `007a6ba` |

---

## Known v1 limitations

Each is documented + has a clear path to resolution:

| Limit | Affected | Mitigation | Resolution path |
|---|---|---|---|
| Northern SK insufficient_baseline (Hafford, Kamsack, Wymark) | ~300 SK parcels | All graceful `null` records on map | ERA5 publishes spring-thaw scenes mid-May → rerun SK T0 |
| MB Eddystone insufficient_baseline | 165 parcels | All graceful `null` records | Same ERA5 catch-up unblocks MB |
| AZ Aguila insufficient_baseline (no T0) | 23 parcels | All graceful `null` records | Out-of-scope for spring v1; v1.5 builds AZ T0 with cotton/alfalfa-specific window if needed |
| ~10–20% ΔVH bias from incidence-angle mixing | All territories | Documented in spec §4.2 | v1.5 plan: per-property orbit pinning + per-property baselines |
| Prince-Albert ΔVH anomaly (+9.32 dB across 19/19 parcels, conf 100%) | 19 parcels (very visible on map) | None yet | Phase 8 calibration with vote labels; or earlier diagnostic if anomaly persists |
| `prior_crop: "unknown"` for 102/158 Hafford parcels (and many AZ) | UI rendering | None yet | v1.5 expand `CDL_CLASS_TO_NAME` + `ACI_CLASS_TO_NAME` maps based on actual class IDs encountered |
| `optical: null` (NDTI/BSI/NDVI features) | All records | None | v1.5 wires Sentinel-2 optical confirmation per spec §4.6 |
| `ndvi_mean: null` (vigor display) | All records | Existing `vigor_color` consumer in view-map.jsx returns null gracefully | Phase 4 work — wire NDVI compute through `pipeline.py` |
| Vote-label loop (Supabase exporter, calibration) | All records | All records have `seeding_confidence` for visible uncertainty | Phase 7 work, post-v1 |

---

## Lessons learned (process)

These shaped how we'll work going forward:

1. **Spec audits catch algorithm-level bugs; production runs catch operational bugs.**
   Codex's rev-2 audit caught the SAR-units math error and the unreachable negative threshold. But it couldn't have caught GEE's per-account orbit coverage, ERA5's publication lag, or AZ org-policy blocking SA keys. Both layers of review are necessary.

2. **GEE failures often surface as cryptic deep-stack errors.** "Image has no bands" turned out to be three separate root causes: empty S2 SCL collection over small bboxes, missing ERA5 lookup for recent dates, and zero-qualifying-scenes from the QC gate. Each required separate investigation. The pattern: when a GEE error is "image has 0 bands at <some operation>," the actual cause is upstream — usually an empty `ImageCollection.median()`.

3. **Asset-namespace provisioning is invisible until you try to write to it.** `ee.Initialize` works without it; `ee.Image` works without it. Only `ee.batch.Export.*.toAsset()` fails. The fix (clicking the Assets tab in Code Editor) takes 5 seconds but is non-discoverable from CLI/code. Documented in `gee_setup_gotchas.md`.

4. **Subagents don't have completion notifications like the main session does.** Two subagents this session "armed Monitor and waited for events" then exited prematurely. The pattern that works: subagents do bounded synchronous work and report back; the main session handles long-running async work with `run_in_background: true` Bash commands.

5. **Plan back-patches matter.** The plan was a starting point. Reality diverged in 4 places (test count off-by-one, parcel-name typo, orbit-drop, hybrid snow QC). Each got back-patched as a "Implementation divergence" callout in the plan + a corresponding commit message. Future sessions reading the plan see the corrections inline rather than tripping over the same issues again.

6. **The "produce → review distribution → fix → re-run" loop is the right workflow for GEE pipelines.** Phase 5 went through 4 rounds, each surfacing a distinct edge case (parcel-list format, AZ branch + MB missing-T0, small-parcel erosion). Each round took ~25 min compute but caught issues that no static review would have surfaced.

---

## Standing practices going forward

Established this session, applies to all future work on this pipeline:

1. **Every "Phase X complete" milestone gets a Codex (or Gemini for big-context) adversarial review** before declaring done. Use `codex exec --enable web_search` for algorithmic review; use Gemini for multi-file code review at scale.

2. **Every milestone gets a retrospective doc** at `docs/superpowers/specs/<date>-<topic>-retrospective.md` capturing what shipped, what was learned, what's pending. This file is the template.

3. **Plan + spec back-patching** when reality diverges. Add an "Implementation divergence" callout in the plan section; update the spec when v1 retreats from a stricter ideal. Commit message references both.

4. **Memory updates for cross-session lessons.** Anything that took >30 min to figure out and would happen the same way next time goes into `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/<topic>.md`.

5. **Subagents for bounded work, main session for long-running.** Subagents implement specific tasks (read plan section, write code, run tests, commit). Long-running async work (T0 exports, full-territory runs) goes via `run_in_background: true` Bash with proper notification.

6. **Distribution gates are the final word, not the spec.** Plans and specs document intent; the distribution of an actual run on real data is the only proof the pipeline ships correct results. Always run + review distribution before declaring a phase done.

---

## Next session pickup

In priority order:

### Phase 4 — UI integration (Claude/subagent JSX + CSS work)

The producer's output (`imagery-data.js` with 1,260 parcels) is sitting on disk waiting to be rendered. Three surfaces:

1. **Atlas map mode toggle** in `view-map.jsx` — add Seeding mode alongside the existing Tenure / Vigor modes, plus the Harvest placeholder. Mutually exclusive. Persist to `localStorage`. Default: Seeding mode Apr 1–Jun 30.
2. **Property drawer satellite-row** in `property-drawer.jsx` — alongside the existing vote tally, show "🛰 Likely seeded (X%)" / "Likely not seeded (X%)" / "Uncertain (X%)" / "No current scene" per parcel.
3. **Farm Progress satellite counter** in `view-dossiers-index.jsx` — add a parallel line under existing vote-confirmed counter showing "🛰 Satellite signal: A of 14 properties likely seeded".
4. **`buildPreparedMapData()`** in `view-map.jsx:586–590` MUST be extended to copy `seeding_seeded`, `seeding_confidence`, `seeding_applicability`, `polygon_quality` into Mapbox feature properties — Codex's rev-3 audit flagged this; without it, the Mapbox fill expressions can't read the new fields.
5. **CSS** for the new mode pills + drawer row + the polygon QC dashed-outline distinction (high vs low quality).

Spec §6 has the complete fill encoding tables. Plan doesn't have detailed Phase 4 tasks yet — would benefit from a small follow-up plan before dispatch.

### v1.5 work (mid-May or later)

- Rerun SK T0 once ERA5 publishes through May (catches northern SK spring thaw → unblocks Hafford + Kamsack + Wymark)
- Per-property orbit pinning + per-property T0 baselines for SK (eliminates the 10-20% ΔVH bias)
- Expand `CDL_CLASS_TO_NAME` and `ACI_CLASS_TO_NAME` maps from actual class IDs encountered in Phase 5 data
- Wire optical (NDTI/BSI/NDVI) per spec §4.6
- Vote-label loop (Supabase exporter + drawer disagreement UI) — Phase 7
- Per-territory threshold calibration once ~50–100 vote labels accrue — Phase 8

### Investigations to keep on the radar

- **Prince-Albert ΔVH anomaly** (+9.32 dB across 19/19 parcels with 100% confidence). Could be PA-specific T0 noise or genuinely wet ground from recent rain. Easy diagnostic: sample S1 backscatter directly over PA on multiple recent dates and compare to T0 backscatter. If T0 shows abnormally low VH at PA's location, T0 noise is the cause.
- **AZ + CO behavior with optical sub-block** — when v1.5 wires NDVI + NDTI for these CDL-CONUS territories, the perennial alfalfa parcels may show distinctive NDVI patterns worth surfacing in the drawer.

---

## Memory + reference material updated this session

External to the repo, lives at `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/`:

- **`gee_setup_gotchas.md`** — appended sections on (a) asset subfolder creation, (b) `iam.disableServiceAccountKeyCreation` org-policy block, (c) earthengine-CLI doesn't pick up ADC, (d) S1 orbit coverage doesn't match territory bboxes, (e) ERA5 vs S2 snow detection at parcel scale.
- **`cli_reference.md`** — corrected Codex flag (`--enable web_search` is current, not the deprecated `--search`).
- **`MEMORY.md`** index — gained the gee_setup_gotchas pointer.

Future Claude sessions on this codebase inherit these automatically.
