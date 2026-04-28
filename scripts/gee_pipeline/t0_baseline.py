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

Auth comes from gee_pipeline.auth.initialize() — service account if
configured, else Application Default Credentials, else earthengine
user OAuth.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from typing import Dict

import ee

# Bootstrap: ensure scripts/ is on sys.path so we can import the gee_pipeline
# package siblings (auth.py).
_HERE = Path(__file__).resolve()
for _parent in _HERE.parents:
    if _parent.name == "scripts":
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

from gee_pipeline.auth import initialize, auth_source, MONETTE_PROJECT

ASSET_PARENT = f"projects/{MONETTE_PROJECT}/assets/monette/sar_baseline_2026"

# Per-territory baseline windows, per spec §2.
# Format: (start_iso, end_iso, bbox)
BASELINE_WINDOWS: Dict[str, tuple] = {
    "sk": ("2026-02-15", "2026-04-15", (-110.0, 49.0, -101.5, 53.5)),
    "mb": ("2026-02-15", "2026-04-15", (-100.5, 51.0, -98.5, 52.5)),
    "mt": ("2026-02-01", "2026-03-15", (-108.5, 45.0, -107.0, 46.5)),
    "co": ("2026-02-01", "2026-03-15", (-103.5, 39.0, -103.0, 39.5)),
}

ROOT = _HERE.parent.parent.parent
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

    # Defensive pre-filter: ERA5-Land DAILY_AGGR has a ~5–7 day lag, so
    # the latest S1 scenes in our baseline window may not yet have an
    # ERA5 record. Drop those scenes before they cause `add_qc_bands` to
    # produce a 0-band image (which fails at `.rename()` and propagates
    # to the export's median compositor as "Image has no bands").
    def _has_era5(scene: ee.Image) -> ee.Image:
        date = ee.Date(scene.date())
        era5_size = (
            ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
            .filterDate(date, date.advance(1, "day"))
            .size()
        )
        return scene.set("has_era5", era5_size.gt(0))

    s1 = s1.map(_has_era5).filter(ee.Filter.eq("has_era5", 1))

    # Per-scene QC: snow-free, unfrozen, dry-24h.
    # All QC bands sourced from ERA5-Land DAILY_AGGR — guaranteed global
    # coverage, no per-scene gaps. (Earlier rev used Sentinel-2 SCL for
    # snow detection but that produced "Image has no bands" failures over
    # small bboxes like Eddystone/Genoa where S2 ±1-day windows can be
    # empty during cloudy Feb–Mar; ERA5 has no such gaps.)
    def add_qc_bands(scene: ee.Image) -> ee.Image:
        date = ee.Date(scene.date())
        era5 = (
            ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
            .filterDate(date, date.advance(1, "day"))
            .first()
        )
        temp_2m = era5.select("temperature_2m")                          # K
        precip = era5.select("total_precipitation_sum").multiply(1000.0) # m → mm
        snow_pct = era5.select("snow_cover")                              # 0–100 %

        return (
            scene.addBands(temp_2m.rename("temp_2m_K"))
            .addBands(precip.rename("precip_24h_mm"))
            .addBands(snow_pct.rename("snow_pct"))
        )

    s1_qc = s1.map(add_qc_bands)

    # Filter scenes whose AOI-mean QC values qualify
    def qualifies(scene: ee.Image) -> ee.Image:
        stats = scene.select(["temp_2m_K", "precip_24h_mm", "snow_pct"]).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=1000,
            maxPixels=1e8,
        )
        snow_ok = ee.Number(stats.get("snow_pct")).lt(5.0)        # < 5% snow cover
        warm_ok = ee.Number(stats.get("temp_2m_K")).gt(273.15)    # > 0°C
        dry_ok = ee.Number(stats.get("precip_24h_mm")).lte(5.0)   # ≤ 5 mm 24 h
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


def export_all(territories: list[str] | None = None) -> Dict[str, str]:
    """Run T0 baseline export for the named territories (default: all 4)."""
    targets = territories if territories else ["sk", "mb", "mt", "co"]
    results = {}
    for territory in targets:
        print(f"Exporting T0 baseline for {territory}...")
        task = export_baseline(territory)
        results[territory] = task.id
        print(f"  task: {task.id}")
    return results


if __name__ == "__main__":
    initialize()
    print(f"GEE auth source: {auth_source()}")
    # Allow re-running specific territories:
    #   python scripts/gee_pipeline/t0_baseline.py            -> all 4
    #   python scripts/gee_pipeline/t0_baseline.py mb co      -> just mb + co
    territories = sys.argv[1:] if len(sys.argv) > 1 else None
    print(json.dumps(export_all(territories), indent=2))
