# Monette Satellite Seeding Detection — v1 Design Spec

**Date:** 2026-04-28
**Status:** Draft (rev 4) — Codex rev-3 re-audit (`yes-with-revisions, 82% confidence`) findings folded in; pending user approval
**Authors:** Kyle (Bushels Energy / Monette Ledger) + Claude (Opus 4.7), structured via `superpowers:brainstorming`
**Target site:** monette.buperac.com (Monette Ledger investigative site)

**Rev 4 changes from rev 3 (re-audit response):**
- **§4.2 freeze QC**: explicit ERA5-Land daily mean 2m air temperature filter (`T_mean > 0°C`) added alongside snow + precip QC.
- **§4.2 reducer disambiguation**: median across all qualifying scenes in the baseline window (not "most recent"); single scene only if exactly one qualifies.
- **§4.4 same-relative-orbit constraint**: pin to a single Sentinel-1 relative orbit per territory to eliminate incidence-angle drift between T0 and T1.
- **§4.5 negative threshold tightened**: `mean_dvh_db ≤ -1.5` (was -1.0) so the "high-confidence not seeded" call is reachable under the §4.7 confidence formula.
- **§5 status enum disambiguated**: `status: "ok" | "no_data" | "cloudy" | "error"` only. `insufficient_baseline` lives only as an `applicability` value, not status.
- **§6 + §6.2 + §6.3 public copy softened**: "Likely seeded (84%)" / "Likely not seeded (71%)" / "Uncertain (38%)" — no checkmark certainty.
- **§8.2 Phase 0d**: GEE catalog check that `USDA/NASS/CDL` includes 2025; otherwise emit `cdl_source_year: 2024` per parcel.
- **§8.2 Phase 0e**: `calibration/az_co_applicability_overrides.json` populated by Kyle for known cotton/alfalfa/rotation mismatches *before* first AZ/CO run.
- **§8.2 Phase 3 gate**: explicit per-territory counts of {true, false, null, perennial, out-of-season, insufficient_baseline}; Phase 5 not unblocked unless distributions are sane per territory, not just globally.
- **§8.2 Phase 4 work**: `buildPreparedMapData()` in `view-map.jsx:586–590` extended to copy `seeding_seeded`, `seeding_confidence`, `seeding_applicability`, `polygon_quality` into Mapbox feature properties (the audit caught that without this they're invisible to fill expressions).

**Rev 3 → 4 audit-resolution table:** see §13 below.

**Carried forward from rev 3:**
- SAR source = `COPERNICUS/S1_GRD_FLOAT` (linear power); change-detection math in linear, dB for display only.
- AZ + CO in v1 (1,260 parcels across 14 properties).
- Tri-state output `seeded: true | false | null` with visible confidence.
- Schema source field is `status` (matches existing `view-map.jsx:554` + `property-drawer.jsx:169` consumers).
- Optical demoted to features-only.
- Pre-uploaded FeatureCollection asset + per-territory `reduceRegions` shards.
- Phase 0 GEE noncommercial verification gate.
- Route is `#map`.

---

## 1. Goal & success metric

Build a satellite-imagery pipeline that emits a **per-parcel `seeded: true | false | null` call with a visible confidence percentage**, refreshed weekly, for all 14 polygon-mapped Monette Farms properties (~213,000 acres across SK, MB, MT, AZ, CO).

**Primary surface:** new "Seeding" mode on the Atlas map (`#map` route), with a green-ramp fill keyed to confidence and the binary call. Parallel surfaces: per-parcel row in the property drawer (alongside vote tally), and a satellite-signal counter on the Farm Progress page (`#dossiers` route).

**Public copy convention:** "satellite signal," "likely seeded (84%)," "likely not seeded (71%)," "uncertain (38%)" — *not* "satellite-confirmed seeded" or "Seeded ✓." The confidence number is always shown to readers; certainty is communicated numerically rather than rhetorically.

**v1 deliberately constrained:**
- Per-parcel state with confidence (not date-of-seeding timeseries).
- Weekly refresh (not real-time / event-driven).
- Per-parcel (per quarter section / parcel), not sub-field zones.
- Optical (Sentinel-2) used as **features only**, not for hard confidence bonuses, until per-territory calibration lands in v1.5.
- AZ alfalfa parcels flagged `applicability: perennial` (no annual seeding event); AZ cotton parcels flagged `out-of-season` for spring runs (planting Feb–April already past for 2026); CO winter-wheat parcels flagged `out-of-season` for spring runs. All three states render distinctly on the map but produce no `seeded: true|false` call.

---

## 2. Region scope & seasonal calendar (v1, 14 properties / 1,260 parcels / ~213k acres)

| Territory | Properties | Parcels | Acres | Cropland mask | Active seeding window | v1 applicability |
|---|---|---:|---:|---|---|---|
| SK (Saskatchewan) | 10 (Vanguard, Ponteix, Admiral, Hafford, Kamsack, Outlook, Prince Albert, Raymore, Wymark, Calderbank) | 850 | ~127,200 | AAFC ACI | May 5 – Jun 5 | `active` (grain) |
| MB (Manitoba) | 1 (Eddystone) — The Pas excluded (parish lots, no DLS) | 165 | ~26,500 | AAFC ACI | May 10 – Jun 10 | `active` (grain) |
| MT (Big Horn) | 1 (Montana, 3 sub-properties) | 220 | ~51,500 | USDA CDL | late Mar – Jun 15 | `active` (grain + sugar beet) |
| AZ (Maricopa / Aguila) | 1 (Aguila — fee + state lease) | 23 | 3,143 | USDA CDL | n/a (Feb–Apr cotton, perennial alfalfa) | `perennial` (alfalfa) or `out-of-season` (cotton) per parcel by CDL crop class |
| CO (Lincoln / Genoa) | 1 (Genoa, BLM PLSS) | 2 | 720 | USDA CDL | mostly past (winter wheat fall 2025; spring crops late Apr) | `out-of-season` for spring runs unless CDL shows spring crop |

**Default mode toggle:**
- Seeding mode default-on: **Apr 1 – Jun 30** (catches early MT planting; user notes MT 2026 running ahead of historical window)
- Harvest mode default-on (v2 placeholder): **Aug 15 – Nov 15**
- Tenure mode (existing): default for rest of year

**Adaptive T0 baseline policy** (replaces the fixed-window approach in rev 1–2):
- Per territory, the pipeline picks the **most recent SAR scene meeting all of**:
  1. Snow-free (Sentinel-2 `SCL` snow class < 5% in matching window, or NSIDC snow product ≤ 0)
  2. Not within 24 h of >5 mm precipitation (ECCC GeoMet for CA, NOAA NCEP for US)
  3. Inside the territory's pre-planting baseline window:
     - SK/MB: Mar 25 – Apr 25 (dynamic — adjusts to late-thaw years)
     - MT: Mar 1 – Mar 25
     - AZ: not applicable (no seeding-event detection)
     - CO: Mar 1 – Mar 25 for spring crops; n/a for winter wheat
- T0 stored as a versioned GEE Asset under `projects/gen-lang-client-0259467098/assets/monette/sar_baseline_<year>/<territory>`.
- If no scene meets all three conditions in the window, the territory's parcels are flagged `seeded: null, applicability: insufficient_baseline` for that season — explicit "we couldn't establish a clean reference."

**2026 backfill caveat:** for any territory where we're already past the ideal baseline window (especially MT), the pipeline picks the best scene available from archived imagery in the relevant window with documented QC flags; results carry a `baseline_quality: backfill` marker for transparency.

---

## 3. Architecture — extends existing `imagery-data.js` contract

### Existing system to extend

The Monette atlas already defines a parcel-imagery contract:

- **File:** `imagery-data.js` at repo root, mirrored to `public/imagery-data.js` for serving (per `scripts/build-jsx.mjs` static-asset list).
- **Producer:** `scripts/build_imagery_data_js.py` (currently emits a placeholder — `parcels: {}`, `ready: false`).
- **Consumer:** `view-map.jsx` (line 554, 586–590) and `property-drawer.jsx` (line 169–180), joining via `imageryKey(propId, loc)` → `"hafford:NW-10-11-10-W3"`.
- **Existing per-parcel source fields:** `status`, `ndvi_mean`, `image_from`, `image_to`. (The consumer transforms `status` → `imagery_status` for downstream Mapbox feature properties.)
- **Loaded as:** `window.MONETTE_IMAGERY` global set inline.

**v1 graduates the placeholder into a real GEE-driven pipeline that fills BOTH the existing vigor/NDVI fields AND new seeding-specific fields per parcel — preserving the existing `status: "ok" | …` consumer contract verbatim.**

### High-level data flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│              OFFLINE PREP (one-time + on-demand)                          │
│  per-property XLSX (G:) → build_quarters_geojson.py                       │
│  + scripts/update_us_holdings_az_co.py (Maricopa GIS + BLM PLSS)          │
│  + quarter_geometry_calibration.json                                       │
│      → quarters.geojson (1,260 features, 14 properties)                   │
│      → uploaded to GEE as FeatureCollection Asset                          │
│        (projects/gen-lang-client-0259467098/assets/monette/parcels_v1)    │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              WEEKLY GEE PIPELINE (Mon 06:00 MT)                           │
│  scripts/build_imagery_data_js.py — graduated from placeholder            │
│   1. Resolve adaptive T0 baseline asset per territory                     │
│   2. Per parcel: erode 80 m + intersect with cropland mask                │
│      (AAFC ACI for SK/MB; USDA CDL for MT/AZ/CO)                          │
│   3. Capture prior_crop (modal CDL/ACI class) + applicability flag        │
│   4. Read T0 from GEE Asset                                               │
│   5. Compute T1: rolling 14-day median Sentinel-1 IW descending VV+VH     │
│      (using S1_GRD_FLOAT — linear power)                                  │
│   6. Refined Lee speckle filter, 3×3 window                               │
│   7. Snow/freeze/wet QC mask (Sentinel-2 SCL + ECCC/NOAA precip)          │
│   8. Per cropland pixel: dvh_linear = VH_T1 / VH_T0 (linear ratio);       │
│      dvh_db = 10·log10(dvh_linear) — for display only                     │
│   9. Aggregate to polygon (one reduceRegions per territory shard,         │
│      with tileScale + maxPixelsPerRegion explicit)                        │
│  10. Apply decision rule → seeded: true | false | null + confidence       │
│  11. Compute optical features (NDTI, BSI, NDVI) — features only in v1     │
│  12. Compute polygon_quality flag                                         │
│  13. Reuse NDVI for vigor field (existing layer)                          │
│  14. Write extended imagery-data.js + mirror to public/                    │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              SITE INTEGRATION                                             │
│  imagery-data.js loaded inline → window.MONETTE_IMAGERY                   │
│  view-map.jsx: existing imageryKey(propId, loc) join logic preserved      │
│                                                                           │
│  Atlas mode toggle: Tenure | Vigor (NDVI) | Seeding | Harvest             │
│    — same parcel record, mode picks which fields drive fill formula       │
│  Property drawer: satellite seeding row alongside vote row                │
│    — copy: "Satellite signal: Seeded ✓ (84% confidence)" / "Uncertain"    │
│  Farm Progress: satellite-signal counter parallel to vote counter         │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              LABEL LOOP                                                   │
│  Supabase votes → export_vote_labels.py → labels.json (weekly)            │
│  Manual review → calibrate_thresholds.py → calibration/thresholds.json    │
│  (Manual-approval gate; auto-calibration deferred to post-v1)             │
└───────────────────────────────────────────────────────────────────────────┘
```

**Compute platform:** Google Earth Engine. **Phase 0 includes a noncommercial-tier verification check** since Google now requires explicit eligibility status for non-paid use; if the project doesn't qualify, we move to paid tier or migrate to Microsoft Planetary Computer.

**Migration story:** if GEE eligibility, quota, or cost becomes a problem, port to Microsoft Planetary Computer via STAC + `stackstac` (~1:1 port of algorithm code; same Sentinel-1/2 + USDA-CDL/AAFC-ACI assets accessible).

---

## 4. Pipeline internals

### 4.1 Polygon prep + cropland mask

Existing `build_quarters_geojson.py` (SK/MB DLS + MT PLSS) and `update_us_holdings_az_co.py` (AZ Maricopa + CO Lincoln BLM PLSS) produce `quarters.geojson` with 1,260 features. Existing `quarter_geometry_calibration.json` applies per-property shift/scale/rotate corrections. **All reused as-is.**

GEE pipeline preprocessing per parcel:

1. **Erode by 80 m** via `ee.Geometry.buffer(-80)`. Removes most road/treeline/fence-line contamination at acceptable cost (~10% of true cropland pixels lost on a typical 800 m polygon).
2. **Intersect with cropland mask** — AAFC ACI for SK/MB, USDA CDL for MT/AZ/CO. Sample only pixels classified as cropland in the latest available year (2024 confirmed; 2025 if released by run time).
3. **Capture modal crop class as `prior_crop`** for phenology context AND applicability decision:
   - Alfalfa or perennial pasture → `applicability: perennial`, no seeded call.
   - Cotton (AZ) outside Feb–Apr planting window → `applicability: out-of-season`.
   - Winter wheat (CO) in spring runs → `applicability: out-of-season` (already planted previous fall).
   - All other crop classes → `applicability: active`, run full pipeline.
4. **Polygon-quality flag**: `cropland_coverage = cropland_pixels / eroded_pixel_count`. If `<0.50` → `polygon_quality: low`.

### 4.2 SAR baseline (T0) — adaptive

- **Source:** `COPERNICUS/S1_GRD_FLOAT` (linear power, no terrain correction quirks).
- **Mode:** IW, **descending pass only AND pinned to a single relative orbit per territory** (eliminates incidence-angle drift between T0 and T1; relative orbit numbers determined empirically per territory in Phase 0).
- **Polarizations:** VV + VH.
- **Per-scene QC gate** — a scene qualifies for T0 if all of:
  - Snow-free (S2 `SCL` < 5% snow OR NSIDC `snow_extent = 0`)
  - **`ECMWF/ERA5_LAND/DAILY_AGGR.temperature_2m > 273.15 K` (mean 2m air temp > 0 °C) for the scene date** — eliminates freeze-state SAR signature
  - No precipitation > 5 mm in the 24 h preceding the SAR pass (ECCC GeoMet / NOAA NCEP)
  - At least 4 unmasked cropland pixels per parcel after applying the QC mask
- **Speckle filter:** Refined Lee, 3×3 window, applied in linear power.
- **Reducer (resolved):** **median across all qualifying scenes in the baseline window**; if exactly one scene qualifies, that scene is the baseline; if zero qualify, the failure case fires.
- **Storage:** versioned GEE Asset, `monette/sar_baseline_2026/{sk,mb,mt,co}` (no AZ asset — flagged perennial/out-of-season).
- **Failure case:** if no scene in the window meets all four conditions, all parcels in that territory get `seeded: null, applicability: insufficient_baseline` until a qualifying scene becomes available.

### 4.3 SAR current state (T1)

- Same source, mode, polarizations, filter as T0.
- **Window:** rolling 14 days backward from run date.
- **Reducer:** median of scenes passing the same snow/freeze/precip QC.
- Recomputed each weekly run.
- If no qualifying scene in the 14-day window, parcel gets `seeded: null, status: no_data` for the week.

### 4.4 Change detection math (linear power, dB only for display)

Per cropland pixel inside each eroded polygon, **all math in linear power**:

```
dvh_linear = σ_VH_T1 / σ_VH_T0
dvv_linear = σ_VV_T1 / σ_VV_T0

# dB derived for human-readable display only:
dvh_db = 10 · log10(dvh_linear)
dvv_db = 10 · log10(dvv_linear)
```

Aggregate to polygon:

```
mean_dvh_linear = mean(dvh_linear | cropland_pixels)
mean_dvv_linear = mean(dvv_linear | cropland_pixels)
mean_dvh_db     = 10 · log10(mean_dvh_linear)   # for display
n_pixels        = count(cropland_pixels)
```

GEE structure: pre-upload polygons as a FeatureCollection asset, do `reduceRegions` once per territory shard with explicit `scale=20, crs='EPSG:4326', tileScale=4, maxPixelsPerRegion=1e7`. Write per-territory exports → merge in post-processing.

### 4.5 Decision rule (tri-state binary; rev 4 thresholds)

Output structure: `seeded: true | false | null`. Confidence percentage always emitted regardless.

| Condition | `seeded` | Notes |
|---|---|---|
| `applicability != "active"` | `null` | perennial / out-of-season / insufficient_baseline / no_data — not a call |
| `confidence ≥ 65` AND `mean_dvh_db ≥ +1.5` | `true` | strong signal, high-confidence positive |
| `confidence ≥ 65` AND `mean_dvh_db ≤ -1.5` | `false` | strong signal, high-confidence negative (tilled too long ago, or fallow). **Threshold tightened from -1.0 to -1.5 in rev 4** so the rule is reachable under the §4.7 confidence formula. |
| Otherwise | `null` | uncertain — show as gray with confidence pct visible |

**Threshold calibration**: the +1.5 dB / −1.0 dB cutoffs are *initial* values from prior art. Section 8 Phase 8 describes the vote-label calibration loop that tunes these per territory after ~50–100 high-trust labels accrue.

**Per-territory adjustment** (initial):
- SK/MB: baseline.
- MT: `mean_dvh_db` threshold +0.2 dB stricter (more no-till residue retention; literature priors).

### 4.6 Optical confirmation (features only in v1)

Optical is **not** weighted into confidence in v1. It's emitted as features for the drawer/audit and as inputs to v1.5 calibration.

- **Source:** `COPERNICUS/S2_SR_HARMONIZED`.
- **Filter:** `CLOUDY_PIXEL_PERCENTAGE < 30`; mask via `SCL` band.
- **Indices** (per cropland pixel):
  - **NDTI** = `(B11 − B12) / (B11 + B12)` — tillage index.
  - **NDVI** = `(B8 − B4) / (B8 + B4)` — emergence detection (lags seeding 2–3 weeks). Also fed into the existing `ndvi_mean` / `vigor_color` fields for the vigor layer.
  - **BSI** = `((B11+B4) − (B8+B2)) / ((B11+B4) + (B8+B2))` — bare-soil index.
- **Bare-soil precondition for tillage indices:** require `mean_NDVI < 0.25` over cropland pixels. Above that, the field has too much vegetation for NDTI/BSI to be meaningful.
- **No cloudless scene available:** all optical features = `null`.
- **v1.5 work:** per-territory percentile calibration of NDTI/BSI cutoffs against vote labels. v1 stores raw values for that future calibration.

### 4.7 Confidence scoring (reconciled with §4.5)

Designed so the confidence number tracks the underlying signal magnitude in a way that matches the decision rule.

```
# normalized signal strength (0..1) on |mean_dvh_db|
sig = clamp((|mean_dvh_db| - 0.5) / 1.5, 0, 1)         # 0 at 0.5 dB, 1 at 2.0 dB

base = sig * 100

# adjustments:
+ 0   if optical has no scene                          # don't bonus-bias the call
+ 0   if optical present                               # demoted in v1 — see §4.6
+ 5   if n_pixels > 200                                # statistical robustness
- 20  if cropland_coverage < 0.50                      # poor polygon QC
- 25  if precip > 5 mm in 24h before T1 scene          # wet-soil ambiguity
- 30  if T1 has no qualifying scene → automatic null   # not really a confidence subtraction; null state

confidence = clamp(base + bonuses + penalties, 0, 100)
```

**Decision-rule reconciliation (rev 4 — symmetric thresholds at ±1.5):**
- At `mean_dvh_db = +1.5`: `sig = (1.5−0.5)/1.5 = 0.667 → base 67`. With clean conditions, confidence ≈ 67–72. Crosses `≥ 65` → `seeded: true`.
- At `mean_dvh_db = +1.0`: `sig = 0.333 → base 33`. Confidence ≈ 33–40 → `seeded: null`.
- At `mean_dvh_db = −1.0`: `sig = 0.333 → base 33` (same magnitude). Confidence ≈ 33–40 → `seeded: null`.
- At `mean_dvh_db = −1.5`: `sig = 0.667 → base 67`. Confidence ≈ 67–72 → `seeded: false` (high-confidence negative).

The same confidence number drives both directions; sign of `mean_dvh_db` determines which call. Symmetric thresholds at ±1.5 dB make the rule and the formula self-consistent.

---

## 5. Output schema — extends `window.MONETTE_IMAGERY`

The pipeline writes the same `imagery-data.js` shape (preserves existing `status`-keyed consumer contract) with `parcels: {}` filled and a `seeding` sub-block plus flat `seeding_*` fields per parcel.

```js
window.MONETTE_IMAGERY = {
  generated_at: "2026-04-28T06:00:00Z",
  source: "gee-pipeline",          // was "placeholder"
  ready: true,                      // was false
  window_days: 14,                  // SAR T1 rolling window
  thresholds_version: "v1.0-prior",
  baseline_window: { sk: ["2026-03-25","2026-04-25"], mb: [...], mt: [...], co: [...] },
  coverage: {
    mapped_parcels: 1260,
    mapped_properties: 14,
    by_property: { hafford: 158, vanguard: 93, montana: 220, aguila: 23, genoa: 2, ... }
  },
  parcels: {
    "hafford:NW-10-11-10-W3": {
      // ── existing vigor fields (preserved verbatim — consumer reads these) ──
      status: "ok",                      // "ok" | "no_data" | "cloudy" | "error"
      image_from: "2026-04-15",
      image_to: "2026-04-25",
      ndvi_mean: 0.18,

      // ── new shared QC fields (flat for Mapbox addressability) ──
      polygon_quality: "high",           // "high" | "low"
      cropland_coverage: 0.78,
      prior_crop: "canola",

      // ── NEW flat seeding fields (Mapbox feature properties read these) ──
      seeding_seeded: true,              // true | false | null
      seeding_confidence: 84,
      seeding_applicability: "active",   // "active" | "perennial" | "out-of-season" | "insufficient_baseline"

      // ── NEW seeding sub-block (drawer + audit reads this) ──
      seeding: {
        seeded: true,
        applicability: "active",
        confidence: 84,
        dvh_db: 1.72,
        dvv_db: 0.31,
        n_pixels: 312,
        last_obs_date: "2026-04-25",
        baseline_quality: "fresh",       // "fresh" | "backfill"
        optical: {                        // features only in v1
          ndti: -0.08,
          bsi: 0.34,
          ndvi: 0.18,
          source_scene: "2026-04-23"
        }
      }
      // future v2: harvest sub-block + harvest_* flat fields land alongside
    },
    "aguila:Sec_25_T7N_R9W_50606041D": {
      status: "ok",
      ndvi_mean: 0.42,
      polygon_quality: "high",
      cropland_coverage: 0.85,
      prior_crop: "alfalfa",
      seeding_seeded: null,
      seeding_confidence: 0,
      seeding_applicability: "perennial",
      seeding: {
        seeded: null,
        applicability: "perennial",
        confidence: 0,
        dvh_db: null,
        dvv_db: null,
        n_pixels: 0,
        last_obs_date: null,
        baseline_quality: null,
        optical: { ndti: null, bsi: null, ndvi: 0.42, source_scene: "2026-04-23" }
      }
    }
  }
};
```

**Why the dual flat + nested representation:**
- Mapbox fill expressions can only address top-level scalar fields on feature properties. So the binary `seeding_seeded` and `seeding_confidence` are flat for the map fill formula.
- The drawer and audit views want richer data (raw ΔVH, optical, n_pixels, baseline quality). Nested `seeding: {…}` keeps that grouped without polluting the top level.
- A small consumer helper in `view-map.jsx` ensures the flat fields always agree with the nested ones (write site is the pipeline; read sites use whichever shape they need).

**File ownership:**

| File | Owner | Edit cadence |
|---|---|---|
| `quarters.geojson` | `build_quarters_geojson.py` + `update_us_holdings_az_co.py` | Manual when XLSX changes / cadastral refresh |
| `data.js` | hand-curated | Manual edits only |
| `imagery-data.js` + `public/imagery-data.js` | `build_imagery_data_js.py` (graduated from placeholder) | Weekly auto-write |
| `labels.json` | `export_vote_labels.py` | Weekly auto-write |
| `calibration/thresholds.json` | `calibrate_thresholds.py` | Manual review every 4 weeks |

**Backwards compatibility constraint (verified):**
- Existing `view-map.jsx:554` reads `imagery.status === "ok"`. Pipeline must emit `status` field per parcel.
- `view-map.jsx:586–590` transforms source → flat Mapbox fields (`imagery_status`, `imagery_from`, `imagery_to`). **Phase 4 must extend `buildPreparedMapData()` to also copy `seeding_seeded`, `seeding_confidence`, `seeding_applicability`, `polygon_quality` into Mapbox feature properties** — the rev-3 audit caught that without this, the new flat fields are invisible to fill expressions.
- `property-drawer.jsx:169–180` reads `row.status`. Same contract.
- Integration test asserts `parcel.status` is one of `{"ok", "no_data", "cloudy", "error"}` and `parcel.seeding.applicability` is one of `{"active", "perennial", "out-of-season", "insufficient_baseline", "unmapped"}` for every parcel in output.

---

## 6. UI integration

### 6.1 Atlas map mode toggle (mutually exclusive, route is `#map`)

| Mode | Default | Fill encoding | Status |
|---|---|---|---|
| 🏠 **Tenure** | rest of year | green `#5f9a45` (owned) / blue `#32a7dd` (rented) / rust `#d4553d` (sold) | shipping |
| 🌿 **Vigor (NDVI)** | optional | green-ramp from `ndvi_mean` via `vigor_color` | wired-but-empty (this design fills it) |
| 🌱 **Seeding** | Apr 1 – Jun 30 | green ramp by `seeding_seeded` × `seeding_confidence` | v1 (this design) |
| 🌾 **Harvest** | Aug 15 – Nov 15 | yellow ramp by harvest fields | v2 placeholder |

**Seeding-mode fill ramp:**

| State | Fill |
|---|---|
| `seeding_seeded=true`, `confidence ≥ 80`, polygon_quality=high | `#15803d` @ 0.55 |
| `seeding_seeded=true`, `confidence 65–79` | `#65a30d` @ 0.40 |
| `seeding_seeded=false`, `confidence ≥ 65` | `#d6d3d1` @ 0.25 (firm tan) — "tilled too long ago / fallow" |
| `seeding_seeded=null`, applicability=`active` | `#a3a3a3` @ 0.30 (gray — uncertain) |
| `applicability=perennial` | blue diagonal hatch `#3b82f6` |
| `applicability=out-of-season` | rust diagonal hatch `#a16207` |
| `applicability=insufficient_baseline` or `status≠"ok"` | gray diagonal hatch — "no current data" |
| No data / unmapped | transparent |

**Outline (mode-independent):** solid 1.5px for `polygon_quality: high`; dashed 1.5px for `polygon_quality: low`.

**Mode persistence:** `localStorage`, with calendar-default fallback for first-time visitors.

### 6.2 Property drawer satellite-row

Each parcel row shows:
- Vote tally (existing)
- **Satellite signal (new):** "🛰 Likely seeded (84%)" / "🛰 Likely not seeded (71%)" / "🛰 Uncertain (38%)" / "🛰 Perennial alfalfa" / "🛰 Out of season" / "🛰 No current scene"
- Polygon QC summary (new): quality badge + cropland coverage %
- Optical feature panel (collapsible): raw NDTI / BSI / NDVI for the most recent S-2 scene, dated

When satellite signal and votes disagree (one ≥ 65 confidence + vote opposite), surface a ⚠ warning icon and a one-liner ("vote says seeded; satellite signal weak"). Disagreements are first-class research signal for the calibration loop.

### 6.3 Farm Progress page satellite-signal counter

Add parallel line under existing vote-confirmed counter:
- Existing: `"5 of 14 properties seeded"` (vote-confirmed)
- New: `"🛰 Satellite signal: 9 of 14 properties likely seeded"` (any parcel with `seeding_seeded=true` AND `confidence ≥ 65` counts; denominator = 14 mapped properties). Public copy uses "likely seeded," not "confirmed."

Per-property cell: two stacked progress bars — green (vote-confirmed acres), light blue-green (satellite-signal-only acres ≥ 65 confidence).

---

## 7. Vote-modal label loop

`export_vote_labels.py` runs weekly ahead of Monday GEE pipeline:

1. Pull `season='seeded'` votes from Supabase (`tcsfwdljaedznqiucsdz` project).
2. Filter to high-trust labels: `vote_count ≥ 2` OR vote has source attached.
3. Emit `labels.json` keyed by `propId:loc` (matches `imagery-data.js`):
   ```json
   {
     "as_of": "2026-04-27",
     "labels": {
       "hafford:NW-10-11-10-W3": { "seeded": true, "trust": "high", "n_votes": 3 }
     }
   }
   ```

`calibrate_thresholds.py` (post-v1, fires after ~50–100 high-trust labels per territory accrue):

1. Load current `imagery-data.js` `seeding_seeded` calls + raw `dvh_db`.
2. Cross-tabulate against `labels.json`.
3. Compute per-territory ROC-style curve over `dvh_db` thresholds.
4. Pick threshold that minimizes false-negative rate while keeping false-positive ≤ 10%.
5. Write proposed deltas to `calibration/thresholds.json` for **manual PR review** (no auto-merge in v1).

---

## 8. Implementation handoff

### 8.1 Tool division

| Component | Owner | Why |
|---|---|---|
| `build_imagery_data_js.py` GEE graduation (SAR algorithm + NDVI + per-territory shards) | **Codex `gpt-5.5/xhigh`** | Heavy reasoning over remote-sensing math + GEE quota architecture; must preserve existing `status` schema |
| Phenology calibration table per territory (with citations) | **Gemini `3.1-pro-preview`** | 1M context absorbs ~30 prairie SAR papers + AZ cotton/alfalfa literature |
| Mode toggle, map layer fill formulas, drawer satellite-row, Farm Progress counter | Claude | JSX/CSS — needs project memory |
| `export_vote_labels.py` (Supabase pull) | Claude | Supabase MCP wired for this org |
| `calibrate_thresholds.py` (v1.5) | Codex `gpt-5.5/high` | Stats; downshift effort acceptable |
| Cloud Scheduler / GitHub Action (weekly fire) | Claude | Deploy/scheduling infra |

### 8.2 Phased ordering with validation gates

| Phase | Owner | Work | Gate |
|---|---|---|---|
| **0a. GEE noncommercial verification** | Kyle + Claude | Check `gen-lang-client-0259467098` eligibility under Google's noncommercial terms; if not, escalate to paid tier or migrate platform | Verification status in writing |
| **0b. Auth refresh + venv check** | Kyle + Claude | `earthengine authenticate`; confirm `C:\Users\kyle\Agriculture\Maps\.venv` works | `earthengine ls projects/gen-lang-client-0259467098/assets` succeeds |
| **0c. Polygon asset upload** | Codex | Upload `quarters.geojson` as GEE FeatureCollection at `monette/parcels_v1` | Asset visible in GEE; ID matches |
| **0d. CDL 2025 availability check** | Codex | Verify `USDA/NASS/CDL` collection in GEE includes 2025 release; if not, log `cdl_source_year: 2024` per parcel and document fallback | Catalog metadata captured; fallback documented |
| **0e. AZ/CO applicability override file** | Kyle | Populate `calibration/az_co_applicability_overrides.json` for known cotton/alfalfa/winter-wheat mismatches against CDL crop class | File exists with at least one override OR documented "no overrides needed" |
| **0f. Sentinel-1 relative-orbit selection** | Codex | Inspect `COPERNICUS/S1_GRD_FLOAT` `relativeOrbitNumber_start` values over each territory; pick one orbit per territory for T0/T1 consistency | Orbit number recorded per territory in pipeline config |
| **1a. Phenology table** | Gemini (parallel) | Per-territory residue/planting/threshold-prior table; AZ cotton + alfalfa included | Markdown table, all 5 territories, ≥3 cited sources per |
| **1b. T0 baseline computation** | Codex (parallel) | Compute & export adaptive T0 SAR baselines per territory (skip AZ) | 4 GEE Assets at `monette/sar_baseline_2026/{sk,mb,mt,co}` |
| **2. Pipeline graduation** | Codex | Extend `build_imagery_data_js.py` from placeholder to GEE-driven; preserve existing `status` field; emit flat + nested seeding fields | Valid `imagery-data.js` for 1 test parcel (Hafford NW-10-11-10-W3) with seeding sub-block + `status="ok"` + `ndvi_mean` populated; old vigor consumers don't break |
| **3. Subset validation** | Codex + Claude | Run on 50 parcels (Hafford only) | **Per-territory distribution counts** of `{seeded:true, seeded:false, seeded:null, applicability:perennial, applicability:out-of-season, applicability:insufficient_baseline}` — must look reasonable per territory, not just globally; ≥10% high-quality polygons; vigor layer renders; seeding layer renders |
| **4. UI integration** | Claude | Mode toggle + ramps + drawer satellite-row + Farm Progress counter; **extend `buildPreparedMapData()` in `view-map.jsx:586–590` to copy `seeding_seeded`, `seeding_confidence`, `seeding_applicability`, `polygon_quality` into Mapbox feature properties** | Local preview renders all 4 modes; toggle persists; drawer shows confidence pct; Mapbox fill expressions resolve `seeding_*` correctly |
| **5. Full-territory run** | Codex | All 1,260 parcels (14 mapped properties) via per-territory shards | Single `imagery-data.js` covering mapped parcels; quota not exhausted; AZ parcels correctly flagged perennial/out-of-season; per-territory distribution table emitted to run log |
| **6. Schedule + deploy** | Claude | Weekly Cloud Function or GitHub Action @ Mon 06:00 MT | First scheduled fire produces commit + Vercel deploy |
| **7. Vote-label loop** | Claude | Supabase exporter + drawer disagreement UI | Labels file populated; disagreement icons render |
| **8. Calibration** (v1.5, ~mid-June 2026) | Codex `high` | Per-territory threshold tuning after ~50–100 labels accrue | Reviewable PR with confusion matrix |

**Time estimate:** ~18–28 hr active work across phases 0–7 (slightly higher than rev 2 due to AZ/CO inclusion + adaptive baseline + asset upload + verification gate), ideally 2–3 calendar days.

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GEE noncommercial verification denied | low | high | Phase 0a check; fallback = paid GEE tier or MPC migration |
| `reduceRegions` fanout exhausts memory at 1,260 parcels | medium | high | Pre-uploaded FeatureCollection asset + per-territory shards + explicit `tileScale=4`, `maxPixelsPerRegion=1e7` |
| Sentinel-1 collection ID change mid-season | low | high | Pin `COPERNICUS/S1_GRD_FLOAT`; check release notes monthly |
| Initial thresholds wrong for 2026 prairie conditions | medium | medium | Distribution sanity check after first run; tighten via vote labels |
| Cloud cover wipes optical features for 4+ weeks | high | low | Optical is features-only in v1; SAR-primary design absorbs this |
| Vote label poisoning by bad-faith voter | low | medium | 2-vote trust threshold; manual PR review on threshold updates |
| Auth token expires mid-pipeline | medium | low | Pre-flight `earthengine ls` check |
| Adaptive T0 fails to find a clean baseline (snowy/wet spring) | medium | medium | Explicit `applicability: insufficient_baseline` state; UI shows "no current baseline" rather than silently miscalling |
| **Spring transition (freeze-thaw) misread as seeding** | medium | high | Snow/freeze/wet QC mask in §4.2; adaptive T0 picks post-thaw scene; precip penalty in confidence formula |
| Schema extension breaks existing vigor consumer | low | high | Pipeline emits `status` field per parcel; integration test asserts on every output |
| `imagery-data.js` payload size grows beyond browser tolerance | low | medium | Currently 1,260 parcels × ~15 fields ≈ 600 KB; well within tolerance. Monitor as harvest fields land |
| AZ cotton/alfalfa misclassified by CDL crop class | medium | low | Manual override file `calibration/az_co_applicability_overrides.json` (Phase 0e) for known mismatches; defaults to `null` (uncertain) when CDL ambiguous |

---

## 10. Deferred to v2

- AZ-specific cotton planting-event classifier (different phenology — wet bare soil from pre-irrigation, drip lines, etc.).
- Surveyed cadastral boundaries (SaskGeomatics ISC, MT Cadastral) — only if v1 reveals systematic errors not solved by cropland-mask intersection.
- Satellite-derived field boundaries (multi-year NDVI segmentation).
- Harvest-mode satellite layer (yellow ramp, Aug–Nov) — same architecture, different phenology calibration.
- Real-time / event-driven SAR ingestion (weekly is sufficient).
- Automated threshold calibration without manual review gate.
- Public-API exposure of `imagery-data.js`.
- "Seeded date" timeseries per parcel (derivable from binary state crossings, but not v1 surface).
- Sub-field zone detection (resolution sufficient but not in v1 scope).
- The Pas (parish-lot polygons) — not derivable from DLS math; needs GIS shapefile.
- Per-territory NDTI/BSI percentile calibration (v1.5).
- Optical confidence weighting (currently features-only; v1.5 once thresholds calibrated).

---

## 11. Open questions

The rev-3 Codex audit returned `yes-with-revisions, 82% confidence` for v1 internal deployment. Rev 4 folded all callouts back in. Remaining open questions are lighter — they're things to monitor during implementation rather than blockers:

1. **Relative orbit selection per territory** — Phase 0f surfaces the actual orbit numbers; until then the spec is committed to "single relative orbit" without naming which. If a territory has no orbit with adequate revisit rate during May–June, that becomes an issue worth re-scoping.

2. **2025 CDL availability** — Phase 0d will resolve. If GEE catalog lags, fallback to 2024 CDL is acceptable but worth flagging in `seeding.cdl_source_year` per parcel.

   **Phase 0d finding (2026-04-27):** Resolved. The `USDA/NASS/CDL` ImageCollection in GEE currently exposes years 1997 through 2025 inclusive (29 annual rasters, sorted: 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025). The 2026 satellite seeding pipeline will use **2025 CDL as the source of truth** for crop-class applicability — `seeding.cdl_source_year: 2025` per parcel for all 2026-season calls. The 2024-fallback path (`cdl_source_year: 2024`) is therefore unused at v1 launch but remains wired in code as a defensive default in case a future re-run targets a year before the catalog has caught up.

3. **Per-territory phenology calibration timing** — first 4 weeks of operation will use literature thresholds; vote-label-driven calibration (Phase 8) lags by 6 weeks. Disagreement icons in the drawer surface mismatches in the meantime.

4. **AZ override coverage** — `az_co_applicability_overrides.json` is built by hand from current Maricopa lease info. If lease cropping changes mid-season, overrides go stale. Cadence for override review: monthly during Apr–Aug.

5. **`null` aggregation in counters** — public Farm Progress UI must not count `null` parcels as "seeded yet." Implementation must explicitly filter `seeding_seeded === true` for the counter, not `!== false`.

---

## 12. Verdict (rev 3 audit)

Codex (`gpt-5.5/xhigh` with web search): **yes-with-revisions, 82% confidence** for v1 internal deployment. All rev-3 audit revisions folded into rev 4 (see §13).

---

## 13. Rev-4 audit-resolution table

| Rev-3 audit finding | Rev-4 resolution | Where |
|---|---|---|
| Fixed T0 baseline lacked freeze QC | Added ERA5-Land `temperature_2m > 273.15 K` filter to T0 selection | §4.2 |
| §4.2 contradiction (most recent vs median) | Resolved: median across qualifying scenes; single scene only if exactly one qualifies | §4.2 |
| Schema consumer-incomplete (Mapbox feature props) | Phase 4 now explicitly extends `buildPreparedMapData()` to copy `seeding_*` flat fields | §5 backwards-compat note + §8.2 Phase 4 |
| Confidence formula negative-side unreachable | Negative threshold tightened from -1.0 to -1.5 dB (symmetric with positive) | §4.5 |
| Same-relative-orbit not enforced | Phase 0f selects orbit per territory; T0 + T1 pinned to that orbit | §4.2 + §8.2 Phase 0f |
| `insufficient_baseline` overloaded as both `status` and `applicability` | Disambiguated: only `applicability` value; status enum reduced to `{ok, no_data, cloudy, error}` | §5 schema |
| 2025 CDL availability not verified | Phase 0d adds explicit GEE catalog check; fallback to 2024 with `cdl_source_year` field | §8.2 Phase 0d |
| AZ/CO need manual overrides | Phase 0e gates on populated `az_co_applicability_overrides.json` | §8.2 Phase 0e |
| Phase 3 distribution gate too vague | Per-territory counts of all 6 outcome buckets required | §8.2 Phase 3 |
| Public copy still used "Seeded ✓" certainty | Drawer + Farm Progress copy switched to "Likely seeded (X%)" | §6.2 + §6.3 |
