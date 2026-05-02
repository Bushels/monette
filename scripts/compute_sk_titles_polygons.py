"""
Phase 4: compute polygons for SK Titles Update records that landed with
geometry: null (the ADD bucket from build_deltas_from_audit.py).

Reads quarters-data.js, finds records with `geometry: null` AND a
parsable legal-location key, computes the [lng,lat] ring using the same
DLS math as scripts/build_quarters_geojson.py, and writes back.

Granularities supported:
  QUARTER     loc='NE-12-13-14-W3'           -> dls_quarter_polygon
  LSD         loc='LSD-9-13-13-14-W3'        -> dls_lsd_polygon (NEW)
  TOWN-LOT    loc='LOT-1-BLK-13-PLAN-N3619'  -> placeholder cluster at
                                                Village of Neville centroid

Idempotent: only operates on records where geometry is None or missing.
Records that already have geometry are untouched.

Run:
  python scripts/compute_sk_titles_polygons.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
QUARTERS_PATH = REPO_ROOT / "quarters-data.js"


# ── DLS math (mirrors scripts/build_quarters_geojson.py) ────────────────────
MILE_KM = 1.609344
EARTH_KM_PER_DEG_LAT = 111.1949


def mi_to_deg_lat(mi: float) -> float:
    return (mi * MILE_KM) / EARTH_KM_PER_DEG_LAT


def mi_to_deg_lng(mi: float, at_lat_deg: float) -> float:
    import math
    return (mi * MILE_KM) / (EARTH_KM_PER_DEG_LAT * math.cos(math.radians(at_lat_deg)))


DLS_MERIDIAN_LNG = {
    "W1": -97.4573361,
    "W2": -102.0,
    "W3": -106.0,
    "W4": -110.0,
    "W5": -114.0,
    "W6": -118.0,
}
DLS_BASELINE_LAT = 49.0  # Canada/US border


def dls_section_to_grid(section: int) -> tuple[int, int]:
    """(col_from_west, row_from_south) for section 1..36 in standard snake."""
    if section < 1 or section > 36:
        raise ValueError(f"section {section} out of range 1..36")
    row_from_south = (section - 1) // 6
    pos_in_row = (section - 1) % 6
    if row_from_south % 2 == 0:
        col_from_west = 5 - pos_in_row  # east→west
    else:
        col_from_west = pos_in_row      # west→east
    return col_from_west, row_from_south


DLS_QUARTER_OFFSET = {
    "SW": (0, 0),
    "SE": (1, 0),
    "NW": (0, 1),
    "NE": (1, 1),
}


def dls_quarter_polygon(qtr: str, section: int, township: int, rng: int,
                        meridian: str) -> list[list[float]]:
    """Closed [lng,lat] ring for a DLS quarter-section. Mirrors build_quarters_geojson.py."""
    if meridian not in DLS_MERIDIAN_LNG:
        raise ValueError(f"Unknown DLS meridian: {meridian}")
    if qtr not in DLS_QUARTER_OFFSET:
        raise ValueError(f"Unknown quarter direction: {qtr}")

    sec_col_w, sec_row_s = dls_section_to_grid(section)
    q_col_w, q_row_s = DLS_QUARTER_OFFSET[qtr]

    township_south_lat = DLS_BASELINE_LAT + mi_to_deg_lat((township - 1) * 6)
    section_south_lat = township_south_lat + mi_to_deg_lat(sec_row_s)
    q_south_lat = section_south_lat + mi_to_deg_lat(q_row_s * 0.5)
    q_north_lat = q_south_lat + mi_to_deg_lat(0.5)

    centre_lat = (q_south_lat + q_north_lat) / 2

    def mi_lng(m: float) -> float:
        return mi_to_deg_lng(m, centre_lat)

    meridian_lng = DLS_MERIDIAN_LNG[meridian]
    range_east_lng = meridian_lng - mi_lng((rng - 1) * 6)
    section_east_lng = range_east_lng - mi_lng(5 - sec_col_w)
    q_east_lng = section_east_lng - mi_lng(0.5 * (1 - q_col_w))
    q_west_lng = q_east_lng - mi_lng(0.5)

    return [
        [q_west_lng, q_south_lat],
        [q_east_lng, q_south_lat],
        [q_east_lng, q_north_lat],
        [q_west_lng, q_north_lat],
        [q_west_lng, q_south_lat],
    ]


def dls_lsd_to_grid(lsd: int) -> tuple[int, int]:
    """(col_from_west, row_from_south) for LSD 1..16 in standard snake.

    LSD numbering is fractal at 1/4 of section: same E→W, W→E snake
    starting at SE corner. LSDs 1-4 row 0 east→west, 5-8 row 1 west→east,
    9-12 row 2 east→west, 13-16 row 3 west→east.
    """
    if lsd < 1 or lsd > 16:
        raise ValueError(f"lsd {lsd} out of range 1..16")
    row_from_south = (lsd - 1) // 4
    pos_in_row = (lsd - 1) % 4
    if row_from_south % 2 == 0:
        col_from_west = 3 - pos_in_row  # east→west
    else:
        col_from_west = pos_in_row      # west→east
    return col_from_west, row_from_south


def dls_lsd_polygon(lsd: int, section: int, township: int, rng: int,
                    meridian: str) -> list[list[float]]:
    """Closed [lng,lat] ring for a 40-acre Legal Subdivision."""
    if meridian not in DLS_MERIDIAN_LNG:
        raise ValueError(f"Unknown DLS meridian: {meridian}")

    sec_col_w, sec_row_s = dls_section_to_grid(section)
    lsd_col_w, lsd_row_s = dls_lsd_to_grid(lsd)

    township_south_lat = DLS_BASELINE_LAT + mi_to_deg_lat((township - 1) * 6)
    section_south_lat = township_south_lat + mi_to_deg_lat(sec_row_s)
    # Each LSD is 1/4 mile tall; row offset within the section.
    lsd_south_lat = section_south_lat + mi_to_deg_lat(lsd_row_s * 0.25)
    lsd_north_lat = lsd_south_lat + mi_to_deg_lat(0.25)

    centre_lat = (lsd_south_lat + lsd_north_lat) / 2

    def mi_lng(m: float) -> float:
        return mi_to_deg_lng(m, centre_lat)

    meridian_lng = DLS_MERIDIAN_LNG[meridian]
    range_east_lng = meridian_lng - mi_lng((rng - 1) * 6)
    section_east_lng = range_east_lng - mi_lng(5 - sec_col_w)
    # LSD east edge offset within section: 0=west-edge, 3=east-edge
    lsd_east_lng = section_east_lng - mi_lng(0.25 * (3 - lsd_col_w))
    lsd_west_lng = lsd_east_lng - mi_lng(0.25)

    return [
        [lsd_west_lng, lsd_south_lat],
        [lsd_east_lng, lsd_south_lat],
        [lsd_east_lng, lsd_north_lat],
        [lsd_west_lng, lsd_north_lat],
        [lsd_west_lng, lsd_south_lat],
    ]


# ── Town-lot placeholder cluster (Village of Neville, Plan N3619) ───────────
NEVILLE_CENTRE_LAT = 49.79
NEVILLE_CENTRE_LNG = -107.55


def town_lot_placeholder(lot: int, block: int, idx_in_cluster: int) -> list[list[float]]:
    """Placeholder polygon — small cluster around Neville centroid.

    Each "lot" gets a tiny ~50m square offset by index. Enhanced replacement
    would pull SAMA cadastral GeoJSON for Plan N3619 later.
    """
    # ~50m = 0.0005° lat. Cluster within ~300m of village centre.
    half_size = 0.00025
    grid_x = (idx_in_cluster % 6) - 2.5  # -2.5 to 2.5
    grid_y = (idx_in_cluster // 6) - 1.5
    cx = NEVILLE_CENTRE_LNG + grid_x * 0.001
    cy = NEVILLE_CENTRE_LAT + grid_y * 0.0005
    return [
        [cx - half_size, cy - half_size],
        [cx + half_size, cy - half_size],
        [cx + half_size, cy + half_size],
        [cx - half_size, cy + half_size],
        [cx - half_size, cy - half_size],
    ]


# ── loc string parsers ──────────────────────────────────────────────────────
QUARTER_RE = re.compile(r"^(NE|NW|SE|SW)-(\d+)-(\d+)-(\d+)-(W\d)$")
LSD_RE = re.compile(r"^LSD-(\d+)-(\d+)-(\d+)-(\d+)-(W\d)$")
TOWN_LOT_RE = re.compile(r"^LOT-(\d+)-BLK-(\w+)-PLAN-(\w+)$")
PLANNED_PARCEL_RE = re.compile(r"^BLK-(\w+)-PLAN-(\w+)$")


def compute_polygon_for(rec: dict, lot_cluster_idx: dict) -> list[list[float]] | None:
    loc = rec.get("loc")
    if not loc:
        return None

    m = QUARTER_RE.match(loc)
    if m:
        qtr, sec, twp, rng, mer = m.groups()
        return dls_quarter_polygon(qtr, int(sec), int(twp), int(rng), mer)

    m = LSD_RE.match(loc)
    if m:
        lsd, sec, twp, rng, mer = m.groups()
        return dls_lsd_polygon(int(lsd), int(sec), int(twp), int(rng), mer)

    m = TOWN_LOT_RE.match(loc)
    if m:
        lot, block, plan = m.groups()
        if plan == "N3619":  # Neville
            idx = lot_cluster_idx.setdefault(plan, 0)
            lot_cluster_idx[plan] += 1
            try:
                lot_int = int(lot)
            except ValueError:
                lot_int = 0
            try:
                block_int = int(block)
            except ValueError:
                block_int = 0
            return town_lot_placeholder(lot_int, block_int, idx)
        return None

    m = PLANNED_PARCEL_RE.match(loc)
    if m:
        # Generic planned parcel — we don't have cadastral data; skip
        return None

    return None


# ── Main ────────────────────────────────────────────────────────────────────
def load_quarters() -> dict:
    text = QUARTERS_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.MONETTE_QUARTERS_REAL\s*=\s*(\{.*\})", text, re.DOTALL)
    return json.loads(m.group(1))


def write_quarters(data: dict, header_extra: str = ""):
    body = json.dumps(data, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
    header = (
        "// AUTO-GENERATED by scripts/build_quarters_data_js.py.\n"
        "// SK-titles deltas applied via scripts/apply_sk_titles_deltas.py.\n"
        "// Phase 3 fold: __neville__ records folded into vanguard.\n"
        "// Phase 4 polygons: scripts/compute_sk_titles_polygons.py filled\n"
        "// geometry: null records via DLS math (quarters + LSDs) and\n"
        "// town-lot placeholders.\n"
        f"{header_extra}"
    )
    QUARTERS_PATH.write_text(
        header + f"window.MONETTE_QUARTERS_REAL = {body};\n",
        encoding="utf-8",
    )


def main():
    quarters = load_quarters()
    lot_cluster_idx: dict = {}

    counts = {"quarter": 0, "lsd": 0, "town_lot": 0, "skipped": 0, "already_set": 0}
    by_property: dict[str, dict] = {}

    for pid, recs in quarters.items():
        for rec in recs:
            if rec.get("geometry") not in (None, {}):
                counts["already_set"] += 1
                continue
            loc = rec.get("loc")
            if not loc:
                counts["skipped"] += 1
                continue

            try:
                ring = compute_polygon_for(rec, lot_cluster_idx)
            except Exception as e:
                print(f"  WARN: {pid} {loc}: {e}")
                ring = None

            if ring is None:
                counts["skipped"] += 1
                continue

            rec["geometry"] = {"type": "Polygon", "coordinates": [ring]}

            # Track polygon kind
            if QUARTER_RE.match(loc):
                kind = "quarter"
            elif LSD_RE.match(loc):
                kind = "lsd"
            elif TOWN_LOT_RE.match(loc):
                kind = "town_lot"
            else:
                kind = "other"
            counts[kind] = counts.get(kind, 0) + 1
            by_property.setdefault(pid, {"quarter": 0, "lsd": 0, "town_lot": 0})
            by_property[pid][kind] = by_property[pid].get(kind, 0) + 1

    write_quarters(quarters)

    print(f"Polygons computed: {sum(counts[k] for k in ('quarter','lsd','town_lot'))}")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print()
    print("Per-property:")
    for pid in sorted(by_property.keys()):
        kinds = by_property[pid]
        non_zero = {k: v for k, v in kinds.items() if v}
        print(f"  {pid}: {non_zero}")


if __name__ == "__main__":
    main()
