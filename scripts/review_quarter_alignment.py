"""
Generate satellite review images for Monette parcel geometry.

This is the secondary check for formula-driven quarter boxes:
1. fetch a Mapbox satellite static image for a property or parcel subset
2. project the generated parcel polygons into the same Web Mercator viewport
3. draw the parcel outlines over the imagery

The goal is not to produce a legal survey. It is to give us a repeatable
inspection image before we touch the geometry formula or deploy a calibration.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config.js"
QUARTERS_PATH = ROOT / "quarters.geojson"
CALIBRATION_PATH = ROOT / "scripts" / "quarter_geometry_calibration.json"
DEFAULT_OUTPUT_DIR = ROOT / "_refs" / "quarter-alignment"
RADIUS_M = 6378137.0
MAX_LAT = 85.05112878

TOKEN_RE = re.compile(r'window\.MAPBOX_TOKEN\s*=\s*"([^"]+)"')
STYLE_RE = re.compile(r'window\.MAPBOX_STYLE_SATELLITE\s*=\s*"mapbox://styles/([^"]+)"')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render parcel overlays on satellite imagery.")
    parser.add_argument(
        "--property",
        dest="property_ids",
        action="append",
        help="property id to render; repeatable. Defaults to all properties with real geometry.",
    )
    parser.add_argument(
        "--loc",
        dest="locs",
        action="append",
        help="optional parcel loc filter within the selected property; repeatable.",
    )
    parser.add_argument("--width", type=int, default=1280, help="output image width in pixels")
    parser.add_argument("--height", type=int, default=1280, help="output image height in pixels")
    parser.add_argument("--padding", type=int, default=48, help="Mapbox static-image padding in pixels")
    parser.add_argument(
        "--margin",
        type=float,
        default=0.08,
        help="extra geographic margin around the selected geometry as a fraction of bbox span",
    )
    parser.add_argument(
        "--line-width",
        type=int,
        default=3,
        help="parcel outline width in pixels",
    )
    parser.add_argument(
        "--fill-alpha",
        type=int,
        default=8,
        help="parcel fill opacity from 0 to 255",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="directory for the rendered PNG files",
    )
    return parser.parse_args()


def load_mapbox_runtime() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    token_match = TOKEN_RE.search(text)
    if not token_match:
        raise RuntimeError(f"Could not find window.MAPBOX_TOKEN in {CONFIG_PATH}")

    style_match = STYLE_RE.search(text)
    if not style_match:
        raise RuntimeError(f"Could not find window.MAPBOX_STYLE_SATELLITE in {CONFIG_PATH}")

    return token_match.group(1), style_match.group(1)


def load_calibration() -> dict:
    if not CALIBRATION_PATH.exists():
        return {"default": {}, "properties": {}}
    return json.loads(CALIBRATION_PATH.read_text(encoding="utf-8"))


def calibration_summary(config: dict, property_id: str) -> str:
    default = config.get("default") or {}
    overrides = (config.get("properties") or {}).get(property_id, {})
    merged = {
        "east_m": overrides.get("east_m", default.get("east_m", 0)),
        "north_m": overrides.get("north_m", default.get("north_m", 0)),
        "scale_x": overrides.get("scale_x", default.get("scale_x", 1)),
        "scale_y": overrides.get("scale_y", default.get("scale_y", 1)),
        "rotate_deg": overrides.get("rotate_deg", default.get("rotate_deg", 0)),
    }
    return (
        f"east={merged['east_m']:.2f}m  north={merged['north_m']:.2f}m  "
        f"scale=({merged['scale_x']:.5f},{merged['scale_y']:.5f})  "
        f"rotate={merged['rotate_deg']:.3f}deg"
    )


def load_quarters() -> dict[str, list[dict]]:
    fc = json.loads(QUARTERS_PATH.read_text(encoding="utf-8"))
    grouped: dict[str, list[dict]] = defaultdict(list)
    for feature in fc["features"]:
        grouped[feature["properties"]["property_id"]].append(feature)
    return grouped


def select_features(grouped: dict[str, list[dict]], property_id: str, locs: set[str]) -> list[dict]:
    features = grouped.get(property_id, [])
    if not locs:
        return features
    return [feature for feature in features if feature["properties"].get("loc") in locs]


def compute_bbox(features: list[dict]) -> tuple[float, float, float, float]:
    min_lng = float("inf")
    min_lat = float("inf")
    max_lng = float("-inf")
    max_lat = float("-inf")
    for feature in features:
        for lng, lat in feature["geometry"]["coordinates"][0]:
            min_lng = min(min_lng, lng)
            min_lat = min(min_lat, lat)
            max_lng = max(max_lng, lng)
            max_lat = max(max_lat, lat)
    if not math.isfinite(min_lng):
        raise ValueError("No geometry found for selection")
    return min_lng, min_lat, max_lng, max_lat


def expand_bbox(
    bbox: tuple[float, float, float, float],
    margin: float,
) -> tuple[float, float, float, float]:
    min_lng, min_lat, max_lng, max_lat = bbox
    lng_span = max(max_lng - min_lng, 0.01)
    lat_span = max(max_lat - min_lat, 0.01)
    pad_lng = lng_span * margin
    pad_lat = lat_span * margin
    return (
        min_lng - pad_lng,
        max(min_lat - pad_lat, -MAX_LAT),
        max_lng + pad_lng,
        min(max_lat + pad_lat, MAX_LAT),
    )


def mercator_x(lng: float) -> float:
    return RADIUS_M * math.radians(lng)


def mercator_y(lat: float) -> float:
    lat = max(min(lat, MAX_LAT), -MAX_LAT)
    rad = math.radians(lat)
    return RADIUS_M * math.log(math.tan((math.pi / 4) + (rad / 2)))


def viewport_transform(
    bbox: tuple[float, float, float, float],
    width: int,
    height: int,
    padding: int,
):
    min_lng, min_lat, max_lng, max_lat = bbox
    min_x = mercator_x(min_lng)
    max_x = mercator_x(max_lng)
    min_y = mercator_y(min_lat)
    max_y = mercator_y(max_lat)

    inner_width = width - (padding * 2)
    inner_height = height - (padding * 2)
    if inner_width <= 0 or inner_height <= 0:
        raise ValueError("padding leaves no drawable area")

    data_width = max(max_x - min_x, 1.0)
    data_height = max(max_y - min_y, 1.0)
    scale = min(inner_width / data_width, inner_height / data_height)
    offset_x = padding + ((inner_width - (data_width * scale)) / 2)
    offset_y = padding + ((inner_height - (data_height * scale)) / 2)

    def project(lng: float, lat: float) -> tuple[float, float]:
        x = mercator_x(lng)
        y = mercator_y(lat)
        px = offset_x + ((x - min_x) * scale)
        py = offset_y + ((max_y - y) * scale)
        return px, py

    return project


def fetch_static_image(
    style_path: str,
    token: str,
    bbox: tuple[float, float, float, float],
    width: int,
    height: int,
    padding: int,
) -> Image.Image:
    min_lng, min_lat, max_lng, max_lat = bbox
    bbox_segment = f"[{min_lng},{min_lat},{max_lng},{max_lat}]"
    url = (
        f"https://api.mapbox.com/styles/v1/{style_path}/static/"
        f"{urllib.parse.quote(bbox_segment, safe='[],.-')}/"
        f"{width}x{height}?padding={padding}&access_token={urllib.parse.quote(token)}"
    )
    with urllib.request.urlopen(url) as response:
        return Image.open(BytesIO(response.read())).convert("RGBA")


def draw_feature_overlay(
    image: Image.Image,
    features: list[dict],
    project,
    line_width: int,
    fill_alpha: int,
):
    draw = ImageDraw.Draw(image, "RGBA")
    fill_alpha = max(0, min(fill_alpha, 255))
    fill = (255, 95, 87, fill_alpha)
    stroke = (255, 95, 87, 255)

    for feature in features:
        ring = feature["geometry"]["coordinates"][0]
        points = [project(lng, lat) for lng, lat in ring]
        if fill_alpha > 0:
            draw.polygon(points, fill=fill)
        draw.line(points, fill=stroke, width=line_width)


def annotate_image(
    image: Image.Image,
    property_id: str,
    features: list[dict],
    locs: set[str],
    calibration_text: str,
):
    draw = ImageDraw.Draw(image, "RGBA")
    title = f"{property_id} | parcels={len(features)}"
    if locs:
        title += f" | locs={len(locs)}"
    detail = "full property" if not locs else "filtered parcel review"
    label_lines = [title, detail, calibration_text]

    x0 = 24
    y0 = 20
    line_height = 18
    width = max((len(line) for line in label_lines), default=0) * 7 + 28
    height = (line_height * len(label_lines)) + 20
    draw.rounded_rectangle((x0, y0, x0 + width, y0 + height), radius=12, fill=(15, 23, 34, 190))

    y = y0 + 10
    for line in label_lines:
        draw.text((x0 + 12, y), line, fill=(255, 255, 255, 255))
        y += line_height


def output_path(out_dir: Path, property_id: str, locs: set[str]) -> Path:
    if not locs:
        return out_dir / f"{property_id}-alignment.png"
    loc_stub = "-".join(sorted(loc.lower().replace("/", "-") for loc in locs))
    loc_stub = re.sub(r"[^a-z0-9-]+", "-", loc_stub).strip("-")
    return out_dir / f"{property_id}-{loc_stub}-alignment.png"


def main() -> int:
    args = parse_args()
    token, style_path = load_mapbox_runtime()
    calibration = load_calibration()
    grouped = load_quarters()
    requested_ids = args.property_ids or sorted(grouped.keys())
    requested_locs = set(args.locs or [])

    args.out_dir.mkdir(parents=True, exist_ok=True)
    rendered = 0
    for property_id in requested_ids:
        features = select_features(grouped, property_id, requested_locs)
        if not features:
            print(f"skip {property_id}: no geometry for that selection")
            continue

        bbox = expand_bbox(compute_bbox(features), args.margin)
        image = fetch_static_image(style_path, token, bbox, args.width, args.height, args.padding)
        project = viewport_transform(bbox, args.width, args.height, args.padding)
        draw_feature_overlay(image, features, project, args.line_width, args.fill_alpha)
        annotate_image(
            image,
            property_id,
            features,
            requested_locs,
            calibration_summary(calibration, property_id),
        )
        destination = output_path(args.out_dir, property_id, requested_locs)
        image.save(destination)
        print(destination)
        rendered += 1

    if rendered == 0:
        print("no images rendered")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
