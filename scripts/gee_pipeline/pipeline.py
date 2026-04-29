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

# Per-territory cropland masks. CDL 2025 confirmed available in GEE (Task 0d).
# AAFC ACI's latest may still be 2024; left at /2024 conservatively.
CROPLAND_MASKS = {
    "sk": "AAFC/ACI/2024",
    "mb": "AAFC/ACI/2024",
    "mt": "USDA/NASS/CDL/2025",
    "az": "USDA/NASS/CDL/2025",
    "co": "USDA/NASS/CDL/2025",
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
    # Defensive: very small parcels (sub-quarter MT aliquots, small AZ
    # fee parcels) can erode to nothing, which then crashes downstream
    # GEE ops with "Image.clip: empty geometry." Detect and return a
    # spec-compliant insufficient_baseline record instead.
    eroded_area_m2 = eroded.area().getInfo()
    if eroded_area_m2 is None or eroded_area_m2 < 100:
        return _build_record(
            territory=territory,
            cropland_coverage=0.0,
            prior_crop="unknown",
            applicability="insufficient_baseline",
            mean_dvh_db=None,
            n_pixels=0,
            run_date=run_date,
        )

    # 2. Cropland mask
    # No special-case territory branches: AZ + every other territory go
    # through the same cropland-mask + applicability_for_crop path. AZ
    # parcels with crop_class='alfalfa' will resolve to applicability=
    # 'perennial', cotton resolves to 'out-of-season' (planting Feb-Apr
    # already past for spring runs), etc. -- exactly as designed in
    # applicability.py.
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
    #
    # Some territories (e.g. MB Eddystone in 2026) don't have a T0 asset
    # because their baseline window had zero qualifying scenes (see
    # InsufficientBaselineError in t0_baseline.py). Probe the asset
    # before reading it; if missing, return insufficient_baseline rather
    # than crashing on a 0-band image.
    asset_id = f"{T0_PARENT}/{territory}"
    try:
        ee.data.getAsset(asset_id)
    except ee.EEException:
        return _build_record(
            territory=territory,
            cropland_coverage=float(cc_value.getInfo() or 0),
            prior_crop=crop_name,
            applicability="insufficient_baseline",
            mean_dvh_db=None,
            n_pixels=0,
            run_date=run_date,
        )
    t0 = ee.Image(asset_id)
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

    # Ratio-of-means: reduce T1 and T0 to AOI means separately (with cropland
    # mask applied), then ratio, then log.  This avoids the instability of
    # mean(T1/T0) when some T0 pixels are near-zero — those pixels would
    # produce enormous per-pixel ratios that dominate the mean and inflate ΔVH.
    # See Codex review b53izop76 for the live diagnostic (+10.9 dB vs +4.6 dB
    # on PA NW-32-51-23-W2).
    t1_vh_masked = t1.select("VH").updateMask(masked)
    t0_vh_masked = t0.select("VH").updateMask(masked)
    t1_vv_masked = t1.select("VV").updateMask(masked)
    t0_vv_masked = t0.select("VV").updateMask(masked)

    stats = (
        t1_vh_masked
        .addBands(t0_vh_masked.rename("VH_t0"))
        .addBands(t1_vv_masked.rename("VV_t1"))
        .addBands(t0_vv_masked.rename("VV_t0"))
        .reduceRegion(
            reducer=ee.Reducer.mean().combine(
                ee.Reducer.count(), sharedInputs=True
            ),
            geometry=eroded,
            scale=20,
            maxPixels=1e7,
            tileScale=4,
        )
    )

    mean_t1_vh = stats.getNumber("VH_mean")
    mean_t0_vh = stats.getNumber("VH_t0_mean")
    n_pixels = stats.getNumber("VH_count")

    # Zero-T0 guard: if T0 mean is null or <= 0, the ratio is undefined.
    mean_t1_vh_val = mean_t1_vh.getInfo() if mean_t1_vh is not None else None
    mean_t0_vh_val = mean_t0_vh.getInfo() if mean_t0_vh is not None else None
    if mean_t1_vh_val is None or mean_t0_vh_val is None or mean_t0_vh_val <= 0:
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
    mean_dvh_db_value = 10 * math.log10(mean_t1_vh_val / mean_t0_vh_val)
    n_pixels_value = int(n_pixels.getInfo() or 0)

    # Compute ΔVV via the same ratio-of-means approach.  Not yet surfaced in
    # the _build_record schema (Bucket B will plumb it through); computed here
    # to validate the math path is symmetric.
    mean_t1_vv_val = stats.getNumber("VV_t1_mean").getInfo()
    mean_t0_vv_val = stats.getNumber("VV_t0_mean").getInfo()
    if mean_t1_vv_val is not None and mean_t0_vv_val is not None and mean_t0_vv_val > 0:
        _mean_dvv_db_value = 10 * math.log10(mean_t1_vv_val / mean_t0_vv_val)
    else:
        _mean_dvv_db_value = None  # noqa: F841 — computed but not yet passed through

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
