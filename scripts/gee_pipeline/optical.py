# scripts/gee_pipeline/optical.py
"""
Optical (Sentinel-2) feature extraction per spec §4.6.

Single-best scene picker — NOT a median composite (Codex review b5ajsddp7).
A median has no single sensing date; single-best gives an honest
source_scene and clearer index semantics.

Indices computed:
  NDVI  = (B8 - B4) / (B8 + B4)          — broad greenness / vigor
  NDTI  = (B11 - B12) / (B11 + B12)      — tillage / residue
  BSI   = ((B11+B4) - (B8+B2)) / ((B11+B4) + (B8+B2))  — bare soil

NDTI and BSI are only emitted when parcel-mean NDVI < NDVI_GATE (0.25).
Above that the field is too vegetated for tillage/bare-soil indices to
be meaningful.
"""
from __future__ import annotations

from typing import Optional, Tuple

import ee

LOOKBACK_DAYS = 10               # search window ends at run_date, looks back N days
                                 # (Codex review bl5l9zfxa Q1: avoid future lookahead in
                                 # public "as-of" output; ±3 symmetric was the spec but
                                 # gave too few candidates in late-April prairies)
SCL_KEEP_CLASSES = [4, 5]        # vegetation (4), bare soils / not_vegetated (5)
MIN_VALID_PIXELS = 50            # parcel must have at least this many valid pixels
NDVI_GATE = 0.25                 # parcel-mean NDVI gate for emitting NDTI / BSI
SCALE_M = 20                     # reduce at 20m — B11/B12/SCL native resolution

# Codex review bl5l9zfxa Q1: dropped CLOUDY_PIXEL_PERCENTAGE < 30 granule-level
# prefilter. SCL is per-pixel cloud classification at 20m, so SCL_KEEP_CLASSES +
# MIN_VALID_PIXELS is the parcel-scale truth. The granule-level prefilter culled
# many scenes that had clean parcel-level coverage even when the granule overall
# was cloudy.


def _scl_mask(image: ee.Image) -> ee.Image:
    """Return a binary ee.Image: 1 where SCL ∈ SCL_KEEP_CLASSES, 0 elsewhere.

    SCL_KEEP_CLASSES = {4 vegetation, 5 bare soils / not_vegetated}.
    Deliberately excludes 7 (low-prob cloud shadow) and 2 (dark pixels)
    as they add noise rather than signal for agricultural indices.
    """
    scl = image.select("SCL")
    keep = scl.eq(SCL_KEEP_CLASSES[0])
    for cls in SCL_KEEP_CLASSES[1:]:
        keep = keep.Or(scl.eq(cls))
    return keep


def compute_optical_features(
    *,
    eroded: ee.Geometry,
    run_date: str,
    cropland_mask: ee.Image,
) -> Tuple[Optional[dict], Optional[float]]:
    """Compute optical index features for a parcel from the best Sentinel-2 scene.

    Parameters
    ----------
    eroded : ee.Geometry
        The eroded parcel geometry (80m buffer already applied upstream).
    run_date : str
        ISO date string (YYYY-MM-dd) used as the END of a lookback-only
        search window of LOOKBACK_DAYS days. (run_date - LOOKBACK, run_date].
    cropland_mask : ee.Image
        Binary 0/1 cropland mask pre-computed for this territory (same mask
        used by the SAR pipeline so we operate on the same pixel population).

    Returns
    -------
    optical_block : dict or None
        { "ndti": float|None, "bsi": float|None, "ndvi": float|None,
          "source_scene": str|None }
        None if no qualifying Sentinel-2 scene has >= MIN_VALID_PIXELS valid
        cropland pixels after the SCL mask.
    ndvi_mean : float or None
        The parcel-mean NDVI for the chosen scene, or None if no qualifying
        scene. Same value as optical_block['ndvi'] when optical_block is
        non-None. Exposed separately so pipeline.py can write it to the
        legacy top-level ndvi_mean field (existing vigor layer) without an
        extra reduce.
    """
    # Lookback-only window: (run_date - LOOKBACK_DAYS, run_date]. This avoids
    # "the dashboard at 2026-04-28 used data from 2026-05-01" lookahead, which
    # is wrong for any public "as-of" interpretation of the output.
    end = ee.Date(run_date).advance(1, "day")  # inclusive of run_date
    start = ee.Date(run_date).advance(-LOOKBACK_DAYS, "day")

    coll = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(eroded)
        .filterDate(start, end)
    )

    # Annotate each scene with the count of valid cropland pixels after the
    # SCL + cropland mask. We use this count to filter below MIN_VALID_PIXELS
    # and to rank scenes (more valid pixels = better coverage).
    #
    # Codex review bl5l9zfxa: ee.Image.And() preserves the first operand's
    # band name, and scl_mask carries band "SCL" (from .select("SCL").eq(...)).
    # Without an explicit .rename("valid"), the reducer dict keys are {"SCL":
    # <count>}, and .getNumber("constant") returned null on every scene —
    # silently filtering ALL scenes out before the qualifying step.
    def annotate(img: ee.Image) -> ee.Image:
        scl_mask = _scl_mask(img)
        valid = scl_mask.And(cropland_mask).rename("valid")
        cnt = valid.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=eroded,
            scale=SCALE_M,
            maxPixels=1e7,
        ).getNumber("valid")
        return img.set("valid_count", cnt)

    annotated = coll.map(annotate)
    qualifying = annotated.filter(
        ee.Filter.gte("valid_count", MIN_VALID_PIXELS)
    )

    n_qualifying = qualifying.size().getInfo()
    if n_qualifying == 0:
        return None, None

    # Rank scenes client-side for a clean single-best pick:
    #   1. Most valid cropland pixels (descending) — coverage
    #   2. Closest to run_date (ascending |Δt|) — temporal relevance
    #   3. Most recent (descending ts) — tie-break
    info_list = qualifying.toList(qualifying.size()).getInfo()
    run_ts = ee.Date(run_date).millis().getInfo()

    def rank_key(item: dict):
        props = item.get("properties") or {}
        valid = props.get("valid_count") or 0
        ts = props.get("system:time_start") or 0
        return (-valid, abs(ts - run_ts), -ts)

    info_list.sort(key=rank_key)
    best_id = info_list[0]["id"]
    best = ee.Image(best_id)

    # Compute mean NDVI over the masked cropland pixels
    scl_mask = _scl_mask(best)
    valid_mask = scl_mask.And(cropland_mask)

    ndvi_img = (
        best.normalizedDifference(["B8", "B4"])
        .rename("ndvi")
        .updateMask(valid_mask)
    )
    ndvi_mean_val = ndvi_img.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=eroded,
        scale=SCALE_M,
        maxPixels=1e7,
    ).getNumber("ndvi").getInfo()

    if ndvi_mean_val is None:
        return None, None

    source_scene_date = (
        ee.Date(best.get("system:time_start"))
        .format("YYYY-MM-dd")
        .getInfo()
    )

    out: dict = {
        "ndvi": round(float(ndvi_mean_val), 3),
        "ndti": None,
        "bsi": None,
        "source_scene": source_scene_date,
    }

    # NDVI gate: emit NDTI / BSI only when mean_NDVI < NDVI_GATE.
    # When NDVI >= 0.25 the canopy is already established — tillage and
    # bare-soil indices are not meaningful and would be misleading.
    if ndvi_mean_val < NDVI_GATE:
        ndti_img = (
            best.normalizedDifference(["B11", "B12"])
            .rename("ndti")
            .updateMask(valid_mask)
        )
        # BSI = ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))
        # No normalizedDifference shortcut — manual expression.
        b2 = best.select("B2")
        b4 = best.select("B4")
        b8 = best.select("B8")
        b11 = best.select("B11")
        numerator = (b11.add(b4)).subtract(b8.add(b2))
        denominator = (b11.add(b4)).add(b8.add(b2))
        bsi_img = (
            numerator.divide(denominator)
            .rename("bsi")
            .updateMask(valid_mask)
        )
        stats = (
            ndti_img.addBands(bsi_img)
            .reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=eroded,
                scale=SCALE_M,
                maxPixels=1e7,
            )
            .getInfo() or {}
        )
        ndti_val = stats.get("ndti")
        bsi_val = stats.get("bsi")
        if ndti_val is not None:
            out["ndti"] = round(float(ndti_val), 3)
        if bsi_val is not None:
            out["bsi"] = round(float(bsi_val), 3)

    return out, float(ndvi_mean_val)
