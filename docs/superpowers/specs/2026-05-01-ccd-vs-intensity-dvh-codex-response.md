Reading additional input from stdin...
OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Users\kyle\Agriculture\Monette
model: gpt-5.5
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: xhigh
reasoning summaries: none
session id: 019df43a-a124-7e03-9828-aa9ddf231fd9
--------
user
Read the file docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md in this repository. It contains a design pressure-test request from Claude Code on behalf of the Monette satellite seeding pipeline project. The spec defines context, decision space, and 7 specific design questions (Q1-Q7) with a requested output format. Respond to each question independently per the requested format, then provide a Final Recommendation synthesizing your answers. Use web search to verify technical claims about Sentinel-1 SLC products in Google Earth Engine, current native CCD/coherence capabilities in GEE, the cited Singh et al. 2025 IEEE JSTARS paper (https://ieeexplore.ieee.org/document/11130190/), and AAFC RCM compact polarimetry literature. Cite all sources. The response should be a complete structured markdown document suitable for archival in our specs directory.
deprecated: `[features].web_search` is deprecated because web search is enabled by default.
Set `web_search` to `"live"`, `"cached"`, or `"disabled"` at the top level (or under a profile) in config.toml if you want to override it.
codex
I’ll ground this in the repo spec first, then verify the satellite/CCD claims against primary or near-primary sources before writing the archival answer. I’m also doing a quick memory pass because this Monette satellite pipeline has prior architecture decisions that may matter.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md'" in C:\Users\kyle\Agriculture\Monette
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"Sentinel|seeding|satellite|CCD|coherence|RCM|Singh|Earth Engine|GEE|DVH|intensity\" 'C:\\Users\\kyle\\.codex\\memories\\MEMORY.md'" in C:\Users\kyle\Agriculture\Monette
 succeeded in 348ms:
# Codex-as-Architect Pressure Test â€” InSAR CCD vs Intensity Î”VH

**Date:** 2026-05-01
**Codex effort:** xhigh (override of project-pinned medium for design pressure-test)
**Status:** sent â€” awaiting Codex response
**Decision owner:** Kyle, with Codex design input

---

## Background

The Monette satellite seeding pipeline detects whether agricultural parcels have been seeded by analyzing Sentinel-1 SAR data. Current implementation computes a backscatter *intensity* delta:

```python
# scripts/gee_pipeline/pipeline.py:536
mean_dvh_db_value = 10 * math.log10(mean_t1_vh_val / mean_t0_vh_val)
```

Where:
- `mean_t1_vh_val` is the parcel-mean VH backscatter from a 14-day rolling median composite of recent S1 GRD_FLOAT scenes
- `mean_t0_vh_val` is the parcel-mean VH backscatter from a fixed-window T0 baseline (Feb 15 â€“ Apr 15 for SK/MB, Feb 1 â€“ Mar 15 for MT/CO), median-composited and exported as a GEE Asset
- The result is a per-parcel Î”VH in decibels; +1.5 dB â†’ seeded=True, -1.5 dB â†’ seeded=False, otherwise null (subject to confidence floor of 65)

This is intensity-based change detection. It measures *how much* radar power comes back from the parcel, comparing T1 to T0.

A 2026-05-04 literature review (Google Deep Research output, archived at `docs/Satellite Imagery for Seeding Detection.docx`, curated at `docs/references/satellite-imagery-seeding-detection-2026-05-04.md`) recommends a fundamentally different approach: **InSAR Coherent Change Detection (CCD)**.

CCD measures *phase* coherence between two consecutive SAR scenes â€” whether scattering elements within each pixel have moved at the millimeter scale (a fraction of the C-band 5.6 cm wavelength). The mechanism for seeding detection: a no-till drill's coulters and press wheels physically displace soil and residue at sub-centimeter scale, dropping interferometric coherence sharply even when the bulk surface roughness barely changes.

The doc cites Singh et al. 2025 (IEEE JSTARS, https://ieeexplore.ieee.org/document/11130190/) achieving RMSE 5.59 days on dual-orbit Sentinel-1 coherence over 3,000+ Ontario fields. The doc doesn't cite a comparable benchmark for intensity-based Î”VH on the same problem.

---

## Our specific operating context

| Constraint | Value |
|---|---|
| Total parcels in dataset | 1,260 |
| Active SAR-eligible parcels (current) | 533 |
| Properties (geographic clusters) | 14 across SK, MB, MT, CO, AZ |
| Use case | CCAA creditor monitoring â€” "is this parcel seeded as of date D, yes / no / withheld" |
| Decision granularity | Per-parcel boolean + confidence + reason, NOT seeding-date regression |
| Update cadence | Property-scoped reruns triggered by smoke validation; not real-time |
| Compute environment | Google Earth Engine via Python `ee` API |
| GEE assets in use | `COPERNICUS/S1_GRD_FLOAT`, `COPERNICUS/S2_SR_HARMONIZED`, `ECMWF/ERA5_LAND/DAILY_AGGR`, USDA/CDL/2025, AAFC/ACI/2024, custom T0 baseline assets |
| Auditability requirement | High â€” calls may need to be defended in court / creditor disputes |
| Ground truth | None yet (planned for v1.5 vote-label loop) |
| Active branch | `feat/seeding-calibration` at commit `2632275` |

Today (2026-05-01) we ran 3-parcel smokes on PA + Raymore. Results showed the intensity Î”VH method *is* detecting signal â€” borderline parcels move from confidence=54 to confidence=100 as snow gates clear, decisive negatives are stable, the per-parcel local-AOI snow gate fires correctly. We have a working v1 system. The question is whether CCD would meaningfully improve it for our specific use case.

---

## The decision space

| Option | Description |
|---|---|
| **A. Stay with intensity Î”VH** | Don't introduce CCD. Our current method works, RMSE 5.59 days is for date-of-seeding regression which is a different problem from our boolean classification. |
| **B. Layer CCD alongside intensity Î”VH** | Compute both. Use them as independent signals that must agree before calling seeded. Disagreement â†’ null with diagnostic info. |
| **C. Switch to CCD as primary, retire intensity Î”VH** | Adopt the literature's recommended state-of-the-art. Risk: we lose the working v1 method while transitioning. |
| **D. CCD as confidence booster only** | Keep intensity Î”VH as the decision rule. Compute coherence as a quality signal that *upgrades* confidence when it agrees with the intensity call. |

---

## Specific design questions for Codex

Please respond to each question independently with your reasoning, evidence cited, and a clear position.

### Q1. Problem-method fit

For the *specific use case* of "is this parcel seeded as of date D" (boolean classification with optional withhold), is InSAR coherence actually a better signal than intensity Î”VH? The literature benchmark (RMSE 5.59 days) is for seeding-date *regression* across 3,000+ Ontario fields. Does that performance translate to per-parcel boolean classification at our scale (~533 active parcels)? What's the strongest counter-argument for staying with intensity Î”VH?

### Q2. GEE feasibility cost

Sentinel-1 SLC products (required for coherence) are available in GEE as `COPERNICUS/S1_GRD` only after preprocessing â€” true SLC interferometry requires either ESA's SNAP toolbox externally or the limited GEE-native coherence implementations. What's the realistic GEE-native path to compute parcel-level coherence at production scale (533+ parcels, weekly update cadence)? Are there hybrid approaches (precompute coherence asset externally, ingest into GEE) that are practical?

### Q3. Coherence's own gotchas

Our intensity Î”VH pipeline has known traps: rolling 14-day window slide, S1 orbit-coverage gaps for territories >3Â° latitude, ERA5 publication lag, snow/freeze contamination. What are the analogous traps for coherence-based detection? Specifically:
- Does coherence have the same per-pixel masking requirements (cropland, polygon quality) as intensity?
- Is coherence equally sensitive to snow/freeze contamination, or does it have different failure modes?
- What's the temporal baseline (days between scenes) sweet spot for spring seeding detection in C-band?
- Does coherence work on parcels at the edge of S1 swath coverage (where intensity also struggles)?

### Q4. Combination logic if we layer them (Option B/D)

If we compute both intensity Î”VH and coherence per parcel, what's the right combination logic?
- Logical AND (both must indicate seeded)?
- Logical OR (either indicates seeded)?
- Confidence-weighted (intensity is primary, coherence is a tiebreaker)?
- Disagreement-as-signal (intensity says seeded, coherence says no â†’ null with reason)?

What does the literature suggest, and what's your design recommendation given our auditability requirement?

### Q5. Transition path if we adopt (Options B, C, or D)

If we decide to adopt CCD in some form, what's the safest transition path?
- Parallel implementation in a separate module (`coherence.py`) with no schema impact, allowing offline comparison runs?
- Add coherence as a new schema field that doesn't affect the decision rule until calibrated?
- Full migration with feature flag?
- Staged property-by-property rollout?

How do we avoid losing the working v1 method while adopting the new one?

### Q6. Effort estimate

For your recommended option, what's a realistic effort estimate (Codex-as-architect prep + Claude implementation + smoke validation cycles) to ship to production? We have a Bucket A/B/C/D milestone pattern from prior retrospectives â€” does this fit as a "Bucket E" or is it a smaller layered increment?

### Q7. What you'd need to verify before committing

Are there specific empirical tests we should run *before* committing to a path? Examples:
- Compare coherence vs intensity on the same parcels we've smoked today (PA NW-32-51-23-W2, Raymore SW-7-26-20-W2)
- Run the IEEE Singh et al. methodology on a small Saskatchewan subset and compare RMSE to our existing data
- Stress-test coherence on the snow/freeze-blocked properties (Hafford, Eddystone) to see if it has different failure modes than intensity

---

## Reference materials

- **Source literature review:** `docs/references/satellite-imagery-seeding-detection-2026-05-04.md` (curated) and `docs/Satellite Imagery for Seeding Detection.docx` (full original)
- **Current pipeline:**
  - `scripts/gee_pipeline/pipeline.py` (especially line 536 for the dvh formula)
  - `scripts/gee_pipeline/t0_baseline.py` (T0 construction)
  - `scripts/gee_pipeline/decision_rule.py` (tri-state classification)
  - `scripts/gee_pipeline/qc.py` (snow/freeze/precip predicates)
- **Methodology log:** `docs/logs/seeding-calibration.md`
- **Today's smoke results:**
  - `scripts/gee_pipeline/_pa_smoke_2026_05_01_results.json`
  - `scripts/gee_pipeline/_raymore_smoke_2026_05_01_results.json`
- **Prior Codex-as-architect precedents:**
  - `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md` (Codex `b5ajsddp7` â€” first architect role; established the pattern)
  - `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md` (Codex review-only loop)
- **Key citations from doc:**
  - Singh et al. 2025 IEEE JSTARS: https://ieeexplore.ieee.org/document/11130190/
  - AAFC RCM + S1 harvest detection: https://www.tandfonline.com/doi/full/10.1080/01431161.2026.2612904
  - Mahdianpari RCM compact pol crops: https://www.tandfonline.com/doi/full/10.1080/07038992.2022.2121271

---

## Requested output format

For each Q1â€“Q7, provide:
1. **Position** â€” clear one-sentence recommendation
2. **Reasoning** â€” 2-4 paragraphs of supporting evidence and analysis
3. **Confidence** â€” high / medium / low, with what would move you to higher confidence

End with a **Final Recommendation** section that synthesizes your answers into one of the four options (A/B/C/D) plus a concrete first step. Use web search where needed to verify recent GEE capabilities, the Singh et al. paper specifics, or other technical claims. Cite sources for any specific performance numbers or implementation details.


 succeeded in 2231ms:
751:# Task Group: Bushel Board dashboard IA, premium seeding UI, cohesion mockups, and overlay concepts
753:scope: Dashboard information-architecture audits, premium seeding UI component work, farmer-friendly static mockups, and ranked map-overlay ideation for Bushel Board; use when comparing current dashboard reality to design docs, building dashboard components, or exploring new visual directions.
784:- docs/plans/mockups/2026-04-27-cohesion-audit, manifest.json, seeding-base.html, overview-base.html, overview-variant-1.html, SectionHeader, GlassCard, app/globals.css, SVG glyphs, no JavaScript, under 30KB
790:- rollout_summaries/2026-04-28T18-17-00-geDn-premium_seeding_focus_map_glass_tooltip_build_blocked.md (cwd=C:\Users\kyle\Agriculture\bushel-board-app, rollout_path=C:\Users\kyle\.codex\sessions\2026\04\28\rollout-2026-04-28T12-17-00-019dd54f-0c14-79a1-b60b-b4d3d7217a81.jsonl, updated_at=2026-04-28T18:30:51+00:00, thread_id=019dd54f-0c14-79a1-b60b-b4d3d7217a81, partial; implemented `seeding-focus-map.tsx` and `seeding-state-tooltip.tsx`, passed focused ESLint, but production build and git staging were blocked by environment limits)
794:- SeedingFocusMap, seeding-focus-map.tsx, seeding-state-tooltip.tsx, SeismographGlyph, react-map-gl/mapbox, GlassCard, useReducedMotion, next/font, Google Fonts, npm.cmd, .git/index.lock, Permission denied, focused ESLint
832:- `components/dashboard/seeding-small-multiples.tsx` is the best contract reference for seeding visuals: the parent owns `currentWeek` and `selectedCommodity`, and downstream visuals should stay controlled instead of forking their own week state [Task 4]
833:- `components/dashboard/seeding-seismograph-glyph.tsx` is the canonical state marker and already contains the scan-line/current-week logic; reuse it rather than reimplementing glyph math in map markers [Task 4]
834:- The premium focus-map implementation from this run added `components/dashboard/seeding-focus-map.tsx` and `components/dashboard/seeding-state-tooltip.tsx` using `react-map-gl/mapbox`, `Marker`, `GlassCard`, container-bounded tooltip clamping, and `useReducedMotion()`-aware motion behavior [Task 4]
836:- Focused verification for small Bushel Board UI slices can use `npx.cmd eslint components/dashboard/seeding-focus-map.tsx components/dashboard/seeding-state-tooltip.tsx` even when repo-wide `tsc --noEmit` is noisy from unrelated failures [Task 4]
847:- Symptom: production build verification fails before reaching the new seeding components. Cause: `next/font` cannot fetch Google Fonts in the network-restricted shell. Fix: report the exact font-fetch blocker and separate focused component checks from full production-build proof [Task 4]
849:- Symptom: a seeding tooltip or marker implementation drifts away from the brief. Cause: tooltip logic is attached to basemap hover or the component forks its own week state. Fix: anchor interaction to the glyph markers and preserve the parent-controlled `currentWeek` contract [Task 4]
852:# Task Group: Official Canada/U.S. seeding-progress lookup
854:scope: Official-source lookup memory for latest reported seeding or planting progress across Canadian provinces and U.S. states; use for current crop-progress asks, not forecasts or pipeline implementation work.
857:## Task 1: Find 2026 seeding progress for Canada and U.S. jurisdictions, returned U.S. state coverage plus Canada status notes
861:- rollout_summaries/2026-04-28T00-46-29-llvX-2026_seeding_progress_canada_us_official_crop_progress.md (cwd=C:\Users\kyle\Agriculture\Monette, rollout_path=C:\Users\kyle\.codex\sessions\2026\04\27\rollout-2026-04-27T18-46-29-019dd18d-43c8-7ed0-8697-53bfea946209.jsonl, updated_at=2026-04-28T00:50:51+00:00, thread_id=019dd18d-43c8-7ed0-8697-53bfea946209, partial; USDA state-by-state planting progress was compiled from the April 26, 2026 release week, while Canada remained a coverage/status pass because official province percentages were not available)
865:- USDA Crop Progress, ESMIS, prog1726.txt, QuickStats 401 Unauthorized, seeding progress, planting progress, Canada provinces, U.S. states, days suitable for fieldwork, 2026_us_seeding_progress_by_state_apr26.csv, 2026_canada_seeding_progress_by_province_apr28.csv
869:- when the user asks for "the seeding progress for 2026" and for "every single state in the USA that has commercialized farming" -> future runs should cover the full requested jurisdiction set instead of answering with a few headline regions [Task 1]
870:- when the accepted framing is "latest reported 2026 planting/seeding progress" -> default to report-based official updates, not forecasts or synthesized estimates [Task 1]
876:- The validated U.S. artifact from this run was `C:\Users\kyle\Agriculture\Monette\2026_us_seeding_progress_by_state_apr26.csv`, built from the USDA April 26, 2026 reporting week and carrying crop-specific planting percentages plus `days suitable for fieldwork` [Task 1]
877:- The Canada artifact was `C:\Users\kyle\Agriculture\Monette\2026_canada_seeding_progress_by_province_apr28.csv`, which intentionally recorded coverage/status notes rather than invented province percentages [Task 1]
883:- Symptom: Canada output looks artificially precise. Cause: qualitative provincial notes or seeded-area surveys are coerced into percent-complete values. Fix: keep Canada as status-only when official province-by-province seeding percentages are not published yet [Task 1]
1137:## Task 1: Audit the current map and research parcel-level satellite / vegetation-vigor options
1141:- rollout_summaries/2026-04-23T05-33-57-CI50-monette_map_research_and_farmer_friendly_build_brief.md (cwd=C:\Users\kyle\Agriculture\Monette, rollout_path=C:\Users\kyle\.codex\sessions\2026\04\22\rollout-2026-04-22T23-33-59-019db8d4-a5de-7f12-b8ec-a22a55fb44c6.jsonl, updated_at=2026-04-23T05:55:11+00:00, thread_id=019db8d4-a5de-7f12-b8ec-a22a55fb44c6, success; current map stack audited and satellite/NDVI direction researched)
1145:- Mapbox, Sentinel-2, NDVI, vegetation vigor, view-map.jsx, config.js, quarters.geojson, quarters-data.js, parcel geometry, property footprints, Sentinel Hub Statistical API, AAFC Annual Crop Inventory, The Pas, mapbox://styles/mapbox/satellite-streets-v12
1217:## Task 9: Research cross-border seeding-progress satellite architecture and reject the Mapbox-native assumption
1221:- rollout_summaries/2026-04-28T04-51-56-QZTV-cross_border_seeding_satellite_research_mapbox_noaa_eccc.md (cwd=C:\Users\kyle\Agriculture\Monette, rollout_path=C:\Users\kyle\.codex\sessions\2026\04\27\rollout-2026-04-27T22-51-56-019dd26d-fa28-7890-a21d-345bb62f58bf.jsonl, updated_at=2026-04-28T04:59:33+00:00, thread_id=019dd26d-fa28-7890-a21d-345bb62f58bf, success; set the satellite stack direction to one cross-border model with country-specific calibration layers)
1225:- Sentinel-1, Sentinel-2, NASA HLS, Mapbox Satellite, NOAA GOES, NOAA VIIRS, ECCC, AAFC, StatsCan, CSA RADARSAT, PlanetScope, seeding likely, emergence confirmed, cross-border model
1243:- when the user asks `what satellite feeds would I need access to` and `Does mapbox provide anything for this already that is native?` -> answer with the data-source truth first and treat Mapbox as the display layer unless proven otherwise [Task 9]
1245:- when the user asks whether NOAA/ECCC or Canada-vs-USA require different satellites -> default to one cross-border raw satellite model with country-specific calibration/reporting layers unless evidence proves the stack must fork [Task 9]
1249:- The Monette app is a static React/Babel/Mapbox site with synchronous `window.*` globals and generated JS assets, so a build-step-generated imagery asset fits the architecture much better than browser-side live satellite fetches [Task 1][Task 2]
1252:- The handoff brief at `docs/plans/2026-04-22-farmer-friendly-map-build-brief.md` locks v1 to: keep Mapbox, avoid browser-side live satellite OAuth, use generated imagery data, make property footprints and quarter outlines the primary land objects, and wire imagery only after the land UX is cleaned up [Task 2]
1254:- The shipped rebuild moved the atlas to a footprint-first flow with three modes (`Status`, `Satellite`, `Vigor`), selected-property fit-bounds, parcel hover state, a right-rail explanation panel, and a generated `imagery-data.js` seam that works without live Sentinel auth in the browser [Task 3]
1273:- Mapbox Satellite is a basemap/display layer, not a native seeding-progress detector; the practical v1 detection stack is Sentinel-1 SAR plus Sentinel-2 / NASA HLS processed server-side, then rendered into Mapbox [Task 9]
1274:- For this product framing, satellites should support labels like `seeding likely`, `emergence confirmed`, and `unknown` rather than exact day-of-seeding claims [Task 9]
1275:- The recommended cross-border architecture is one raw satellite model shared across Canada and the U.S., with USDA/NASS and AAFC/StatsCan/CSA-style layers used for country-specific calibration and reporting [Task 9]
1276:- NOAA GOES/VIIRS and ECCC feeds are support/context layers for weather and timing, not primary field-scale seeding detectors; PlanetScope and RADARSAT/RCM are later upgrades, not hard v1 dependencies [Task 9]
1281:- Symptom: v1 scope explodes into a satellite platform project. Cause: trying to fetch/process imagery live in the browser for a static app. Fix: keep imagery/stat processing out of the browser and feed the UI a generated data asset instead [Task 1][Task 2]
1292:- Symptom: seeding-progress architecture drifts into `Mapbox can do this natively`. Cause: the display layer is confused with the detection layer. Fix: keep Mapbox for rendering only and design the sensing pipeline around Sentinel/HLS inputs [Task 9]
1293:- Symptom: the product starts overclaiming imagery precision. Cause: satellite change detection is described like direct seed-in-ground observation. Fix: phrase the output as confidence states and keep exact seeding claims out unless corroborated by stronger evidence [Task 9]
1294:- Symptom: the implementation forks into separate Canada and U.S. satellite stacks too early. Cause: government reporting layers are mistaken for different raw sensing requirements. Fix: keep one raw cross-border model and split only the calibration/reporting layer [Task 9]
1419:- Symptom: `trial_plots` seeding breaks at launch. Cause: real plot rows were created with `NULL` acres while the schema required non-null acres. Fix: validate seed flows against DB constraints, not just the happy-path UI [Task 1]
1538:- CCAA, FTI, DIP term sheet, Chapter 15, forbearance agreement, Stewart Valley Farm, Regina I, Havre Land, Dutcyvich, paNOW, Ritchie Bros, Monette Land, SCC docket 42250, BankruptcyObserver, docs/2026-04-22-monette-court-research-brief.md, leverage/liquidity crisis, seeding-season clock
1553:- The cleanest thesis from the filing set is a leverage/liquidity crisis with a seeding-season clock, not a one-off lawsuit story; the seasonal urgency is central to why the DIP request was framed as emergency liquidity [Task 2]
1636:- chat-tools, llm-adapter, chat-completion, CHAT_TOOLS, executeTool, get_state_cash_prices, get_us_cash_bids, us_cash_prices, us-market-context, seeding-drill, Kalshi, prompt budget, exact line numbers, no code changes
1739:- `lib/queries/seeding-drill.ts` is the best local contract example for `get_state_cash_prices` consumption because it already maps the RPC rows into UI data without inventing a new schema [Task 7]

codex
The spec confirms this is a design-pressure-test, not an implementation request. I’ve found relevant prior Monette memory around the satellite architecture: Mapbox is display-only, the v1 sensing stack should stay server-side/generated, and claims should stay confidence-state based rather than exact seed-in-ground proof.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path='"'C:\\Users\\kyle\\.codex\\memories\\MEMORY.md'; "'$lines=Get-Content -LiteralPath $path; for($i=1217;$i -le 1294;$i++){ if($i -le $lines.Count){ '"'{0}:{1}' -f "'$i,$lines[$i-1] }}' in C:\Users\kyle\Agriculture\Monette
 succeeded in 337ms:
1217:## Task 9: Research cross-border seeding-progress satellite architecture and reject the Mapbox-native assumption
1218:
1219:### rollout_summary_files
1220:
1221:- rollout_summaries/2026-04-28T04-51-56-QZTV-cross_border_seeding_satellite_research_mapbox_noaa_eccc.md (cwd=C:\Users\kyle\Agriculture\Monette, rollout_path=C:\Users\kyle\.codex\sessions\2026\04\27\rollout-2026-04-27T22-51-56-019dd26d-fa28-7890-a21d-345bb62f58bf.jsonl, updated_at=2026-04-28T04:59:33+00:00, thread_id=019dd26d-fa28-7890-a21d-345bb62f58bf, success; set the satellite stack direction to one cross-border model with country-specific calibration layers)
1222:
1223:### keywords
1224:
1225:- Sentinel-1, Sentinel-2, NASA HLS, Mapbox Satellite, NOAA GOES, NOAA VIIRS, ECCC, AAFC, StatsCan, CSA RADARSAT, PlanetScope, seeding likely, emergence confirmed, cross-border model
1226:
1227:## User preferences
1228:
1229:- when the user says "Do some proper research and see what ideas you can come up with" -> bring back a research-backed recommendation grounded in the actual repo and real data coverage, not generic map ideas [Task 1]
1230:- when the user says "Lets go ahead with this build! Should we do it in a new session and you can create the document to follow" -> package multi-step implementation work into a fresh-session handoff brief instead of continuing ad hoc in the same thread [Task 2]
1231:- when the brief says `Keep Mapbox. Do not replace the mapping library.` -> preserve the stack and improve UX/cartography instead of swapping map libraries [Task 3]
1232:- when the brief says `Fix the land UX first, then wire imagery` and `Default selected-property view should feel imagery-first and farmer-friendly.` -> bias toward property footprints, fit-bounds, and land-inspection semantics before adding more imagery plumbing [Task 3]
1233:- when imagery language is user-facing, keep the wording discipline `vegetation vigor`, not `crop health`, so the app does not overclaim what the data proves [Task 1][Task 3]
1234:- when a Monette change touches public corrections or clarifications, keep structured vote/state flows in Monette and route free-form discussion/corrections to Agnonymous instead of silently mixing both systems [Task 4]
1235:- when the user says "Lets make a note in Hafford ... and they can leave any kind of update or email that notifies me at buperac@gmail.com" -> put the note and contact CTA inside the Hafford property UI itself, with both a direct email path and the existing moderated submit path, not a detached explanation elsewhere [Task 5]
1236:- when a Monette public claim is not title-verified in-session, soften wording from assertions like `we know` to careful phrasing like `Local reports indicate` until official records are checked [Task 5]
1237:- when the user says the CTA "opens agnonymous.buperac.com in a new window but also changes the old window" and asks to keep Monette in place -> preserve the originating Monette tab and open Agnonymous separately without opener-tab fallback redirects [Task 6]
1238:- when the user follows a successful Monette fix with a short `deploy` -> treat that as a request to ship the just-fixed change live [Task 6]
1239:- when the user says "Lets get rid of teh Hafford/Simmons rented land Clarification request. on the homepage. Too many requests from too many places are making it difficult." -> remove overlapping homepage/global clarification asks and keep the narrower property-local request path instead of adding more top-level clutter [Task 7]
1240:- when the user follows a narrow Monette UI cleanup with "perfect, lets push that" -> treat it as a request to rebuild and deploy the linked Vercel project, not to leave the change local [Task 7]
1241:- when the user asks "How current is this data? This should start as the initial source of truth for this area and should be documented as such. Any voting that happened or court document changes should be shown as changes to this original map." -> future Montana work should preserve a baseline/overlay hierarchy explicitly instead of treating each new source as a silent overwrite [Task 8]
1242:- when the user says "If it is more current than what is showing on the Acre_Sheet ... then we will use this map as the current one" -> compare recency between cadastral and Acre Sheet inputs, but preserve both sources and document which one is the controlling baseline vs reconciliation overlay [Task 8]
1243:- when the user asks `what satellite feeds would I need access to` and `Does mapbox provide anything for this already that is native?` -> answer with the data-source truth first and treat Mapbox as the display layer unless proven otherwise [Task 9]
1244:- when the user says `Lets work through the best route to address this.` -> give a practical architecture route, not a catalog of remote-sensing products [Task 9]
1245:- when the user asks whether NOAA/ECCC or Canada-vs-USA require different satellites -> default to one cross-border raw satellite model with country-specific calibration/reporting layers unless evidence proves the stack must fork [Task 9]
1246:
1247:## Reusable knowledge
1248:
1249:- The Monette app is a static React/Babel/Mapbox site with synchronous `window.*` globals and generated JS assets, so a build-step-generated imagery asset fits the architecture much better than browser-side live satellite fetches [Task 1][Task 2]
1250:- `quarters.geojson` has 1,166 parcel features total, with real parcel geometry for 12 properties; The Pas remains synthetic fallback only and should not be treated as equal coverage [Task 1]
1251:- `quarters.geojson` did not contain populated `crop_2023`, `crop_2024`, or `crop_2025` fields during the audit, while `soil` and `titled_ac` were present; crop-history overlays need a different source such as AAFC Annual Crop Inventory [Task 1]
1252:- The handoff brief at `docs/plans/2026-04-22-farmer-friendly-map-build-brief.md` locks v1 to: keep Mapbox, avoid browser-side live satellite OAuth, use generated imagery data, make property footprints and quarter outlines the primary land objects, and wire imagery only after the land UX is cleaned up [Task 2]
1253:- `view-map.jsx` is the primary atlas surface; in this static build, UI contract changes need to be reflected in `config.js`, `index.html`, and `styles.css` together, and custom layers must be reattached after Mapbox `setStyle()` calls [Task 1][Task 3]
1254:- The shipped rebuild moved the atlas to a footprint-first flow with three modes (`Status`, `Satellite`, `Vigor`), selected-property fit-bounds, parcel hover state, a right-rail explanation panel, and a generated `imagery-data.js` seam that works without live Sentinel auth in the browser [Task 3]
1255:- `npm run build` uses `scripts/build-jsx.mjs` and rebuilds both `build/` and `public/` in this repo; a mobile smoke test at `390x844` verified no horizontal overflow after the atlas rebuild [Task 3]
1256:- The Monette-to-Agnonymous contract is query-string based: `source=monette`, `kind`, `category`, `title`, `body`, `property`, `return`, with `buildAgnonymousUrl(...)` as the retrieval handle and `window.AGNONYMOUS_URL` set in `config.js` [Task 4]
1257:- `openAgnonymousDiscussion()` lives in `components.jsx` and is the shared CTA helper; the correct browser behavior here is `window.open(url, "_blank", "noopener,noreferrer")` with no opener-tab redirect fallback [Task 4][Task 6]
1258:- The structured vote path remains `window.monetteInsertVote(...)`; free-form correction threads moved out, but quarter votes and the anonymized live vote feed still belong in Monette [Task 4]
1259:- For property-specific evidence collection, the existing moderated queue is still the preferred Monette pattern: drive the copy from a property-level `communityAsk` object in `data.js`, render it generically in `property-drawer.jsx`, and wire the submit button through `onOpenHeadlineForm` / `window.monetteSubmitTip` instead of creating a second inbox or submission flow [Task 5]
1260:- The Hafford evidence-request implementation paired the moderated submit CTA with a direct `mailto:` link to `buperac@gmail.com`, using a prefilled subject/body so email replies and moderated updates stay anchored to the property context [Task 5]
1261:- Verification for this kind of Monette property-UI change should include `node --check` on the touched JS files, `npm run build`, and a local preview check against the property hash route such as `http://localhost:8765/#map/hafford` [Task 5]
1262:- The Hafford data still carries uncertainty on the landlord side (`Presumed Simmons - pending confirmation`), so public-facing lease copy should stay careful until title support exists [Task 5]
1263:- In this browser/security setup, `window.open(..., "noopener,noreferrer")` can still succeed while returning `null`, so a null return is not proof the popup failed [Task 6]
1264:- Monette remains a static React/Babel site built through `scripts/build-jsx.mjs`; CTA/helper source changes require `npm run build` before `vercel deploy --prod -y` so both `build/` and `public/build/` refresh [Task 6]
1265:- The homepage Hafford/Simmons clarification ask lived in `view-editorial.jsx` as a `ClarificationRibbon` render; removing that render path leaves the broader `AgnonymousRibbon` component available and does not touch the property-level `communityAsk` flow in `data.js` / `property-drawer.jsx` [Task 7]
1266:- In this Monette workspace, `node --check` is not a usable validator for `.jsx` files because Node throws `ERR_UNKNOWN_FILE_EXTENSION`; use `npm run build` as the real JSX validation path [Task 7]
1267:- The linked Vercel project for this checkout is `monette-ledger`, stored in `.vercel/project.json`; in this non-git workspace, "push" means rebuild then `vercel deploy --prod -y` [Task 7]
1268:- For Montana in this repo, the public DNRC/DOR cadastral owner query for `MONETTE FARMS USA INC` is now the original title/geometry baseline, while Acre Sheet is the farmed-acre reconciliation overlay; that repo-specific exception is documented in `README.md`, `docs/2026-04-23-map-handoff.md`, and `docs/2026-04-26-montana-cadastral-source-of-truth.md` [Task 8]
1269:- The Montana refresh path is `npm run refresh:montana`, which repulls the owner query, converts ArcGIS JSON, replaces only the Montana slice in `quarters.geojson`, and rebuilds `quarters-data.js` [Task 8]
1270:- The Montana slice now carries provenance fields including `owner`, `tax_year`, `source`, `property_card`, and `gis_ac`; `quarter-panel.jsx` surfaces `Tax year`, `Record owner`, and a Montana property-card link, while `property-drawer.jsx` carries the source-of-truth note from `data.js` [Task 8]
1271:- The validated Montana baseline figures were `220` Big Horn County parcels, `TaxYear 2026`, `51,528.893` assessed acres, `51,711.930` GIS acres, and `1,235` total parcel rows in the generated repo dataset, with a documented `26,198` acre reconciliation gap in `data.js` [Task 8]
1272:- Production deploy for this Montana update used the same linked `monette-ledger` Vercel project, with `vercel deploy --prod -y` followed by `vercel inspect` to confirm `status: Ready` and alias `https://monette.buperac.com` [Task 8]
1273:- Mapbox Satellite is a basemap/display layer, not a native seeding-progress detector; the practical v1 detection stack is Sentinel-1 SAR plus Sentinel-2 / NASA HLS processed server-side, then rendered into Mapbox [Task 9]
1274:- For this product framing, satellites should support labels like `seeding likely`, `emergence confirmed`, and `unknown` rather than exact day-of-seeding claims [Task 9]
1275:- The recommended cross-border architecture is one raw satellite model shared across Canada and the U.S., with USDA/NASS and AAFC/StatsCan/CSA-style layers used for country-specific calibration and reporting [Task 9]
1276:- NOAA GOES/VIIRS and ECCC feeds are support/context layers for weather and timing, not primary field-scale seeding detectors; PlanetScope and RADARSAT/RCM are later upgrades, not hard v1 dependencies [Task 9]
1277:
1278:## Failures and how to do differently
1279:
1280:- Symptom: the current map feels cluttered and not farmer-native. Cause: centroid pins, property-level fills, and parcel fills are stacked onto the same geography with mixed semantics. Fix: refactor the land UX first so property footprints and quarter outlines become the primary objects before adding imagery layers [Task 1][Task 2][Task 3]
1281:- Symptom: v1 scope explodes into a satellite platform project. Cause: trying to fetch/process imagery live in the browser for a static app. Fix: keep imagery/stat processing out of the browser and feed the UI a generated data asset instead [Task 1][Task 2]
1282:- Symptom: the map implies uniform parcel intelligence where none exists. Cause: coverage asymmetry gets hidden, especially for The Pas synthetic fallback. Fix: show vigor only where real parcel geometry and usable imagery exist, and do not fake The Pas coverage [Task 1][Task 2]
1283:- Symptom: implementation starts in the wrong order. Cause: imagery plumbing gets started before the land UX is corrected. Fix: begin from the brief and refactor `view-map.jsx` before building more imagery pipeline work [Task 2]
1284:- Symptom: newer map work drifts back into inspection-mode expansion that conflicts with later handoff direction. Cause: agents do not check the freshest Monette map brief before extending the public atlas. Fix: read the newer handoff doc first and treat status-first public behavior as the default unless the user explicitly broadens scope [Task 3]
1285:- Symptom: browser QA fails even though the Agnonymous helper is correct. Cause: the assertion is too strict about URL encoding. Fix: check the helper contract and decoded payload instead of requiring one exact encoded string [Task 4]
1286:- Symptom: discussion-routing changes leave stale fallback copy behind. Cause: tutorial or legacy helper text still describes the old moderated Monette queue. Fix: scan tutorial/fallback/editorial copy whenever discussion flows are split so future sessions do not revert the routing by accident [Task 4]
1287:- Symptom: a property-specific evidence request spawns another submission mechanism. Cause: agents forget the atlas already has a moderated update queue. Fix: reuse the existing Monette submit flow and add property-local data/config for the callout rather than creating a parallel inbox or bespoke form [Task 5]
1288:- Symptom: a public-facing Hafford note overstates what has been verified. Cause: wording hardens an unverified local report into a fact claim. Fix: preserve cautious language such as `Local reports indicate` and keep verification gaps visible until title evidence exists [Task 5]
1289:- Symptom: clicking a Monette CTA opens Agnonymous in a new window and also redirects the original Monette tab. Cause: the helper interprets a null `window.open(...)` return as failure and falls back to `window.location.href = url`. Fix: remove opener-navigation fallbacks unless the UX explicitly wants the source tab to move [Task 6]
1290:- Symptom: the homepage gets cluttered with overlapping correction asks. Cause: a global clarification ribbon duplicates a more relevant property-level request flow. Fix: remove the homepage banner and keep the narrower property-specific `communityAsk` path [Task 7]
1291:- Symptom: code search or syntax validation stalls in this workspace during Monette UI edits. Cause: `rg.exe` can fail with `Access is denied`, and `node --check` does not handle `.jsx` here. Fix: switch to PowerShell search immediately and use `npm run build` as the validation gate [Task 7]
1292:- Symptom: seeding-progress architecture drifts into `Mapbox can do this natively`. Cause: the display layer is confused with the detection layer. Fix: keep Mapbox for rendering only and design the sensing pipeline around Sentinel/HLS inputs [Task 9]
1293:- Symptom: the product starts overclaiming imagery precision. Cause: satellite change detection is described like direct seed-in-ground observation. Fix: phrase the output as confidence states and keep exact seeding claims out unless corroborated by stronger evidence [Task 9]
1294:- Symptom: the implementation forks into separate Canada and U.S. satellite stacks too early. Cause: government reporting layers are mistaken for different raw sensing requirements. Fix: keep one raw cross-border model and split only the calibration/reporting layer [Task 9]

web search: 
web search: Google Earth Engine Sentinel-1 SLC coherence COPERNICUS/S1_SLC product
web search: 
web search: Google Earth Engine interferometric coherence Sentinel-1 SLC native coherence implementation
web search: 
web search: https://developers.google.com/earth-engine/guides/sentinel1
web search: 
web search: Singh 2025 IEEE JSTARS seeding date Sentinel-1 coherence RMSE 5.59 days Ontario fields 3000
web search: 
web search: 
web search: 
web search: 10.1109/JSTARS.2025.3600324 "Field-Scale Detection of Crop Seeding Date"
web search: 
web search: AAFC RADARSAT Constellation Mission compact polarimetry crop monitoring Mahdianpari 2022 2121271
web search: 
web search: "10.1080/01431161.2026.2612904" harvest date estimation Sentinel-1 RADARSAT constellation mission
web search: 
web search: https://www.mdpi.com/2072-4292/12/10/1551
web search: 
web search: https://doaj.org/article/6ee9351755834b2ba22cc05dc32ef73c
web search: 
web search: https://doi.org/10.3390/rs12101551
web search: 
web search: 'Variation of SAR backscattering' in https://doi.org/10.3390/rs12101551
web search: 
web search: https://documentation.dataspace.copernicus.eu/APIs/Sentinel-1%20SLC%20Burst.html
web search: 
web search: https://www.asc-csa.gc.ca/eng/satellites/radarsat/faq.asp
web search: 
web search: Sentinel-1C operational status 2026 Sentinel-1A revisit 6 days constellation
web search: 
web search: https://developers.google.com/earth-engine/tutorials/community/detecting-changes-in-sentinel-1-imagery-pt-1
codex
The web check is narrowing the answer: true InSAR coherence is still not a normal Earth Engine `COPERNICUS/S1_GRD` operation because the phase-bearing SLC data is not ingested into GEE. The credible paths are either keep GRD intensity in GEE, use a derived/static coherence product where it fits poorly, or process SLC/coherence outside GEE and ingest parcel/coherence outputs back in.
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path='"'docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md'; "'$lines=Get-Content -LiteralPath $path; for($i=1;$i -le $lines.Count;$i++){ if($lines[$i-1] -match '"'mean_dvh_db_value|Total parcels|Active SAR-eligible|Q1|Q2|Q3|Q4|Q5|Q6|Q7|Requested output format|Decision space'){ '{0}:{1}' -f "'$i,$lines[$i-1] }}' in C:\Users\kyle\Agriculture\Monette
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path='"'scripts/gee_pipeline/pipeline.py'; if(Test-Path -LiteralPath "'$path){ $lines=Get-Content -LiteralPath $path; for($i=520;$i -le 545;$i++){ if($i -le $lines.Count){ '"'{0}:{1}' -f "'$i,$lines[$i-1] }} }' in C:\Users\kyle\Agriculture\Monette
exec
"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$path='"'scripts/gee_pipeline/decision_rule.py'; if(Test-Path -LiteralPath "'$path){ $lines=Get-Content -LiteralPath $path; for($i=1;$i -le [Math]::Min($lines.Count,180);$i++){ if($lines[$i-1] -match '"'seeded|confidence|dvh|threshold|None|null|tri'){ '{0}:{1}' -f "'$i,$lines[$i-1] }} }' in C:\Users\kyle\Agriculture\Monette
 succeeded in 293ms:
16:mean_dvh_db_value = 10 * math.log10(mean_t1_vh_val / mean_t0_vh_val)
38:| Total parcels in dataset | 1,260 |
39:| Active SAR-eligible parcels (current) | 533 |
54:## The decision space
69:### Q1. Problem-method fit
73:### Q2. GEE feasibility cost
77:### Q3. Coherence's own gotchas
85:### Q4. Combination logic if we layer them (Option B/D)
95:### Q5. Transition path if we adopt (Options B, C, or D)
105:### Q6. Effort estimate
109:### Q7. What you'd need to verify before committing
140:## Requested output format
142:For each Q1â€“Q7, provide:

 succeeded in 305ms:
520:    # is undefined.
521:    if (mean_t1_vh_val is None or mean_t0_vh_val is None
522:            or mean_t1_vh_val <= 0 or mean_t0_vh_val <= 0):
523:        return _build_record(
524:            territory=territory,
525:            cropland_coverage=cropland_coverage_val,
526:            prior_crop=crop_name,
527:            applicability="insufficient_baseline",
528:            mean_dvh_db=None,
529:            n_pixels=0,
530:            run_date=run_date,
531:            optical_block=optical_block,
532:            ndvi_mean=ndvi_mean_val,
533:        )
534:
535:    import math
536:    mean_dvh_db_value = 10 * math.log10(mean_t1_vh_val / mean_t0_vh_val)
537:
538:    # Compute Î”VV via the same ratio-of-means approach.
539:    # Bucket B: drop the underscore prefix + noqa; pass into _build_record.
540:    if (mean_t1_vv_val is not None and mean_t0_vv_val is not None
541:            and mean_t1_vv_val > 0 and mean_t0_vv_val > 0):
542:        mean_dvv_db_value = 10 * math.log10(mean_t1_vv_val / mean_t0_vv_val)
543:    else:
544:        mean_dvv_db_value = None
545:

 succeeded in 308ms:
2:Decision rule for the Â§4.5 tri-state seeded call.
4:  seeded:
5:    null  if applicability != "active"
6:    true  if confidence â‰¥ 65 AND mean_dvh_db â‰¥ +1.5
7:    false if confidence â‰¥ 65 AND mean_dvh_db â‰¤ -1.5
8:    null  otherwise (uncertain â€” show as gray with confidence pct visible)
10:Symmetric thresholds at Â±1.5 dB ensure the rule is reachable under the
11:Â§4.7 confidence formula (the negative side at -1.0 was unreachable in
20:POSITIVE_THRESHOLD_DB = 1.5
21:NEGATIVE_THRESHOLD_DB = -1.5
22:CONFIDENCE_FLOOR = 65
25:def decide_seeded(
28:    mean_dvh_db: float,
29:    confidence: int,
30:    veto_reason: str | None = None,
32:    """Return True (seeded), False (not seeded), or None (uncertain / n/a)."""
34:        return None
37:        return None
39:    if confidence < CONFIDENCE_FLOOR:
40:        return None
42:    if mean_dvh_db >= POSITIVE_THRESHOLD_DB:
45:    if mean_dvh_db <= NEGATIVE_THRESHOLD_DB:
48:    return None

web search: 
web search: 
web search: 
web search: https://www.mdpi.com/2072-4292/11/13/1582
web search: 
web search: 'The main objective of this study' in https://www.mdpi.com/2072-4292/11/13/1582
codex
# CCD vs Intensity Delta VH Pressure Test Response

**Recommendation:** choose **Option D: CCD as confidence booster only**, with an offline/shadow coherence spike first. Do not replace the working GEE-native intensity pipeline until local parcel evidence proves coherence improves withheld/false-call behavior.

**Source correction:** the IEEE document `11130190` cited in the spec is **Chen et al. 2025**, not Singh et al. It is titled *Field-Scale Detection of Crop Seeding Date Using Sentinel-1 Coherence Time Series* and reports RMSE down to **5.59 days** after dual-orbit integration.

## Q1. Problem-Method Fit

**Position:** InSAR coherence is a better *candidate* signal for detecting soil disturbance, but it does not automatically beat intensity Delta VH for our boolean “seeded as of date D” v1 use case.

**Reasoning:** Coherence directly measures whether phase-stable scatterers changed between repeat SAR acquisitions. That maps well to drill disturbance, press wheels, coulters, tillage, reseeding, and residue movement. Chen et al. 2025 used Sentinel-1 coherence time series and decision rules to estimate seeding dates, with individual-orbit RMSEs of **5.99-9.89 days** and dual-orbit RMSEs of **6.74 days in 2019** and **5.59 days in 2020** over Ontario corn fields; the paper also tested 1000+ soybean and 2000+ corn fields against local progress reports.

But that benchmark is date regression, not the Monette production question. Our current rule is a conservative tri-state classifier: true, false, or null, with a confidence floor and `+/-1.5 dB` Delta VH thresholds in [decision_rule.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/decision_rule.py:2). The current implementation computes `mean_dvh_db_value = 10 * log10(t1_vh / t0_vh)` in [pipeline.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/pipeline.py:536). A boolean-with-withhold system can be useful even if it cannot estimate exact seeding dates.

The strongest counter-argument for staying with intensity Delta VH is operational: it is already GEE-native, auditable, cheap, and working on the May 1 smokes. The 2026 Sentinel-1/RCM harvest paper is also a warning against overrating coherence by default: for Sentinel-1 harvest-date estimation, VV/VH backscatter performed similarly to coherence, while RCM compact-pol decomposition improved some results.

**Confidence:** **Medium.** Higher confidence requires same-parcel comparison on Monette’s smoked parcels plus at least a small labelled Saskatchewan/Manitoba validation set.

## Q2. GEE Feasibility Cost

**Position:** There is no clean production-grade GEE-native path for true Sentinel-1 coherence today; the realistic path is external SLC/coherence processing, then ingesting outputs or parcel stats back into the existing pipeline.

**Reasoning:** Earth Engine’s official Sentinel-1 collections are GRD intensity products. GEE documents `COPERNICUS/S1_GRD` as terrain-corrected backscatter, and explicitly says Sentinel-1 SLC data cannot currently be ingested because Earth Engine does not support complex-valued images without losing phase information during pyramiding. The current GEE community SAR change-detection tutorial uses `COPERNICUS/S1_GRD_FLOAT` and `COPERNICUS/S1_GRD`, and notes that complex off-diagonal covariance terms are not available in archived S1 imagery in GEE.

The GEE catalog does contain a derived **Global Seasonal Sentinel-1 Interferometric Coherence and Backscatter** dataset, but it is a historical 2019-2020 seasonal product, not a live pairwise CCD source for 2026 field operations. It is unsuitable for parcel-level weekly seeding status.

The practical hybrid path is: fetch SLC bursts from Copernicus Data Space or another SLC source, compute coherence with SNAP/openEO/ASF-style processing, export GeoTIFF/coherence rasters or parcel-level statistics, then ingest those outputs into GEE or the repo’s generated JSON/log pipeline. Copernicus launched an openEO `sentinel1_sar_coherence` process in April 2026, powered by SNAP, which is the closest current managed path.

**Confidence:** **High.** This would only change if GEE adds current pairwise SLC/coherence support or a maintained 2026 coherence ImageCollection with sufficient temporal granularity.

## Q3. Coherence’s Own Gotchas

**Position:** Coherence has at least as many gates as intensity, and probably stricter ones: same orbit geometry, valid SLC pairs, edge masking, snow/freeze/rain exclusion, and cropland/polygon hygiene.

**Reasoning:** Coherence still needs cropland masks, inward parcel buffers, and valid-pixel thresholds. Mixed pixels at roads, tree rows, yard sites, sloughs, parcel edges, and swath/burst boundaries can dominate parcel means. It is more geometry-sensitive than intensity because coherence depends on precise repeat geometry and co-registration.

Snow/freeze is not solved by coherence. Shang and Liu’s 2020 AAFC-linked Sentinel-1 study explicitly excluded the April snowmelt period from the seeding search window because snowmelt could cause false seeding alarms. Rain, soil moisture shifts, wet snow, freeze/thaw, rolling, tillage, reseeding, residue removal, and early crop growth can all decorrelate a field without proving seeding.

The temporal baseline sweet spot is the shortest same-geometry repeat pair available: typically 6-12 days for Sentinel-1 depending on constellation/orbit availability; RCM’s constellation can provide exact 4-day revisits. Longer baselines increase ordinary temporal decorrelation and date uncertainty. Coherence will not improve parcels at S1 swath edges unless the same relative orbit and burst coverage are valid across the pair; edge parcels are more likely to become null, not magically cleaner.

**Confidence:** **High** on the failure modes; **medium** on exact local thresholds until we inspect 2026 SLC pair coverage property by property.

## Q4. Combination Logic If Layered

**Position:** Use confidence-weighted logic with disagreement-as-null; do not use logical OR, and do not let coherence create a seeded call by itself in v1.

**Reasoning:** Literature supports complementarity, not blind substitution. The 2020 Shang/Liu study used both coherence and VH backscatter logic, and the 2025 Chen paper used thresholding, decision rules, and multi-orbit integration rather than a single raw coherence threshold. That is compatible with an auditable tri-state system.

Recommended rule:

- Intensity valid, coherence missing: keep current intensity decision unchanged.
- Intensity and coherence agree: keep decision and optionally upgrade confidence/reason.
- Intensity seeded, coherence validly contradicts: return null with `sar_signal_disagreement`.
- Coherence seeded, intensity uncertain: keep null until calibrated; attach diagnostic.
- Either signal blocked by snow/freeze/coverage gates: null or no-upgrade, depending on which gate fired.

Logical OR is too risky for creditor/court-facing calls because it maximizes false positives. Logical AND is defensible but may over-withhold. Confidence-weighted with disagreement-as-null is the best fit for auditability.

**Confidence:** **High.** The exact numeric confidence increments should wait until local comparison runs.

## Q5. Transition Path

**Position:** Build coherence as a separate shadow module first, with no production decision impact and no schema-breaking change.

**Reasoning:** The safe order is:

1. Add `coherence.py` or an external `coherence_pipeline/` as a separate module.
2. Produce offline parcel diagnostics only: pair IDs, dates, temporal baseline, relative orbit, valid pixel count, mean/median coherence, IQR, mask percent, snow/freeze flags.
3. Compare against existing Delta VH smokes and known null/negative cases.
4. Add nullable schema/log fields only after the diagnostics prove useful.
5. Feature-flag any production use.
6. Roll out property by property.

Do not touch the current `decision_rule.py` thresholds during the spike. The current Delta VH method is the working v1, and coherence should earn its way in by reducing disputed calls or explaining withheld calls.

**Confidence:** **High.** The transition risk is mostly integration/process risk, not algorithm theory.

## Q6. Effort Estimate

**Position:** Treat the first coherence pass as a contained feasibility spike; treat full production CCD as a new Bucket E only if it adds external SLC processing or changes production decisions.

**Reasoning:** Realistic estimate for the recommended Option D path:

- Architect prep: **0.5-1 day** to lock acceptance gates and output contracts.
- External coherence feasibility spike: **2-4 days** for SLC pair inventory, SNAP/openEO path, and two-property parcel stats.
- Smoke comparison: **1-2 days** for PA, Raymore, Hafford/Eddystone, and swath-edge parcels.
- Production shadow integration: **2-4 days** if the spike passes.
- Decision-impact rollout: **another 1-2 weeks** after local labels exist.

This is not a small tweak if true coherence is required. It becomes Bucket E when it adds an external processor, new credentials/storage, new retry modes, or legal-facing decision impact. A shadow-only JSON/log diagnostic is smaller: call it a layered increment, not a production migration.

**Confidence:** **Medium.** The biggest uncertainty is whether openEO/SNAP processing can be made boring enough on Windows/GEE/Cloud Storage without turning into a platform project.

## Q7. What To Verify Before Committing

**Position:** Run empirical coverage and disagreement tests before committing to any production CCD behavior.

**Reasoning:** Required tests:

1. **SLC pair inventory:** for every active property, list same-relative-orbit SLC pairs during the spring seeding window, valid temporal baseline, burst coverage, and parcel coverage percent.
2. **Known smoke parcels:** compare coherence and Delta VH on PA `NW-32-51-23-W2`, Raymore `SW-7-26-20-W2`, plus decisive negatives and borderline nulls from May 1.
3. **Snow/freeze blocked properties:** run Hafford and Eddystone to prove coherence does not create snowmelt false positives.
4. **Swath-edge stress:** test parcels where intensity already struggles from orbit/coverage gaps.
5. **Disagreement audit:** generate a list where intensity and coherence disagree, then inspect imagery/date/weather context manually.
6. **Label requirement:** before primary production use, collect local labels through the v1.5 vote-label loop or a trusted field-status source.
7. **Audit packet:** every coherence-derived diagnostic must retain source scene IDs, orbit, date pair, temporal baseline, masks, weather gates, and final reason.

Do not spend time reproducing the full Chen et al. RMSE benchmark unless we have real local seeding dates. Without labels, a Saskatchewan RMSE exercise is theatre.

**Confidence:** **High.** These tests are the minimum before any court/creditor-facing reliance.

## Final Recommendation

Choose **Option D: CCD as confidence booster only**, but begin with a **shadow-only feasibility spike**.

Concrete first step: build a two-property coherence diagnostic run for **PA + Raymore**, then add **Hafford/Eddystone** as snow/freeze stress tests. Output parcel-level diagnostics only. No schema change, no production decision change, no replacement of Delta VH.

Decision rule for now:

```text
Delta VH remains primary.
Coherence may upgrade confidence only when it agrees.
Valid disagreement forces null.
Coherence alone cannot call seeded in v1.
```

This is a genuine upgrade candidate, not token burn. It becomes token burn if we chase full CCD before proving it improves withheld/false-call behavior on Monette’s actual parcels.

## Sources

- Local pressure-test spec: [2026-05-01-ccd-vs-intensity-dvh-pressure-test.md](C:/Users/kyle/Agriculture/Monette/docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md:38)
- Current Delta VH implementation: [pipeline.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/pipeline.py:536)
- Current tri-state rule: [decision_rule.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/decision_rule.py:2)
- Google Earth Engine Sentinel-1 guide: https://developers.google.com/earth-engine/guides/sentinel1
- GEE Sentinel-1 GRD catalog: https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD
- GEE Sentinel-1 change-detection tutorial: https://developers.google.com/earth-engine/tutorials/community/detecting-changes-in-sentinel-1-imagery-pt-1
- GEE global seasonal coherence dataset: https://developers.google.com/earth-engine/datasets/catalog/Earth_Big_Data_GLOBAL_SEASONAL_S1_V2019_COHERENCE
- Chen et al. 2025 / IEEE document 11130190 metadata: https://doaj.org/article/5d55e2018dbe484b9baf8f0afb44bd02
- Chen et al. 2025 DOI/details: https://colab.ws/articles/10.1109%2Fjstars.2025.3600324
- Shang & Liu et al. 2020 Sentinel-1 seeding/harvest study: https://doi.org/10.3390/rs12101551
- Copernicus Sentinel-1 SLC Burst API: https://documentation.dataspace.copernicus.eu/APIs/Sentinel-1%20SLC%20Burst.html
- Copernicus openEO Sentinel-1 coherence process: https://dataspace.copernicus.eu/news/2026-4-9-land-deformation-change-detection-interferometric-sar-coherence-openeo
- RCM FAQ / revisit / CCD / compact polarization: https://www.asc-csa.gc.ca/eng/satellites/radarsat/faq.asp
- Dingle Robertson et al. 2022 RCM compact-pol crop monitoring: https://doaj.org/article/6ee9351755834b2ba22cc05dc32ef73c
- Mahdianpari et al. 2019 RCM compact-pol preparation study: https://www.mdpi.com/2072-4292/11/13/1582
- Khabbazan et al. 2026 Sentinel-1 + RCM harvest-date paper: https://www.tandfonline.com/doi/full/10.1080/01431161.2026.2612904


2026-05-04T18:27:38.506493Z ERROR codex_core::session: failed to record rollout items: thread 019df43a-a124-7e03-9828-aa9ddf231fd9 not found
tokens used
268,201
# CCD vs Intensity Delta VH Pressure Test Response

**Recommendation:** choose **Option D: CCD as confidence booster only**, with an offline/shadow coherence spike first. Do not replace the working GEE-native intensity pipeline until local parcel evidence proves coherence improves withheld/false-call behavior.

**Source correction:** the IEEE document `11130190` cited in the spec is **Chen et al. 2025**, not Singh et al. It is titled *Field-Scale Detection of Crop Seeding Date Using Sentinel-1 Coherence Time Series* and reports RMSE down to **5.59 days** after dual-orbit integration.

## Q1. Problem-Method Fit

**Position:** InSAR coherence is a better *candidate* signal for detecting soil disturbance, but it does not automatically beat intensity Delta VH for our boolean “seeded as of date D” v1 use case.

**Reasoning:** Coherence directly measures whether phase-stable scatterers changed between repeat SAR acquisitions. That maps well to drill disturbance, press wheels, coulters, tillage, reseeding, and residue movement. Chen et al. 2025 used Sentinel-1 coherence time series and decision rules to estimate seeding dates, with individual-orbit RMSEs of **5.99-9.89 days** and dual-orbit RMSEs of **6.74 days in 2019** and **5.59 days in 2020** over Ontario corn fields; the paper also tested 1000+ soybean and 2000+ corn fields against local progress reports.

But that benchmark is date regression, not the Monette production question. Our current rule is a conservative tri-state classifier: true, false, or null, with a confidence floor and `+/-1.5 dB` Delta VH thresholds in [decision_rule.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/decision_rule.py:2). The current implementation computes `mean_dvh_db_value = 10 * log10(t1_vh / t0_vh)` in [pipeline.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/pipeline.py:536). A boolean-with-withhold system can be useful even if it cannot estimate exact seeding dates.

The strongest counter-argument for staying with intensity Delta VH is operational: it is already GEE-native, auditable, cheap, and working on the May 1 smokes. The 2026 Sentinel-1/RCM harvest paper is also a warning against overrating coherence by default: for Sentinel-1 harvest-date estimation, VV/VH backscatter performed similarly to coherence, while RCM compact-pol decomposition improved some results.

**Confidence:** **Medium.** Higher confidence requires same-parcel comparison on Monette’s smoked parcels plus at least a small labelled Saskatchewan/Manitoba validation set.

## Q2. GEE Feasibility Cost

**Position:** There is no clean production-grade GEE-native path for true Sentinel-1 coherence today; the realistic path is external SLC/coherence processing, then ingesting outputs or parcel stats back into the existing pipeline.

**Reasoning:** Earth Engine’s official Sentinel-1 collections are GRD intensity products. GEE documents `COPERNICUS/S1_GRD` as terrain-corrected backscatter, and explicitly says Sentinel-1 SLC data cannot currently be ingested because Earth Engine does not support complex-valued images without losing phase information during pyramiding. The current GEE community SAR change-detection tutorial uses `COPERNICUS/S1_GRD_FLOAT` and `COPERNICUS/S1_GRD`, and notes that complex off-diagonal covariance terms are not available in archived S1 imagery in GEE.

The GEE catalog does contain a derived **Global Seasonal Sentinel-1 Interferometric Coherence and Backscatter** dataset, but it is a historical 2019-2020 seasonal product, not a live pairwise CCD source for 2026 field operations. It is unsuitable for parcel-level weekly seeding status.

The practical hybrid path is: fetch SLC bursts from Copernicus Data Space or another SLC source, compute coherence with SNAP/openEO/ASF-style processing, export GeoTIFF/coherence rasters or parcel-level statistics, then ingest those outputs into GEE or the repo’s generated JSON/log pipeline. Copernicus launched an openEO `sentinel1_sar_coherence` process in April 2026, powered by SNAP, which is the closest current managed path.

**Confidence:** **High.** This would only change if GEE adds current pairwise SLC/coherence support or a maintained 2026 coherence ImageCollection with sufficient temporal granularity.

## Q3. Coherence’s Own Gotchas

**Position:** Coherence has at least as many gates as intensity, and probably stricter ones: same orbit geometry, valid SLC pairs, edge masking, snow/freeze/rain exclusion, and cropland/polygon hygiene.

**Reasoning:** Coherence still needs cropland masks, inward parcel buffers, and valid-pixel thresholds. Mixed pixels at roads, tree rows, yard sites, sloughs, parcel edges, and swath/burst boundaries can dominate parcel means. It is more geometry-sensitive than intensity because coherence depends on precise repeat geometry and co-registration.

Snow/freeze is not solved by coherence. Shang and Liu’s 2020 AAFC-linked Sentinel-1 study explicitly excluded the April snowmelt period from the seeding search window because snowmelt could cause false seeding alarms. Rain, soil moisture shifts, wet snow, freeze/thaw, rolling, tillage, reseeding, residue removal, and early crop growth can all decorrelate a field without proving seeding.

The temporal baseline sweet spot is the shortest same-geometry repeat pair available: typically 6-12 days for Sentinel-1 depending on constellation/orbit availability; RCM’s constellation can provide exact 4-day revisits. Longer baselines increase ordinary temporal decorrelation and date uncertainty. Coherence will not improve parcels at S1 swath edges unless the same relative orbit and burst coverage are valid across the pair; edge parcels are more likely to become null, not magically cleaner.

**Confidence:** **High** on the failure modes; **medium** on exact local thresholds until we inspect 2026 SLC pair coverage property by property.

## Q4. Combination Logic If Layered

**Position:** Use confidence-weighted logic with disagreement-as-null; do not use logical OR, and do not let coherence create a seeded call by itself in v1.

**Reasoning:** Literature supports complementarity, not blind substitution. The 2020 Shang/Liu study used both coherence and VH backscatter logic, and the 2025 Chen paper used thresholding, decision rules, and multi-orbit integration rather than a single raw coherence threshold. That is compatible with an auditable tri-state system.

Recommended rule:

- Intensity valid, coherence missing: keep current intensity decision unchanged.
- Intensity and coherence agree: keep decision and optionally upgrade confidence/reason.
- Intensity seeded, coherence validly contradicts: return null with `sar_signal_disagreement`.
- Coherence seeded, intensity uncertain: keep null until calibrated; attach diagnostic.
- Either signal blocked by snow/freeze/coverage gates: null or no-upgrade, depending on which gate fired.

Logical OR is too risky for creditor/court-facing calls because it maximizes false positives. Logical AND is defensible but may over-withhold. Confidence-weighted with disagreement-as-null is the best fit for auditability.

**Confidence:** **High.** The exact numeric confidence increments should wait until local comparison runs.

## Q5. Transition Path

**Position:** Build coherence as a separate shadow module first, with no production decision impact and no schema-breaking change.

**Reasoning:** The safe order is:

1. Add `coherence.py` or an external `coherence_pipeline/` as a separate module.
2. Produce offline parcel diagnostics only: pair IDs, dates, temporal baseline, relative orbit, valid pixel count, mean/median coherence, IQR, mask percent, snow/freeze flags.
3. Compare against existing Delta VH smokes and known null/negative cases.
4. Add nullable schema/log fields only after the diagnostics prove useful.
5. Feature-flag any production use.
6. Roll out property by property.

Do not touch the current `decision_rule.py` thresholds during the spike. The current Delta VH method is the working v1, and coherence should earn its way in by reducing disputed calls or explaining withheld calls.

**Confidence:** **High.** The transition risk is mostly integration/process risk, not algorithm theory.

## Q6. Effort Estimate

**Position:** Treat the first coherence pass as a contained feasibility spike; treat full production CCD as a new Bucket E only if it adds external SLC processing or changes production decisions.

**Reasoning:** Realistic estimate for the recommended Option D path:

- Architect prep: **0.5-1 day** to lock acceptance gates and output contracts.
- External coherence feasibility spike: **2-4 days** for SLC pair inventory, SNAP/openEO path, and two-property parcel stats.
- Smoke comparison: **1-2 days** for PA, Raymore, Hafford/Eddystone, and swath-edge parcels.
- Production shadow integration: **2-4 days** if the spike passes.
- Decision-impact rollout: **another 1-2 weeks** after local labels exist.

This is not a small tweak if true coherence is required. It becomes Bucket E when it adds an external processor, new credentials/storage, new retry modes, or legal-facing decision impact. A shadow-only JSON/log diagnostic is smaller: call it a layered increment, not a production migration.

**Confidence:** **Medium.** The biggest uncertainty is whether openEO/SNAP processing can be made boring enough on Windows/GEE/Cloud Storage without turning into a platform project.

## Q7. What To Verify Before Committing

**Position:** Run empirical coverage and disagreement tests before committing to any production CCD behavior.

**Reasoning:** Required tests:

1. **SLC pair inventory:** for every active property, list same-relative-orbit SLC pairs during the spring seeding window, valid temporal baseline, burst coverage, and parcel coverage percent.
2. **Known smoke parcels:** compare coherence and Delta VH on PA `NW-32-51-23-W2`, Raymore `SW-7-26-20-W2`, plus decisive negatives and borderline nulls from May 1.
3. **Snow/freeze blocked properties:** run Hafford and Eddystone to prove coherence does not create snowmelt false positives.
4. **Swath-edge stress:** test parcels where intensity already struggles from orbit/coverage gaps.
5. **Disagreement audit:** generate a list where intensity and coherence disagree, then inspect imagery/date/weather context manually.
6. **Label requirement:** before primary production use, collect local labels through the v1.5 vote-label loop or a trusted field-status source.
7. **Audit packet:** every coherence-derived diagnostic must retain source scene IDs, orbit, date pair, temporal baseline, masks, weather gates, and final reason.

Do not spend time reproducing the full Chen et al. RMSE benchmark unless we have real local seeding dates. Without labels, a Saskatchewan RMSE exercise is theatre.

**Confidence:** **High.** These tests are the minimum before any court/creditor-facing reliance.

## Final Recommendation

Choose **Option D: CCD as confidence booster only**, but begin with a **shadow-only feasibility spike**.

Concrete first step: build a two-property coherence diagnostic run for **PA + Raymore**, then add **Hafford/Eddystone** as snow/freeze stress tests. Output parcel-level diagnostics only. No schema change, no production decision change, no replacement of Delta VH.

Decision rule for now:

```text
Delta VH remains primary.
Coherence may upgrade confidence only when it agrees.
Valid disagreement forces null.
Coherence alone cannot call seeded in v1.
```

This is a genuine upgrade candidate, not token burn. It becomes token burn if we chase full CCD before proving it improves withheld/false-call behavior on Monette’s actual parcels.

## Sources

- Local pressure-test spec: [2026-05-01-ccd-vs-intensity-dvh-pressure-test.md](C:/Users/kyle/Agriculture/Monette/docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md:38)
- Current Delta VH implementation: [pipeline.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/pipeline.py:536)
- Current tri-state rule: [decision_rule.py](C:/Users/kyle/Agriculture/Monette/scripts/gee_pipeline/decision_rule.py:2)
- Google Earth Engine Sentinel-1 guide: https://developers.google.com/earth-engine/guides/sentinel1
- GEE Sentinel-1 GRD catalog: https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD
- GEE Sentinel-1 change-detection tutorial: https://developers.google.com/earth-engine/tutorials/community/detecting-changes-in-sentinel-1-imagery-pt-1
- GEE global seasonal coherence dataset: https://developers.google.com/earth-engine/datasets/catalog/Earth_Big_Data_GLOBAL_SEASONAL_S1_V2019_COHERENCE
- Chen et al. 2025 / IEEE document 11130190 metadata: https://doaj.org/article/5d55e2018dbe484b9baf8f0afb44bd02
- Chen et al. 2025 DOI/details: https://colab.ws/articles/10.1109%2Fjstars.2025.3600324
- Shang & Liu et al. 2020 Sentinel-1 seeding/harvest study: https://doi.org/10.3390/rs12101551
- Copernicus Sentinel-1 SLC Burst API: https://documentation.dataspace.copernicus.eu/APIs/Sentinel-1%20SLC%20Burst.html
- Copernicus openEO Sentinel-1 coherence process: https://dataspace.copernicus.eu/news/2026-4-9-land-deformation-change-detection-interferometric-sar-coherence-openeo
- RCM FAQ / revisit / CCD / compact polarization: https://www.asc-csa.gc.ca/eng/satellites/radarsat/faq.asp
- Dingle Robertson et al. 2022 RCM compact-pol crop monitoring: https://doaj.org/article/6ee9351755834b2ba22cc05dc32ef73c
- Mahdianpari et al. 2019 RCM compact-pol preparation study: https://www.mdpi.com/2072-4292/11/13/1582
- Khabbazan et al. 2026 Sentinel-1 + RCM harvest-date paper: https://www.tandfonline.com/doi/full/10.1080/01431161.2026.2612904


---CODEX EXIT: 0---
