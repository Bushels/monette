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

# USDA CDL agricultural class filter (Codex review bd5gaxmye — Fix 1).
#
# CDL's "cropland" band is a 256-class land-cover map, NOT a binary mask.
# The previous neq(0) incorrectly included Open Water (111), Developed
# (121–124), Forest (141–143), Grass/Pasture (176), Wetlands (190–194),
# etc. — affecting 245 of 1,260 parcels (MT 220 + AZ 23 + CO 2).
#
# Per USDA NASS CDL legend (https://www.nass.usda.gov/Research_and_Science/
# Cropland/docs/cdl_codes.pdf and GEE catalog):
#   1–60:   Major crops (corn, wheat, cotton, soybeans, alfalfa, oats, etc.)
#   66–80:  Tree fruits and orchard crops (cherries, apples, peaches, etc.)
#   195–254: Extended crops (herbs, vegetables, berries, specialty crops)
#
# Explicitly excluded (must not be treated as cropland for seeding detection):
#   0:       Background / no-data
#   61–65:   Fallow/Idle Cropland, Pasture mixes — not seeded; return
#            out_of_season or unmapped via applicability_for_crop
#   81:      Clouds/No Data
#   82–83:   Developed, Water
#   87–92:   Wetlands / Aquaculture
#   111:     Open Water
#   121–124: Developed/Impervious
#   131:     Barren Land
#   141–143: Deciduous/Evergreen/Mixed Forest
#   152:     Shrubland
#   176:     Grass/Pasture
#   190–194: Wetlands
CDL_CROPLAND_CLASSES_RANGES = [
    (1, 60),    # major crops
    (66, 80),   # orchard / tree crops
    (195, 254), # extended crops (specialty vegetables, herbs, berries)
]

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
    # AAFC ACI: cropland classes are 100+; this branch is correct — no change.
    # CDL: the "cropland" band is a 256-class land-cover map (NOT a binary mask).
    # Build a proper agricultural-class filter using CDL_CROPLAND_CLASSES_RANGES
    # (see module constant above). Codex review bd5gaxmye — Fix 1.
    if territory in {"sk", "mb"}:
        cropland_mask = cropland_img.select("landcover").gte(100)
    else:
        cl = cropland_img.select("cropland")
        cropland_mask = (
            cl.gte(CDL_CROPLAND_CLASSES_RANGES[0][0]).And(cl.lte(CDL_CROPLAND_CLASSES_RANGES[0][1]))
            .Or(cl.gte(CDL_CROPLAND_CLASSES_RANGES[1][0]).And(cl.lte(CDL_CROPLAND_CLASSES_RANGES[1][1])))
            .Or(cl.gte(CDL_CROPLAND_CLASSES_RANGES[2][0]).And(cl.lte(CDL_CROPLAND_CLASSES_RANGES[2][1])))
        )

    # 3. cropland_coverage
    # Fix (Codex b08awunq3): the previous two-step count()/count() approach
    # was wrong on two counts:
    # (a) Reducer.count() counts unmasked pixels regardless of *value*, so the
    #     binary 0/1 mask was counted as 100 % present even where class < 100.
    # (b) Image.constant(1) lives in geographic projection; the denominator
    #     count() at scale=20 differed from the ACI Albers numerator count(),
    #     making the ratio a projection-mismatch artifact, not a real fraction.
    # Fix: mean() of the 0/1 binary image over the eroded geometry gives the
    # true fraction of pixels equal to 1 — i.e. the real cropland fraction.
    # The .clip() is dropped; the reducer geometry already restricts the domain.
    cc_value = cropland_mask.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=eroded,
        scale=20,
        maxPixels=1e7,
    ).getNumber(cropland_mask.bandNames().get(0))

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
    #
    # Fix (Codex b08awunq3): build ONE common valid mask spanning T1, T0, and
    # the cropland mask so that all four bands are reduced over an identical
    # pixel support. Without this, if T1 has data where T0 doesn't (or vice
    # versa), mean(T1_VH) and mean(T0_VH) are computed over *different* pixel
    # sets, making the ratio biased. The common mask forces equal support.
    # Fix (Codex review bd5gaxmye — Fix 2): include VV masks alongside VH masks
    # so that all four bands share an identical pixel support before reduce.
    # updateMask() preserves existing per-band masks, so even after applying
    # common_mask, T1_VV retains its native VV mask. If T1's VV and VH masks
    # ever diverge (rare S1 processing edge effects), the post-reduce count
    # assertion would fire. Defense in depth: intersect all four masks here.
    common_mask = (
        t1.select("VH").mask()
        .And(t1.select("VV").mask())
        .And(t0.select("VH").mask())
        .And(t0.select("VV").mask())
        .And(cropland_mask)
    )

    t1_vh_masked = t1.select("VH").updateMask(common_mask)
    t0_vh_masked = t0.select("VH").updateMask(common_mask)
    t1_vv_masked = t1.select("VV").updateMask(common_mask)
    t0_vv_masked = t0.select("VV").updateMask(common_mask)

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

    # Fix (Codex review bd5gaxmye — Fix 3): pull all stats in one round-trip
    # instead of 12 separate .getInfo() calls. Previously the code made 4 lazy
    # ee.Number refs (mean_t1_vh, mean_t0_vh, n_pixels) PLUS 8 individual
    # .getInfo() calls. Collapsing to stats.getInfo() → dict cuts active-parcel
    # GEE round-trips from ~12 to 1 on the stats path (~30–40% wall-clock saving).
    stats_dict = stats.getInfo() or {}
    mean_t1_vh_val = stats_dict.get("VH_mean")
    mean_t0_vh_val = stats_dict.get("VH_t0_mean")
    mean_t1_vv_val = stats_dict.get("VV_t1_mean")
    mean_t0_vv_val = stats_dict.get("VV_t0_mean")
    vh_count_val = stats_dict.get("VH_count")
    vh_t0_count_val = stats_dict.get("VH_t0_count")
    vv_count_val = stats_dict.get("VV_t1_count")
    vv_t0_count_val = stats_dict.get("VV_t0_count")
    n_pixels_value = int(vh_count_val or 0)

    # Post-reduce sanity check: all four count bands must be equal because they
    # were all masked to the same common_mask support. If GEE's per-band
    # masking produced unequal counts, the ratio would be computed over
    # different pixel sets — fail closed rather than ship a biased ΔVH.
    if not (vh_count_val == vh_t0_count_val == vv_count_val == vv_t0_count_val):
        return _build_record(
            territory=territory,
            cropland_coverage=float(cc_value.getInfo() or 0),
            prior_crop=crop_name,
            applicability="insufficient_baseline",
            mean_dvh_db=None,
            n_pixels=0,
            run_date=run_date,
        )

    # Symmetric ratio guard: if either mean is null OR <= 0, the ratio + log
    # is undefined.
    if (mean_t1_vh_val is None or mean_t0_vh_val is None
            or mean_t1_vh_val <= 0 or mean_t0_vh_val <= 0):
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

    # Compute ΔVV via the same ratio-of-means approach.
    # Bucket B: drop the underscore prefix + noqa; pass into _build_record.
    if (mean_t1_vv_val is not None and mean_t0_vv_val is not None
            and mean_t1_vv_val > 0 and mean_t0_vv_val > 0):
        mean_dvv_db_value = 10 * math.log10(mean_t1_vv_val / mean_t0_vv_val)
    else:
        mean_dvv_db_value = None

    return _build_record(
        territory=territory,
        cropland_coverage=float(cc_value.getInfo() or 0),
        prior_crop=crop_name,
        applicability=applicability,
        mean_dvh_db=mean_dvh_db_value,
        n_pixels=n_pixels_value,
        run_date=run_date,
        dvv_db=mean_dvv_db_value,
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
    dvv_db: Optional[float] = None,           # Bucket B commit 1
    precip_mm_24h: float = 0.0,               # Bucket B commit 2 will populate
    optical_block: Optional[dict] = None,     # Bucket B commit 3 will populate
    ndvi_mean: Optional[float] = None,        # Bucket B commit 3 will populate
    last_obs_date: Optional[str] = None,      # defaults to run_date if None
) -> dict:
    """Compose the per-parcel imagery-data.js record."""
    polygon_quality = "high" if cropland_coverage >= 0.50 else "low"

    # last_obs_date defaults to run_date; commit 2 will surface the actual
    # latest S1 contributing scene date for active SAR parcels.
    effective_last_obs = last_obs_date if last_obs_date is not None else run_date

    if mean_dvh_db is None:
        confidence = 0
        seeded = None
        # baseline_quality is None for non-SAR branches (insufficient_baseline,
        # perennial, out-of-season). We use mean_dvh_db as the SAR/non-SAR
        # discriminator: only active SAR branches produce a non-None mean_dvh_db.
        baseline_quality = None
    else:
        confidence = compute_confidence(
            mean_dvh_db=mean_dvh_db,
            n_pixels=n_pixels,
            cropland_coverage=cropland_coverage,
            precip_mm_24h=precip_mm_24h,
        )
        seeded = decide_seeded(
            applicability=applicability,
            mean_dvh_db=mean_dvh_db,
            confidence=confidence,
        )
        # v1 shortcut: all active SAR baselines in this run were built from
        # the 2026 spring baseline window — they are "fresh". The "backfill"
        # value is reserved for v1.5 when a sidecar baseline_state.json with
        # real provenance (built-date vs requested-window comparison) is
        # introduced. See Codex review b5ajsddp7.
        baseline_quality = "fresh"

    return {
        "status": "ok",
        "image_from": run_date,
        "image_to": run_date,
        "ndvi_mean": round(ndvi_mean, 3) if ndvi_mean is not None else None,
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
            "dvv_db": round(dvv_db, 3) if dvv_db is not None else None,
            "n_pixels": n_pixels,
            "last_obs_date": effective_last_obs,
            "baseline_quality": baseline_quality,
            "optical": optical_block,
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
