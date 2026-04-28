"""
Pick a single Sentinel-1 relative orbit per territory.

Rationale: change-detection math (T1 vs T0) only makes sense when both
scenes are taken from the same incidence-angle regime. Sentinel-1
descending pass over the prairies has 2-3 distinct relative orbits
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
