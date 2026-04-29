# Session Retrospective — 2026-04-29 (early-morning) — Bucket B

**Topic:** Bucket B (schema completeness) of the Monette satellite seeding pipeline; first session using **Codex-as-architect** as part of the workflow
**Total commits:** 5 (4 code + 1 data refresh) on top of `bc55706`
**Wall-clock:** ~3 hours (~30 min Codex design pressure-test, ~30 min subagent implementation, ~30 min Codex review iteration + post-fix smoke test, ~35 min Phase 5 rerun, ~30 min docs/retrospective)
**Pickup point for next session:** Phase 4 UI integration

This retrospective extends the Bucket A loop's lessons (`docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md`). The new pattern this session: **Codex as a feature-building collaborator, not just a reviewer.**

---

## What shipped

| Commit | What | File |
|---|---|---|
| `af01c7a` | Schema plumbing: top-level `baseline_window`, `dvv_db` plumb-through, `baseline_quality` conditional, `_build_record` signature extended | `pipeline.py`, `build_imagery_data_js.py` |
| `aa70b34` | Wet-soil precip penalty: max precip across S1 contributing scene dates (not window-wide); ERA5 m→mm + negative-artifact clamp + null-image guard | `pipeline.py` |
| `516d482` | New `optical.py` module: single-best S2 scene picker (NOT median), conservative SCL `{4,5}` mask, parcel-mean NDVI gate at 0.25, min 50 valid pixels, 20m reduce | new `scripts/gee_pipeline/optical.py`, `pipeline.py` |
| `1c49f11` | Post-Codex-review fix: `.rename("valid")` for the reducer key bug; ±3-day symmetric → 10-day lookback-only window; drop CLOUDY_PIXEL_PERCENTAGE prefilter | `optical.py` |
| `30d6881` | Phase 5 rerun: regenerated `imagery-data.js` with Bucket B fields populated | `imagery-data.js` |

**Field coverage achieved (1,260 parcels):**

- `dvv_db` (active branches): **533 / 533** (100%)
- `baseline_quality` `"fresh"` vs `null`: 533 vs 727 (perfect — matches active-vs-non-active partition)
- `optical` populated: **1087 / 1260** (86%); full `ndvi+ndti+bsi` on 882; NDVI-only (gate fired) on 205
- `ndvi_mean` populated: 1087 (= optical count, side-effect of same compute)
- top-level `baseline_window`: present (sk/mb/mt/co)
- Precip penalty firings: 0 (verified honest — see "Lessons" #3 below)

---

## Architectural decisions made

| Decision | Rationale | Source |
|---|---|---|
| **Single-best Sentinel-2 scene per parcel** (NOT a median composite) | Median has no single sensing date; `source_scene` would be a fiction. Single-best gives an honest sensing date and clearer index semantics. Same lesson as Bucket A's snow QC fix. | Codex `b5ajsddp7` Q1 |
| **Max precip across S1 *contributing* dates**, not every calendar day or a fictional median date | T1 is a 14-day median composite — it has no scene date. Max-across-window penalizes rain days with no SAR acquisition (incorrect). Mean smears out the wet-day signal. Max-across-S1-contributing is the honest answer. | Codex `b5ajsddp7` Q2 |
| **Conservative SCL keep `{4 vegetation, 5 not_vegetated}`** — exclude class 7 (low-prob cloud) and class 2 (dark pixels) | "Not cloud classes" approach pollutes parcel-mean indices with noise. SCL is the parcel-scale truth at 20m; conservative inclusion is more honest than exclusion of obvious clouds. | Codex `b5ajsddp7` Q1 |
| **Parcel-mean NDVI gate at 0.25 for NDTI/BSI emission** (NOT per-pixel) | Spec §4.6 says "mean_NDVI < 0.25 over cropland pixels." Above that, the field has too much vegetation for tillage/bare-soil indices to be physically meaningful. Per-pixel would emit indices on isolated bare patches surrounded by canopy — misleading. | Codex `b5ajsddp7` Q1 confirming spec |
| **20 m reduce scale** for S2 indices | B11/B12/SCL are natively 20 m; B2/B4/B8 are 10 m but reducing at 10 m would mix resolutions in the same reducer call (subtle bias). 20 m matches the most-coarse band and aligns with the SAR pipeline. | Codex `b5ajsddp7` Q1 |
| **`baseline_quality` v1 shortcut: `"fresh"` for any readable T0; null for non-SAR branches** | Real `"fresh"` vs `"backfill"` distinction needs a sidecar `baseline_state.json` recording per-territory provenance. Sidecar is v1.5 work; v1 emits `"fresh"` when T0 is readable and documents the shortcut. | Codex `b5ajsddp7` Q3 |
| **Compute optical for ALL parcels surviving erosion+cropland** (active + non-active) | Spec promises optical broadly; NDVI also feeds the legacy vigor layer. But optical does NOT influence non-active seeding decisions — it's calibration data for v1.5. | Codex `b5ajsddp7` Q5 |
| **10-day lookback-only window** (not symmetric ±3) | Avoid future-lookahead in public "as-of" output (the dashboard at 2026-04-28 shouldn't use data from 2026-05-01). 10 days gives Sentinel-2's ~5-day mid-latitude revisit two chances at clear coverage. | Codex `bl5l9zfxa` Q1 |
| **Drop `CLOUDY_PIXEL_PERCENTAGE < 30` granule-level prefilter** | SCL is per-pixel cloud classification at 20 m, so SCL_KEEP + MIN_VALID_PIXELS is the parcel-scale truth. The granule prefilter culled scenes that had clean parcel-level coverage even when the granule overall was cloudy. | Codex `bl5l9zfxa` Q1 |
| **`.rename("valid")` after `scl_mask.And(cropland_mask)`** | `ee.Image.And()` preserves the FIRST operand's band name; scl_mask carries band `"SCL"` from `.select("SCL").eq(...)`. Without rename, the reducer dict keys are `{"SCL": <count>}` and `.getNumber("constant")` returned null on every scene — silently filtering all scenes out. | Codex `bl5l9zfxa` BLOCKER |

---

## Process highlight: Codex-as-architect

This was the first Bucket where Codex contributed *before code was written*, not just after.

**Old workflow (Bucket A):** Claude implements → subagent code review → Codex adversarial review → fixes → Codex re-review.

**New workflow (Bucket B):**
1. **Codex architecture pressure-test** (`b5ajsddp7`) — fed the spec + current pipeline state + 6 specific design questions; Codex returned written guidance per question.
2. **Plan synthesis** — Claude main session translated Codex's design feedback into a concrete implementer-subagent prompt with the design choices baked in (single-best scene, max-S1-contributing-precip, conservative SCL, etc.).
3. **Implementation** — Claude subagent dispatched with the full design baked into the prompt; produced 3 commits.
4. **Codex review** (`bl5l9zfxa`) — caught a critical band-name bug + window/filter refinements.
5. **Fix iteration** — main session applied the fix; smoke-tested.
6. **Codex final review** (`beyzs2ym9`) — sign-off.
7. **Phase 5 rerun + commit + docs**.

**What worked:**
- Codex's design pressure-test surfaced semantic decisions Claude-as-builder would have papered over (median composite vs single-best is a choice you don't notice unless someone asks "what does source_scene mean for a median?")
- The implementer subagent inherited a much higher-quality spec than it would have written for itself
- Codex's review then circled back to verify the implementation matched the design — which is where it caught the band-name bug
- The two roles (architect, reviewer) play together: Codex sets the bar, then checks the bar was met

**What was different from Bucket A:**
- Bucket A used Codex purely reactively (3 review rounds catching defects after-the-fact). Bucket B used Codex prospectively (design first, then verify).
- Cost: one extra Codex run per Bucket (the design pressure-test). At `gpt-5.5/xhigh` that's ~5–10 min wall-clock + ChatGPT-billed tokens.
- Benefit: probably saved one round of fix-iterate by getting the architecture right the first time. Hard to count counterfactually.

**Where to apply this pattern in the future:** any Bucket / phase that introduces new GEE patterns or non-trivial algorithmic choices. Pure mechanical schema work doesn't need it.

---

## Lessons learned

### 1. Codex's design pressure-test caught semantic decisions Claude wouldn't have thought to ask about.

The "median composite vs single-best scene" call is the canonical example. Without Codex asking the question, the implementer subagent would have defaulted to median (the "obvious" composite for a 14-day window) and the resulting `source_scene` field would have been a fictional median date. Future v1.5 calibration against vote labels would have struggled with a `source_scene` that doesn't match any real S2 acquisition.

The architecture pressure-test isn't just a code review preview — it's a chance to ask "what would future-you / future-collaborator be confused by?" Codex's `xhigh` reasoning is well-suited to that question.

### 2. The band-name bug pattern (`.And()` preserves first operand's band name) is a recurring GEE trap.

`ee.Image.And()`, `.Or()`, `.eq()`, `.lt()`, `.gt()`, etc. all preserve the FIRST operand's band name. Combining masks via `.And()` keeps the band you started with, not a generic "result" name. The reducer then has to look up THAT band name, not a default `"constant"`.

The pattern that's safe: explicitly `.rename(...)` after any logical-combinator chain that may obscure the band name. Documenting in `gee_setup_gotchas.md` for future reference.

This bug class wouldn't have been caught by:
- Unit tests (the failure is in EE server-side semantics, not Python logic)
- Smoke tests with a small N (the smoke test correctly observed `optical: null` everywhere but reasoned the wrong cause — high cloud cover — because that explanation was visible and superficially consistent)
- A static code review that doesn't trace EE band-name propagation through `.And()` chains

Codex's `xhigh` reasoning + web-search-verified GEE docs caught it.

### 3. The precip penalty correctly didn't fire — and verifying *why* matters.

Confidence histogram was byte-for-byte identical pre/post Bucket B. Two possible explanations for an unchanged confidence histogram: (a) the precip lookup is silently returning 0 due to a bug, OR (b) the actual S1 contributing dates happened to be dry. These produce identical observables.

Verifying (b) was real: traced PA's 3 contributing scenes — Apr 14 (24h-prior 0.07 mm), Apr 19 (0.0005 mm), Apr 26 (no ERA5 record yet, ~9 day lag). Max = 0.07 mm. Far below the 5 mm threshold. The 13 mm peak day in the broader window was on Apr 16-18 — NO S1 acquisition on those days, so per Codex's design call this rain correctly does NOT penalize.

Two takeaways:
- Always verify "no signal" in production output; it could mean working-as-designed OR silent bug. Indistinguishable from the output alone.
- The 24h-before-acquisition window is conservative for soil moisture (rain 2-3 days prior still affects SAR backscatter via residual surface moisture). v1.5 calibration should consider broadening to `N days before each acquisition` once vote labels accrue.

### 4. ERA5 lag silently affects late-window scenes.

PA's Apr 26 S1 scene's ERA5 lookup returned size=0 — the "9-day lag" Codex flagged in Bucket A's review. The pipeline correctly skips that scene's contribution (rather than crashing). But the operator can't see this from the output without instrumenting — it manifests only as "max precip slightly lower than the true maximum" because some scenes are silently dropped.

v1.5 should add a `precip_data_partial: true | false` flag (or equivalent) to the per-parcel record when ANY contributing scene's ERA5 lookup was lag-dropped. Then the UI can show a "soil-moisture data was partial for this scene" caveat where appropriate.

### 5. Confidence-unchanged is a useful negative signal.

The fact that pre/post-Bucket-B confidence histograms were identical is itself a signal: it confirms Bucket B touched only NEW slots (`dvv_db`, `optical`, `baseline_quality`) and didn't accidentally regress the SAR math from Bucket A. A regression would have shown up as a confidence shift on the active parcels.

Practice: at every Bucket landing where the SAR math should be unchanged, re-emit the confidence histogram and verify it's stable. Any unexpected shift is a regression signal.

---

## Standing practices added or refined

The Bucket A retrospective established 8 standing practices. Bucket B reinforces all eight and adds:

### 9. For non-trivial Bucket / phase work, Codex pressure-tests architecture *before* code is written.

Pattern: feed Codex (`gpt-5.5/xhigh`) the spec + current code state + 5–10 specific design questions; receive written guidance per question; bake the answers into the implementer-subagent's prompt. Cost: one extra Codex run (~5–10 min). Benefit: probably saves a round of fix-iterate by getting architecture right first time.

When to use: any work that introduces new GEE patterns, new algorithmic choices, or new schema fields with subtle semantics.

When to skip: pure mechanical refactors, schema renames, or fixes to a well-specified bug.

### 10. Always verify "no signal" in production output to distinguish working-as-designed from silent bug.

If a feature you just shipped doesn't fire on the production data, ASK WHY. Two explanations always exist (working-as-designed vs silently broken) and they're indistinguishable from the output alone. Trace one or two specific cases to confirm the working-as-designed explanation.

This applies to: confidence penalties not firing, optical:null, applicability shifts, polygon_quality flags, etc.

### 11. `.rename(...)` defensively after EE logical-combinator chains.

`.And()`, `.Or()`, `.eq()`, etc. preserve the FIRST operand's band name. If you build a derived image via these and then reduce it, name the result explicitly so downstream `.getNumber(name)` lookups don't depend on which operand you happened to pass first. Pattern:

```python
combined = mask_a.And(mask_b).rename("valid")
combined.reduceRegion(...).getNumber("valid")  # explicit, robust
```

---

## Next session pickup (priority order)

1. **Phase 4 UI integration** (~half-day code + smoke test). Spec §6 has the full fill-encoding tables. Five surfaces:
   - Atlas map mode toggle in `view-map.jsx` (Tenure / Vigor / Seeding / [Harvest placeholder]; mutually exclusive; localStorage persist; default Seeding mode Apr 1 – Jun 30 per spec)
   - `buildPreparedMapData()` extension to copy `seeding_seeded`, `seeding_confidence`, `seeding_applicability`, `polygon_quality` into Mapbox feature properties (Codex's rev-3 audit flagged this previously)
   - Drawer satellite-row in `property-drawer.jsx` per parcel + collapsible optical-features panel (NDTI/BSI/NDVI + source_scene)
   - Farm Progress satellite counter in `view-dossiers-index.jsx`: "🛰 Satellite signal: A of 14 properties likely seeded"
   - CSS for new mode pills, polygon-QC dashed-outline, disagreement icon when satellite + vote disagree

2. **Bucket C — production readiness** (~3–4 hr). Server-side `reduceRegions` per territory shard; S1 collection filter completeness (VV/VH `listContains`, resolution, edge masking — Codex flagged worth doing now since `dvv_db` is live); ERA5 lag dynamic detection + `precip_data_partial` flag.

3. **Genoa CO `cropland_coverage = 0` diagnosis** (small, non-blocking from Bucket A loop). Both perennial parcels return cc=0 while modal class is alfalfa — pixel-alignment edge case at the small CO bbox + the new strict CDL filter.

4. **Mid-May calendar item.** Once ERA5 publishes through May ~21, rerun SK T0 to catch the northern SK spring thaw → unblock Hafford/Kamsack/Wymark active calls.

5. **Phase 7 — vote-label loop** (post-v1).

6. **Phase 8 — per-territory threshold calibration** (after ~50–100 vote labels accrue). Codex flagged precip-window calibration (24h vs N-day) and per-territory NDTI/BSI percentile cutoffs as candidates.

---

## Reference index

| Topic | Path |
|---|---|
| Canonical project status | `docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md` |
| Design contract (spec, rev 4) | `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` |
| Phenology calibration table | `docs/superpowers/specs/2026-04-28-phenology-priors.md` |
| v1 ship + initial Codex review retrospective | `docs/superpowers/specs/2026-04-28-session-retrospective.md` |
| Bucket A cleanup retrospective (3-round Codex review loop) | `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md` |
| **This file (Bucket B retrospective + Codex-as-architect workflow)** | `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md` |
| GEE platform gotchas (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/gee_setup_gotchas.md` |
| Workflow practices (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md` |
| CLI reference (Codex/Gemini/Claude) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/cli_reference.md` |
