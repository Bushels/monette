"""Refresh Monette's Arizona and Colorado parcel slices in quarters.geojson.

- Arizona: 23 Maricopa parcels under MONETTE FARMS ARIZONA LLC.
- Colorado: six 2026 Lincoln County assessor accounts under MONETTE FARMS
  USA, INC., totaling 4,085 assessed acres. Assessor legal descriptions
  control the crosswalk; BLM CadNSDI supplies PLSS section geometry.

Run with: python scripts/update_us_holdings_az_co.py [--only colorado|arizona]
"""
import argparse
import json
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
# (verified 2026-04-27 via mcassessor.maricopa.gov owner search).
AGUILA_PARCELS = {
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

# Current owner/account results from Lincoln County EagleWeb, checked 2026-07-15.
# Assessed acres total 4,085, exactly matching Clark's live offering. The older
# Helkaa declaration says 4,079 acres; data.js preserves that six-acre delta.
GENOA_ACCOUNTS = [
    {
        "account_no": "R008634", "parcel_id": "2581-311-00-112",
        "assessed_ac": 638.0, "nominal_ac": 640.0,
        "legal": "ALL SEC. 31; T9S R54W OF THE 6TH P.M., LINCOLN COUNTY, COLORADO",
        "twp": 9, "parts": [(31, "ALL")],
    },
    {
        "account_no": "R008636", "parcel_id": "2581-183-00-114",
        "assessed_ac": 721.0, "nominal_ac": 720.0,
        "legal": "S2SW4 SEC. 18; ALL SEC. 19; T9S R54W OF THE 6TH P.M.",
        "twp": 9, "parts": [(18, "S2SW4"), (19, "ALL")],
        "situs_address": "52326 COUNTY HIGHWAY 109, GENOA",
    },
    {
        "account_no": "R008638", "parcel_id": "2581-281-00-116",
        "assessed_ac": 1280.0, "nominal_ac": 1280.0,
        "legal": "ALL SEC. 28; ALL SEC. 33 T9S R54W OF THE 6TH P.M.",
        "twp": 9, "parts": [(28, "ALL"), (33, "ALL")],
    },
    {
        "account_no": "R008641", "parcel_id": "2797-042-00-112",
        "assessed_ac": 163.0, "nominal_ac": 160.0,
        "legal": "NW4 SEC. 4 T10S R54W OF THE 6TH P.M.",
        "twp": 10, "parts": [(4, "NW4")],
    },
    {
        "account_no": "R008643", "parcel_id": "2797-061-00-114",
        "assessed_ac": 640.0, "nominal_ac": 640.0,
        "legal": "ALL SEC. 6 T10S R54W OF THE 6TH P.M.",
        "twp": 10, "parts": [(6, "ALL")],
    },
    {
        "account_no": "R008645", "parcel_id": "2581-301-00-119",
        "assessed_ac": 643.0, "nominal_ac": 640.0,
        "legal": "ALL SEC. 30 T9S R54W OF THE 6TH P.M.",
        "twp": 9, "parts": [(30, "ALL")],
    },
]


def http_json(url: str, params: dict) -> dict:
    full = url + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(full, timeout=60) as resp:
        return json.load(resp)


def round_geom(geom: dict, digits: int = 6) -> dict:
    if not geom:
        return geom

    def rounded(value):
        return round(value, digits)

    if geom["type"] == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [
                [[rounded(x), rounded(y)] for x, y in ring]
                for ring in geom["coordinates"]
            ],
        }
    if geom["type"] == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [
                    [[rounded(x), rounded(y)] for x, y in ring]
                    for ring in polygon
                ]
                for polygon in geom["coordinates"]
            ],
        }
    return geom


def fetch_aguila_features() -> list:
    apns = list(AGUILA_PARCELS.keys())
    where = "APN IN (" + ",".join("'" + apn + "'" for apn in apns) + ")"
    data = http_json(MARICOPA_URL, {
        "where": where,
        "outFields": "APN,APNDash,PropertyFullStreetAddress",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    features = data.get("features", [])
    if len(features) != len(apns):
        raise RuntimeError(
            f"Maricopa returned {len(features)} polygons; expected {len(apns)}"
        )

    out = []
    for feature in features:
        apn = feature["properties"]["APN"]
        kind, lease_no, str_label, sqft = AGUILA_PARCELS[apn]
        acres = sqft / SQFT_PER_ACRE
        parts = str_label.split()
        section_number = int(parts[1])
        township_number, township_direction = int(parts[2][1:-1]), parts[2][-1]
        range_number, range_direction = int(parts[3][1:-1]), parts[3][-1]
        loc = (
            f"T{township_number:02d}{township_direction}-"
            f"R{range_number:02d}{range_direction}-S{section_number:02d}-{apn}"
        )
        owner = "MONETTE FARMS ARIZONA LLC"
        if lease_no:
            owner += f" LE # {lease_no}"
        out.append({
            "type": "Feature",
            "geometry": round_geom(feature["geometry"]),
            "properties": {
                "property_id": "aguila",
                "loc": loc,
                "loc_raw": (
                    f"Sec {section_number}, T{township_number} {township_direction}, "
                    f"R{range_number} {range_direction}"
                ),
                "qtr": None,
                "sec": section_number,
                "twp": township_number,
                "rng": range_number,
                "meridian": "AZ-GSRM",
                "twp_dir": township_direction,
                "rng_dir": range_direction,
                "titled_ac": round(acres, 2),
                "gis_ac": round(acres, 2),
                "county": "Maricopa",
                "parcel_id": feature["properties"]["APNDash"],
                "tenure": kind,
                "lease_no": lease_no,
                "situs_address": feature["properties"].get("PropertyFullStreetAddress"),
                "owner": owner,
                "title": f"APN {feature['properties']['APNDash']}, {str_label}",
                "title_count": 1,
                "source": (
                    "Maricopa County GIS Parcel service, "
                    "owner='MONETTE FARMS ARIZONA LLC'"
                ),
            },
        })
    return out


def fetch_plss_sections(plssid: str, section_numbers: list[int]) -> dict[int, dict]:
    # CadNSDI stores single-digit section numbers with a leading zero.
    section_sql = ",".join(f"'{number:02d}'" for number in section_numbers)
    data = http_json(BLM_PLSS_URL, {
        "where": f"PLSSID='{plssid}' AND FRSTDIVNO IN ({section_sql})",
        "outFields": "PLSSID,FRSTDIVID,FRSTDIVNO,FRSTDIVLAB",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    sections = {
        int(feature["properties"]["FRSTDIVNO"]): feature
        for feature in data.get("features", [])
    }
    missing = set(section_numbers) - set(sections)
    if missing:
        raise RuntimeError(f"BLM {plssid} query missing sections: {sorted(missing)}")
    return sections


def polygons_from_geometry(geometry: dict) -> list:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise RuntimeError(f"Unsupported PLSS geometry: {geometry['type']}")


def derive_bbox_aliquot(section_geometry: dict, aliquot: str) -> dict:
    """Derive the two assessor aliquots needed for portfolio-scale display."""
    polygons = polygons_from_geometry(section_geometry)
    coords = [point for polygon in polygons for ring in polygon for point in ring]
    xs = [point[0] for point in coords]
    ys = [point[1] for point in coords]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    midx = (minx + maxx) / 2.0
    midy = (miny + maxy) / 2.0
    if aliquot == "S2SW4":
        bounds = (minx, miny, midx, (miny + midy) / 2.0)
    elif aliquot == "NW4":
        bounds = (minx, midy, midx, maxy)
    else:
        raise RuntimeError(f"Unsupported aliquot: {aliquot}")
    west, south, east, north = bounds
    ring = [
        [west, south], [east, south], [east, north],
        [west, north], [west, south],
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def fetch_genoa_features() -> list:
    """Build the six current Lincoln County accounts from assessor legal rows."""
    sections = {}
    sections.update({
        (9, number): feature
        for number, feature in fetch_plss_sections(
            "CO060090S0540W0", [18, 19, 28, 30, 31, 33]
        ).items()
    })
    sections.update({
        (10, number): feature
        for number, feature in fetch_plss_sections(
            "CO060100S0540W0", [4, 6]
        ).items()
    })

    out = []
    for account in GENOA_ACCOUNTS:
        polygons = []
        derived_parts = []
        for section_number, aliquot in account["parts"]:
            section_geometry = sections[(account["twp"], section_number)]["geometry"]
            if aliquot == "ALL":
                polygons.extend(polygons_from_geometry(section_geometry))
            else:
                derived = derive_bbox_aliquot(section_geometry, aliquot)
                polygons.extend(polygons_from_geometry(derived))
                derived_parts.append(f"{aliquot} Sec {section_number}")

        geometry = (
            {"type": "Polygon", "coordinates": polygons[0]}
            if len(polygons) == 1
            else {"type": "MultiPolygon", "coordinates": polygons}
        )
        properties = {
            "property_id": "genoa",
            "loc": f"CO-LINCOLN-{account['account_no']}",
            "loc_raw": account["legal"],
            "qtr": (
                account["parts"][0][1]
                if len(account["parts"]) == 1 and account["parts"][0][1] != "ALL"
                else None
            ),
            "sec": account["parts"][0][0] if len(account["parts"]) == 1 else None,
            "twp": account["twp"],
            "rng": 54,
            "meridian": "6th-PM",
            "twp_dir": "S",
            "rng_dir": "W",
            "titled_ac": account["assessed_ac"],
            "gis_ac": account["nominal_ac"],
            "county": "Lincoln",
            "parcel_id": account["parcel_id"],
            "account_no": account["account_no"],
            "tenure": "fee",
            "owner": "MONETTE FARMS USA, INC., A MONTANA CORPORATION",
            "title": account["legal"],
            "title_count": 1,
            "source": (
                "Lincoln County CO EagleWeb 2026 owner/account record + "
                "BLM CadNSDI PLSS geometry"
            ),
            "source_checked_at": "2026-07-15",
            "legal_parts": [
                f"{aliquot} Sec {section}" for section, aliquot in account["parts"]
            ],
        }
        if account.get("situs_address"):
            properties["situs_address"] = account["situs_address"]
        if derived_parts:
            properties["geometry_note"] = (
                f"{', '.join(derived_parts)} derived from the BLM section bounding box; "
                "portfolio-scale display only, not a survey-accurate boundary."
            )
        out.append({
            "type": "Feature",
            "geometry": round_geom(geometry),
            "properties": properties,
        })

    assessed_total = sum(feature["properties"]["titled_ac"] for feature in out)
    if len(out) != 6 or assessed_total != 4085.0:
        raise RuntimeError(
            f"Colorado account gate failed: {len(out)} accounts / "
            f"{assessed_total} assessed acres"
        )
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=("arizona", "colorado"))
    args = parser.parse_args()

    feature_collection = json.load(GEOJSON_PATH.open(encoding="utf-8"))
    replace_ids = (
        {"aguila", "genoa"}
        if args.only is None
        else {"aguila" if args.only == "arizona" else "genoa"}
    )
    other = [
        feature for feature in feature_collection["features"]
        if feature["properties"].get("property_id") not in replace_ids
    ]
    refreshed = []
    if "aguila" in replace_ids:
        aguila = fetch_aguila_features()
        refreshed.extend(aguila)
        az_acres = sum(feature["properties"]["titled_ac"] for feature in aguila)
        print(
            f"Replaced AZ slice: {len(aguila)} parcels, {az_acres:,.2f} ac "
            "(Aguila/Maricopa)"
        )
    if "genoa" in replace_ids:
        genoa = fetch_genoa_features()
        refreshed.extend(genoa)
        co_acres = sum(feature["properties"]["titled_ac"] for feature in genoa)
        print(
            f"Replaced CO slice: {len(genoa)} accounts, {co_acres:,.2f} ac "
            "(Genoa/Lincoln)"
        )

    feature_collection["features"] = other + refreshed
    GEOJSON_PATH.write_text(json.dumps(feature_collection) + "\n", encoding="utf-8")
    print(f"Total features in quarters.geojson: {len(feature_collection['features'])}")


if __name__ == "__main__":
    main()
