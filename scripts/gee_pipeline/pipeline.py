# scripts/gee_pipeline/pipeline.py
"""
Single-parcel and territory-shard pipeline entrypoints.

For Phase 2, only run_single_parcel() is exercised. Phase 5 (separate
plan) layers on territory-shard runs that call this same primitive.

Auth comes from gee_pipeline.auth.initialize() — service account if
configured, else Application Default Credentials, else earthengine
user OAuth. See gee_pipeline/auth.py for setup.
"""
from __future__ import annotations
import json
import sys
from datetime import date
from pathlib import Path
from typing import Optional

import ee

# Bootstrap: ensure scripts/ is on sys.path so we can import gee_pipeline
# package siblings whether this file is run as `python scripts/gee_pipeline/pipeline.py`
# or `python -m scripts.gee_pipeline.pipeline`.
_HERE = Path(__file__).resolve()
for _parent in _HERE.parents:
    if _parent.name == "scripts":
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

from gee_pipeline.applicability import applicability_for_crop, Applicability
from gee_pipeline.confidence import compute_confidence
from gee_pipeline.decision_rule import decide_seeded
from gee_pipeline.auth import initialize, auth_source

GEE_PROJECT = "monette-494717"
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
    # v1 note: orbit pinning intentionally dropped; T0 was rebuilt as a
    # multi-orbit median. T1 here also uses all descending IW scenes
    # (no orbit filter). See t0_baseline.build_baseline_image docstring
    # for the bias tradeoff and v1.5 plan.
    t0 = ee.Image(f"{T0_PARENT}/{territory}")
    t1_window_start = ee.Date(run_date).advance(-14, "day")
    t1_window_end = ee.Date(run_date)
    t1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
        .filterBounds(eroded)
        .filterDate(t1_window_start, t1_window_end)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
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
    initialize()
    print(f"GEE auth source: {auth_source()}")
    # Test parcel: Hafford NW-10-45-13-W3 (159.8 ac, real parcel verified
    # in projects/monette-494717/assets/monette/parcels_v1).
    record = run_single_parcel(
        property_id="hafford",
        loc="NW-10-45-13-W3",
        run_date="2026-04-28",
    )
    print(json.dumps(record, indent=2))
