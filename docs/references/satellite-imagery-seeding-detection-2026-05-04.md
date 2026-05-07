# Satellite Imagery for Seeding Detection — Curated Reference

**Source:** "Advanced Satellite Earth Observation Methodologies for Detecting Seeded Status in No-Till Agricultural Systems of Canada" — Google Deep Research output dated 2026-05-04, archived locally at `docs/Satellite Imagery for Seeding Detection.docx`.

**Purpose of this file:** distilled record of which methodologies from the source apply to the Monette satellite-seeding pipeline, which we already do, which we plan to adopt, and which we explicitly reject. Includes file:line references to our pipeline so future sessions can cross-reference without re-reading the 5,400-word original. Reviewed against pipeline state at branch `feat/seeding-calibration` commit `2632275`.

---

## Quick adoption status

| Topic | Status | Owner |
|---|---|---|
| Multi-sensor fusion (S1 SAR + S2 optical) | ✅ ALIGNED | shipped |
| VH primary polarization, VV in mask | ✅ ALIGNED | shipped |
| SWIR-based NDTI residue index | ✅ ALIGNED | shipped (`optical.py`) |
| Hybrid S2 SCL + ERA5 snow QC | ✅ ALIGNED | shipped (`t0_baseline.py:add_qc_bands`) |
| Per-parcel local-AOI QC veto | ✅ ALIGNED | shipped (`pipeline.py:_active_veto_for_latest_scene`) |
| Rolling T1 vs fixed-window T0 baseline | ✅ ALIGNED | shipped |
| Tri-state output (active/null/false) | ✅ ALIGNED | shipped (`decision_rule.py`) |
| Refined Lee speckle filter | ✅ ALIGNED | shipped (`t0_baseline.py:_refined_lee`) |
| GDD agronomic gating | 🟢 v1.1 BACKLOG | unassigned |
| Forward NDVI emergence validation | 🟢 v1.1 BACKLOG | unassigned |
| VH/VV ratio as no-till discriminator | 🟢 v1.1 BACKLOG | unassigned |
| Zonal % threshold as secondary signal | 🟢 v1.1 BACKLOG | unassigned |
| InSAR Coherent Change Detection (CCD) | 🟡 v1.5 SCOPE — under Codex review | spec at `docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md` |
| RCM (RADARSAT Constellation Mission) | 🟡 v1.5 SCOPE | unassigned |
| Topographic Wetness Index for sloughs | 🟡 v1.5 SCOPE | unassigned |
| PlanetScope commercial daily 3m | ❌ REJECTED | cost vs benefit doesn't justify for CCAA monitoring |
| U-Net / SAM2 boundary delineation | ❌ REJECTED | we use authoritative cadastral DLS/PLSS |
| Random Forest / XGBoost as primary decision rule | ❌ REJECTED v1, defer to v1.5+ | no ground-truth labels yet; ~533 active parcels too small |
| 75-85% zonal threshold AS PRIMARY (vs as secondary) | ❌ REJECTED | masks legitimate partial-seeding cases |

---

## ✅ Already aligned (validates current design)

### Multi-sensor S1 + S2 fusion
> *"a 'virtual constellation' approach is strictly required... by integrating high-frequency optical imagery with the all-weather, day-and-night capabilities of Synthetic Aperture Radar (SAR), it is possible to construct a highly confident, automated detection framework."*

This is exactly our current design. Sentinel-1 (descending IW, dual-pol VV+VH) for SAR, Sentinel-2 (SR_HARMONIZED, SCL + NDVI/NDTI/BSI) for optical. No change required.

### VH primary, VV as mask
> *"VV polarization is highly sensitive to surface roughness... cross-polarized VH channel is predominantly sensitive to volume scattering within a canopy or a thick layer of standing crop residue."*

Our pipeline uses VH for the primary delta computation and VV in the common mask ([pipeline.py:458-466](C:\Users\kyle\Agriculture\Monette\scripts\gee_pipeline\pipeline.py#L458)). The doc validates this choice but suggests we could also exploit VV/VH ratios — see v1.1 backlog item #3.

### NDTI for residue/tillage tracking
> *"Heavy weed-control tillage substantially lowers the NDTI value by burying the residue and exposing bare soil minerals. In contrast, a no-till seeding operation leaves the residue intact, thereby maintaining a high, stable NDTI value."*

Our `optical.py` computes NDTI alongside NDVI and BSI. We already gate optical features on parcel-mean NDVI < 0.25 to ensure tillage indices are physically meaningful (per Bucket B retro Codex review).

### Hybrid snow QC (S2 SCL primary, ERA5 fallback)
The doc recommends NDSI for snow detection. Our implementation uses S2 SCL class 11 directly with ±3-day window, falling back to ERA5-Land `snow_cover` when S2 returns no scenes ([t0_baseline.py:144-189](C:\Users\kyle\Agriculture\Monette\scripts\gee_pipeline\t0_baseline.py#L144)). Functionally equivalent to NDSI — both leverage SWIR vs visible reflectance differences, just packaged differently.

### Per-parcel local-AOI veto
> *"Field reports override model confidence when they expose a missing QC condition. High numeric confidence can still be a false positive if snow/frozen surface is not explicitly gated on the active observation date and the local area around the parcel."*

Our `_active_veto_for_latest_scene` function ([pipeline.py:207-228](C:\Users\kyle\Agriculture\Monette\scripts\gee_pipeline\pipeline.py#L207)) implements this exactly — checks parcel-local AOI snow_pct, plus a 5km buffer (`ACTIVE_LOCAL_SNOW_BUFFER_M`) for surrounding-area conditions, plus ERA5 temp/precip. Today's Raymore smoke (2026-05-01) confirmed the per-parcel granularity catches mid-thaw progression that a territory-level gate would miss.

---

## 🟢 v1.1 Backlog — adopt (low cost, high value)

Each item is independently shippable in a half-day Codex-as-architect → Claude-implement → smoke session. Tracked in PROJECT_STATE.md and the methodology log.

### 1. GDD (Growing Degree Days) agronomic gating

**Doc summary:** *"GDD is a weather-based heuristic that measures accumulated thermal heat above a specific base temperature threshold (e.g., 5°C for many spring crops)... The detection algorithm uses GDD accumulation as a mandatory gating mechanism."*

**Why adopt:** Currently we gate on absolute conditions (snow<5%, temp>0°C, precip≤5mm) at the SAR scene date. We don't check whether *cumulative* thermal time supports any biological seeding activity yet. In early April 2026 the snow could clear, temp could exceed 0°C briefly, and our gate would consider conditions "active" — but no Saskatchewan farmer would seed with only 50 GDD accumulated. False-positive risk.

**Implementation:**
- New module `scripts/gee_pipeline/gdd.py` exposing `gdd_cumulative(territory, parcel_centroid, snow_melt_date, run_date) -> float`
- Inside `run_single_parcel`, compute `gdd` and gate before triggering SAR analysis
- Schema additions to `seeding`: `gdd_cumulative` (float), `gdd_threshold_met` (bool), `gdd_threshold_used` (int — for transparency)
- Per-territory thresholds in a new `applicability.py` constant: e.g., `SK_SPRING_CROP_GDD_MIN = 75` (placeholder; needs agronomy lookup)
- Decision rule: if `gdd_cumulative < threshold`, set applicability to `pre_agronomic` (new state), seeded=null

**Data dependency:** ERA5-Land DAILY_AGGR `temperature_2m` already in pipeline. No new data source.

### 2. Forward NDVI emergence validation

**Doc summary:** *"Once a coherence drop (the primary seeding signature) is detected, the algorithm utilizes the GDD clock to predict the exact date of the subsequent 'spring inflection point'—the specific moment when the crop emerges from the soil and causes the field's NDVI to rise sharply... If the predicted NDVI rise occurs according to the GDD timeline, the initial SAR-detected seeding event is retroactively validated with supreme statistical confidence."*

**Why adopt:** Closes the loop on detection. When we call a parcel `seeded=True` today, we have no follow-up mechanism to validate. The doc proposes: predict the emergence date as `seed_date + GDD_to_emergence`, then check S2 NDVI at that date for the predicted inflection.

**Implementation:**
- Schema additions: `seeding.emergence_predicted_date` (ISO date), `seeding.emergence_validated` (`true|false|pending`), `seeding.emergence_ndvi_observed` (float)
- New function `validate_emergence(parcel_id, seeded_date) -> ValidationResult` that runs N days after a seeded call
- Build script `scripts/gee_pipeline/validate_emergence.py` that walks the served `imagery-data.js`, finds parcels with `emergence_validated == "pending"` whose predicted date has passed, and updates their records
- Failed validation downgrades the call to `seeded=null` with reason `failed_emergence_check` — important for false-positive detection

**Cron candidate:** Run daily via the schedule plugin to keep the validation queue current.

### 3. VH/VV ratio as no-till discriminator

**Doc summary:** *"A cultivator destroys this volume, causing the VH/VV ratio to drop significantly, whereas a no-till drill largely preserves the stubble structure, maintaining the ratio."*

**Why adopt:** Currently if intensity ΔVH crosses +1.5 dB and confidence ≥ 65, we call `seeded=True`. But weed-control tillage *also* produces a positive ΔVH (different physical cause: macroscopic surface roughness change vs. soil-disturbance + residue-shift from a no-till drill). VH/VV ratio is the documented discriminator: it stays stable for no-till, drops for cultivation.

**Implementation:**
- Compute `vh_vv_ratio_t1 = mean_t1_vh / mean_t1_vv` and same for T0
- `vh_vv_ratio_delta = ratio_t1 - ratio_t0`
- New schema field: `seeding.vh_vv_ratio_delta` (float)
- Decision-rule extension: if `mean_dvh_db >= 1.5` AND `vh_vv_ratio_delta < -0.X` (X TBD via calibration), seeded → null with reason `tillage_signature_not_seeding`
- Threshold X needs Codex-as-architect pressure test — too sensitive and we'll over-suppress no-till; too loose and we'll miss tillage events

### 4. Zonal percentage threshold as secondary signal

**Doc summary:** *"if a specific majority threshold—typically between 75% and 85% of the arable pixels within a delineated parcel—crosses the InSAR coherence drop threshold and satisfies the NDTI preservation constraints, the entire operational unit is confidently classified as seeded."*

**Why adopt as SECONDARY:** Currently we mean-reduce dvh_db across the parcel polygon. A mean of 1.6 dB could come from "every pixel at 1.6 dB" (uniform seeding) or "60% at 3 dB and 40% at -0.5 dB" (partial seeding). Same mean, very different operational meaning. The doc recommends % threshold as the *primary* call, but for our use case a partially-seeded field is meaningful information we'd lose by collapsing to a binary.

**Implementation:**
- Add per-pixel threshold count alongside the mean reducer
- Compute `pct_pixels_above_threshold` (15th/50th/85th percentile of per-pixel ΔVH)
- New schema fields: `seeding.pixel_distribution.{p15, p50, p85, pct_above_seeded_threshold, pct_below_not_seeded_threshold}`
- Decision rule: if mean and percentile agree, current confidence stays. If they disagree (e.g., mean=seeded but only 50% of pixels above threshold), flag `partial_signal` with the actual %

---

## 🟡 v1.5 Scope (deferred — architecture-level work)

### InSAR Coherent Change Detection (CCD)

**Doc summary:** The doc's headline methodology. Cites Chen et al. 2025 (the source doc misattributed this as Singh et al.; correction verified by Codex web search 2026-05-01) (IEEE) achieving RMSE 5.59 days for Sentinel-1 coherence-based seeding-date detection on 3,000+ Ontario fields. The mechanism: coherence measures phase + amplitude correlation between consecutive SAR scenes — "the physical structure of the field surface has remained highly stable, down to the millimeter scale (a fraction of the radar wavelength), between the two satellite passes." A no-till drill press wheel produces millimeter-scale disturbance that drops coherence sharply.

**Why deferred:** Our current method uses *intensity* ΔVH (the magnitude of returned radar power), not coherence (phase correlation). They are different physical measurements requiring different S1 product types — we use `S1_GRD_FLOAT`, coherence requires `S1_SLC` (Single Look Complex). Switching is non-trivial: SLC processing in GEE requires interferometric setup, baseline correction, and significantly more compute per scene.

**Status:** Codex-as-architect pressure-test in progress as of 2026-05-01. Spec: `docs/superpowers/specs/2026-05-01-ccd-vs-intensity-dvh-pressure-test.md`. Decision pending.

### RCM (RADARSAT Constellation Mission) integration

**Doc summary:** Canadian C-band SAR with 4-day revisit (vs. S1's 6-12 day) and **compact polarimetry** enabling m-chi decomposition that separates volume / surface / double-bounce scattering. *"V/S ratios decline drastically following heavy tillage events... In contrast, the V/S ratio remains relatively stable, or alters only marginally, during a low-disturbance no-till seeding event."* Validated by AAFC research.

**Why deferred:** Not currently in GEE catalog (need separate ingestion via CSA), m-chi decomposition is non-trivial implementation, requires CSA data access agreement. Significant effort estimate: 1-2 weeks. Genuine Canadian-specific advantage — worth scoping for v1.5.

### Topographic Wetness Index (TWI) for slough masking

**Doc summary:** *"the Canadian landscape is heavily defined by the Prairie Pothole Region (PPR). The PPR contains millions of shallow, glacially formed depressional wetlands... If a satellite-based classification system naively averages the spectral or radar signature of an entire field boundary, the persistent presence of standing water or dense emergent wetland vegetation will severely corrupt the aggregate seeding signature."*

**Why deferred:** Real concern for our SK/MB properties (especially Eddystone, Kamsack — Manitoba parkland). Not the highest priority because most properties currently blocked are blocked on snow/freeze, not slough contamination. Implementation: DEM (Copernicus GLO-30 in GEE) + TWI computation + dynamic SAR-based slough detection using specular reflection (open water) and double-bounce scattering (flooded vegetation). 2-3 days work.

---

## ❌ Rejected — does not fit Monette use case

### PlanetScope commercial daily 3m imagery

**Doc recommendation:** *"PlanetScope's daily 3m data... unprecedented daily revisit frequency is the most critical optical asset for overcoming cloud-cover gaps."*

**Why we reject:** Commercial pricing. Monette portfolio is ~250k+ acres across 14 properties — annual PlanetScope licensing for that area is a material recurring cost. Our use case is "is this parcel seeded as of date D yes/no" for CCAA creditor monitoring — not high-frequency in-season management decisions. The Sentinel-1 + Sentinel-2 free constellation gives us sufficient temporal coverage when paired with the rolling-window T1 logic. Cost-benefit doesn't justify.

### U-Net / SAM2 boundary delineation

**Doc recommendation:** *"fully convolutional networks like U-Net or the Segment Anything Model (SAM2) are deployed on early-season PlanetScope or Sentinel-2 imagery... achieving Intersection over Union (IoU) scores above 0.80."*

**Why we reject:** We have authoritative cadastral data — DLS quarter sections in Canada and PLSS sections in the US. Title boundaries are *legally definitive*. Learned boundaries from imagery would be less accurate than the registry, not more. Useful for crowd-sourced or unknown-owner mapping; not relevant for CCAA-creditor tracking where titles are source of truth. See `.claude/skills/farmland-legal-descriptions/SKILL.md` for our quarter-section parsing.

### Random Forest / XGBoost as primary decision rule

**Doc recommendation:** *"In experiments conducted across North America, RF classifiers integrating Sentinel-1 and Sentinel-2 data achieved overall accuracies exceeding 85%."*

**Why we reject in v1:** No ground-truth seeded labels yet. ~533 active parcels is too small to robustly train RF/XGBoost without overfitting (cited studies used thousands of labeled fields). Our rule-based decision logic is interpretable and auditable — important for a CCAA-monitoring application where every call may need to be defended in court.

**Status for v1.5+:** Reconsider once vote-label loop accrues 50-100+ labeled parcels (per Bucket B retrospective Phase 7). Even then, RF/XGBoost should *layer on top of* the rule-based decision, not replace it.

### 75-85% zonal threshold AS PRIMARY decision rule

**Doc recommendation:** Use % of pixels above threshold as the *primary* binary classifier.

**Why we reject as primary:** Could mask legitimate partial-seeding situations. If a farmer hasn't seeded headlands yet, we want to surface that as `partial_signal` not silently classify the whole parcel as seeded or not-seeded. **Adopted as a SECONDARY signal** (see v1.1 backlog item #4) where the per-pixel distribution complements the mean reduction.

---

## ⚠️ Where the doc is wrong / incomplete (worth flagging in our methodology log)

These are gaps in the source document that future readers of this reference should know about — they don't invalidate the source's recommendations but they don't address known operational realities of our pipeline.

1. **No discussion of the 14-day T1 rolling window slide effect.** Today (2026-05-01) we observed dvh_db values shift ~1.5-2x on the same Apr 26 SAR scene between Apr 29 and May 1 builds, due to the median composite window sliding forward. The doc treats T1 as a snapshot.

2. **No discussion of S1 orbit-coverage gaps.** Our `t0_baseline.py:104-114` documented v1 fix (drop orbit pinning) for territories spanning >3° latitude isn't on the doc's radar. Real issue: SK bbox spans 49°N–53.5°N which exceeds one S1 swath.

3. **No discussion of ERA5-Land publication lag (~5-9 days).** Our pipeline guards against this; the doc assumes ERA5 is real-time.

4. **No discussion of CDL/ACI publication lag.** CDL 2025 wasn't fully published in GEE until well into 2026 spring. Our `pipeline.py` falls back to AAFC ACI 2024 for Canada.

5. **"5.59 day RMSE" benchmark is for *seeding-date estimation* (regression), not "is this parcel seeded yes/no" (classification).** Apples-to-apples comparison needs care. Our v1 metric should probably be confusion-matrix based (sensitivity/specificity per parcel) once we have ground truth.

6. **Doc doesn't address asymmetric snow_or_freeze_risk veto behavior.** Today's Raymore smoke confirmed the gate fires on positive-direction signals but lets decisive negative signals through. The doc's NDSI gate is a binary "seed-if-snow-free" — doesn't handle the "decisive negative still trustworthy" case.

---

## Performance benchmarks (from source, for reference)

| Method | Data | Target | Metric |
|---|---|---|---|
| InSAR coherence time series | Sentinel-1 (single orbit) | Seeding date | RMSE 5.99–9.89 days |
| InSAR coherence time series | Sentinel-1 (dual orbit) | Seeding date | RMSE 5.59 days |
| XGBoost on RCM + S1 | RCM compact pol + Sentinel-1 | Field operation date | RMSE ~7.86 days, R² 0.88 |
| Random Forest | Sentinel-2 SWIR + Landsat 8 | Tillage intensity / residue | 75-79% accuracy |
| U-Net (CNN) | Sentinel-2 / PlanetScope | Field boundary delineation | IoU > 0.80 |

---

## Key citations from source

The full source has 105 citations. Highest-relevance for our pipeline work:

- **Chen et al. 2025 — IEEE JSTARS:** "Field-Scale Detection of Crop Seeding Date Using Sentinel-1 Coherence Time Series." https://ieeexplore.ieee.org/document/11130190/ — the canonical CCD reference. DOI: 10.1109/jstars.2025.3600324. Note: source research doc misattributed this as Singh et al.; Codex web search corrected it 2026-05-01. RMSE 5.59 days is specifically the **dual-orbit 2020 Ontario corn** result.
- **Shang & Liu et al. 2020 — Remote Sensing 12(10) 1551:** Sentinel-1 seeding/harvest study; explicitly excluded April snowmelt window from seeding search to prevent false alarms — confirms snow/freeze still gates coherence-based detection. https://doi.org/10.3390/rs12101551
- **Copernicus openEO `sentinel1_sar_coherence` process (April 2026):** managed CCD pipeline that bypasses GEE's lack of SLC support. https://dataspace.copernicus.eu/news/2026-4-9-land-deformation-change-detection-interferometric-sar-coherence-openeo
- **Mahdianpari et al. — MDPI Remote Sensing:** "Monitoring Crops Using Compact Polarimetry and the RADARSAT Constellation Mission." https://www.tandfonline.com/doi/full/10.1080/07038992.2022.2121271 — RCM compact pol for crops.
- **AAFC RCM + S1 harvest detection:** "Harvest date estimation over corn and sunflower fields using Sentinel-1 and RADARSAT constellation mission data and machine learning algorithms." https://www.tandfonline.com/doi/full/10.1080/01431161.2026.2612904
- **Prairie Pothole + S1 backscatter:** "Monitoring surface water dynamics in the Prairie Pothole Region of North Dakota using dual-polarised Sentinel-1 SAR time series." https://hess.copernicus.org/articles/26/841/2022/
- **Field boundary dataset (Canadian Prairies, SAM2):** https://data.mendeley.com/datasets/2y568rt76w
