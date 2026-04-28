# Monette Satellite Seeding v1 — Pipeline Foundation Plan (Phases 0–3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the GEE-driven satellite seeding pipeline through subset validation — Phases 0–3 of the spec — producing a validated `imagery-data.js` output for the Hafford property (158 parcels) and proving the algorithm distribution looks sane before any UI work begins.

**Architecture:** Per [docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md](docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md). Three principal artifacts produced by this plan: (1) a GEE FeatureCollection asset of all 1,260 parcels, (2) per-territory T0 SAR baseline assets at `monette/sar_baseline_2026/{sk,mb,mt,co}`, (3) extended `scripts/build_imagery_data_js.py` producing tri-state seeded calls (`true | false | null`) with visible confidence percentage per parcel. Tool split: Codex owns SAR/GEE math (`gpt-5.5/xhigh`); Gemini produces phenology calibration (`3.1-pro-preview`, 1M context); Claude orchestrates and integrates non-GEE Python.

**Tech Stack:** Python 3.11+ with `earthengine-api`, `geopandas`, `numpy`, `pytest`. Google Earth Engine compute (project `gen-lang-client-0259467098`). Sentinel-1 `COPERNICUS/S1_GRD_FLOAT` (linear power), Sentinel-2 `COPERNICUS/S2_SR_HARMONIZED`, `AAFC/ACI`, `USDA/NASS/CDL`, `ECMWF/ERA5_LAND/DAILY_AGGR`. Existing Python venv at `C:\Users\kyle\Agriculture\Maps\.venv`. Repo: `github.com/Bushels/monette` (working copy at `C:\Users\kyle\Agriculture\Monette`).

**Out-of-scope for this plan (separate follow-up plans):**
- Phase 4 — UI integration (mode toggle, drawer satellite-row, Farm Progress counter, `buildPreparedMapData()` extension)
- Phase 5 — full 1,260-parcel territory-sharded run
- Phase 6 — Cloud Scheduler / GitHub Action weekly fire + Vercel deploy
- Phase 7 — Vote-label loop (Supabase exporter)
- Phase 8 — Calibration (v1.5)

---

## File Structure

### New files (created by this plan)

- `scripts/gee_pipeline/__init__.py` — package marker
- `scripts/gee_pipeline/applicability.py` — pure function: CDL/ACI crop class → `applicability` enum
- `scripts/gee_pipeline/decision_rule.py` — pure function: `mean_dvh_db` + `confidence` → `seeded` tri-state
- `scripts/gee_pipeline/confidence.py` — pure function: signal magnitude + QC penalties → 0–100 confidence
- `scripts/gee_pipeline/relative_orbit.py` — Sentinel-1 relative-orbit picker per territory (queries GEE catalog)
- `scripts/gee_pipeline/qc.py` — snow/freeze/precip QC predicates (queries ERA5 + Sentinel-2 SCL + ECCC/NOAA precip)
- `scripts/gee_pipeline/t0_baseline.py` — T0 asset creation orchestration per territory
- `scripts/gee_pipeline/pipeline.py` — single-parcel and per-territory pipeline entrypoints
- `scripts/upload_parcels_asset.py` — one-time upload of `quarters.geojson` as GEE FeatureCollection
- `tests/gee_pipeline/__init__.py`
- `tests/gee_pipeline/test_applicability.py`
- `tests/gee_pipeline/test_decision_rule.py`
- `tests/gee_pipeline/test_confidence.py`
- `tests/gee_pipeline/test_qc.py`
- `calibration/az_co_applicability_overrides.json` — manual override file (Kyle populates in Task 0e)
- `docs/superpowers/specs/2026-04-28-phenology-priors.md` — Gemini-produced phenology calibration table
- `pyproject.toml` — project metadata + pytest config (if not already present)
- `requirements-dev.txt` — `pytest`, `earthengine-api`, etc.

### Modified files

- `scripts/build_imagery_data_js.py` — graduate from placeholder to GEE-driven via `gee_pipeline.pipeline.build_imagery_payload()`

### Reused as-is (no modification in this plan)

- `quarters.geojson`
- `scripts/build_quarters_geojson.py`
- `scripts/update_us_holdings_az_co.py`
- `scripts/quarter_geometry_calibration.json`
- `view-map.jsx`, `property-drawer.jsx`, `view-dossiers-index.jsx` (UI work is Phase 4 — out-of-scope for this plan)

---

## Phase 0 — Setup & Verification

### Task 0a: GEE noncommercial verification (Kyle action item)

**Files:** none — this is an account-state check, not code.

- [ ] **Step 1: Visit Google Cloud Console for project `gen-lang-client-0259467098`**

URL: https://console.cloud.google.com/earth-engine/project?project=gen-lang-client-0259467098

- [ ] **Step 2: Confirm noncommercial eligibility**

Look for "Project Use Type" or noncommercial-verification banner. If not yet verified, click "Apply for noncommercial use." Eligible categories: research, education, journalism, nonprofit, government. Monette Ledger qualifies under journalism / public-interest research.

- [ ] **Step 3: Document outcome in `docs/superpowers/specs/`**

Write a one-paragraph note to `docs/superpowers/specs/2026-04-28-gee-eligibility.md` recording: project ID, verification status (verified | pending | denied), date, fallback decision if denied (paid GEE tier vs Microsoft Planetary Computer migration).

- [ ] **Step 4: Commit eligibility note**

```bash
cd "C:/Users/kyle/Agriculture/Monette"
git add -f docs/superpowers/specs/2026-04-28-gee-eligibility.md
git commit -m "docs: record GEE noncommercial eligibility status for satellite seeding pipeline"
```

---

### Task 0b: GEE auth refresh + venv smoke test

**Files:** none — terminal commands only.

- [ ] **Step 1: Activate the Maps venv**

```bash
source "C:/Users/kyle/Agriculture/Maps/.venv/Scripts/activate"
# Bash on Windows: forward slashes work
```

- [ ] **Step 2: Refresh earthengine credentials**

```bash
earthengine authenticate
```

Expected: opens browser; sign in with the Google account associated with project `gen-lang-client-0259467098`; paste the auth code back into the terminal. Credentials write to `C:\Users\kyle\.config\earthengine\credentials`.

- [ ] **Step 3: Verify auth works**

```bash
earthengine ls projects/gen-lang-client-0259467098/assets
```

Expected: returns a list (possibly empty if no assets yet) without auth errors.

- [ ] **Step 4: Verify Python `earthengine-api` import**

```bash
python -c "import ee; ee.Initialize(project='gen-lang-client-0259467098'); print('GEE OK,', ee.Number(42).getInfo())"
```

Expected output:
```
GEE OK, 42
```

- [ ] **Step 5: No commit needed (no file changes).**

---

### Task 0c: Upload `quarters.geojson` as GEE FeatureCollection asset

**Files:**
- Create: `scripts/upload_parcels_asset.py`

- [ ] **Step 1: Write the upload script**

```python
# scripts/upload_parcels_asset.py
"""
One-time upload of quarters.geojson as a GEE FeatureCollection asset.

Run after `earthengine authenticate`. The asset is referenced by
gee_pipeline.pipeline as the source of polygon geometry, so this must
happen before any T0 baseline or weekly pipeline runs.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import ee

GEE_PROJECT = "gen-lang-client-0259467098"
ASSET_ID = f"projects/{GEE_PROJECT}/assets/monette/parcels_v1"

ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = ROOT / "quarters.geojson"


def main() -> int:
    ee.Initialize(project=GEE_PROJECT)

    geojson = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    features = []
    for f in geojson.get("features", []):
        props = f.get("properties") or {}
        # Carry forward only the fields the pipeline needs to keep the asset small.
        keep = {
            "property_id": props.get("property_id"),
            "loc": props.get("loc"),
            "titled_ac": props.get("titled_ac"),
        }
        features.append(ee.Feature(ee.Geometry(f["geometry"]), keep))

    fc = ee.FeatureCollection(features)
    print(f"Uploading {len(features)} features as {ASSET_ID}...")

    task = ee.batch.Export.table.toAsset(
        collection=fc,
        description="monette_parcels_v1_upload",
        assetId=ASSET_ID,
    )
    task.start()
    print(f"Started task {task.id}. Monitor with: earthengine task info {task.id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the upload**

```bash
python scripts/upload_parcels_asset.py
```

Expected output:
```
Uploading 1260 features as projects/gen-lang-client-0259467098/assets/monette/parcels_v1...
Started task <TASK_ID>. Monitor with: earthengine task info <TASK_ID>
```

- [ ] **Step 3: Wait for task completion**

```bash
earthengine task info <TASK_ID>
```

Expected: status transitions `READY` → `RUNNING` → `COMPLETED` (typically 1–5 minutes for 1,260 features).

- [ ] **Step 4: Verify asset is queryable**

```bash
python -c "import ee; ee.Initialize(project='gen-lang-client-0259467098'); fc = ee.FeatureCollection('projects/gen-lang-client-0259467098/assets/monette/parcels_v1'); print('parcels:', fc.size().getInfo())"
```

Expected output:
```
parcels: 1260
```

- [ ] **Step 5: Commit the upload script**

```bash
git add scripts/upload_parcels_asset.py
git commit -m "feat(gee): add one-time upload of quarters.geojson as GEE FeatureCollection asset"
```

---

### Task 0d: Verify USDA CDL 2025 availability in GEE

**Files:** none — investigative; updates spec if mismatch found.

- [ ] **Step 1: Query the CDL collection metadata**

```bash
python -c "
import ee
ee.Initialize(project='gen-lang-client-0259467098')
cdl = ee.ImageCollection('USDA/NASS/CDL')
years = cdl.aggregate_array('system:index').getInfo()
print('CDL years available:', sorted(set(y[:4] for y in years)))
"
```

- [ ] **Step 2: Record latest year**

If output includes `'2025'`, the pipeline can use 2025 CDL for 2026 calls. If only `'2024'` is the latest, the pipeline must emit `seeding.cdl_source_year: 2024` per parcel and document the lag.

- [ ] **Step 3: Document outcome**

Append a one-paragraph note to `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` under §11 ("Open questions") indicating which CDL year is the source of truth for 2026 v1, and how/when 2025 will land if not yet available.

- [ ] **Step 4: Commit if note added**

```bash
git add docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md
git commit -m "docs(spec): record CDL 2025 availability finding (Phase 0d)"
```

---

### Task 0e: Populate AZ/CO applicability overrides file (Kyle action item)

**Files:**
- Create: `calibration/az_co_applicability_overrides.json`

- [ ] **Step 1: Create directory + file shell**

```bash
mkdir -p calibration
```

- [ ] **Step 2: Populate based on current Maricopa/Lincoln lease intel**

Write `calibration/az_co_applicability_overrides.json`:

```json
{
  "version": 1,
  "as_of": "2026-04-28",
  "note": "Manual overrides for parcels where CDL crop class doesn't match current operator intent. Applied AFTER CDL classification but BEFORE the seeding decision rule. Empty overrides map = trust CDL for everything.",
  "overrides": {
    "aguila:T07N-R08W-S29-50607017": {
      "applicability": "perennial",
      "reason": "Aguila section 29 — 640 ac state-leased alfalfa, lease 01-1199 (Monette FY2026 cropping confirmed alfalfa)",
      "source": "Maricopa County Assessor + state-trust lease record"
    }
  }
}
```

Add one entry per parcel where you have ground-truth that contradicts the CDL crop class. If you have no overrides yet, leave the `overrides` map empty — that's a valid v1 starting state, and the pipeline will trust CDL for everything.

- [ ] **Step 3: Commit**

```bash
git add calibration/az_co_applicability_overrides.json
git commit -m "feat(calibration): seed AZ/CO applicability overrides file for satellite pipeline"
```

---

### Task 0f: Pick Sentinel-1 relative orbit per territory

**Files:**
- Create: `scripts/gee_pipeline/__init__.py`
- Create: `scripts/gee_pipeline/relative_orbit.py`

- [ ] **Step 1: Create the package marker**

```bash
mkdir -p scripts/gee_pipeline tests/gee_pipeline
```

```python
# scripts/gee_pipeline/__init__.py
"""Monette satellite seeding pipeline (GEE-driven)."""
```

```python
# tests/gee_pipeline/__init__.py
```

- [ ] **Step 2: Write the relative-orbit picker**

```python
# scripts/gee_pipeline/relative_orbit.py
"""
Pick a single Sentinel-1 relative orbit per territory.

Rationale: change-detection math (T1 vs T0) only makes sense when both
scenes are taken from the same incidence-angle regime. Sentinel-1
descending pass over the prairies has 2–3 distinct relative orbits
visible in any given AOI; mixing them looks like a backscatter change
that is actually pure orbit geometry.

This script inspects the S1_GRD_FLOAT collection inside each territory's
bounding box over a recent 6-month window, counts scene availability per
relative orbit, and writes the chosen orbit number per territory to
config so the rest of the pipeline can reference it.
"""
from __future__ import annotations
from collections import Counter
from typing import Dict

import ee

# Approximate AOI bounding boxes per territory (lng_min, lat_min, lng_max, lat_max).
# Tight enough to discriminate orbits, loose enough to cover all parcels.
TERRITORY_BBOXES: Dict[str, tuple] = {
    "sk": (-110.0, 49.0, -101.5, 53.5),     # Saskatchewan
    "mb": (-100.5, 51.0, -98.5, 52.5),      # Eddystone area
    "mt": (-108.5, 45.0, -107.0, 46.5),     # Big Horn County
    "co": (-103.5, 39.0, -103.0, 39.5),     # Genoa, Lincoln Co
}


def pick_orbit(territory: str, window_months: int = 6) -> int:
    """
    Inspect S1_GRD_FLOAT IW descending scenes over the territory bbox in
    the last `window_months`. Return the most-frequent relativeOrbitNumber.
    """
    bbox = TERRITORY_BBOXES[territory]
    aoi = ee.Geometry.Rectangle(list(bbox))
    end = ee.Date(ee.Number(ee.Date(ee.Date(ee.Number(0)).millis())).add(0))  # placeholder; use real `Date.now()`
    # Use ee.Date with a server-side now() instead:
    end = ee.Date(ee.String("2026-04-28"))  # pin to spec date for deterministic picking
    start = end.advance(-window_months, "month")

    coll = (
        ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
    )
    orbits = coll.aggregate_array("relativeOrbitNumber_start").getInfo()
    if not orbits:
        raise RuntimeError(f"No S1 IW descending scenes found for {territory}")
    counter = Counter(orbits)
    most_common, _count = counter.most_common(1)[0]
    return int(most_common)


def pick_all() -> Dict[str, int]:
    return {t: pick_orbit(t) for t in TERRITORY_BBOXES}


if __name__ == "__main__":
    ee.Initialize(project="gen-lang-client-0259467098")
    result = pick_all()
    import json
    print(json.dumps(result, indent=2))
```

- [ ] **Step 3: Run and capture orbit numbers**

```bash
python scripts/gee_pipeline/relative_orbit.py
```

Expected output (orbit numbers will vary):
```json
{
  "sk": 49,
  "mb": 78,
  "mt": 49,
  "co": 49
}
```

- [ ] **Step 4: Persist results to a config file**

Write `scripts/gee_pipeline/orbits.json`:

```json
{
  "as_of": "2026-04-28",
  "orbits": {
    "sk": 49,
    "mb": 78,
    "mt": 49,
    "co": 49
  },
  "source": "scripts/gee_pipeline/relative_orbit.py"
}
```

(Use whatever the script actually output; do NOT use the example values blindly.)

- [ ] **Step 5: Commit**

```bash
git add scripts/gee_pipeline/__init__.py scripts/gee_pipeline/relative_orbit.py scripts/gee_pipeline/orbits.json tests/gee_pipeline/__init__.py
git commit -m "feat(gee): add Sentinel-1 relative-orbit picker per territory"
```

---

## Phase 1 — Phenology table + T0 baselines

### Task 1a: Gemini phenology calibration table

**Files:**
- Create: `docs/superpowers/specs/2026-04-28-phenology-priors.md`

- [ ] **Step 1: Compose the Gemini prompt**

Save this prompt to a temp file at `docs/superpowers/specs/.gemini-phenology-prompt.txt` (gitignored):

```
You are a senior remote-sensing scientist with deep prairie agricultural
expertise. Build a per-territory phenology calibration table for a
Sentinel-1 SAR change-detection seeding-event classifier.

Territories (with rough operator + crop mix):

1. Saskatchewan (Vanguard, Ponteix, Admiral, Hafford, Kamsack, Outlook,
   Prince Albert, Raymore, Wymark, Calderbank): wheat, canola, oats,
   peas, lentils, barley. ~177k acres across 850 quarters.
2. Manitoba (Eddystone): mixed grain + forage. ~24k acres, 165 parcels.
3. Montana Big Horn County: wheat + sugar beet + irrigated alfalfa
   in some sections. ~52k acres, 220 parcels.
4. Arizona Maricopa Co (Aguila): cotton + alfalfa, irrigated, mix of
   fee + state-trust lease. 3,143 acres, 23 parcels.
5. Colorado Lincoln Co (Genoa): high-plains dryland — winter wheat,
   spring wheat, corn, millet. 720 acres, 2 parcels.

Inputs you must produce per territory (markdown table):
- Typical planting window calendar (start date, end date, primary crops)
- Typical residue type at T0 (Feb–Mar) and expected residue Sentinel-1
  VH backscatter signature (in dB, with citations)
- Expected ΔVH magnitude when seeding/tillage occurs (with citations)
- Expected ΔVV magnitude (often less diagnostic but worth recording)
- Adjustments to the spec's default thresholds (mean_dvh_db ≥ +1.5 →
  seeded:true; ≤ -1.5 → seeded:false) — should the territory be
  stricter or looser, and why?
- Confounders unique to this territory (e.g., Big Horn River flooding,
  Aguila irrigation pulses, prairie sloughs)
- Pre-seeding scene-availability advice (which weeks usually have the
  most cloud-free / snow-free / unflooded SAR + S2 scenes)

Cite all numerical claims. Use AAFC SMAPVEX-12, McNairn et al., Davidson
et al., USDA SARS, Sentinel Hub knowledge base, and any peer-reviewed
remote-sensing literature you can locate on prairie seeding detection.
Output as a single Markdown document, one section per territory.
```

- [ ] **Step 2: Run Gemini headless**

```bash
gemini -p "$(cat docs/superpowers/specs/.gemini-phenology-prompt.txt)" -o text > docs/superpowers/specs/2026-04-28-phenology-priors.md
```

Expected: produces a 5-section markdown doc with cited tables.

- [ ] **Step 3: Kyle reviews the output**

Read `docs/superpowers/specs/2026-04-28-phenology-priors.md` end-to-end. Verify each cited reference resolves. If a section is thin, re-prompt Gemini with `-i` (interactive) to deepen that section.

- [ ] **Step 4: Commit phenology priors**

```bash
git add -f docs/superpowers/specs/2026-04-28-phenology-priors.md
git commit -m "docs: add Gemini-produced phenology calibration table for satellite seeding pipeline"
```

---

### Task 1b: Implement QC predicates (snow/freeze/precip)

**Files:**
- Create: `scripts/gee_pipeline/qc.py`
- Create: `tests/gee_pipeline/test_qc.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/gee_pipeline/test_qc.py
"""Unit tests for the snow/freeze/precip QC predicates.

The actual GEE-side QC mask is built in qc.build_qc_mask(); these tests
cover the pure-Python helpers it uses.
"""
import pytest
from scripts.gee_pipeline.qc import (
    is_snow_free,
    is_unfrozen,
    is_dry_24h,
    qualifies_for_baseline,
)


def test_snow_free_true_when_under_threshold():
    assert is_snow_free(snow_pct=2.0) is True


def test_snow_free_false_when_at_threshold():
    assert is_snow_free(snow_pct=5.0) is False


def test_snow_free_false_when_over_threshold():
    assert is_snow_free(snow_pct=12.5) is False


def test_unfrozen_true_above_zero_celsius():
    assert is_unfrozen(temp_2m_kelvin=274.0) is True


def test_unfrozen_false_at_zero_celsius():
    # T_mean must be STRICTLY > 273.15 K per spec §4.2
    assert is_unfrozen(temp_2m_kelvin=273.15) is False


def test_unfrozen_false_below_zero():
    assert is_unfrozen(temp_2m_kelvin=270.0) is False


def test_dry_24h_true_under_5mm():
    assert is_dry_24h(precip_mm=4.9) is True


def test_dry_24h_true_at_5mm():
    # Spec §4.2: "no precipitation > 5 mm". 5.0 mm is NOT > 5.0, so it passes
    # the gate. Strictly inclusive at the boundary.
    assert is_dry_24h(precip_mm=5.0) is True


def test_dry_24h_false_over_5mm():
    assert is_dry_24h(precip_mm=12.3) is False


def test_qualifies_for_baseline_all_pass():
    assert qualifies_for_baseline(snow_pct=2.0, temp_2m_kelvin=275.0, precip_mm=1.0) is True


def test_qualifies_for_baseline_freeze_fails():
    assert qualifies_for_baseline(snow_pct=2.0, temp_2m_kelvin=270.0, precip_mm=1.0) is False


def test_qualifies_for_baseline_snow_fails():
    assert qualifies_for_baseline(snow_pct=20.0, temp_2m_kelvin=280.0, precip_mm=1.0) is False


def test_qualifies_for_baseline_wet_fails():
    assert qualifies_for_baseline(snow_pct=2.0, temp_2m_kelvin=275.0, precip_mm=10.0) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/gee_pipeline/test_qc.py -v
```

Expected: every test fails with `ModuleNotFoundError: No module named 'scripts.gee_pipeline.qc'`.

- [ ] **Step 3: Implement the QC predicates**

```python
# scripts/gee_pipeline/qc.py
"""
Snow/freeze/precip QC predicates for SAR baseline scene selection.

Per spec §4.2, a Sentinel-1 scene qualifies as a T0 baseline candidate
only if all of the following hold for the scene's date and AOI:

  - snow-free (Sentinel-2 SCL snow class < 5%, OR NSIDC snow_extent = 0)
  - unfrozen (ECMWF/ERA5_LAND/DAILY_AGGR.temperature_2m > 273.15 K)
  - dry (no precipitation > 5 mm in the 24 h preceding the SAR pass,
    via ECCC GeoMet for CA / NOAA NCEP for US)

This module exposes pure-Python helpers for those three rules so they
can be unit-tested without GEE. The GEE-side mask construction lives
in qc.build_qc_mask() (Phase 2 — uses these same thresholds via ee
expressions).
"""
from __future__ import annotations

SNOW_THRESHOLD_PCT = 5.0
FREEZE_THRESHOLD_KELVIN = 273.15
PRECIP_THRESHOLD_MM = 5.0


def is_snow_free(snow_pct: float) -> bool:
    """True iff snow coverage in the AOI is < 5% (per Sentinel-2 SCL)."""
    return snow_pct < SNOW_THRESHOLD_PCT


def is_unfrozen(temp_2m_kelvin: float) -> bool:
    """True iff daily mean 2m air temperature is strictly above 0 °C."""
    return temp_2m_kelvin > FREEZE_THRESHOLD_KELVIN


def is_dry_24h(precip_mm: float) -> bool:
    """True iff cumulative precip in the 24 h before the SAR pass is ≤ 5 mm."""
    return precip_mm <= PRECIP_THRESHOLD_MM


def qualifies_for_baseline(
    *, snow_pct: float, temp_2m_kelvin: float, precip_mm: float
) -> bool:
    """All three QC rules must pass for a scene to qualify as T0 baseline."""
    return (
        is_snow_free(snow_pct)
        and is_unfrozen(temp_2m_kelvin)
        and is_dry_24h(precip_mm)
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gee_pipeline/test_qc.py -v
```

Expected: all 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gee_pipeline/qc.py tests/gee_pipeline/test_qc.py
git commit -m "feat(gee): add snow/freeze/precip QC predicates with unit tests"
```

---

### Task 1c: Implement applicability classifier (CDL/ACI crop class → applicability enum)

**Files:**
- Create: `scripts/gee_pipeline/applicability.py`
- Create: `tests/gee_pipeline/test_applicability.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/gee_pipeline/test_applicability.py
"""Unit tests for CDL/ACI crop class → applicability enum mapping.

Per spec §4.1, applicability values are:
  active | perennial | out-of-season | insufficient_baseline | unmapped
"""
import pytest
from scripts.gee_pipeline.applicability import (
    applicability_for_crop,
    PERENNIAL_CROPS,
    OUT_OF_SEASON_SPRING,
)


def test_canola_is_active():
    # AAFC ACI canola class
    assert applicability_for_crop(crop_class="canola", territory="sk", run_date="2026-04-28") == "active"


def test_wheat_is_active_in_sk():
    assert applicability_for_crop(crop_class="spring_wheat", territory="sk", run_date="2026-04-28") == "active"


def test_alfalfa_is_perennial_anywhere():
    assert applicability_for_crop(crop_class="alfalfa", territory="az", run_date="2026-04-28") == "perennial"
    assert applicability_for_crop(crop_class="alfalfa", territory="sk", run_date="2026-04-28") == "perennial"


def test_pasture_is_perennial():
    assert applicability_for_crop(crop_class="pasture_grass", territory="mt", run_date="2026-04-28") == "perennial"


def test_winter_wheat_is_out_of_season_in_spring_run():
    # Spring satellite run finds winter wheat that was planted previous fall
    assert applicability_for_crop(crop_class="winter_wheat", territory="co", run_date="2026-04-28") == "out-of-season"


def test_cotton_in_az_late_april_is_out_of_season():
    # AZ cotton planting is Feb-mid April; April 28 is past the window
    assert applicability_for_crop(crop_class="cotton", territory="az", run_date="2026-04-28") == "out-of-season"


def test_cotton_in_az_early_march_is_active():
    # AZ cotton planting is in progress in early March
    assert applicability_for_crop(crop_class="cotton", territory="az", run_date="2026-03-05") == "active"


def test_unknown_crop_defaults_to_active():
    # Spec policy: when CDL is ambiguous, run the pipeline; the QC + decision-rule
    # null-out path will catch unmappable signal.
    assert applicability_for_crop(crop_class="other_grain", territory="sk", run_date="2026-04-28") == "active"


def test_perennial_crops_set_membership():
    # alfalfa, pasture_grass, hay_perennial should all be in the perennial set
    assert "alfalfa" in PERENNIAL_CROPS
    assert "pasture_grass" in PERENNIAL_CROPS
```

- [ ] **Step 2: Run to verify tests fail**

```bash
pytest tests/gee_pipeline/test_applicability.py -v
```

Expected: all 9 tests FAIL with import error.

- [ ] **Step 3: Implement the classifier**

```python
# scripts/gee_pipeline/applicability.py
"""
CDL/ACI crop class → applicability enum.

Per spec §4.1, the per-parcel `applicability` value drives the decision
rule (and the map fill style). This module captures the v1 logic:

  - alfalfa, pasture, hay_perennial → perennial (no annual seeding event)
  - winter_wheat in any territory during spring run → out-of-season
    (planted previous fall; pipeline cannot detect a seeding event for it)
  - AZ cotton outside the Feb 1 – Apr 15 planting window → out-of-season
  - Unknown / ambiguous classes → active (let the pipeline run; the
    decision rule will null-out weak signals via confidence < 65)

All other classes → active (run full pipeline).

This is intentionally simple in v1. Manual overrides via
calibration/az_co_applicability_overrides.json get applied AFTER this
classifier (in pipeline.apply_applicability_overrides()).
"""
from __future__ import annotations
from datetime import date
from typing import Literal

Applicability = Literal[
    "active",
    "perennial",
    "out-of-season",
    "insufficient_baseline",
    "unmapped",
]

PERENNIAL_CROPS = frozenset({
    "alfalfa",
    "pasture_grass",
    "hay_perennial",
    "grass_managed",
    "switchgrass",
})

OUT_OF_SEASON_SPRING = frozenset({
    "winter_wheat",  # planted previous fall, no spring seeding event
    "winter_canola",
    "winter_barley",
})

# AZ cotton planting window — Feb 1 to mid-April
AZ_COTTON_PLANTING_END_MMDD = (4, 15)


def _parse_run_date(run_date: str) -> date:
    return date.fromisoformat(run_date)


def applicability_for_crop(
    *, crop_class: str, territory: str, run_date: str
) -> Applicability:
    """
    Map a CDL/ACI crop class string to an applicability enum, considering
    the territory and the date the satellite pipeline is being run on.
    """
    crop = crop_class.lower().strip()

    if crop in PERENNIAL_CROPS:
        return "perennial"

    if crop in OUT_OF_SEASON_SPRING:
        return "out-of-season"

    # AZ cotton is seasonal: planting Feb 1 – mid-April. After Apr 15 the
    # crop is already in ground; we cannot detect a seeding event.
    if crop == "cotton" and territory == "az":
        d = _parse_run_date(run_date)
        cutoff_mmdd = AZ_COTTON_PLANTING_END_MMDD
        if (d.month, d.day) > cutoff_mmdd:
            return "out-of-season"
        return "active"

    # Default: run the pipeline; let the decision rule decide if the
    # signal is strong enough.
    return "active"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gee_pipeline/test_applicability.py -v
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gee_pipeline/applicability.py tests/gee_pipeline/test_applicability.py
git commit -m "feat(gee): add CDL/ACI applicability classifier with unit tests"
```

---

### Task 1d: Implement confidence formula

**Files:**
- Create: `scripts/gee_pipeline/confidence.py`
- Create: `tests/gee_pipeline/test_confidence.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/gee_pipeline/test_confidence.py
"""Unit tests for the §4.7 confidence formula.

The formula: sig = clamp((|mean_dvh_db| - 0.5) / 1.5, 0, 1) * 100, then
add bonuses (+5 for n_pixels > 200) and subtract penalties (-20 for
cropland_coverage < 0.50, -25 for precip > 5mm in 24h).
"""
import pytest
from scripts.gee_pipeline.confidence import compute_confidence


def test_at_positive_threshold_clean_conditions():
    # mean_dvh_db = +1.5, no penalties, no bonuses
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    # sig = (1.5 - 0.5) / 1.5 = 0.667; base = 67
    assert 65 <= c <= 70


def test_at_positive_threshold_with_robustness_bonus():
    # n_pixels > 200 adds +5
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=300,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert 70 <= c <= 75


def test_at_negative_threshold_clean():
    # |-1.5| produces same magnitude → same base
    c = compute_confidence(
        mean_dvh_db=-1.5,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert 65 <= c <= 70


def test_inside_uncertain_zone():
    # mean_dvh_db = +1.0 → sig = 0.333 → base 33
    c = compute_confidence(
        mean_dvh_db=1.0,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert 30 <= c <= 38


def test_low_polygon_quality_penalty():
    # Same magnitude but cropland_coverage < 0.50 subtracts 20
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=150,
        cropland_coverage=0.30,
        precip_mm_24h=2.0,
    )
    # Base ~67, penalty -20 → ~47
    assert 45 <= c <= 50


def test_wet_soil_penalty():
    # precip > 5mm subtracts 25
    c = compute_confidence(
        mean_dvh_db=1.5,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=8.0,
    )
    # Base ~67, penalty -25 → ~42
    assert 40 <= c <= 45


def test_far_above_threshold_caps_at_100():
    # mean_dvh_db = +5.0 should give sig=1, base=100
    c = compute_confidence(
        mean_dvh_db=5.0,
        n_pixels=300,
        cropland_coverage=0.9,
        precip_mm_24h=0.0,
    )
    # Bonus +5 capped at 100
    assert c == 100


def test_zero_signal_clamps_at_zero():
    c = compute_confidence(
        mean_dvh_db=0.0,
        n_pixels=150,
        cropland_coverage=0.7,
        precip_mm_24h=2.0,
    )
    assert c == 0


def test_returns_int_in_0_100_range():
    for dvh in [-3.0, -1.0, 0.0, 1.0, 3.0]:
        c = compute_confidence(
            mean_dvh_db=dvh,
            n_pixels=150,
            cropland_coverage=0.7,
            precip_mm_24h=2.0,
        )
        assert isinstance(c, int)
        assert 0 <= c <= 100
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/gee_pipeline/test_confidence.py -v
```

Expected: all 9 tests FAIL with import error.

- [ ] **Step 3: Implement the formula**

```python
# scripts/gee_pipeline/confidence.py
"""
Confidence scoring per spec §4.7 (rev 4).

  sig  = clamp((|mean_dvh_db| - 0.5) / 1.5, 0, 1) * 100
  base = sig

  + 5  if n_pixels > 200            (statistical robustness)
  - 20 if cropland_coverage < 0.50  (poor polygon QC)
  - 25 if precip_mm_24h > 5.0       (wet-soil ambiguity)

  final = clamp(base + bonuses + penalties, 0, 100)

The same formula handles positive and negative SAR change. The sign of
mean_dvh_db only matters for the decision rule (see decision_rule.py),
not for the confidence number.
"""
from __future__ import annotations


CONFIDENCE_FLOOR_DB = 0.5
CONFIDENCE_CEILING_DB = 2.0
ROBUSTNESS_PIXEL_THRESHOLD = 200
ROBUSTNESS_BONUS = 5
POLYGON_QC_PENALTY = -20
POLYGON_QC_THRESHOLD = 0.50
WET_SOIL_PENALTY = -25
WET_SOIL_PRECIP_THRESHOLD_MM = 5.0


def compute_confidence(
    *,
    mean_dvh_db: float,
    n_pixels: int,
    cropland_coverage: float,
    precip_mm_24h: float,
) -> int:
    """Return an integer confidence in [0, 100]."""
    magnitude = abs(mean_dvh_db)

    # Normalize magnitude to [0, 1] over [0.5, 2.0] dB
    span = CONFIDENCE_CEILING_DB - CONFIDENCE_FLOOR_DB
    normalized = (magnitude - CONFIDENCE_FLOOR_DB) / span
    sig = max(0.0, min(1.0, normalized))
    base = sig * 100.0

    bonus = ROBUSTNESS_BONUS if n_pixels > ROBUSTNESS_PIXEL_THRESHOLD else 0
    penalty = 0
    if cropland_coverage < POLYGON_QC_THRESHOLD:
        penalty += POLYGON_QC_PENALTY
    if precip_mm_24h > WET_SOIL_PRECIP_THRESHOLD_MM:
        penalty += WET_SOIL_PENALTY

    final = base + bonus + penalty
    final = max(0.0, min(100.0, final))
    return int(round(final))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gee_pipeline/test_confidence.py -v
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gee_pipeline/confidence.py tests/gee_pipeline/test_confidence.py
git commit -m "feat(gee): add confidence-scoring formula with unit tests"
```

---

### Task 1e: Implement decision rule (mean_dvh_db + confidence → seeded tri-state)

**Files:**
- Create: `scripts/gee_pipeline/decision_rule.py`
- Create: `tests/gee_pipeline/test_decision_rule.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/gee_pipeline/test_decision_rule.py
"""Unit tests for the §4.5 decision rule (rev 4 thresholds).

  applicability != "active"          → seeded: null
  confidence ≥ 65 AND dvh_db ≥ +1.5  → seeded: true
  confidence ≥ 65 AND dvh_db ≤ -1.5  → seeded: false
  otherwise                          → seeded: null
"""
import pytest
from scripts.gee_pipeline.decision_rule import decide_seeded


def test_perennial_returns_null():
    assert decide_seeded(applicability="perennial", mean_dvh_db=2.0, confidence=85) is None


def test_out_of_season_returns_null():
    assert decide_seeded(applicability="out-of-season", mean_dvh_db=2.0, confidence=85) is None


def test_insufficient_baseline_returns_null():
    assert decide_seeded(applicability="insufficient_baseline", mean_dvh_db=2.0, confidence=85) is None


def test_strong_positive_active_returns_true():
    assert decide_seeded(applicability="active", mean_dvh_db=1.7, confidence=78) is True


def test_strong_negative_active_returns_false():
    assert decide_seeded(applicability="active", mean_dvh_db=-1.7, confidence=78) is False


def test_low_confidence_returns_null():
    # ΔVH magnitude looks strong but confidence below threshold
    assert decide_seeded(applicability="active", mean_dvh_db=1.7, confidence=60) is None


def test_below_positive_threshold_returns_null():
    # Confidence high enough but dvh_db not over +1.5
    assert decide_seeded(applicability="active", mean_dvh_db=1.2, confidence=70) is None


def test_above_negative_threshold_returns_null():
    # |dvh_db| < 1.5 so neither true nor false
    assert decide_seeded(applicability="active", mean_dvh_db=-1.0, confidence=70) is None


def test_exactly_at_positive_threshold():
    # +1.5 is the boundary — inclusive per spec table
    assert decide_seeded(applicability="active", mean_dvh_db=1.5, confidence=65) is True


def test_exactly_at_negative_threshold():
    # -1.5 is the boundary — inclusive per spec table
    assert decide_seeded(applicability="active", mean_dvh_db=-1.5, confidence=65) is False


def test_exactly_at_confidence_floor():
    # Confidence == 65 is the inclusive minimum
    assert decide_seeded(applicability="active", mean_dvh_db=1.6, confidence=65) is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/gee_pipeline/test_decision_rule.py -v
```

Expected: all 11 tests FAIL with import error.

- [ ] **Step 3: Implement the decision rule**

```python
# scripts/gee_pipeline/decision_rule.py
"""
Decision rule for the §4.5 tri-state seeded call.

  seeded:
    null  if applicability != "active"
    true  if confidence ≥ 65 AND mean_dvh_db ≥ +1.5
    false if confidence ≥ 65 AND mean_dvh_db ≤ -1.5
    null  otherwise (uncertain — show as gray with confidence pct visible)

Symmetric thresholds at ±1.5 dB ensure the rule is reachable under the
§4.7 confidence formula (the negative side at -1.0 was unreachable in
rev 3 — see rev-4 audit-resolution table).
"""
from __future__ import annotations
from typing import Optional

from .applicability import Applicability


POSITIVE_THRESHOLD_DB = 1.5
NEGATIVE_THRESHOLD_DB = -1.5
CONFIDENCE_FLOOR = 65


def decide_seeded(
    *,
    applicability: Applicability,
    mean_dvh_db: float,
    confidence: int,
) -> Optional[bool]:
    """Return True (seeded), False (not seeded), or None (uncertain / n/a)."""
    if applicability != "active":
        return None

    if confidence < CONFIDENCE_FLOOR:
        return None

    if mean_dvh_db >= POSITIVE_THRESHOLD_DB:
        return True

    if mean_dvh_db <= NEGATIVE_THRESHOLD_DB:
        return False

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gee_pipeline/test_decision_rule.py -v
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Run all gee_pipeline tests together**

```bash
pytest tests/gee_pipeline/ -v
```

Expected: 42 tests pass (13 qc + 9 applicability + 9 confidence + 11 decision_rule).

- [ ] **Step 6: Commit**

```bash
git add scripts/gee_pipeline/decision_rule.py tests/gee_pipeline/test_decision_rule.py
git commit -m "feat(gee): add tri-state seeded decision rule with unit tests"
```

---

### Task 1f: T0 baseline asset creation per territory

**Files:**
- Create: `scripts/gee_pipeline/t0_baseline.py`

- [ ] **Step 1: Write the T0 baseline script**

```python
# scripts/gee_pipeline/t0_baseline.py
"""
Compute and export the per-territory T0 SAR baseline as a versioned GEE
Asset, per spec §4.2.

For each territory:
  1. Filter S1_GRD_FLOAT IW descending to the territory's bbox + baseline
     window + chosen relative orbit
  2. Per scene, compute snow_pct (S2 SCL), temp_2m (ERA5), precip_24h
     (ERA5 total_precipitation)
  3. Filter scenes to those passing the qualifies_for_baseline gate
  4. Apply Refined Lee speckle filter (3x3 window) in linear power
  5. Median-reduce across qualifying scenes
  6. Export as Asset

Storage layout:
  monette/sar_baseline_2026/sk
  monette/sar_baseline_2026/mb
  monette/sar_baseline_2026/mt
  monette/sar_baseline_2026/co

(No AZ — flagged perennial/out-of-season.)
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Dict

import ee

GEE_PROJECT = "gen-lang-client-0259467098"
ASSET_PARENT = f"projects/{GEE_PROJECT}/assets/monette/sar_baseline_2026"

# Per-territory baseline windows, per spec §2.
# Format: (start_iso, end_iso, bbox)
BASELINE_WINDOWS: Dict[str, tuple] = {
    "sk": ("2026-02-15", "2026-04-15", (-110.0, 49.0, -101.5, 53.5)),
    "mb": ("2026-02-15", "2026-04-15", (-100.5, 51.0, -98.5, 52.5)),
    "mt": ("2026-02-01", "2026-03-15", (-108.5, 45.0, -107.0, 46.5)),
    "co": ("2026-02-01", "2026-03-15", (-103.5, 39.0, -103.0, 39.5)),
}

ROOT = Path(__file__).resolve().parent.parent.parent
ORBITS_PATH = ROOT / "scripts" / "gee_pipeline" / "orbits.json"


def _load_orbits() -> Dict[str, int]:
    return json.loads(ORBITS_PATH.read_text())["orbits"]


def _refined_lee(image: ee.Image) -> ee.Image:
    """Apply 3x3 Refined Lee speckle filter (linear power)."""
    # Standard implementation; see GEE community catalog at:
    #   https://github.com/google/earthengine-community/tree/master/toolkits/landcover
    kernel = ee.Kernel.square(radius=1, units="pixels", normalize=False)
    mean = image.reduceNeighborhood(ee.Reducer.mean(), kernel)
    variance = image.reduceNeighborhood(ee.Reducer.variance(), kernel)
    # Coefficient of variation
    cv = variance.divide(mean.pow(2))
    # Adaptive blend: high-variance pixels keep raw value, low-variance get smoothed
    weight = cv.divide(cv.add(0.25))
    smoothed = mean.add(image.subtract(mean).multiply(weight))
    return smoothed.rename(image.bandNames())


def build_baseline_image(territory: str) -> ee.Image:
    """Build the median-composited T0 baseline image for one territory."""
    start, end, bbox = BASELINE_WINDOWS[territory]
    aoi = ee.Geometry.Rectangle(list(bbox))
    orbit = _load_orbits()[territory]

    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
        .filter(ee.Filter.eq("relativeOrbitNumber_start", orbit))
    )

    # Per-scene QC: snow-free, unfrozen, dry-24h.
    def add_qc_bands(scene: ee.Image) -> ee.Image:
        date = ee.Date(scene.date())
        # ERA5-Land daily mean 2m air temperature
        era5 = (
            ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
            .filterDate(date, date.advance(1, "day"))
            .first()
        )
        temp_2m = era5.select("temperature_2m")
        # ERA5 total_precipitation in metres → convert to mm × 1000, sum 24 h
        precip = era5.select("total_precipitation_sum").multiply(1000.0)
        # S2 SCL snow class for the scene date AOI
        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filterDate(date.advance(-1, "day"), date.advance(1, "day"))
            .map(lambda im: im.select("SCL"))
            .median()
        )
        snow_mask = s2.eq(11)  # SCL class 11 = snow

        return (
            scene.addBands(temp_2m.rename("temp_2m_K"))
            .addBands(precip.rename("precip_24h_mm"))
            .addBands(snow_mask.rename("snow_mask"))
        )

    s1_qc = s1.map(add_qc_bands)

    # Filter scenes whose AOI-mean QC values qualify
    def qualifies(scene: ee.Image) -> ee.Image:
        stats = scene.select(["temp_2m_K", "precip_24h_mm", "snow_mask"]).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=1000,
            maxPixels=1e8,
        )
        snow_ok = ee.Number(stats.get("snow_mask")).lt(0.05)  # < 5% snow
        warm_ok = ee.Number(stats.get("temp_2m_K")).gt(273.15)
        dry_ok = ee.Number(stats.get("precip_24h_mm")).lte(5.0)
        passes = snow_ok.And(warm_ok).And(dry_ok)
        return scene.set("qc_pass", passes)

    s1_with_pass = s1_qc.map(qualifies)
    qualifying = s1_with_pass.filter(ee.Filter.eq("qc_pass", 1))

    # Refined Lee speckle filter, then median composite
    cleaned = qualifying.map(_refined_lee)
    composite = cleaned.select(["VV", "VH"]).median()
    return composite.clip(aoi)


def export_baseline(territory: str) -> ee.batch.Task:
    """Kick off an Asset export for the territory's T0 baseline."""
    image = build_baseline_image(territory)
    asset_id = f"{ASSET_PARENT}/{territory}"
    bbox = BASELINE_WINDOWS[territory][2]
    region = ee.Geometry.Rectangle(list(bbox))

    task = ee.batch.Export.image.toAsset(
        image=image,
        description=f"monette_t0_baseline_2026_{territory}",
        assetId=asset_id,
        region=region,
        scale=20,
        maxPixels=1e10,
    )
    task.start()
    return task


def export_all() -> Dict[str, str]:
    """Run T0 baseline export for SK, MB, MT, CO."""
    results = {}
    for territory in ["sk", "mb", "mt", "co"]:
        print(f"Exporting T0 baseline for {territory}...")
        task = export_baseline(territory)
        results[territory] = task.id
        print(f"  task: {task.id}")
    return results


if __name__ == "__main__":
    ee.Initialize(project=GEE_PROJECT)
    print(json.dumps(export_all(), indent=2))
```

- [ ] **Step 2: Run T0 baseline exports**

```bash
python scripts/gee_pipeline/t0_baseline.py
```

Expected output:
```
Exporting T0 baseline for sk...
  task: <TASK_ID_SK>
Exporting T0 baseline for mb...
  task: <TASK_ID_MB>
Exporting T0 baseline for mt...
  task: <TASK_ID_MT>
Exporting T0 baseline for co...
  task: <TASK_ID_CO>
{
  "sk": "<TASK_ID_SK>",
  "mb": "<TASK_ID_MB>",
  "mt": "<TASK_ID_MT>",
  "co": "<TASK_ID_CO>"
}
```

- [ ] **Step 3: Wait for all 4 exports to complete**

```bash
earthengine task list | head -20
```

Wait until all 4 tasks show `COMPLETED` status. Each takes ~5–15 min.

- [ ] **Step 4: Verify all 4 assets exist**

```bash
earthengine ls projects/gen-lang-client-0259467098/assets/monette/sar_baseline_2026
```

Expected output:
```
projects/gen-lang-client-0259467098/assets/monette/sar_baseline_2026/sk
projects/gen-lang-client-0259467098/assets/monette/sar_baseline_2026/mb
projects/gen-lang-client-0259467098/assets/monette/sar_baseline_2026/mt
projects/gen-lang-client-0259467098/assets/monette/sar_baseline_2026/co
```

If any task fails (insufficient qualifying scenes), document the failure in `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` and either widen the QC tolerance or escalate to backfill mode (see spec §4.2 "2026 backfill caveat").

- [ ] **Step 5: Commit the script**

```bash
git add scripts/gee_pipeline/t0_baseline.py
git commit -m "feat(gee): add per-territory T0 SAR baseline asset creation"
```

---

## Phase 2 — Pipeline scaffold (single test parcel)

### Task 2a: Build the single-parcel pipeline orchestrator

**Files:**
- Create: `scripts/gee_pipeline/pipeline.py`

- [ ] **Step 1: Write the pipeline module**

```python
# scripts/gee_pipeline/pipeline.py
"""
Single-parcel and territory-shard pipeline entrypoints.

For Phase 2, only run_single_parcel() is exercised. Phase 5 (separate
plan) layers on territory-shard runs that call this same primitive.
"""
from __future__ import annotations
import json
from datetime import date
from pathlib import Path
from typing import Optional

import ee

from .applicability import applicability_for_crop, Applicability
from .confidence import compute_confidence
from .decision_rule import decide_seeded

GEE_PROJECT = "gen-lang-client-0259467098"
PARCEL_ASSET = f"projects/{GEE_PROJECT}/assets/monette/parcels_v1"
T0_PARENT = f"projects/{GEE_PROJECT}/assets/monette/sar_baseline_2026"

# Per-territory cropland masks
CROPLAND_MASKS = {
    "sk": "AAFC/ACI/2024",
    "mb": "AAFC/ACI/2024",
    "mt": "USDA/NASS/CDL/2024",
    "co": "USDA/NASS/CDL/2024",
}

# CDL → AAFC ACI common-name map (subset; expand as needed)
CDL_CLASS_TO_NAME = {
    1: "spring_wheat",
    24: "winter_wheat",
    2: "cotton",
    36: "alfalfa",
    37: "non_alfalfa_hay",
    176: "pasture_grass",
    # ... expand from USDA CDL legend
}

ACI_CLASS_TO_NAME = {
    133: "canola",
    146: "spring_wheat",
    122: "winter_wheat",
    136: "barley",
    167: "oats",
    192: "alfalfa",
    # ... expand from AAFC ACI legend
}


def _territory_for_parcel(property_id: str) -> str:
    """Map a property_id to its territory."""
    sk = {"vanguard", "ponteix", "admiral", "hafford", "kamsack", "outlook",
          "prince-albert", "raymore", "wymark", "calderbank"}
    mb = {"eddystone"}
    mt = {"montana"}
    az = {"aguila"}
    co = {"genoa"}
    if property_id in sk: return "sk"
    if property_id in mb: return "mb"
    if property_id in mt: return "mt"
    if property_id in az: return "az"
    if property_id in co: return "co"
    raise ValueError(f"Unknown property_id: {property_id}")


def _classify_crop(class_id: int, territory: str) -> str:
    """Map a CDL/ACI numeric class to a friendly crop name."""
    if territory in {"sk", "mb"}:
        return ACI_CLASS_TO_NAME.get(class_id, "unknown")
    return CDL_CLASS_TO_NAME.get(class_id, "unknown")


def run_single_parcel(
    *,
    property_id: str,
    loc: str,
    run_date: str,
) -> dict:
    """
    Run the full Phase 2 pipeline for one parcel and return the
    imagery-data.js-compatible record.
    """
    territory = _territory_for_parcel(property_id)
    parcels = ee.FeatureCollection(PARCEL_ASSET)
    parcel_fc = parcels.filter(
        ee.Filter.And(
            ee.Filter.eq("property_id", property_id),
            ee.Filter.eq("loc", loc),
        )
    )
    geom = parcel_fc.first().geometry()

    # 1. Erode by 80m
    eroded = geom.buffer(-80)

    if territory == "az":
        # AZ is flagged out at the territory level for v1 spring runs
        return _empty_record(territory, "perennial_or_out_of_season", run_date)

    # 2. Cropland mask
    cropland_collection = CROPLAND_MASKS[territory]
    cropland_img = ee.Image(cropland_collection)
    # AAFC ACI: cropland classes are 100+; CDL: cropland is non-zero non-pasture
    if territory in {"sk", "mb"}:
        cropland_mask = cropland_img.select("landcover").gte(100)
    else:
        cropland_mask = cropland_img.select("cropland").neq(0)
    masked = cropland_mask.clip(eroded)

    # 3. cropland_coverage
    total_pixels = ee.Image.constant(1).clip(eroded).reduceRegion(
        reducer=ee.Reducer.count(),
        geometry=eroded,
        scale=20,
        maxPixels=1e7,
    ).getNumber("constant")
    cropland_pixels = masked.reduceRegion(
        reducer=ee.Reducer.count(),
        geometry=eroded,
        scale=20,
        maxPixels=1e7,
    ).getNumber(masked.bandNames().get(0))

    cc_value = cropland_pixels.divide(total_pixels)

    # 4. Modal prior_crop class
    modal_class = cropland_img.reduceRegion(
        reducer=ee.Reducer.mode(),
        geometry=eroded,
        scale=20,
        maxPixels=1e7,
    ).getNumber(cropland_img.bandNames().get(0))

    crop_name = _classify_crop(int(modal_class.getInfo() or -1), territory)

    # 5. Applicability
    applicability = applicability_for_crop(
        crop_class=crop_name, territory=territory, run_date=run_date
    )

    if applicability != "active":
        return _build_record(
            territory=territory,
            cropland_coverage=float(cc_value.getInfo() or 0),
            prior_crop=crop_name,
            applicability=applicability,
            mean_dvh_db=None,
            n_pixels=0,
            run_date=run_date,
        )

    # 6. Read T0 baseline + compute T1, then ΔVH
    t0 = ee.Image(f"{T0_PARENT}/{territory}")
    t1_window_start = ee.Date(run_date).advance(-14, "day")
    t1_window_end = ee.Date(run_date)
    orbits = json.loads(
        Path(__file__).parent.joinpath("orbits.json").read_text()
    )["orbits"]
    t1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
        .filterBounds(eroded)
        .filterDate(t1_window_start, t1_window_end)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
        .filter(ee.Filter.eq("relativeOrbitNumber_start", orbits[territory]))
        .median()
        .clip(eroded)
    )

    # Linear ratio per pixel, masked to cropland
    dvh_linear = t1.select("VH").divide(t0.select("VH")).updateMask(masked)
    dvv_linear = t1.select("VV").divide(t0.select("VV")).updateMask(masked)

    stats = dvh_linear.addBands(dvv_linear.rename("dvv_linear")).reduceRegion(
        reducer=ee.Reducer.mean().combine(
            ee.Reducer.count(), sharedInputs=True
        ),
        geometry=eroded,
        scale=20,
        maxPixels=1e7,
        tileScale=4,
    )

    mean_dvh_linear = stats.getNumber("VH_mean")
    n_pixels = stats.getNumber("VH_count")
    if mean_dvh_linear is None or mean_dvh_linear.getInfo() is None:
        return _build_record(
            territory=territory,
            cropland_coverage=float(cc_value.getInfo() or 0),
            prior_crop=crop_name,
            applicability="insufficient_baseline",
            mean_dvh_db=None,
            n_pixels=0,
            run_date=run_date,
        )

    import math
    mean_dvh_db_value = 10 * math.log10(mean_dvh_linear.getInfo())
    n_pixels_value = int(n_pixels.getInfo() or 0)

    return _build_record(
        territory=territory,
        cropland_coverage=float(cc_value.getInfo() or 0),
        prior_crop=crop_name,
        applicability=applicability,
        mean_dvh_db=mean_dvh_db_value,
        n_pixels=n_pixels_value,
        run_date=run_date,
    )


def _build_record(
    *,
    territory: str,
    cropland_coverage: float,
    prior_crop: str,
    applicability: Applicability,
    mean_dvh_db: Optional[float],
    n_pixels: int,
    run_date: str,
) -> dict:
    """Compose the per-parcel imagery-data.js record."""
    polygon_quality = "high" if cropland_coverage >= 0.50 else "low"

    if mean_dvh_db is None:
        confidence = 0
        seeded = None
    else:
        # Precip and dvv for v1 not threaded into this scaffold; use 0
        confidence = compute_confidence(
            mean_dvh_db=mean_dvh_db,
            n_pixels=n_pixels,
            cropland_coverage=cropland_coverage,
            precip_mm_24h=0.0,
        )
        seeded = decide_seeded(
            applicability=applicability,
            mean_dvh_db=mean_dvh_db,
            confidence=confidence,
        )

    return {
        "status": "ok",
        "image_from": run_date,
        "image_to": run_date,
        "ndvi_mean": None,  # filled in Phase 4
        "polygon_quality": polygon_quality,
        "cropland_coverage": round(cropland_coverage, 3),
        "prior_crop": prior_crop,
        "seeding_seeded": seeded,
        "seeding_confidence": confidence,
        "seeding_applicability": applicability,
        "seeding": {
            "seeded": seeded,
            "applicability": applicability,
            "confidence": confidence,
            "dvh_db": round(mean_dvh_db, 3) if mean_dvh_db is not None else None,
            "dvv_db": None,  # added in a future task
            "n_pixels": n_pixels,
            "last_obs_date": run_date,
            "baseline_quality": "fresh",
            "optical": None,  # added in a future task
        },
    }


def _empty_record(territory: str, applicability: Applicability, run_date: str) -> dict:
    return _build_record(
        territory=territory,
        cropland_coverage=0,
        prior_crop="unknown",
        applicability=applicability,
        mean_dvh_db=None,
        n_pixels=0,
        run_date=run_date,
    )


if __name__ == "__main__":
    ee.Initialize(project=GEE_PROJECT)
    record = run_single_parcel(
        property_id="hafford",
        loc="NW-10-11-10-W3",
        run_date="2026-04-28",
    )
    print(json.dumps(record, indent=2))
```

- [ ] **Step 2: Run on the test parcel**

```bash
python scripts/gee_pipeline/pipeline.py
```

Expected output: a JSON record with `seeding.dvh_db` in [-3, +3] dB, `n_pixels > 50`, `cropland_coverage > 0.5`, `seeding.confidence` between 0 and 100, and a tri-state `seeded` value.

- [ ] **Step 3: Verify output schema matches spec §5**

Manually inspect the JSON output against the schema in `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` §5. Required fields:
- `status`, `image_from`, `image_to`, `ndvi_mean` (top-level)
- `polygon_quality`, `cropland_coverage`, `prior_crop` (shared QC)
- `seeding_seeded`, `seeding_confidence`, `seeding_applicability` (flat for Mapbox)
- `seeding.{seeded, applicability, confidence, dvh_db, n_pixels, last_obs_date, baseline_quality}` (nested)

Any missing field is a defect — fix before commit.

- [ ] **Step 4: Commit**

```bash
git add scripts/gee_pipeline/pipeline.py
git commit -m "feat(gee): add single-parcel pipeline orchestrator (Phase 2 scaffold)"
```

---

### Task 2b: Graduate `build_imagery_data_js.py` to call the pipeline

**Files:**
- Modify: `scripts/build_imagery_data_js.py`

- [ ] **Step 1: Read the current placeholder**

```bash
cat scripts/build_imagery_data_js.py
```

Confirm the structure — `build_placeholder()` produces `parcels: {}`. The new version replaces `build_placeholder()` with `build_payload(parcels=...)` that calls `gee_pipeline.pipeline.run_single_parcel()` for each parcel in the supplied list.

- [ ] **Step 2: Modify the script**

Replace the body of `scripts/build_imagery_data_js.py` with:

```python
"""
Build imagery-data.js for the Monette atlas.

v2 (rev 4): graduated from placeholder to GEE-driven via the
gee_pipeline package. For Phase 2 (this plan), the script accepts a
--parcels-list JSON file specifying which parcels to process; default
is the Hafford property (158 parcels).

Phases 3 onwards expand the parcel list and add territory shards.
"""
from __future__ import annotations
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import ee

ROOT = Path(__file__).resolve().parent.parent
GEOJSON = ROOT / "quarters.geojson"
OUT = ROOT / "imagery-data.js"
PUBLIC_OUT = ROOT / "public" / "imagery-data.js"

GEE_PROJECT = "gen-lang-client-0259467098"


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_parcel_index() -> dict:
    """Load quarters.geojson and index features by (property_id, loc)."""
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    index = {}
    by_property = Counter()
    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        prop_id = props.get("property_id")
        loc = props.get("loc")
        if not (prop_id and loc):
            continue
        index[f"{prop_id}:{loc}"] = props
        by_property[prop_id] += 1
    return {
        "total_features": sum(by_property.values()),
        "by_property": dict(sorted(by_property.items())),
        "lookup": index,
    }


def build_payload(parcel_keys: list[str], run_date: str) -> dict:
    """Run the GEE pipeline for each parcel in parcel_keys."""
    from scripts.gee_pipeline.pipeline import run_single_parcel

    ee.Initialize(project=GEE_PROJECT)
    coverage = load_parcel_index()
    parcels_out = {}

    for key in parcel_keys:
        prop_id, loc = key.split(":", 1)
        try:
            record = run_single_parcel(
                property_id=prop_id, loc=loc, run_date=run_date
            )
        except Exception as exc:  # noqa: BLE001
            record = {
                "status": "error",
                "error": str(exc),
                "image_from": run_date,
                "image_to": run_date,
            }
        parcels_out[key] = record

    return {
        "generated_at": iso_now(),
        "source": "gee-pipeline",
        "ready": True,
        "window_days": 14,
        "thresholds_version": "v1.0-prior",
        "coverage": {
            "mapped_parcels": coverage["total_features"],
            "mapped_properties": len(coverage["by_property"]),
            "by_property": coverage["by_property"],
        },
        "parcels": parcels_out,
    }


def write_js(payload: dict) -> None:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    for path in (OUT, PUBLIC_OUT):
        path.write_text(
            "// AUTO-GENERATED by scripts/build_imagery_data_js.py\n"
            "// GEE-driven payload — Phase 2 scaffold (Hafford-only by default).\n"
            f"window.MONETTE_IMAGERY = {body};\n",
            encoding="utf-8",
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--property-id", default="hafford",
                        help="Process only parcels under this property_id")
    parser.add_argument("--run-date", default="2026-04-28",
                        help="ISO date for T1 window end")
    parser.add_argument("--limit", type=int, default=None,
                        help="Process at most N parcels (Phase 2 default: 1)")
    args = parser.parse_args()

    coverage = load_parcel_index()
    keys = [k for k in coverage["lookup"]
            if k.startswith(f"{args.property_id}:")]
    if args.limit:
        keys = keys[:args.limit]
    print(f"Processing {len(keys)} parcels under {args.property_id}...")

    payload = build_payload(keys, args.run_date)
    write_js(payload)
    print(f"Wrote {OUT.name} and {PUBLIC_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run for the single test parcel (Hafford NW-10-11-10-W3)**

```bash
python scripts/build_imagery_data_js.py --property-id hafford --limit 1 --run-date 2026-04-28
```

Expected: writes `imagery-data.js` with one Hafford parcel populated (`source: "gee-pipeline"`, `ready: true`, `parcels` map has 1 entry).

- [ ] **Step 4: Inspect the output**

```bash
python -c "
import json
with open('imagery-data.js') as f:
    raw = f.read().split('window.MONETTE_IMAGERY = ', 1)[1].rstrip(';\n')
data = json.loads(raw)
print(f\"source: {data['source']}\")
print(f\"ready: {data['ready']}\")
print(f\"parcels: {len(data['parcels'])}\")
for k, v in data['parcels'].items():
    print(f'  {k}: status={v[\"status\"]}, seeded={v[\"seeding_seeded\"]}, conf={v[\"seeding_confidence\"]}')
"
```

Expected output:
```
source: gee-pipeline
ready: true
parcels: 1
  hafford:NW-10-11-10-W3: status=ok, seeded=<true|false|None>, conf=<int 0-100>
```

- [ ] **Step 5: Verify the existing vigor consumer still loads (smoke test)**

Open `index.html` in a local preview (`python -m http.server --directory C:/Users/kyle/Agriculture/Monette 8765`), navigate to `http://localhost:8765/#map/hafford`, open the property drawer, and confirm no console errors. The vigor layer will be empty (no `ndvi_mean` in this scaffold) but the page must not crash.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_imagery_data_js.py
git commit -m "feat(imagery): graduate build_imagery_data_js.py to GEE-driven (Phase 2)"
```

---

## Phase 3 — Subset validation (50 Hafford parcels)

### Task 3a: Run the pipeline against all 158 Hafford parcels

**Files:** none — execution-only.

- [ ] **Step 1: Run the full Hafford set**

```bash
python scripts/build_imagery_data_js.py --property-id hafford --run-date 2026-04-28
```

Expected: ~30–60 minutes (1 reduceRegion call per parcel). The output `imagery-data.js` should contain ~158 parcels.

- [ ] **Step 2: Compute per-territory distribution**

```bash
python -c "
import json
from collections import Counter
with open('imagery-data.js') as f:
    raw = f.read().split('window.MONETTE_IMAGERY = ', 1)[1].rstrip(';\n')
data = json.loads(raw)

seeded_counts = Counter()
applicability_counts = Counter()
quality_counts = Counter()
for k, v in data['parcels'].items():
    seeded_counts[v.get('seeding_seeded')] += 1
    applicability_counts[v.get('seeding_applicability', 'unknown')] += 1
    quality_counts[v.get('polygon_quality', 'unknown')] += 1

print('seeded:', dict(seeded_counts))
print('applicability:', dict(applicability_counts))
print('polygon_quality:', dict(quality_counts))
"
```

Expected: a non-trivial distribution — NOT all `null`, NOT all `true`, NOT all `false`. Realistic for late-April Hafford might be ~80% null (uncertain or active-but-not-yet), ~10% true (early seeding starting), ~10% false (residual fallow). Polygon quality ≥10% high.

- [ ] **Step 3: Document the distribution as a baseline run log**

Write `docs/superpowers/specs/2026-04-28-phase3-subset-distribution.md`:

```markdown
# Phase 3 — Hafford Subset Distribution Run Log

**Date:** 2026-04-28
**Run by:** <implementer>

## Counts

(insert actual counts from Step 2)

## Sanity assessment

- [ ] No "all-true" / "all-false" / "all-null" pathology
- [ ] ≥10% polygon_quality=high
- [ ] Distribution looks plausible for Hafford in late April 2026
- [ ] No `status=error` records (or, if present, root-causes documented below)

## Anomalies & follow-ups

(list anything that needs investigation)
```

- [ ] **Step 4: Commit baseline log**

```bash
git add -f docs/superpowers/specs/2026-04-28-phase3-subset-distribution.md
git commit -m "docs(phase3): record Hafford subset distribution baseline"
```

---

### Task 3b: Phase 3 gate review

**Files:** none — review checkpoint.

- [ ] **Step 1: Review distribution against expected sanity criteria**

Open `docs/superpowers/specs/2026-04-28-phase3-subset-distribution.md` and check the four sanity items in Step 3. If any fail:

- **All `null`** — likely T0 baseline didn't qualify enough scenes; investigate `t0_baseline.py` QC gate, possibly relax window
- **All `true`** — threshold too low or T0 mixed with current state; investigate freeze-thaw signal in T0 selection
- **All `false`** — `mean_dvh_db` is uniformly negative — sign error somewhere; check `_refined_lee` polarity
- **<10% high quality** — eroded buffer too aggressive OR cropland mask join broken

- [ ] **Step 2: Either green-light Phase 4 OR loop back**

If sanity checks pass: write a one-line note in the spec at §11 confirming Phase 3 passed and naming the run log. Then schedule the Phase 4 plan (UI integration).

If sanity checks fail: open a debug session, identify the root cause, fix in the relevant `gee_pipeline/` module, re-run from Task 3a.

- [ ] **Step 3: If green-lit, commit the green-light note**

```bash
git add docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md
git commit -m "docs(spec): Phase 3 subset validation passed; cleared for Phase 4 (UI)"
```

---

## Self-Review

After saving the plan, run through this checklist (no subagent dispatch needed — just look at the plan with fresh eyes).

### Spec coverage

For each spec section, identify which task implements it:

- §2 Region scope — Task 0c (parcel asset upload reflects all 14 properties)
- §3 Architecture — Tasks 0c, 1f, 2a, 2b implement the offline-prep + weekly-pipeline + integration boxes
- §4.1 Polygon prep — Task 2a (steps 1–4 of `run_single_parcel`)
- §4.2 SAR baseline (T0) — Task 1f
- §4.3 SAR current state (T1) — Task 2a (steps 6+)
- §4.4 Change detection math — Task 2a (linear power; dB only at the end via `math.log10`)
- §4.5 Decision rule — Task 1e
- §4.6 Optical confirmation — DEFERRED to Phase 4 plan (acknowledged in `_build_record` as `optical: None`)
- §4.7 Confidence formula — Task 1d
- §5 Output schema — Task 2a `_build_record()` produces the dual flat + nested shape
- §6 UI integration — out of this plan (Phase 4)
- §7 Vote-modal label loop — out of this plan (Phase 7)
- §8.1 Tool division — task ownership noted in §8.2 below
- §8.2 Phased ordering — this plan covers Phases 0–3
- §9 Risk register — partially addressed (auth, quota, schema BC); rest land in Phase 4–7 plans
- §11 Open questions — Tasks 0d, 0f, 1a address the listed items

### Placeholder scan

- No "TBD", "TODO", or "implement later" markers
- All commands have expected output specified
- Pure-function code is fully written; GEE-dependent code has skeletons that may need polish during implementation
- The CDL_CLASS_TO_NAME and ACI_CLASS_TO_NAME maps are intentionally subset — Task 2a Step 3 verifies the test parcel's class resolves; expanding the map for full territory runs is Phase 5 work

### Type consistency

- `applicability` enum values used consistently: `active | perennial | out-of-season | insufficient_baseline | unmapped`
- `Applicability` Literal type imported in `decision_rule.py` and `pipeline.py`
- Field names in JSON output match spec §5 exactly
- `seeding_seeded` is the flat name; `seeding.seeded` is the nested name; both populated in `_build_record`

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-28-monette-satellite-seeding-foundation.md`.**

Two execution options:

**1. Subagent-Driven (recommended for this plan)** — Each task gets a dedicated subagent with the right tooling. Tasks 0a/0b/0e are Kyle action items (no subagent). Tasks 0c–0f, 1f, 2a, 3a get a Codex subagent (`codex:codex-rescue` with `gpt-5.5/xhigh`) — the SAR/GEE math benefits from xhigh reasoning. Task 1a gets Gemini headless (`gemini -p ... -o text`). Tasks 1b–1e are pure-Python with TDD discipline — Claude (this session) handles them efficiently.

**2. Inline Execution** — Execute every task in this session via `superpowers:executing-plans`, with checkpoints between phases. Higher-touch but single-context.

**Which approach do you want?** (Subagent-Driven gets you faster wall-clock; Inline keeps everything in one session for review.)

After Phase 3 completes (green-light), we'll write the **Phase 4 plan** for UI integration (mode toggle, drawer satellite-row, Farm Progress counter, `buildPreparedMapData()` extension). Then a third plan for Phases 5–7 (full-territory run + scheduling + vote-label loop).
