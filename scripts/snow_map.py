#!/usr/bin/env python
"""Synoptic snow-extent maps per Prairie province from MODIS NDSI.

Builds current-state PNG + stats for AB / SK / MB and a Prairie-wide
composite, derived from the most recent MOD10A1 (Terra ~10:30 local) +
MYD10A1 (Aqua ~13:30 local) MODIS observations within a short look-back
window. Optionally masks permanent water bodies via JRC Global Surface
Water so headline stats reflect LAND snow, not lake ice.

Usage:
  python scripts/snow_map.py alberta
  python scripts/snow_map.py saskatchewan
  python scripts/snow_map.py manitoba
  python scripts/snow_map.py prairie         # composite covering AB/SK/MB
  python scripts/snow_map.py all             # all four (recommended)

  python scripts/snow_map.py all --no-water-mask        # raw NDSI (incl. lake ice)
  python scripts/snow_map.py all --date 2026-05-10      # backfill specific UTC date

Outputs (always dual-written):
  out/snow_maps/YYYY-MM-DD/{ab,sk,mb,prairie}-snow.png
  out/snow_maps/YYYY-MM-DD/{ab,sk,mb,prairie}-stats.json
  public/snow/YYYY-MM-DD/{...same files...}
  public/snow/manifest.json   (catalogue of available dates)
  public/snow/index.html      (Watcher viewer page; idempotent)

Method:
  1. Boundaries from FAO/GAUL/2015/level1 (ADM1_NAME match).
  2. LOOKBACK_DAYS UTC days ending requested date+1, so the requested
     date is inclusive even though MODIS L3 products lag ~1 day.
  3. Mask any pixel where NDSI_Snow_Cover > 100 (101-255 are flag codes
     for cloud, ocean, fill, night, detector saturated, etc.).
  4. (Default) Mask permanent water via JRC GSW max_extent, so frozen
     lake pixels do not register as land snow.
  5. Sort ASCENDING by system:time_start and `mosaic()` so the newest
     valid pixel wins per location (EE mosaic priority is last-iteration,
     so newest must come last).
  6. Visualize as a 4-stop discrete palette over [0, 100]; clip to AOI.
  7. Stats at MODIS native ~500m: mean NDSI, area >= 40 (definite snow),
     and snow_pct = snow / valid_clear_pixels.

Auth:
  Reuses scripts/gee_pipeline/auth.py - service account, then ADC,
  then user OAuth.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import ee
import requests

# UTF-8 stdout so emoji/em-dash don't mojibake on Windows (memory practice #16).
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Bootstrap: put scripts/ on sys.path so `from gee_pipeline.auth import ...` works
_HERE = Path(__file__).resolve()
for _parent in _HERE.parents:
    if _parent.name == "scripts":
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break

from gee_pipeline.auth import initialize, auth_source  # noqa: E402

REPO_ROOT = _HERE.parent.parent
OUT_DIR = REPO_ROOT / "out" / "snow_maps"
PUBLIC_DIR = REPO_ROOT / "public" / "snow"

LOOKBACK_DAYS = 5
THUMBNAIL_PX = 1400  # long-edge in pixels for province renders
PRAIRIE_THUMBNAIL_PX = 2000  # composite covers ~3x area, give it more pixels

# FAO/GAUL ADM1_NAME -> short_code
PROVINCES = {
    "alberta":      "AB",
    "saskatchewan": "SK",
    "manitoba":     "MB",
}
ALIASES = {"ab": "alberta", "sk": "saskatchewan", "mb": "manitoba"}

# Discrete 4-stop palette over NDSI [0, 100]
SNOW_PALETTE = [
    "d2b48c",  # 0   bare/no snow (warm tan)
    "a3c4dc",  # ~33 trace/melting
    "5b9bd5",  # ~66 partial cover
    "f5f9ff",  # 100 full cover (off-white)
]


# ---------- core EE construction --------------------------------------------

def _prep_modis(img: ee.Image) -> ee.Image:
    """Mask flag values (>100), rename band to 'snow', preserve time."""
    snow = img.select("NDSI_Snow_Cover").rename("snow")
    valid = snow.lte(100)
    return snow.updateMask(valid).copyProperties(img, ["system:time_start"])


def land_mask() -> ee.Image:
    """Return a binary mask: 1 over land (never water), 0 over water.

    Uses JRC Global Surface Water (1.4) `max_extent`: pixels classified
    as water at any point in the ~37 yr Landsat record. For a stable
    feature like a lake or major river this is a clean permanent-water
    mask. Floodplains that are only intermittently wet may be flagged
    here too, which is acceptable for our use (we only want LAND).

    Returns the mask itself (1-band, 0/1) rather than applying it, so
    callers can compose with other masks via .updateMask().
    """
    gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("max_extent")
    is_water = gsw.unmask(0).gte(1)
    return is_water.Not().rename("land")


def build_snow_image(geom: ee.Geometry, end_date: datetime, *, mask_water: bool = True) -> ee.Image:
    """Most-recent valid MODIS NDSI mosaic, optionally land-only.

    Window is [end-LOOKBACK_DAYS, end+1day) so the requested date is
    inclusive. Returns a single-band image named 'snow'.
    """
    end_ee = ee.Date(end_date.strftime("%Y-%m-%d")).advance(1, "day")
    start_ee = end_ee.advance(-LOOKBACK_DAYS, "day")

    mod = (ee.ImageCollection("MODIS/061/MOD10A1")
           .filterDate(start_ee, end_ee)
           .filterBounds(geom))
    myd = (ee.ImageCollection("MODIS/061/MYD10A1")
           .filterDate(start_ee, end_ee)
           .filterBounds(geom))

    n_mod = mod.size().getInfo()
    n_myd = myd.size().getInfo()
    print(f"  MOD10A1 scenes in window: {n_mod}")
    print(f"  MYD10A1 scenes in window: {n_myd}")
    if n_mod + n_myd == 0:
        raise SystemExit(
            "  ABORT: zero MODIS scenes in window. Widen LOOKBACK_DAYS or pass --date."
        )

    # Sort ASCENDING so newest is last in the iteration -> wins in mosaic().
    # See codex review ae0cceafc606df651: EE mosaic() priority = last image,
    # not chronologically latest by metadata.
    combined = (mod.map(_prep_modis)
                .merge(myd.map(_prep_modis))
                .sort("system:time_start"))
    snow_img = combined.mosaic()

    if mask_water:
        snow_img = snow_img.updateMask(land_mask())

    return snow_img.clip(geom)


# ---------- visualization ---------------------------------------------------

def render_thumbnail(snow_img: ee.Image, out_path: Path, region: ee.Geometry,
                     dimensions: int = THUMBNAIL_PX) -> int:
    """Fetch a styled thumbnail PNG and write it to disk. Returns size in bytes."""
    snow_viz = snow_img.visualize(min=0, max=100, palette=SNOW_PALETTE)
    url = snow_viz.getThumbURL({
        "region": region,
        "dimensions": dimensions,
        "format": "png",
    })
    print(f"  fetching: {url[:140]}...")
    resp = requests.get(url, timeout=240)
    resp.raise_for_status()
    out_path.write_bytes(resp.content)
    return len(resp.content)


# ---------- stats -----------------------------------------------------------

def snow_stats(snow_img: ee.Image, geom: ee.Geometry) -> dict:
    """Compute summary stats at MODIS native 500m resolution.

    valid_km2: clear-sky LAND area (water already masked if applied upstream)
    snow_km2: area where NDSI >= 40
    snow_pct: snow_km2 / valid_km2
    """
    SCALE = 500
    pixel_area_km2 = ee.Image.pixelArea().divide(1e6)

    valid_mask = snow_img.mask()
    snow_mask = snow_img.gte(40).And(valid_mask)

    mean_ndsi = snow_img.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=SCALE,
        maxPixels=int(1e10),
        bestEffort=True,
    ).get("snow")

    valid_km2 = pixel_area_km2.updateMask(valid_mask).reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geom,
        scale=SCALE,
        maxPixels=int(1e10),
        bestEffort=True,
    ).get("area")

    snow_km2 = pixel_area_km2.updateMask(snow_mask).reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geom,
        scale=SCALE,
        maxPixels=int(1e10),
        bestEffort=True,
    ).get("area")

    out = ee.Dictionary({
        "mean_ndsi": mean_ndsi,
        "valid_km2": valid_km2,
        "snow_km2": snow_km2,
    }).getInfo()

    valid = float(out.get("valid_km2") or 0.0)
    snow = float(out.get("snow_km2") or 0.0)
    out["snow_pct"] = round((snow / valid * 100.0), 2) if valid > 0 else None
    out["window_days"] = LOOKBACK_DAYS
    if out.get("mean_ndsi") is not None:
        out["mean_ndsi"] = round(float(out["mean_ndsi"]), 2)
    out["valid_km2"] = round(valid, 1)
    out["snow_km2"] = round(snow, 1)
    return out


# ---------- per-province + prairie drivers ----------------------------------

def _province_geom(name_capital: str) -> tuple[ee.FeatureCollection, ee.Geometry]:
    fc = ee.FeatureCollection("FAO/GAUL/2015/level1").filter(
        ee.Filter.eq("ADM1_NAME", name_capital))
    if fc.size().getInfo() == 0:
        raise SystemExit(f"ABORT: no province match for '{name_capital}'.")
    return fc, fc.geometry()


def _bounds_of(geom: ee.Geometry) -> dict:
    """Return {'west':..., 'east':..., 'south':..., 'north':...} in WGS84.

    Used by Mapbox image source so the PNG can be georeferenced against
    its corner coordinates.
    """
    coords = geom.bounds().coordinates().getInfo()[0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return {
        "west": min(lons),
        "east": max(lons),
        "south": min(lats),
        "north": max(lats),
    }


def render_province(province_key: str, end_date: datetime, *, mask_water: bool) -> dict:
    norm = ALIASES.get(province_key.lower(), province_key.lower())
    short = PROVINCES[norm]
    full_name = norm.capitalize()

    print(f"\n[{short}] {full_name} - snow map for {end_date.date()} "
          f"(window {LOOKBACK_DAYS}d ending {end_date.date()}, water_mask={mask_water})")

    fc, geom = _province_geom(full_name)
    snow_img = build_snow_image(geom, end_date, mask_water=mask_water)

    print(f"[{short}] computing stats at 500 m...")
    stats = snow_stats(snow_img, geom)
    print(f"[{short}]   mean NDSI    : {stats['mean_ndsi']}")
    print(f"[{short}]   valid clear  : {stats['valid_km2']:,.0f} km^2")
    print(f"[{short}]   snow >= 40   : {stats['snow_km2']:,.0f} km^2  ({stats['snow_pct']}%)")

    bounds = _bounds_of(geom)
    record = {
        "province": full_name,
        "code": short,
        "kind": "province",
        "date_utc": end_date.strftime("%Y-%m-%d"),
        "stats": stats,
        "water_masked": mask_water,
        "source": ["MODIS/061/MOD10A1", "MODIS/061/MYD10A1"]
                  + (["JRC/GSW1_4/GlobalSurfaceWater"] if mask_water else []),
        "boundary": "FAO/GAUL/2015/level1",
        "bounds": bounds,
    }

    for target_dir in (OUT_DIR, PUBLIC_DIR):
        date_dir = target_dir / end_date.strftime("%Y-%m-%d")
        date_dir.mkdir(parents=True, exist_ok=True)
        png = date_dir / f"{short.lower()}-snow.png"
        js = date_dir / f"{short.lower()}-stats.json"
        nbytes = render_thumbnail(snow_img, png, geom.bounds())
        js.write_text(json.dumps(record, indent=2))
        print(f"[{short}] wrote {png.relative_to(REPO_ROOT)} ({nbytes/1024:.1f} KB)")

    record["image_path"] = f"{end_date.strftime('%Y-%m-%d')}/{short.lower()}-snow.png"
    return record


def render_prairie(end_date: datetime, *, mask_water: bool) -> dict:
    print(f"\n[PR] Prairie composite (AB/SK/MB) for {end_date.date()} "
          f"(window {LOOKBACK_DAYS}d, water_mask={mask_water})")

    fc = ee.FeatureCollection("FAO/GAUL/2015/level1").filter(
        ee.Filter.inList("ADM1_NAME", ["Alberta", "Saskatchewan", "Manitoba"]))
    if fc.size().getInfo() != 3:
        raise SystemExit("ABORT: expected 3 prairie provinces from FAO/GAUL.")
    geom = fc.geometry()

    snow_img = build_snow_image(geom, end_date, mask_water=mask_water)

    print(f"[PR] computing aggregate stats at 500 m...")
    stats = snow_stats(snow_img, geom)
    print(f"[PR]   mean NDSI    : {stats['mean_ndsi']}")
    print(f"[PR]   valid clear  : {stats['valid_km2']:,.0f} km^2")
    print(f"[PR]   snow >= 40   : {stats['snow_km2']:,.0f} km^2  ({stats['snow_pct']}%)")

    bounds = _bounds_of(geom)
    record = {
        "province": "Prairie composite",
        "code": "PR",
        "kind": "composite",
        "date_utc": end_date.strftime("%Y-%m-%d"),
        "stats": stats,
        "water_masked": mask_water,
        "source": ["MODIS/061/MOD10A1", "MODIS/061/MYD10A1"]
                  + (["JRC/GSW1_4/GlobalSurfaceWater"] if mask_water else []),
        "boundary": "FAO/GAUL/2015/level1 (AB+SK+MB union)",
        "bounds": bounds,
    }

    for target_dir in (OUT_DIR, PUBLIC_DIR):
        date_dir = target_dir / end_date.strftime("%Y-%m-%d")
        date_dir.mkdir(parents=True, exist_ok=True)
        png = date_dir / "prairie-snow.png"
        js = date_dir / "prairie-stats.json"
        nbytes = render_thumbnail(snow_img, png, geom.bounds(), dimensions=PRAIRIE_THUMBNAIL_PX)
        js.write_text(json.dumps(record, indent=2))
        print(f"[PR] wrote {png.relative_to(REPO_ROOT)} ({nbytes/1024:.1f} KB)")

    record["image_path"] = f"{end_date.strftime('%Y-%m-%d')}/prairie-snow.png"
    return record


# ---------- manifest + HTML viewer ------------------------------------------

def update_manifest(date_utc: str, records: dict) -> None:
    """Append/update one date's entry in out/snow_maps/manifest.json (source
    of truth) and mirror to public/snow/manifest.json (fast-iteration copy).

    Reads existing manifest from OUT_DIR (source of truth). The build script
    copies out/snow_maps/ -> public/snow/ on every build, so OUT_DIR is the
    authoritative version; PUBLIC_DIR is overwritten in lockstep here for
    same-process consistency without requiring a build.
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    src_path = OUT_DIR / "manifest.json"
    if src_path.exists():
        manifest = json.loads(src_path.read_text())
    else:
        manifest = {
            "updated_at": None,
            "schedule": {"cadence": "weekly", "dow": "Sunday", "time_utc": "09:00"},
            "dates": {},
        }
    manifest.setdefault("schedule", {"cadence": "weekly", "dow": "Sunday", "time_utc": "09:00"})
    # MERGE (not replace) so a partial run like `python snow_map.py sk` only
    # updates the SK key for that date and leaves AB/MB/PR untouched. Codex
    # ab24cb625ed84faa0 review WARN: replacing the dict orphans other records.
    existing = manifest.setdefault("dates", {}).get(date_utc, {}) or {}
    existing.update({records[k]["code"].lower(): records[k] for k in records})
    manifest["dates"][date_utc] = existing
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    payload = json.dumps(manifest, indent=2)

    for target in (OUT_DIR, PUBLIC_DIR):
        (target / "manifest.json").write_text(payload)
    print(f"\nupdated manifest: {src_path.relative_to(REPO_ROOT)} (mirrored to public/)")


def write_index_html() -> None:
    """Write index.html to BOTH out/snow_maps/ and public/snow/.

    Idempotent. The HTML reads manifest.json at runtime via fetch and
    renders entirely with DOM methods (no innerHTML) for safety.
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for target in (OUT_DIR, PUBLIC_DIR):
        (target / "index.html").write_text(_INDEX_HTML, encoding="utf-8")
    print(f"wrote index.html to out/snow_maps/ and public/snow/")


_INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prairie Snow Watcher | Monette</title>
  <link rel="icon" href="../favicon.svg">
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2028;
      --panel-2: #232b35;
      --ink: #e6ecf2;
      --ink-2: #94a3b8;
      --accent: #5b9bd5;
      --warm: #d2b48c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      line-height: 1.5;
    }
    header {
      padding: 32px 28px 18px;
      border-bottom: 1px solid var(--panel-2);
      background: linear-gradient(180deg, #1a2735 0%, var(--bg) 100%);
    }
    header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; letter-spacing: 0.2px; }
    header .sub { color: var(--ink-2); font-size: 14px; }
    header .schedule {
      margin-top: 14px; display: inline-flex; gap: 16px; flex-wrap: wrap;
      padding: 10px 14px; background: var(--panel); border-radius: 8px;
      border: 1px solid var(--panel-2); font-size: 13px;
    }
    header .schedule b { color: var(--accent); }
    main { padding: 24px 28px 60px; max-width: 1400px; margin: 0 auto; }

    .latest-grid {
      display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      margin-bottom: 38px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--panel-2);
      border-radius: 10px;
      overflow: hidden;
      display: flex; flex-direction: column;
    }
    .card .head {
      padding: 12px 14px;
      display: flex; justify-content: space-between; align-items: baseline;
      border-bottom: 1px solid var(--panel-2);
    }
    .card .head h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .card .head .pct { font-size: 18px; font-weight: 700; color: var(--accent); }
    .card .img-wrap {
      background: #0a0e12;
      display: flex; justify-content: center; align-items: center;
      aspect-ratio: 1 / 1.1;
      overflow: hidden;
    }
    .card .img-wrap img { width: 100%; height: 100%; object-fit: contain; }
    .card .stats {
      padding: 10px 14px; font-size: 12px; color: var(--ink-2);
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px;
    }
    .card .stats span.k { color: var(--ink-2); }
    .card .stats span.v { color: var(--ink); font-variant-numeric: tabular-nums; }

    .prairie-card { grid-column: span 2; }
    @media (max-width: 800px) { .prairie-card { grid-column: span 1; } }

    .timeseries {
      background: var(--panel); border: 1px solid var(--panel-2); border-radius: 10px;
      overflow: hidden; margin-bottom: 38px;
    }
    .timeseries h2 {
      margin: 0; padding: 14px 18px; font-size: 14px; font-weight: 600;
      border-bottom: 1px solid var(--panel-2);
    }
    .timeseries table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .timeseries th, .timeseries td {
      padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--panel-2);
    }
    .timeseries th { color: var(--ink-2); font-weight: 500; font-size: 12px; }
    .timeseries td.num { font-variant-numeric: tabular-nums; text-align: right; }
    .timeseries tr:last-child td { border-bottom: none; }
    .timeseries tr:hover td { background: var(--panel-2); cursor: pointer; }
    .timeseries .selected td { background: rgba(91, 155, 213, 0.12); }

    footer {
      color: var(--ink-2); font-size: 12px; line-height: 1.7;
      padding: 24px 28px; border-top: 1px solid var(--panel-2);
    }
    footer code {
      background: var(--panel); padding: 1px 5px; border-radius: 3px;
      font-size: 11px; color: #c8d4e0;
    }
    footer a { color: var(--accent); }

    .legend {
      display: inline-flex; gap: 8px; align-items: center; font-size: 11px;
      color: var(--ink-2); margin-top: 12px;
    }
    .legend .swatch {
      display: inline-block; width: 14px; height: 14px; border-radius: 3px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <header>
    <h1>Prairie Snow Watcher</h1>
    <div class="sub">MODIS NDSI snow extent across Alberta, Saskatchewan, Manitoba.
      Refreshed weekly to track the spring melt line.</div>
    <div class="schedule" id="schedule">Loading schedule&hellip;</div>
    <div class="legend">
      <span class="swatch" style="background:#d2b48c"></span>0
      <span class="swatch" style="background:#a3c4dc"></span>~30
      <span class="swatch" style="background:#5b9bd5"></span>~65
      <span class="swatch" style="background:#f5f9ff;border:1px solid #444"></span>100
      <span style="margin-left:6px">NDSI snow cover %</span>
    </div>
  </header>
  <main>
    <section>
      <div id="latest-grid" class="latest-grid">Loading&hellip;</div>
    </section>

    <section>
      <div class="timeseries">
        <h2>History &mdash; newest first</h2>
        <table id="ts-table">
          <thead>
            <tr>
              <th>Date (UTC)</th>
              <th>AB land snow %</th>
              <th>SK land snow %</th>
              <th>MB land snow %</th>
              <th>Prairie %</th>
              <th>Mean NDSI</th>
            </tr>
          </thead>
          <tbody id="ts-body"></tbody>
        </table>
      </div>
    </section>
  </main>

  <footer>
    <p><b>Data sources:</b> MODIS C6.1 NDSI snow cover (MOD10A1 Terra + MYD10A1 Aqua,
    daily, 500 m) composited over a 5-day look-back window with newest-pixel-wins
    mosaic; permanent water masked via JRC Global Surface Water 1.4
    <code>max_extent</code> so frozen lakes do not register as land snow.
    Province boundaries from FAO/GAUL/2015/level1.</p>
    <p><b>Caveats:</b> "Snow" here means NDSI &ge; 40, the standard "definite snow"
    threshold. Mid-melt patches with NDSI 15-39 read as "trace" in the colour ramp
    but are not counted in the headline %. AB headline reflects the whole province
    (most snow lives in the Rocky foothills, a small slice). MB clear-pixel coverage
    is lower than AB/SK because of larger water bodies.</p>
    <p><b>Pipeline:</b> regenerate locally with <code>python scripts/snow_map.py all</code>.
    Weekly cron updates this page automatically every Sunday 09:00 UTC.</p>
  </footer>

  <script>
    // timeZone:"UTC" forces formatting in UTC instead of the browser's local
    // timezone — without it, a date like "2026-05-10T00:00:00Z" renders as
    // "May 9, 2026" for any browser west of UTC because midnight-UTC is the
    // previous calendar day locally.
    const FMT = new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" });

    function fmtDate(s) { return FMT.format(new Date(s + "T00:00:00Z")); }

    function nextSunday(refUTCDate) {
      // 0 = Sunday (UTC). Returns the next Sunday after refUTCDate at 09:00 UTC.
      const d = new Date(refUTCDate);
      const dow = d.getUTCDay();
      const add = dow === 0 ? 7 : (7 - dow);
      d.setUTCDate(d.getUTCDate() + add);
      d.setUTCHours(9, 0, 0, 0);
      return d;
    }

    function el(tag, attrs, ...children) {
      const node = document.createElement(tag);
      if (attrs) {
        for (const k of Object.keys(attrs)) {
          if (k === "class") node.className = attrs[k];
          else if (k === "text") node.textContent = attrs[k];
          else if (k.startsWith("on")) node.addEventListener(k.slice(2), attrs[k]);
          else node.setAttribute(k, attrs[k]);
        }
      }
      for (const c of children) {
        if (c == null) continue;
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      }
      return node;
    }

    function pct(rec) {
      if (!rec || !rec.stats || rec.stats.snow_pct == null) return "—";
      return rec.stats.snow_pct.toFixed(2) + "%";
    }

    function setSchedule(latestDate, schedCfg) {
      const next = nextSunday(new Date(latestDate + "T00:00:00Z"));
      const today = new Date();
      const daysUntil = Math.ceil((next.getTime() - today.getTime()) / (24 * 3600 * 1000));
      const cadence = (schedCfg && schedCfg.cadence) || "weekly";
      const dow = (schedCfg && schedCfg.dow) || "Sunday";
      const tutc = (schedCfg && schedCfg.time_utc) || "09:00";

      const node = document.getElementById("schedule");
      node.replaceChildren();

      const a = el("span", null);
      a.appendChild(el("b", { text: "Latest: " }));
      a.appendChild(document.createTextNode(fmtDate(latestDate)));
      node.appendChild(a);

      const b = el("span", null);
      b.appendChild(el("b", { text: "Cadence: " }));
      b.appendChild(document.createTextNode(cadence + " · " + dow + " " + tutc + " UTC"));
      node.appendChild(b);

      const c = el("span", null);
      c.appendChild(el("b", { text: "Next: " }));
      const days = daysUntil >= 0
        ? "(in " + daysUntil + " day" + (daysUntil === 1 ? "" : "s") + ")"
        : "(" + (-daysUntil) + "d ago — late!)";
      c.appendChild(document.createTextNode(FMT.format(next) + " " + days));
      node.appendChild(c);
    }

    function buildCard(date, key, rec) {
      const card = el("div", { class: "card" + (key === "pr" ? " prairie-card" : "") });

      const head = el("div", { class: "head" });
      head.appendChild(el("h3", { text: rec.province }));
      head.appendChild(el("span", { class: "pct", text: pct(rec) }));
      card.appendChild(head);

      const wrap = el("div", { class: "img-wrap" });
      const imgKey = key === "pr" ? "prairie" : key;
      wrap.appendChild(el("img", {
        src: date + "/" + imgKey + "-snow.png",
        alt: rec.province + " snow " + date,
      }));
      card.appendChild(wrap);

      const stats = el("div", { class: "stats" });
      const rows = [
        ["snow ≥ 40", rec.stats.snow_km2.toLocaleString() + " km²"],
        ["clear pixels", rec.stats.valid_km2.toLocaleString() + " km²"],
        ["mean NDSI", String(rec.stats.mean_ndsi)],
        ["basis", rec.water_masked ? "land snow" : "any snow/ice"],
      ];
      for (const [k, v] of rows) {
        stats.appendChild(el("span", { class: "k", text: k }));
        stats.appendChild(el("span", { class: "v", text: v }));
      }
      card.appendChild(stats);

      return card;
    }

    function renderLatest(date, entry) {
      const grid = document.getElementById("latest-grid");
      grid.replaceChildren();
      const order = ["pr", "ab", "sk", "mb"];
      for (const k of order) {
        if (!entry[k]) continue;
        grid.appendChild(buildCard(date, k, entry[k]));
      }
    }

    function renderTimeseries(allDates, manifest, latestDate) {
      const tbody = document.getElementById("ts-body");
      tbody.replaceChildren();
      for (const d of allDates) {
        const e = manifest.dates[d];
        const tr = el("tr", { class: d === latestDate ? "selected" : "" });
        tr.addEventListener("click", () => {
          for (const sib of tbody.children) sib.classList.remove("selected");
          tr.classList.add("selected");
          renderLatest(d, e);
        });
        const cells = [
          [d, false],
          [pct(e.ab), true],
          [pct(e.sk), true],
          [pct(e.mb), true],
          [pct(e.pr), true],
          [e.pr ? String(e.pr.stats.mean_ndsi) : "—", true],
        ];
        for (const [text, num] of cells) {
          tr.appendChild(el("td", { class: num ? "num" : "", text }));
        }
        tbody.appendChild(tr);
      }
    }

    async function load() {
      const grid = document.getElementById("latest-grid");
      let m;
      try {
        const res = await fetch("manifest.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        m = await res.json();
      } catch (err) {
        grid.replaceChildren(document.createTextNode(
          "manifest.json missing — run `python scripts/snow_map.py all`. (" + err.message + ")"
        ));
        return;
      }
      const dates = Object.keys(m.dates || {}).sort().reverse();
      if (!dates.length) {
        grid.replaceChildren(document.createTextNode("No snapshots yet."));
        return;
      }
      const latest = dates[0];
      setSchedule(latest, m.schedule);
      renderLatest(latest, m.dates[latest]);
      renderTimeseries(dates, m, latest);
    }

    load();
  </script>
</body>
</html>
"""


# ---------- CLI -------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "scope",
        choices=list(PROVINCES) + list(ALIASES) + ["prairie", "all"],
        help="province key, 'prairie' for the AB+SK+MB composite, or 'all' for the full set",
    )
    p.add_argument("--date", default=None,
                   help="UTC date YYYY-MM-DD anchoring the look-back (default: today UTC)")
    p.add_argument("--no-water-mask", action="store_true",
                   help="skip JRC GSW permanent-water mask (lake ice will count as snow)")
    args = p.parse_args()

    end_date = (datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if args.date else datetime.now(timezone.utc))
    mask_water = not args.no_water_mask

    print(f"GEE auth source: {auth_source()}")
    initialize()
    print(f"GEE initialized; project = monette-494717")

    records: dict = {}

    if args.scope == "all":
        for prov in PROVINCES.keys():
            r = render_province(prov, end_date, mask_water=mask_water)
            records[r["code"].lower()] = r
        r = render_prairie(end_date, mask_water=mask_water)
        records[r["code"].lower()] = r
    elif args.scope == "prairie":
        r = render_prairie(end_date, mask_water=mask_water)
        records[r["code"].lower()] = r
    else:
        r = render_province(args.scope, end_date, mask_water=mask_water)
        records[r["code"].lower()] = r

    if records:
        update_manifest(end_date.strftime("%Y-%m-%d"), records)
    write_index_html()

    print("\ndone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
