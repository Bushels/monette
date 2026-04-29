"""
Refresh Aguila (Maricopa County, AZ) + Genoa (Lincoln County, CO) parcel slices
in quarters.geojson, mirroring the Montana cadastral update pattern.

- AZ: 23 Maricopa parcels under MONETTE FARMS ARIZONA LLC, fetched from the
  Maricopa County GIS public service. State-trust leases (LE# in owner string)
  are tagged but kept under property_id='aguila' so they share a polygon group.
- CO: Lincoln County parcel 258118300114 = S/2 SW/4 Sec 18 + ALL Sec 19,
  T9S R54W, 6th P.M. Sourced from the BLM CadNSDI national PLSS service.

Run with:  python scripts/update_us_holdings_az_co.py
"""
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = ROOT / "quarters.geojson"

MARICOPA_URL = (
    "https://gis.maricopa.gov/arcgis/rest/services/IndividualService/"
    "Parcel/MapServer/1/query"
)
BLM_PLSS_URL = (
    "https://gis.blm.gov/arcgis/rest/services/Cadastral/"
    "BLM_Natl_PLSS_CadNSDI_NAD83/MapServer/2/query"
)

# All 23 Maricopa parcels held by MONETTE FARMS ARIZONA LLC
# (verified 2026-04-27 via mcassessor.maricopa.gov owner search)
AGUILA_PARCELS = {
    # APN: (kind, lease_no_or_None, str_label, sqft)
    "50605024":  ("fee",   None,        "Sec 24 T7N R9W", 6_969_600),
    "50605025":  ("fee",   None,        "Sec 24 T7N R9W", 6_838_920),
    "50606041D": ("fee",   None,        "Sec 25 T7N R9W", 6_969_600),
    "50606041K": ("fee",   None,        "Sec 25 T7N R9W", 1_397_035),
    "50606041L": ("fee",   None,        "Sec 25 T7N R9W", 1_396_755),
    "50606041M": ("fee",   None,        "Sec 25 T7N R9W", 1_396_185),
    "50606041N": ("fee",   None,        "Sec 25 T7N R9W", 1_394_243),
    "50606041P": ("fee",   None,        "Sec 25 T7N R9W", 1_394_918),
    "50607013E": ("fee",   None,        "Sec 30 T7N R8W", 6_782_684),
    "50607013F": ("fee",   None,        "Sec 30 T7N R8W", 1_720_644),
    "50607013J": ("fee",   None,        "Sec 30 T7N R8W", 2_570_257),
    "50607013K": ("fee",   None,        "Sec 30 T7N R8W",   427_822),
    "50607013M": ("fee",   None,        "Sec 30 T7N R8W",   210_021),
    "50607013N": ("fee",   None,        "Sec 30 T7N R8W",   210_021),
    "50607013P": ("fee",   None,        "Sec 30 T7N R8W",   405_910),
    "50607013Q": ("fee",   None,        "Sec 30 T7N R8W",   213_860),
    "50607013R": ("fee",   None,        "Sec 30 T7N R8W",   213_960),
    "50607016":  ("lease", "01-110421", "Sec 30 T7N R8W", 13_939_200),
    "50607017":  ("lease", "01-1199",   "Sec 29 T7N R8W", 27_878_400),
    "50607018":  ("lease", "01-1199",   "Sec 31 T7N R8W", 13_939_200),
    "50607019A": ("lease", "01-1199",   "Sec 32 T7N R8W", 26_264_047),
    "50607020":  ("lease", "01-1199",   "Sec 33 T7N R8W", 13_939_200),
    "50607077":  ("lease", "03-78735",  "Sec 28 T7N R8W",   435_336),
}

SQFT_PER_ACRE = 43_560.0


def http_json(url: str, params: dict) -> dict:
    full = url + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(full, timeout=60) as resp:
        return json.load(resp)


def round_geom(geom: dict, digits: int = 6) -> dict:
    if not geom:
        return geom
    def r(v): return round(v, digits)
    if geom["type"] == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [[[r(x), r(y)] for x, y in ring] for ring in geom["coordinates"]],
        }
    if geom["type"] == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [[[r(x), r(y)] for x, y in ring] for ring in poly]
                for poly in geom["coordinates"]
            ],
        }
    return geom


def fetch_aguila_features() -> list:
    apns = list(AGUILA_PARCELS.keys())
    where = "APN IN (" + ",".join("'" + a + "'" for a in apns) + ")"
    data = http_json(MARICOPA_URL, {
        "where": where,
        "outFields": "APN,APNDash,PropertyFullStreetAddress",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    feats = data.get("features", [])
    if len(feats) != len(apns):
        raise RuntimeError(
            f"Maricopa returned {len(feats)} polygons; expected {len(apns)}"
        )

    out = []
    for f in feats:
        apn = f["properties"]["APN"]
        kind, lease_no, str_label, sqft = AGUILA_PARCELS[apn]
        ac = sqft / SQFT_PER_ACRE
        # Parse "Sec 30 T7N R8W"
        sec_str, twp_str, rng_str = str_label.split()[1], str_label.split()[2], str_label.split()[3]
        twp_num = int(twp_str[1:-1]); twp_dir = twp_str[-1]
        rng_num = int(rng_str[1:-1]); rng_dir = rng_str[-1]
        loc = f"T{twp_num:02d}{twp_dir}-R{rng_num:02d}{rng_dir}-S{int(sec_str):02d}-{apn}"
        owner = "MONETTE FARMS ARIZONA LLC"
        if lease_no:
            owner += f" LE # {lease_no}"
        situs = f["properties"].get("PropertyFullStreetAddress")
        out.append({
            "type": "Feature",
            "geometry": round_geom(f["geometry"]),
            "properties": {
                "property_id": "aguila",
                "loc": loc,
                "loc_raw": f"Sec {int(sec_str)}, T{twp_num} {twp_dir}, R{rng_num} {rng_dir}",
                "qtr": None,
                "sec": int(sec_str),
                "twp": twp_num,
                "rng": rng_num,
                "meridian": "AZ-GSRM",  # Gila and Salt River Meridian
                "twp_dir": twp_dir,
                "rng_dir": rng_dir,
                "titled_ac": round(ac, 2),
                "gis_ac": round(ac, 2),
                "county": "Maricopa",
                "parcel_id": f["properties"]["APNDash"],
                "tenure": kind,  # 'fee' or 'lease'
                "lease_no": lease_no,
                "situs_address": situs,
                "owner": owner,
                "title": f"APN {f['properties']['APNDash']}, {str_label}",
                "title_count": 1,
                "source": "Maricopa County GIS Parcel service, owner='MONETTE FARMS ARIZONA LLC'",
            },
        })
    return out


def fetch_genoa_features() -> list:
    """Pull Sec 18 + Sec 19 of T9S R54W in CO (6th P.M.) from BLM PLSS,
    and derive the S/2 SW/4 aliquot of Sec 18 from its bounding box.
    Parcel = S/2 SW/4 Sec 18 + ALL Sec 19 (Lincoln Co parcel 258118300114)."""
    data = http_json(BLM_PLSS_URL, {
        "where": "PLSSID='CO060090S0540W0' AND (FRSTDIVNO='18' OR FRSTDIVNO='19')",
        "outFields": "PLSSID,FRSTDIVID,FRSTDIVNO,FRSTDIVLAB",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    secs = {f["properties"]["FRSTDIVNO"]: f for f in data.get("features", [])}
    if "18" not in secs or "19" not in secs:
        raise RuntimeError(f"BLM returned only sections: {list(secs)}")

    out = []
    # Section 19 — full polygon (640 ac)
    s19 = secs["19"]
    out.append({
        "type": "Feature",
        "geometry": round_geom(s19["geometry"]),
        "properties": {
            "property_id": "genoa",
            "loc": "T09S-R54W-S19-258118300114",
            "loc_raw": "Sec 19, T9 S, R54 W",
            "qtr": None,
            "sec": 19,
            "twp": 9,
            "rng": 54,
            "meridian": "6th-PM",
            "twp_dir": "S",
            "rng_dir": "W",
            "titled_ac": 640.0,
            "gis_ac": 640.0,
            "county": "Lincoln",
            "parcel_id": "258118300114",
            "tenure": "fee",
            "owner": "MONETTE FARMS USA, INC.",
            "title": "ALL Sec 19, T9S R54W (per Lincoln Co AgSales 2023, Recpt #359168)",
            "title_count": 1,
            "source": "BLM CadNSDI PLSS section polygon + Lincoln Co Assessor 2023 ag-sales record",
        },
    })

    # Section 18 — derive S/2 SW/4 aliquot (80 ac) from Sec 18's bbox
    s18_geom = s18 = secs["18"]["geometry"]
    coords = s18["coordinates"][0] if s18["type"] == "Polygon" else s18["coordinates"][0][0]
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    # SW quarter: lng in [minx, mid_x], lat in [miny, mid_y]
    midx = (minx + maxx) / 2.0
    midy = (miny + maxy) / 2.0
    # S/2 of SW/4: lng [minx, midx], lat [miny, (miny+midy)/2]
    s2sw4_y_top = (miny + midy) / 2.0
    aliquot_ring = [
        [minx, miny], [midx, miny], [midx, s2sw4_y_top],
        [minx, s2sw4_y_top], [minx, miny],
    ]
    out.append({
        "type": "Feature",
        "geometry": round_geom({"type": "Polygon", "coordinates": [aliquot_ring]}),
        "properties": {
            "property_id": "genoa",
            "loc": "T09S-R54W-S18-S2SW4-258118300114",
            "loc_raw": "S/2 SW/4 Sec 18, T9 S, R54 W",
            "qtr": "S2SW",
            "sec": 18,
            "twp": 9,
            "rng": 54,
            "meridian": "6th-PM",
            "twp_dir": "S",
            "rng_dir": "W",
            "titled_ac": 80.0,
            "gis_ac": 80.0,
            "county": "Lincoln",
            "parcel_id": "258118300114",
            "tenure": "fee",
            "owner": "MONETTE FARMS USA, INC.",
            "title": "S/2 SW/4 Sec 18, T9S R54W (per Lincoln Co AgSales 2023, Recpt #359168)",
            "title_count": 1,
            "source": "BLM CadNSDI PLSS section + aliquot derivation (S/2 SW/4)",
            "geometry_note": "S2SW4 aliquot derived from section bbox; not a survey-accurate boundary.",
        },
    })
    return out


def main() -> None:
    fc = json.load(GEOJSON_PATH.open(encoding="utf-8"))
    other = [f for f in fc["features"] if f["properties"].get("property_id") not in ("aguila", "genoa")]

    aguila = fetch_aguila_features()
    genoa = fetch_genoa_features()

    fc["features"] = other + aguila + genoa
    GEOJSON_PATH.write_text(json.dumps(fc) + "\n", encoding="utf-8")

    az_ac = sum(f["properties"]["titled_ac"] for f in aguila)
    co_ac = sum(f["properties"]["titled_ac"] for f in genoa)
    print(f"Replaced AZ slice: {len(aguila)} parcels, {az_ac:,.2f} ac (Aguila/Maricopa)")
    print(f"Replaced CO slice: {len(genoa)} parcels, {co_ac:,.2f} ac (Genoa/Lincoln)")
    print(f"Total features in quarters.geojson: {len(fc['features'])}")


if __name__ == "__main__":
    main()
