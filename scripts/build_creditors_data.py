from __future__ import annotations

import json
import os
import re
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "docs" / "Court" / "Monette Creditor Listing (FTI), posted April 24 2026.pdf"
OUT_PATH = ROOT / "creditors-data.js"
GEOCODE_CACHE_PATH = ROOT / "scripts" / "creditors-geocode-cache.json"
SOURCE_URL = "https://cfcanada.fticonsulting.com/MonetteFarms/docs/Monette%20Creditor%20Listing.pdf"
MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN")
if not MAPBOX_TOKEN:
    raise SystemExit("MAPBOX_TOKEN is not set. Add it to .env.local or export before running.")

AMOUNT_RE = re.compile(r"(?:\$\s*)?(\d[\d,]*\.\d{2})\s*$")

PAGE_DEBTORS = {
    2: ("Monette Farms Ltd.", "Monette Farms", "CDN"),
    3: ("Monette Farms Ltd.", "Monette Farms", "CDN"),
    4: ("Monette Farms Ltd.", "Monette Farms", "CDN"),
    5: ("Monette Farms Ltd.", "Monette Farms", "CDN"),
    6: ("Monette Farms USA, Inc.", "Monette Farms USA", "USD"),
    7: ("Monette Produce, LLC", "Monette Produce, LLC", "USD"),
    8: ("Monette Farms Arizona, LLC", "Monette Farms Arizona", "USD"),
    9: ("Monette Produce Ltd.", "Monette Produce Ltd.", "CDN"),
    10: ("Monette Farms BC Ltd.", "Monette Farms BC", "CDN"),
    11: ("Monette Farms BC Ltd.", "Monette Farms BC", "CDN"),
    12: ("Monette Seeds Ltd.", "Monette Seeds", "CDN"),
    13: ("Monette Seeds USA, LLC", "Monette Seeds USA", "USD"),
    14: ("Nexgen Seeds Ltd.", "Nexgen Seeds", "CDN"),
}

SKIP_PREFIXES = (
    "Creditor Mailing Listing",
    "All amounts in ",
    "Notes:",
    "1. The attached list",
    "2. This list is provided",
    "3. The dollar amounts",
    "4. If a Claims Procedure",
    "Name Address City",
    "Company Name Address",
    "amounts shown",
    "Page ",
)

ADDRESS_WORDS = {
    "box",
    "po",
    "p.o.",
    "rr",
    "site",
    "suite",
    "unit",
    "bay",
    "room",
    "c/o",
}

LOCATION_COUNTRIES = {"Canada", "USA", "France"}
PROVINCE_STATE_CODES = {
    "AB",
    "BC",
    "MB",
    "NB",
    "NL",
    "NS",
    "NT",
    "NU",
    "ON",
    "PE",
    "QC",
    "SK",
    "YT",
    "AK",
    "AL",
    "AR",
    "AZ",
    "CA",
    "CO",
    "CT",
    "DC",
    "DE",
    "FL",
    "GA",
    "HI",
    "IA",
    "ID",
    "IL",
    "IN",
    "KS",
    "KY",
    "LA",
    "MA",
    "MD",
    "ME",
    "MI",
    "MN",
    "MO",
    "MS",
    "MT",
    "NC",
    "ND",
    "NE",
    "NH",
    "NJ",
    "NM",
    "NV",
    "NY",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VA",
    "VT",
    "WA",
    "WI",
    "WV",
    "WY",
}

INDUSTRY_RULES = [
    (
        "Banking & secured finance",
        (
            "bank of nova scotia",
            "farm credit canada",
            "credit facility",
            "lc facility",
            "life policy debt",
            "senior facilities",
            "revolving credit facility",
        ),
    ),
    (
        "Equipment finance & leases",
        (
            "equipment leases",
            "pmsi",
            "deere credit",
            "pnc vendor finance",
            "meridian onecap",
            "de lage landen",
            "cnh industrial capital",
        ),
    ),
    (
        "Land, rent & real estate",
        (
            "vendor take-back",
            "real estate",
            "state land",
            "land department",
            "land & cattle",
            "ranching",
            "farms ltd",
            "farm ltd",
            "farms inc",
            "farm corporation",
            "hutterite",
            "saulteaux",
            "cassandra brouwer",
            "karen ril",
        ),
    ),
    (
        "Crop inputs, seed & fertilizer",
        (
            "nutrien",
            "agriteam",
            "simplot",
            "seed",
            "seeds",
            "agro",
            "crop",
            "grower solutions",
            "pioneer co-op",
            "co-op",
            "cooperative",
            "town & country",
            "chs big sky",
            "duck's agro",
            "rayglen commodities",
            "safflower",
            "ts&l seed",
            "stokes seeds",
            "watson seeds",
            "edge agro",
        ),
    ),
    (
        "Grain, rail & logistics",
        (
            "adm agri",
            "bunge",
            "canadian national railway",
            "canadian pacific railway",
            "bnsf",
            "railway",
            "grain",
            "commodities",
            "scoular",
            "traffix",
            "logistics",
            "transport",
            "trucking",
            "demurrage",
            "quality logistic",
            "sp i logistics",
            "spi logistics",
        ),
    ),
    (
        "Equipment, parts & machinery",
        (
            "brandt",
            "john deere",
            "rdo equipment",
            "redhead equipment",
            "pattison ag",
            "pgs equipment",
            "young's equipment",
            "western tractor",
            "westcon equipment",
            "saskatoon material handling",
            "prairie coast equipment",
            "glas equipment",
            "m&s equipment",
            "can-seed equipment",
            "leavitt machinery",
            "inland kenworth",
            "truck pro",
            "atv farms",
            "universal lift",
            "allterrain",
            "prairie mechanics",
            "rwc idealease",
        ),
    ),
    (
        "Fuel, energy & utilities",
        (
            "fuel",
            "propane",
            "petroleum",
            "suncor",
            "ufa",
            "oil depot",
            "saskpower",
            "saskenergy",
            "ferrellgas",
            "air liquide",
            "linde",
            "verizon",
            "fortisbc",
            "agco energy",
        ),
    ),
    (
        "Irrigation, water & infrastructure",
        (
            "irrigation",
            "water users",
            "water pipeline",
            "drip",
            "sprinkler",
            "pipeline",
            "southern irrigation",
            "wsa solutions",
            "laurel ag & water",
        ),
    ),
    (
        "Construction & trades",
        (
            "construction",
            "welding",
            "electric",
            "plumbing",
            "refrigeration",
            "machine shop",
            "steel",
            "paving",
            "road maintenance",
            "contracting",
            "mechanical",
            "automation",
            "glass and aluminum",
            "corr grain systems",
        ),
    ),
    (
        "Livestock, feed & veterinary",
        (
            "livestock",
            "animal health",
            "veterinary",
            "zoetis",
            "feed",
            "benchmark commodities",
            "cattle",
            "dino meats",
        ),
    ),
    (
        "Produce, packing & cold chain",
        (
            "produce",
            "packing",
            "pallet",
            "plantel",
            "nurseries",
            "leafy greens",
            "little potato",
            "volm",
            "ifco",
            "chep",
            "plant tape",
            "storcool",
            "cooling",
            "vacuum cooling",
            "westrock",
            "friesen plastics",
            "imperial dade",
            "organic",
            "ccof",
            "pro-cert",
            "food safety",
        ),
    ),
    (
        "Legal, accounting & advisory",
        (
            "law",
            "llp",
            "legal",
            "ernst & young",
            "thomson reuters",
            "morrison cohen",
            "norton rose",
            "fillmore riley",
            "cuelenaere",
            "mclennan ross",
            "ascent employment",
            "berry riddell",
            "billstein",
            "bosch, kuhr",
            "lawson lundell",
        ),
    ),
    (
        "Government, taxes & regulators",
        (
            "saskatchewan crop insurance",
            "workers compensation",
            "receiver general",
            "government of",
            "canadian food inspection",
            "department of agriculture",
            "ministry of finance",
            "city of",
            "town of",
            "rm of",
            "regional district",
            "property tax",
            "ised",
            "pulse growers",
        ),
    ),
    (
        "Technology, software & communications",
        (
            "samsara",
            "solink",
            "cube",
            "agsense",
            "suretrack",
            "wbm technologies",
            "thorstad computer",
            "ricoh",
            "itrade",
            "intuit",
            "stout industrial technology",
        ),
    ),
    (
        "Insurance, travel & administration",
        (
            "insurance",
            "traveler",
            "adp",
            "airsprint",
            "vacation world",
            "yellowstone club",
            "human capital",
            "employment",
        ),
    ),
    (
        "General supplies & site services",
        (
            "fastenal",
            "gregg distributors",
            "lawson products",
            "home hardware",
            "hardware",
            "tire",
            "kal-tire",
            "kal tire",
            "orkin",
            "janitorial",
            "portable restrooms",
            "septic",
            "disposal",
            "uline",
            "auto supply",
            "napa",
            "quality inspections",
            "certified laboratories",
            "diagnostics",
            "laboratories",
            "pest prevention",
            "scale co",
            "ts&m supply",
            "wrangler hi-line",
        ),
    ),
    (
        "Farms, gardens & custom operators",
        (
            " farms",
            " farm",
            "garden",
            "ag management partners",
            "ag harvest",
            "ag ventures",
            "du plessis",
            "danny o'conner",
        ),
    ),
]


def clean_text(value: str) -> str:
    replacements = {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\s+", " ", value).strip()
    return value.replace("Take - Back", "Take-Back")


def should_skip(line: str, page_number: int) -> bool:
    if not line:
        return True
    if line in {"Secured Creditors"}:
        return True
    if page_number in PAGE_DEBTORS:
        debtor, _, _ = PAGE_DEBTORS[page_number]
        if line == debtor:
            return True
    return any(line.startswith(prefix) for prefix in SKIP_PREFIXES)


def amount_from_line(line: str) -> tuple[float | None, str]:
    match = AMOUNT_RE.search(line)
    if not match:
        return None, line
    amount = float(match.group(1).replace(",", ""))
    return amount, line[: match.start()].strip()


def find_address_start(tokens: list[str]) -> int | None:
    for i, token in enumerate(tokens):
        lowered = token.strip(",").lower()
        if lowered == "bay":
            if i >= 1 and i + 1 < len(tokens) and re.match(r"^#?\d", tokens[i + 1]):
                return i
            continue
        if lowered in ADDRESS_WORDS and i >= 1:
            return i
        if lowered.startswith("p.o") and i >= 1:
            return i
        if re.match(r"^#?\d", token):
            if i >= 2:
                return i
            if i == 1 and (tokens[0].isupper() or "&" in tokens[0] or len(tokens[0]) <= 5):
                return i
    return None


def split_creditor_detail(detail: str) -> dict[str, str]:
    if detail.endswith(" Various"):
        return {
            "creditor": detail[: -len(" Various")].strip(),
            "address": "Various",
            "province": "",
            "country": "",
            "postalCode": "",
        }

    tokens = detail.split()
    country_index = None
    for i in range(len(tokens) - 1, -1, -1):
        if tokens[i] in LOCATION_COUNTRIES:
            country_index = i
            break

    province = ""
    country = ""
    postal_code = ""
    detail_tokens = tokens

    if country_index is not None:
        country = tokens[country_index]
        postal_code = " ".join(tokens[country_index + 1 :])
        before_country = tokens[:country_index]
        if before_country and before_country[-1] in PROVINCE_STATE_CODES:
            province = before_country[-1]
            detail_tokens = before_country[:-1]
        else:
            detail_tokens = before_country

    address_start = find_address_start(detail_tokens)
    if address_start is None:
        return {
            "creditor": " ".join(detail_tokens).strip() or detail,
            "address": "",
            "province": province,
            "country": country,
            "postalCode": postal_code,
        }

    return {
        "creditor": " ".join(detail_tokens[:address_start]).strip(),
        "address": " ".join(detail_tokens[address_start:]).strip(),
        "province": province,
        "country": country,
        "postalCode": postal_code,
    }


def classify_industry(creditor: str, claim_type: str) -> str:
    haystack = clean_text(creditor).lower()
    if claim_type == "Secured" and "equipment leases" in haystack:
        return "Equipment finance & leases"
    if "saskatchewan crop insurance" in haystack:
        return "Government, taxes & regulators"
    for industry, needles in INDUSTRY_RULES:
        if any(needle in haystack for needle in needles):
            return industry
    return "Other business services"


def row_location(parts: dict[str, str]) -> tuple[str, str, str]:
    country = parts["country"] or "Various"
    province_state = parts["province"] or "Various"
    if country == "Various":
        province_state = "Various"
    location = ", ".join(part for part in [province_state, country] if part and part != "Various")
    return country, province_state, location or "Various"


# Words that frequently appear at the END of an address but are NOT part of the city.
# We strip them from the right side of a candidate-city run.
ADDRESS_TAIL_NOISE = {
    "stn",
    "station",
    "main",
    "rr",
    "rr#1",
    "rr#2",
    "rr#3",
    "rr#4",
    "rr#5",
}

# Single letters appearing right before the city (postal station codes
# like "Stn A Toronto" or "PO Box 4090 STN A Toronto").
SINGLE_LETTER_NOISE = {c.lower() for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}

# Direction prefixes that appear right before the city ("NE Calgary", "SW Calgary",
# "East Saskatoon", "W Swift Current"). These are address directions, not the city.
DIRECTION_PREFIXES = {
    "n",
    "s",
    "e",
    "w",
    "ne",
    "nw",
    "se",
    "sw",
    "north",
    "south",
    "east",
    "west",
}

# Multi-word cities we want to preserve fully even though they start with a direction
# or contain words that look like directions. Lowercased keys.
PROTECTED_MULTIWORD_CITIES = {
    "north portal",
    "north battleford",
    "north vancouver",
    "north york",
    "south porcupine",
    "east st paul",
    "east st. paul",
    "west kelowna",
    "west st paul",
    "new york",
    "new york city",
    "the pas",
    "swift current",
    "rocky view",
    "rocky view county",
    "rocky mountain house",
    "holland landing",
    "cache creek",
    "100 mile house",
    "150 mile house",
    "mile house",
    "moose jaw",
    "fort st john",
    "fort st. john",
    "high river",
    "medicine hat",
    "prince albert",
    "prince george",
    "grande prairie",
    "spruce grove",
    "red deer",
    "lloydminster",
    "fort saskatchewan",
    "fort macleod",
    "salinas valley",
    "santa cruz",
    "santa rosa",
    "santa barbara",
    "santa fe",
    "los angeles",
    "san francisco",
    "san diego",
    "san jose",
    "salt lake city",
    "sioux falls",
    "fall river",
    "great falls",
    "elk grove",
    "long beach",
    "el centro",
    "rio rico",
    "valley center",
}

# Address keywords that mark the END of street info (city starts AFTER these or these
# are not part of city).
ADDRESS_KEYWORDS = {
    "street", "st", "st.", "rd", "road", "ave", "avenue", "drive", "dr",
    "box", "po", "p.o.", "rr", "site", "suite", "ste", "unit", "bay",
    "highway", "hwy", "court", "ct", "crescent", "cres", "lane", "ln",
    "blvd", "way", "parkway", "pkwy", "fl", "floor", "pl", "place",
    "building", "tower", "plaza", "centre", "center", "trail", "tr",
    "terrace", "ter", "circle", "cir", "loop", "row", "mews", "passage",
    "square", "sq", "concession", "conc", "range", "twp", "township",
    "side", "block", "blk", "section", "sec",
}


def _starts_with_digit(token: str) -> bool:
    return bool(re.match(r"^[0-9#]", token))


def _is_capitalized(token: str) -> bool:
    if not token:
        return False
    return token[0].isupper()


def extract_city(address: str, province_state: str = "", country: str = "") -> str:
    """
    Extract the mailing city from a one-line address. Cities appear at the end of
    the address string (the FTI listing concatenates Street + City). We walk
    backwards from the end collecting capitalized tokens, stopping when we hit
    a digit, a street keyword, or a non-capitalized word.

    Then we strip postal-station noise ("Stn A", single letters, RR#) and lone
    direction prefixes ("NE Calgary", "East Saskatoon"), unless the result looks
    like a known multi-word city (e.g. "North Portal", "Swift Current").
    """
    if not address or address == "Various":
        return ""

    cleaned = address.rstrip(" ,")
    tokens = cleaned.split()
    if not tokens:
        return ""

    # Walk backwards collecting candidate city words.
    candidates: list[str] = []
    for tok in reversed(tokens):
        if not tok:
            break
        if _starts_with_digit(tok):
            break
        lowered = tok.strip(",.").lower()
        if lowered in ADDRESS_KEYWORDS:
            break
        if not _is_capitalized(tok):
            break
        candidates.insert(0, tok.strip(","))
        # Stop at 4 tokens (e.g. "Rocky View County" is 3, "100 Mile House" is 3).
        if len(candidates) >= 4:
            break

    if not candidates:
        return ""

    # Iteratively strip leading noise tokens.
    def joined(values: list[str]) -> str:
        return " ".join(values).strip().rstrip(",")

    while candidates:
        full_lower = joined(candidates).lower()
        if full_lower in PROTECTED_MULTIWORD_CITIES:
            return joined(candidates)
        first = candidates[0].strip(",.").lower()
        if first in ADDRESS_TAIL_NOISE:
            candidates.pop(0)
            continue
        if first in SINGLE_LETTER_NOISE:
            candidates.pop(0)
            continue
        # Direction prefix: only drop if there's still another token after it
        # AND the remaining candidate isn't itself a protected multi-word city.
        if first in DIRECTION_PREFIXES and len(candidates) > 1:
            remainder_lower = joined(candidates[1:]).lower()
            if remainder_lower not in PROTECTED_MULTIWORD_CITIES:
                # Also avoid stripping if the original full phrase is itself a
                # protected city name (already handled above).
                candidates.pop(0)
                continue
        break

    return joined(candidates)


# Manual normalization for cities we know come out of the parser slightly off,
# usually because of postal-station prefixes the parser couldn't strip cleanly.
CITY_OVERRIDES: dict[str, str] = {
    "a toronto": "Toronto",
    "station a toronto": "Toronto",
    "stn a toronto": "Toronto",
    "stn main winnipeg": "Winnipeg",
    "main winnipeg": "Winnipeg",
    "east saskatoon": "Saskatoon",
    "west saskatoon": "Saskatoon",
    "w saskatoon": "Saskatoon",
    "e saskatoon": "Saskatoon",
    "n saskatoon": "Saskatoon",
    "s saskatoon": "Saskatoon",
    "ne calgary": "Calgary",
    "nw calgary": "Calgary",
    "se calgary": "Calgary",
    "sw calgary": "Calgary",
    "ne edmonton": "Edmonton",
    "nw edmonton": "Edmonton",
    "se edmonton": "Edmonton",
    "sw edmonton": "Edmonton",
    "landing ne calgary": "Calgary",
    "w swift current": "Swift Current",
    "west swift current": "Swift Current",
    "rr#1 york": "York",
    "rr#2 york": "York",
    "huron sd": "Huron",  # The Huron, SD entry — keep "Huron"
    "mile house": "100 Mile House",  # data shows just "Mile House"; assume 100 Mile House (BC)
    "pacific coolidge": "Coolidge",
    "prov victoria": "Victoria",
    "streetsville rp mississauga": "Mississauga",
    "jackson crt kelowna": "Kelowna",
    "premier riviere-du-loup": "Riviere-du-Loup",
    "outardes": "Pointe-aux-Outardes",
}


def normalize_city(raw_city: str) -> str:
    if not raw_city:
        return ""
    key = raw_city.lower().strip()
    if key in CITY_OVERRIDES:
        return CITY_OVERRIDES[key]
    # Strip a leading "RR#1 " / "RR#2 " etc.
    cleaned = re.sub(r"^RR#\d+\s+", "", raw_city, flags=re.IGNORECASE).strip()
    # Title-case unless it's already mixed-case (preserve "The Pas" etc.)
    if cleaned.isupper() or cleaned.islower():
        cleaned = cleaned.title()
    return cleaned


# ---------------------------------------------------------------------------
# Geocoding
# ---------------------------------------------------------------------------


def load_geocode_cache() -> dict[str, dict]:
    if GEOCODE_CACHE_PATH.exists():
        try:
            return json.loads(GEOCODE_CACHE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def save_geocode_cache(cache: dict[str, dict]) -> None:
    GEOCODE_CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=True, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def geocode_city(
    city: str, province_state: str, country: str, cache: dict[str, dict]
) -> dict | None:
    if not city:
        return None

    cache_key = f"{city}|{province_state}|{country}".lower()
    if cache_key in cache:
        return cache[cache_key]

    country_codes_map = {"Canada": "ca", "USA": "us", "France": "fr"}
    country_code = country_codes_map.get(country)

    search_pieces = [city]
    if province_state and province_state != "Various":
        search_pieces.append(province_state)
    if country and country != "Various":
        search_pieces.append(country)
    search_text = ", ".join(search_pieces)

    url = (
        "https://api.mapbox.com/geocoding/v5/mapbox.places/"
        f"{quote(search_text)}.json"
        f"?access_token={MAPBOX_TOKEN}&limit=1&types=place,locality,district"
    )
    if country_code:
        url += f"&country={country_code}"

    try:
        req = Request(url, headers={"User-Agent": "monette-ledger-build"})
        with urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"  [geocode] {search_text}: error {exc}")
        cache[cache_key] = {"city": city, "provinceState": province_state, "country": country, "lat": None, "lng": None, "matched": None}
        return cache[cache_key]

    features = data.get("features") or []
    if not features:
        print(f"  [geocode] {search_text}: no result")
        result = {"city": city, "provinceState": province_state, "country": country, "lat": None, "lng": None, "matched": None}
    else:
        feat = features[0]
        lng, lat = feat["center"][0], feat["center"][1]
        result = {
            "city": city,
            "provinceState": province_state,
            "country": country,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "matched": feat.get("place_name"),
        }
        print(f"  [geocode] {search_text} -> {feat.get('place_name')} ({lat:.3f}, {lng:.3f})")

    cache[cache_key] = result
    # Be polite to the API.
    time.sleep(0.05)
    return result


def attach_geocoding(rows: list[dict]) -> None:
    cache = load_geocode_cache()
    unique_keys: dict[tuple[str, str, str], None] = {}
    for row in rows:
        raw_city = extract_city(row.get("address", ""), row.get("provinceState", ""), row.get("country", ""))
        city = normalize_city(raw_city)
        row["city"] = city
        country = row.get("country", "")
        province_state = row.get("provinceState", "")
        if city:
            unique_keys[(city, province_state, country)] = None

    print(f"geocoding {len(unique_keys)} unique cities (cache hits will be reused)")
    for city, province_state, country in unique_keys:
        geocode_city(city, province_state, country, cache)

    save_geocode_cache(cache)

    for row in rows:
        city = row.get("city", "")
        if not city:
            row["lat"] = None
            row["lng"] = None
            continue
        cache_key = f"{city}|{row.get('provinceState', '')}|{row.get('country', '')}".lower()
        entry = cache.get(cache_key) or {}
        row["lat"] = entry.get("lat")
        row["lng"] = entry.get("lng")


def parse_pdf() -> list[dict]:
    reader = PdfReader(str(PDF_PATH))
    rows: list[dict] = []
    buffer = ""

    for page_index, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        if page_index != 1:
            buffer = ""

        for raw_line in page_text.splitlines():
            line = clean_text(raw_line)
            if should_skip(line, page_index):
                continue

            current = clean_text(f"{buffer} {line}") if buffer else line
            amount, before_amount = amount_from_line(current)
            if amount is None:
                buffer = current
                continue

            buffer = ""
            if before_amount.startswith("Total -"):
                continue

            if page_index == 1:
                detail = before_amount
                currency = "CDN"
                claim_type = "Secured"
                debtor = "Applicants"
                debtor_label = "All applicants"
            else:
                debtor, debtor_label, currency = PAGE_DEBTORS[page_index]
                claim_type = "Unsecured"
                detail = before_amount
                if detail.startswith(debtor_label + " "):
                    detail = detail[len(debtor_label) + 1 :].strip()

            parts = split_creditor_detail(detail)
            creditor = parts["creditor"] or detail
            address = parts["address"]
            country, province_state, location = row_location(parts)
            industry = classify_industry(creditor, claim_type)

            rows.append(
                {
                    "id": f"cred-{len(rows) + 1:04d}",
                    "creditor": creditor,
                    "debtor": debtor,
                    "debtorLabel": debtor_label,
                    "claimType": claim_type,
                    "currency": currency,
                    "balance": round(amount, 2),
                    "balanceLabel": f"${amount:,.2f} {currency}",
                    "address": address,
                    "province": province_state,
                    "provinceState": province_state,
                    "country": country,
                    "postalCode": parts["postalCode"],
                    "location": location,
                    "industry": industry,
                    "sourcePage": page_index,
                    "raw": current,
                }
            )

    return rows


def parse_printed_totals() -> list[dict]:
    reader = PdfReader(str(PDF_PATH))
    printed_totals: list[dict] = []
    for page_index, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        currency = "CDN"
        if page_index in PAGE_DEBTORS:
            _, _, currency = PAGE_DEBTORS[page_index]
        for raw_line in page_text.splitlines():
            line = clean_text(raw_line)
            if not line.startswith("Total -"):
                continue
            amount, before_amount = amount_from_line(line)
            if amount is None:
                continue
            label = before_amount.replace("Total -", "", 1).strip()
            printed_totals.append(
                {
                    "label": label,
                    "page": page_index,
                    "currency": currency,
                    "printedTotal": round(amount, 2),
                }
            )
    return printed_totals


def label_row_total(rows: list[dict], label: str, currency: str) -> float:
    if label == "Secured Creditors":
        return sum(
            row["balance"]
            for row in rows
            if row["claimType"] == "Secured" and row["currency"] == currency
        )
    return sum(
        row["balance"]
        for row in rows
        if (row["debtorLabel"] == label or row["debtor"] == label) and row["currency"] == currency
    )


def reconcile_totals(rows: list[dict], printed_totals: list[dict]) -> dict:
    checks = []
    for item in printed_totals:
        extracted = round(label_row_total(rows, item["label"], item["currency"]), 2)
        printed = item["printedTotal"]
        difference = round(extracted - printed, 2)
        checks.append(
            {
                **item,
                "extractedTotal": extracted,
                "difference": difference,
                "matches": abs(difference) <= 0.01,
            }
        )
    max_difference = max((abs(item["difference"]) for item in checks), default=0)
    return {
        "ok": all(item["matches"] for item in checks),
        "checkCount": len(checks),
        "matchedCount": sum(1 for item in checks if item["matches"]),
        "maxDifference": round(max_difference, 2),
        "checks": checks,
    }


def add_rollup(target: dict, key: tuple[str, str], base: dict, amount: float) -> None:
    row = target.setdefault(
        key,
        {
            **base,
            "creditorCount": 0,
            "balance": 0,
        },
    )
    row["creditorCount"] += 1
    row["balance"] += amount


def sorted_rollups(values: dict) -> list[dict]:
    return sorted(
        (
            {
                **value,
                "balance": round(value["balance"], 2),
                "balanceLabel": f"${value['balance']:,.2f} {value['currency']}",
            }
            for value in values.values()
        ),
        key=lambda item: item["balance"],
        reverse=True,
    )


def summarize(rows: list[dict]) -> dict:
    totals_by_currency: dict[str, float] = {}
    totals_by_claim: dict[str, dict[str, float]] = {}
    debtor_totals: dict[tuple[str, str], dict] = {}
    country_totals: dict[tuple[str, str], dict] = {}
    province_state_totals: dict[tuple[str, str, str], dict] = {}
    industry_totals: dict[tuple[str, str], dict] = {}
    hierarchy_totals: dict[tuple[str, str, str, str], dict] = {}
    city_totals: dict[tuple[str, str, str], dict] = {}

    for row in rows:
        currency = row["currency"]
        claim_type = row["claimType"]
        balance = row["balance"]
        debtor_key = (row["debtor"], currency)

        totals_by_currency[currency] = totals_by_currency.get(currency, 0) + balance
        totals_by_claim.setdefault(claim_type, {})
        totals_by_claim[claim_type][currency] = totals_by_claim[claim_type].get(currency, 0) + balance

        debtor = debtor_totals.setdefault(
            debtor_key,
            {
                "debtor": row["debtor"],
                "debtorLabel": row["debtorLabel"],
                "currency": currency,
                "claimType": claim_type,
                "creditorCount": 0,
                "balance": 0,
            },
        )
        debtor["creditorCount"] += 1
        debtor["balance"] += balance

        add_rollup(
            country_totals,
            (row["country"], currency),
            {"country": row["country"], "currency": currency},
            balance,
        )
        add_rollup(
            province_state_totals,
            (row["country"], row["provinceState"], currency),
            {"country": row["country"], "provinceState": row["provinceState"], "currency": currency},
            balance,
        )
        add_rollup(
            industry_totals,
            (row["industry"], currency),
            {"industry": row["industry"], "currency": currency},
            balance,
        )
        add_rollup(
            hierarchy_totals,
            (row["country"], row["provinceState"], row["industry"], currency),
            {
                "country": row["country"],
                "provinceState": row["provinceState"],
                "industry": row["industry"],
                "currency": currency,
            },
            balance,
        )
        city = row.get("city") or ""
        if city:
            city_key = (city, row.get("provinceState") or "", row.get("country") or "")
            entry = city_totals.setdefault(
                city_key,
                {
                    "city": city,
                    "provinceState": row.get("provinceState") or "",
                    "country": row.get("country") or "",
                    "lat": row.get("lat"),
                    "lng": row.get("lng"),
                    "creditorCount": 0,
                    "balanceCDN": 0.0,
                    "balanceUSD": 0.0,
                    "industries": {},
                    "claimTypes": {"Secured": 0, "Unsecured": 0},
                },
            )
            entry["creditorCount"] += 1
            if currency == "CDN":
                entry["balanceCDN"] += balance
            else:
                entry["balanceUSD"] += balance
            ind = row.get("industry") or "Other"
            entry["industries"][ind] = entry["industries"].get(ind, 0) + balance
            entry["claimTypes"][claim_type] = entry["claimTypes"].get(claim_type, 0) + 1

    printed_totals = parse_printed_totals()

    return {
        "rowCount": len(rows),
        "totalsByCurrency": {
            currency: round(value, 2)
            for currency, value in sorted(totals_by_currency.items())
        },
        "totalsByClaim": {
            claim: {currency: round(value, 2) for currency, value in sorted(values.items())}
            for claim, values in sorted(totals_by_claim.items())
        },
        "debtorTotals": sorted(
            (
                {
                    **value,
                    "balance": round(value["balance"], 2),
                    "balanceLabel": f"${value['balance']:,.2f} {value['currency']}",
                }
                for value in debtor_totals.values()
            ),
            key=lambda item: item["balance"],
            reverse=True,
        ),
        "countryTotals": sorted_rollups(country_totals),
        "provinceStateTotals": sorted_rollups(province_state_totals),
        "industryTotals": sorted_rollups(industry_totals),
        "hierarchyTotals": sorted_rollups(hierarchy_totals),
        "cityTotals": _format_city_totals(city_totals),
        "reconciliation": reconcile_totals(rows, printed_totals),
    }


def _format_city_totals(city_totals: dict[tuple[str, str, str], dict]) -> list[dict]:
    formatted: list[dict] = []
    for entry in city_totals.values():
        balance_cdn = round(entry["balanceCDN"], 2)
        balance_usd = round(entry["balanceUSD"], 2)
        # Sort industries by total balance and keep the top label.
        top_industry = ""
        if entry["industries"]:
            top_industry = max(entry["industries"].items(), key=lambda kv: kv[1])[0]
        formatted.append(
            {
                "city": entry["city"],
                "provinceState": entry["provinceState"],
                "country": entry["country"],
                "lat": entry["lat"],
                "lng": entry["lng"],
                "creditorCount": entry["creditorCount"],
                "balanceCDN": balance_cdn,
                "balanceUSD": balance_usd,
                "topIndustry": top_industry,
                "secured": entry["claimTypes"].get("Secured", 0),
                "unsecured": entry["claimTypes"].get("Unsecured", 0),
            }
        )
    # Rank by combined dollar weight (CAD + USD as a single signal).
    formatted.sort(
        key=lambda item: (item["balanceCDN"] + item["balanceUSD"]),
        reverse=True,
    )
    return formatted


def main() -> None:
    rows = parse_pdf()
    attach_geocoding(rows)
    payload = {
        "source": {
            "title": "Monette Creditor Listing",
            "postedDate": "2026-04-24",
            "preparedAsOf": "2026-04-21",
            "url": SOURCE_URL,
            "localPdf": str(PDF_PATH.relative_to(ROOT)).replace("\\", "/"),
            "generatedAt": date.today().isoformat(),
            "note": "Amounts are listed by FTI without admission as to liability or quantum. No claims procedure had been established in the April 24, 2026 notice.",
        },
        "summary": summarize(rows),
        "rows": rows,
    }
    OUT_PATH.write_text(
        "window.MONETTE_CREDITORS = "
        + json.dumps(payload, ensure_ascii=True, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH.relative_to(ROOT)} with {len(rows)} creditor rows")


if __name__ == "__main__":
    main()
