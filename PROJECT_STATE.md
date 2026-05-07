# PROJECT_STATE.md

## Last verified commit (feat/seeding-calibration)
2632275 wip(seeding-calibration): mid-iteration GEE pipeline + UI changes

## Active task
GEE seeding-calibration pipeline — per-property smoke-test then full-run cadence with `--merge-existing` to avoid wiping `imagery-data.js`. **Status as of 2026-05-06: Montana full rerun shipped (+5,467 ac, +10 confident seeded parcels) with Codex independent audit GREEN-YELLOW (21 PASS / 3 FLAG geography+applicability+seeded-call all PASS, FLAGs are crop-label provenance only). PA + Raymore awaiting next S1 descending IW pass.** Working files:
- scripts/gee_pipeline/decision_rule.py
- scripts/gee_pipeline/pipeline.py
- scripts/gee_pipeline/qc.py
- imagery-data.js, components.jsx, property-drawer.jsx, quarter-panel.jsx, view-map.jsx, styles.css
- docs/logs/seeding-calibration.md (methodology log, now tracked)

## Known blockers
1. **Northern SK/MB baseline window calendar-blocked** until ERA5 publishes through ~May 21. Extending the SK/MB baseline window into the late-spring thaw is the only path to unblock Hafford/Kamsack/Wymark/Eddystone/Admiral. No code action available before mid-May.

(Cleared 2026-05-01: a "dvh_db magnitude inflation" blocker was opened during the May 1 smoke and immediately retracted after `git diff 516d482 2632275 -- scripts/gee_pipeline/pipeline.py` + `git blame` confirmed the SAR computation block is unchanged. The dvh delta is the documented rolling-14-day T1 median composite slide — see methodology log entry for 2026-05-01.)

## Next action
1. Decide whether to deploy the May 6 Montana rerun (`vercel --prod`) or hold for another cycle. The new `public/imagery-data.js` reflects fresh May 1/6 SAR scenes, +5,467 ac confidently seeded, and Codex-audit-validated geometry.
2. **PA + Raymore re-smoke 2026-05-07: no new SAR scene yet** (still keyed off Apr 26 — 11 days stale at SK latitude vs MT got a May 6 pass). Skip full SK reruns until a fresher descending IW scene arrives, expected within 48-72 hours. Re-smoke at that point.
3. v1.1 backlog item 5 (polygon-pct CDL provenance) is the most actionable response to Codex's FLAGs — expose top-3 CDL classes per parcel so applicability can detect winter-wheat-dominant polygons that currently fall through to `unknown`.

## v1.1 Backlog (added 2026-05-01 from research review)

Independent, shippable items distilled from `docs/references/satellite-imagery-seeding-detection-2026-05-04.md`. See `docs/logs/seeding-calibration.md` "v1.1 Backlog" section for full descriptions. Order is suggestion-only — each is independently shippable.

1. **GDD agronomic gating** — suspend pipeline until thermal threshold met (uses ERA5 already in pipeline)
2. **Forward NDVI emergence validation** — retroactive confirmation via predicted-emergence NDVI inflection
3. **VH/VV ratio as no-till discriminator** — tiebreaker to flag tillage-not-seeding cases
4. **Zonal percentage threshold as secondary signal** — adds robustness for partially-seeded fields
5. **Polygon-pct CDL provenance** — expose top-3 CDL classes per parcel + percentages (added 2026-05-06 from Codex Montana audit). Current `prior_crop` is just the modal class; this misses winter-wheat-dominant polygons that fall through to `unknown` and get applicability=active when they should be out-of-season. New schema: `cdl_top3: [{class, pct}, {class, pct}, {class, pct}]`. Updated applicability rule: any single CDL class >= threshold (e.g. 30%) drives applicability if it implies a non-active state.

Each item: half-day Codex-as-architect → implement → smoke session.

## v1.5 Scope (deferred)

1. **InSAR Coherent Change Detection (CCD) — Codex pressure-test resolved 2026-05-01:** **Option D recommended (confidence booster only)**, with a **shadow-only feasibility spike first**. Critical finding: GEE does not natively support Sentinel-1 SLC ingestion (phase info lost in pyramiding) — the only viable path is external SNAP/openEO processing (e.g., the new April 2026 Copernicus openEO `sentinel1_sar_coherence` process) with results ingested back as parcel-level diagnostics. ΔVH stays primary; coherence may only upgrade confidence on agreement; disagreement forces null. Concrete first step: 2-property coherence diagnostic for PA + Raymore, plus Hafford/Eddystone as snow/freeze stress tests. NO labels = no production decision impact. Full spec: `docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md`. Codex response: `2026-05-01-ccd-vs-intensity-dvh-codex-response.md` (Codex `019df43a-a124-7e03-9828-aa9ddf231fd9`, `gpt-5.5/xhigh` + web search). Effort estimate: 5-11 days for shadow-only spike; 1-2 weeks more for production rollout after local labels accrue.
2. **RCM (RADARSAT Constellation Mission) integration** — Canadian 4-day SAR with compact polarimetry; requires CSA data access + non-trivial m-chi decomposition.
3. **Topographic Wetness Index slough masking** — DEM-based intra-field wetland masking for Prairie Pothole Region properties (Eddystone, Kamsack).

## Smoke artifacts (gitignored, transient)
- scripts/gee_pipeline/_pa_smoke_2026_05_01.py + `_pa_smoke_2026_05_01_results.json`
- scripts/gee_pipeline/_raymore_smoke_2026_05_01.py + `_raymore_smoke_2026_05_01_results.json`