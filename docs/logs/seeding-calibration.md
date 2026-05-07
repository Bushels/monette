# Seeding Calibration Log - 2026-04-30

Public rule: show only seeded acres, status, and confidence. Keep method details private.

## Operating Pattern

1. Audit geometry before running GEE.
2. Smoke-test 3 representative quarters.
3. Full-run one property only when the smoke test agrees with current direction.
4. Use `--merge-existing` so property updates do not wipe the rest of `imagery-data.js`.
5. Rebuild and verify served `public/imagery-data.js`.

## Lessons So Far

- Calderbank proved the workflow: clean geometry, full rerun, seeded acres moved from about 161 ac to about 1,117 ac.
- Raymore proved the first false-positive correction: the earlier run showed about 639 likely seeded acres across 4 parcels, but local snow reports exposed a missing active-observation snow/freeze gate.
- Raymore corrected rerun after the snow/freeze gate: 0 likely seeded acres, 120 active parcels, 18,775 active-read acres, 97 parcels / about 15,184 acres confidence-withheld for snow/freeze risk, and 23 parcels / about 3,591 acres with no confident call.
- Green-parcel retest after the snow/freeze gate covered 187 previously green parcels. 166 parcels / about 34,910 acres survived as likely seeded; 15 parcels / about 2,262 acres were confidence-withheld for snow/freeze risk; 6 Montana parcels / about 2,726 acres dropped to no confident call.
- By property on the green-parcel retest: Calderbank held 7/7 green parcels; Vanguard held 46/46; Ponteix held 36/39 with 3 withheld; Prince Albert moved 12/12 to confidence-withheld; Montana held 77/83 with 6 no-call.
- Ponteix is the first strong seeded-area expansion, but the snow/freeze retest reduced the public green count from 39 parcels / about 6,171 ac to 36 parcels / about 5,694 ac. The 3 removed parcels are confidence-withheld, not called unseeded.
- Vanguard produced the strongest clean Saskatchewan signal so far: clean geometry, no low-QC parcels, and the April 30 run moved seeded acres to about 7,258 ac across 46 seeded parcels.
- Hafford is not ready for seeded-acre reporting because fresh smoke tests still return `insufficient_baseline`.
- Progress bars must use active GEE-read acres as the denominator, not total titled acres.
- A property-level rerun must preserve all other property records. `--merge-existing` is now required for scoped reruns.
- Zero-acre source records are acreage-rollup risks even when their geometry and satellite reads are valid.
- The rolling 14-day run window matters. A rerun can change confidence even when the latest radar observation date is still the same.
- Field reports override model confidence when they expose a missing QC condition. High numeric confidence can still be a false positive if snow/frozen surface is not explicitly gated on the active observation date and the local area around the parcel.

## 2026-05-01 Smoke Findings (PA + Raymore)

- The 3-quarter smoke pattern was applied to Prince Albert and Raymore today using `scripts/gee_pipeline/_pa_smoke_2026_05_01.py` and `_raymore_smoke_2026_05_01.py`. Six GEE calls total against representative parcels spanning strong-historical, borderline, and low-QC (PA) or strong-negative (Raymore) regimes.
- Both properties are still keyed off the same 2026-04-26 Sentinel-1 descending IW scene as the Apr 30 corrected rerun. No newer S1 acquisition has reached PA or Raymore yet. Next descending IW pass at this latitude is expected May 2-4.
- PA: all 3 smoked parcels still vetoed for `snow_or_freeze_risk`. Confirms that the late-spring thaw has not arrived at PA latitudes (~52-53N) as of the Apr 26 observation. No full-rerun action today.
- Raymore: 2 of 3 vetoed, 1 cleared. The cleared parcel (SW-7-26-20-W2 at Township 26, ~50.8N) is the southernmost of the three; the two vetoed parcels (Townships 27 and 29) are 15-30 km north. Confirms the snow gate is granular per-parcel local AOI, not territory-wide. The thaw is moving northward across Raymore latitude band right now and we are catching it mid-progression.
- Same Apr 26 latest-scene-date produces larger dvh_db magnitudes under today's pipeline than under the Apr 29-build pipeline (e.g. Raymore NE-34-29-21-W2: +1.78 -> +3.91; SW-7-26-20-W2: -2.11 -> -2.81; PA NW-32-51-23-W2: +4.57 -> +6.72). Investigated 2026-05-01: confirmed via `git diff 516d482 2632275 -- scripts/gee_pipeline/pipeline.py` and `git blame` that the SAR computation block is unchanged since 2026-04-28; the only diff is the snow-gate veto machinery. The dvh_db delta is the documented rolling-14-day T1 median composite slide -- the Apr 29 window included an Apr 14 scene that has now dropped out, leaving only the cleaner Apr 20 + Apr 26 scenes in the median. Magnitude shift is in the same direction as the underlying signal because removing a winter-noisy scene unmasks the spring signal. Working as designed; not a blocker.
- Decision: do not run a full PA or Raymore today. The May 1 served `imagery-data.js` already reflects the gate-aware Apr 30 rebuild and a fresh full-run on the same SAR scene would produce near-identical public output. Re-smoke both properties around May 3-4 once a new descending IW scene arrives.
- Smoke pattern proven economical: 6 GEE calls saved a ~250-parcel rerun cycle (PA 20 + Raymore 122 + dependent rebuild) that would have produced no substantive dashboard change. Smoke is now the explicit "is it worth running the full rebuild?" gate.

## 2026-05-06 Montana Full Rerun + Codex Independent Audit

- The May 1 + May 6 Sentinel-1 descending IW scenes both arrived at Big Horn County. Pre-rerun smoke on 3 representative MT parcels (strongest-historical seeded, spring_wheat, borderline-confidence-null) all came back clean: no snow vetoes, strong-seeded calls held, borderline correctly stayed null at confidence 44.
- Full property rerun executed via `python scripts/build_imagery_data_js.py --property-id montana --run-date 2026-05-06 --merge-existing`. 220/220 MT parcels processed; other 13 properties' data preserved.
- Net delta: seeded=True went from 83 parcels / ~20,841 ac to 93 parcels / 26,308 ac. **+10 parcels, +5,467 ac of newly-confident seeded calls.** Zero regressions (no parcel went True -> False or True -> null). Active-null bucket shrank from 30 to 20 parcels (the 10 that gained seeded=True).
- Final acreage rollup matches cadastral baseline within 0.1%: 51,741 ac total across the 220 owned parcels (vs 51,712 ac cadastral GIS / 51,529 ac assessed).
- Latest observation date: 107 parcels at 2026-05-06 (today's pass), 113 parcels at 2026-05-01. Fresh data on every parcel.
- Independent audit via Codex (gpt-5.5/medium + web search) on 6 stratified-random parcels: **21 PASS / 3 FLAG / 0 FAIL across 24 checks.** Geometry independently verified against BLM PLSS CadNSDI and Census Geocoder (6/6 PASS). Acreage sanity 6/6 PASS. Seeded-call sanity 6/6 PASS. The 3 FLAGs are all crop-label provenance (point-CDL vs polygon-modal-CDL methodology difference). Codex verdict: "yes-with-caveats — geometry and broad seeded/null/perennial handling trusted; per-parcel crop labels need tighter provenance audit." Full report at `docs/superpowers/specs/2026-05-06-montana-parcel-audit-codex-response.md`.
- Acreage interpretation note for creditor-facing surfaces: 26,308 ac is the *spring-detected-seeded* total. Adding the 13,755 ac of out-of-season winter wheat (correctly excluded from spring detection but operationally still seeded last fall) brings the total Montana production footprint to roughly 40,063 ac. The 6,727 ac of perennial pasture/alfalfa is also actively producing land. The 4,570 ac active-null + 380 ac insufficient_baseline are the only acreage where we genuinely cannot make a confident call as of today.

### Open follow-up from Codex audit (added to v1.1 backlog as item 5)

5. **Polygon-pct CDL provenance.** Current `prior_crop` is just the polygon-modal CDL class. Codex audit found 3 cases where centroid-pixel CDL disagreed with our modal label — e.g. one parcel labelled `prior_crop=unknown applicability=active` had centroid CDL = Winter Wheat, which would imply applicability should be `out-of-season`. Fix: expose top-3 CDL classes with percent coverage in the schema (`cdl_top3: [{class:"winter_wheat", pct:0.42}, ...]`), then decide applicability when ANY single class crosses a percent threshold (not only when it strictly dominates).

## 2026-05-07 SK Re-smoke (PA + Raymore) — No New Scene Yet

- 6-parcel re-smoke (3 PA + 3 Raymore, same parcels as 2026-05-01) via `scripts/gee_pipeline/_sk_resmoke_2026_05_07.py`. All 6 still vetoed for `snow_or_freeze_risk`.
- Critical finding: **`last_obs=2026-04-26` for all 6 parcels** — no new Sentinel-1 descending IW scene has reached PA or Raymore in 11 days. Montana got a May 6 scene, but SK at higher latitude (51-53°N) is on a different ground-track schedule. 11 days without a descending pass is unusual but within Sentinel-1 normal variability.
- The rolling-14-day window has *shrunk* on these parcels: Apr 20 has dropped out and no new scene replaced it. The median composite is now effectively N=1 (Apr 26 only). This makes per-parcel dvh values more sensitive to single-scene noise, visible as wider swings vs the May 1 measurements (e.g., SW-7-26-20-W2 dvh -2.81 -> -4.34, NE-34-29-21-W2 dvh 3.91 -> 1.04).
- Specific case worth noting: SW-7-26-20-W2 was the only Raymore parcel that cleared the snow gate on May 1. Today the same parcel is vetoed for snow_or_freeze_risk on the same Apr 26 scene. The veto check is per-parcel local-AOI at the latest scene date; with median sensitivity now coming from a single scene, marginal QC results can flip. Working as designed; just an edge case worth logging.
- Decision: **do not run full PA or Raymore reruns today.** Smoke saved a 142-parcel rerun cycle. Re-smoke when GEE shows a fresher SAR scene over SK (next descending IW pass expected within 48-72 hours).

## v1.1 Backlog (added 2026-05-01 from satellite-imagery research review)

Source: `docs/references/satellite-imagery-seeding-detection-2026-05-04.md`. Each item is independently shippable and improves the gating/decision quality without changing the SAR backbone. Tackle in any order; each is one Codex-as-architect + Claude-implement + smoke session (~half-day).

1. **GDD (Growing Degree Days) agronomic gating.** Suspend the entire pipeline for a parcel until cumulative thermal time (sum of `max(0, daily_mean_temp_C - 5)` from snow-melt date through run date) exceeds the localized planting threshold for the parcel's territory + crop. Prevents wasted compute and false positives in early April when conditions are pre-agronomic. Uses ERA5-Land data already in the pipeline. New schema field: `seeding.gdd_cumulative` + `seeding.gdd_threshold_met` (bool). Rationale: Singh et al. 2025 (IEEE) cite GDD gating as a key noise-reduction step in the IEEE/AAFC seeding-date pipeline.

2. **Forward NDVI emergence validation.** When the pipeline calls `seeded=True`, predict the emergence date (seed_date + GDD-to-emergence threshold per crop). When that date arrives, check Sentinel-2 NDVI for the predicted spring inflection point. Validated emergence = upgrade to high-confidence retroactively. Failed emergence within window = downgrade to `null` with a `failed_emergence_check` reason. New post-processing stage that runs N days after a seeded call. Schema additions: `seeding.emergence_predicted_date`, `seeding.emergence_validated` (true/false/pending).

3. **VH/VV ratio as no-till discriminator.** We collect both polarizations but only compute `dvh_db` and `dvv_db` separately. Per the literature, weed-control tillage destroys stubble volume scattering, dropping VH/VV; no-till seeding preserves stubble, keeping VH/VV stable. Compute `vh_vv_ratio_delta = (T1.VH/T1.VV) - (T0.VH/T0.VV)`. Use as a tiebreaker: when intensity dvh suggests "seeded" but VH/VV ratio dropped, flag with veto reason `tillage_signature_not_seeding` and surface as `null` instead of seeded.

4. **Zonal percentage threshold as secondary signal.** Currently we mean-reduce dvh across the parcel polygon. Per the literature, also compute the *fraction* of pixels meeting the +1.5 dB threshold (or below -1.5 dB for negative). When the per-pixel fraction agrees with the mean call, confidence stays at current value. When they disagree (e.g., mean says seeded but only 40% of pixels meet threshold), surface as `partial_signal` with the actual percentage in the schema. Useful for headlands and irregularly-seeded fields. Replace `ee.Reducer.mean()` with a combined reducer including `percentile([15, 50, 85])` and a per-pixel threshold count.

These four are explicitly **adopt-low-cost** items. The deeper architecture decisions (CCD vs intensity dvh, RCM integration, TWI-based slough masking) are tracked separately as v1.5 scope; CCD is currently under Codex-as-architect pressure-test (see `docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md`).

## Current Property Order

- Snow-gated green calls currently held: Calderbank (7 parcels / about 1,117 ac), Ponteix (36 parcels / about 5,694 ac), Vanguard (46 parcels / about 7,258 ac), Montana (77 parcels / about 20,841 ac).
- Snow/freeze blocked: Raymore (97 parcels / about 15,184 active-read acres withheld) and Prince Albert (12 parcels / about 1,785 active-read acres withheld). May 1 smoke confirmed gate still firing for all PA and northern Raymore. Re-smoke May 3-4 after the next S1 descending IW pass.
- Clean Saskatchewan areas already strong enough to keep watching: Vanguard, Ponteix, Calderbank.
- Needs full calibration review before public confidence: Montana, because it has strong title/geometry sourcing but 66 low-QC imagery records and 6 formerly green parcels dropped to no-call on retest.
- Needs baseline/applicability work before seeded-acre reporting: Hafford, Admiral, Kamsack, Wymark, Eddystone. These currently show no active seeded-acre read. Calendar-blocked on ERA5 publication through ~May 21 to extend the SK/MB baseline window into the late-spring thaw.
- Low-priority active watch: Outlook has active read acres but 0 seeded acres and 4 low-QC records.
