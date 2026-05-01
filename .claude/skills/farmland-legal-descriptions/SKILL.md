---
name: farmland-legal-descriptions
description: How to parse and render Canadian DLS and US PLSS legal land descriptions (e.g. "NE-10-11-10-W3", "T04S-R31E-S26") into Mapbox GL polygons. Use this skill whenever the task involves mapping farmland, computing parcel polygons from legal descriptions, working with township/range/section grids, Saskatchewan/Manitoba/Alberta land titles, or Montana PLSS data. Also use when a user mentions quarter sections, sections, townships, ranges, meridians, aliquots, parish lots, or wants to visualize agricultural property boundaries on a map — even when they don't explicitly reference DLS or PLSS.
---

# Farmland Legal Descriptions → Map Polygons

Parsing farmland is tricky because the legal description systems are old (DLS from 1871, PLSS from 1785), survey-format-dependent, and full of subtle encoding variations that break naive regex. This skill captures the math, the formats, the parsing strategy, and the real-world gotchas.

## TL;DR decision tree

```
Is the input a Canadian legal description?
├── Looks like "NE-10-11-10-W3" → DLS standard (SK/AB)
├── Looks like "SW35-25-12W"    → DLS compact (MB)
├── Looks like "RL70-PQ-4734"   → Red River parish lot (MB) — NOT resolvable by math
└── Looks like a PID / title #  → NOT a location

Is the input a US legal description?
├── "T04S R31E S26" or "04 S | 31 E | 26" (split cols) → PLSS
├── "S26, T04 S, R31 E, ACRES 80, N2SW4" → PLSS with aliquot — section polygon OK, aliquot needs extra work
└── Anything else → reject
```

## Dominion Land Survey (DLS) — Canada

The DLS covers Manitoba, Saskatchewan, Alberta, and parts of BC. It's a rectangular grid measured from principal meridians.

### Grid hierarchy

```
Meridian (W1..W6)    — vertical reference line
   └── Range (1..30+)    — 6-mile bands going WEST from the meridian
       └── Township (1..~130)   — 6-mile bands going NORTH from 49°N baseline
           └── Section (1..36)   — 1-mile² cells, snake-numbered inside township
               └── Quarter (NE|NW|SE|SW)   — 0.5-mile² corners
                   └── LSD (1..16)   — 0.25-mile² cells (rarely used for mapping)
```

### Meridian longitudes (authoritative)

| Meridian | Longitude       | Notes |
|----------|-----------------|-------|
| W1       | −97°27′28.41″   | ≈ −97.4573° — runs just east of Winnipeg; NOT an integer |
| W2       | −102° exactly   | Eastern SK |
| W3       | −106° exactly   | Central SK |
| W4       | −110° exactly   | SK/AB provincial boundary |
| W5       | −114° exactly   | Central AB |
| W6       | −118° exactly   | Western AB |

### Section numbering (snake pattern)

Section 1 is at the **SE corner** of the township. Numbering snakes west across row 0, then east across row 1, etc.:

```
Row 5 (north): 31 32 33 34 35 36
Row 4:         30 29 28 27 26 25
Row 3:         19 20 21 22 23 24
Row 2:         18 17 16 15 14 13
Row 1:          7  8  9 10 11 12
Row 0 (south):  6  5  4  3  2  1
              W←  (section 1 is E)  →E
```

Rule: even-indexed rows (0, 2, 4 from south) go **east→west**; odd rows go **west→east**.

### Standard SK/AB format

`NE-10-11-10-W3` means:
- Quarter: NE
- Section: 10
- Township: 11 (north of 49°N, so ≈ 49° + 10×6mi ≈ 49.87°)
- Range: 10 (west of W3, so ≈ −106° − 9×6mi, with cos(lat) correction)
- Meridian: W3

Regex: `^\s*(NE|NW|SE|SW)-(\d{1,2})-(\d{1,3})-(\d{1,3})-(W[1-6])\s*$`

### Manitoba compact format

`SW35-25-12W` — quarter and section run together, and the meridian number is dropped (MB is almost entirely W1 of the Principal Meridian). Default to W1.

Regex: `^\s*(NE|NW|SE|SW)(\d{1,2})-(\d{1,3})-(\d{1,3})(W[1-6]?)?\s*$`

### Whole-section and half-section fallbacks (MB)

Some LLDs don't specify a quarter — just a section-level descriptor like `S26-24-12W` or `E33-25-12W`. These resist quarter-level rendering; emit as a **full 1-mile section square**. The fallback regex accepts any single-letter directional prefix:

`^\s*(?:[NSEW]|N½|S½|E½|W½)(\d{1,2})-(\d{1,3})-(\d{1,3})(W[1-6]?)?\s*$`

## Public Land Survey System (PLSS) — USA

Montana, Wyoming, and most western US states use PLSS. Same 6×6-mile township / 1-mile-section grid as DLS but:

- **Multiple meridians per state.** Montana has the Montana Principal Meridian (−111.6592° W, baseline 45.7870° N). There's also the Great Falls baseline. Always check which meridian applies.
- **Townships go both N and S of baseline.** `T04S` = 4 townships south of baseline. `T01N` = just north of baseline.
- **Ranges go both E and W of meridian.** `R31E` = 31 ranges east. `R15W` would be west.

### Montana format variants in the wild

Source data varies wildly. All of these mean "Section 26, Township 4 South, Range 31 East of MPM":

- Split columns: `Township="04 S"`, `Range="31 E"`, `Section="26"`
- Legal description field: `"S26, T04 S, R31 E"`
- Compact: `"T04S-R31E-S26"`, `"T4S R31E S26"`

**Gotcha**: the raw XLSX may have "04 S" (space-separated) or "04S" (no space). Split on whitespace, strip, and uppercase.

### Aliquot sub-parcels (PLSS only)

PLSS assessor data often includes **aliquot** descriptors:

- `N2SW4` = North half of the Southwest quarter = 80 acres
- `SE4SE4` = Southeast ¼ of the Southeast ¼ = 40 acres
- `W2` = West half of section = 320 acres

One section can appear multiple times in the source (once per aliquot owned). For mapping at section granularity, **dedupe by (twp, rng, sec)** and sum the acres. For aliquot-level precision, parse the aliquot string and subdivide — that's more work and usually unnecessary for overview zoom levels.

## Red River Parish Lots (Manitoba) — NOT resolvable by math

Parcels in The Pas, Selkirk, and the old Red River Settlement use a **narrow river-lot survey** from 1835. Format: `RL70-PQ-4734`. These are long, thin strips running perpendicular to a river, irregular in size and orientation. **There is no township/range math that produces them.** You need GIS data (shapefiles from the provincial cadastre) or a fallback to property-center markers.

## Polygon math (first-principles, no GIS library)

### Earth → degrees

```python
MILE_KM = 1.609344
EARTH_KM_PER_DEG_LAT = 111.1949  # mean

def mi_to_deg_lat(mi):
    return (mi * MILE_KM) / EARTH_KM_PER_DEG_LAT

def mi_to_deg_lng(mi, at_lat_deg):
    import math
    return (mi * MILE_KM) / (EARTH_KM_PER_DEG_LAT * math.cos(math.radians(at_lat_deg)))
```

Use the **centre latitude of the parcel** for the lng conversion, not a fixed latitude. This keeps each quarter's aspect ratio correct at its actual location.

### DLS quarter-section polygon

```python
DLS_MERIDIAN_LNG = {"W1": -97.4573361, "W2": -102.0, "W3": -106.0,
                    "W4": -110.0, "W5": -114.0, "W6": -118.0}
DLS_BASELINE_LAT = 49.0

def dls_section_to_grid(section):
    """Section 1 = SE corner. Snake numbering: even rows E→W, odd rows W→E."""
    row_from_south = (section - 1) // 6
    pos_in_row = (section - 1) % 6
    if row_from_south % 2 == 0:
        col_from_west = 5 - pos_in_row
    else:
        col_from_west = pos_in_row
    return col_from_west, row_from_south

def dls_quarter_polygon(qtr, section, township, rng, meridian):
    sec_col_w, sec_row_s = dls_section_to_grid(section)
    q_off = {"SW": (0,0), "SE": (1,0), "NW": (0,1), "NE": (1,1)}
    q_col_w, q_row_s = q_off[qtr]

    # Latitudes (no cos correction needed for lat)
    twp_south_lat = DLS_BASELINE_LAT + mi_to_deg_lat((township - 1) * 6)
    sec_south_lat = twp_south_lat + mi_to_deg_lat(sec_row_s)
    q_south_lat = sec_south_lat + mi_to_deg_lat(q_row_s * 0.5)
    q_north_lat = q_south_lat + mi_to_deg_lat(0.5)

    # Longitudes, scaled by this quarter's centre latitude
    centre_lat = (q_south_lat + q_north_lat) / 2
    mi_lng = lambda m: mi_to_deg_lng(m, centre_lat)
    meridian_lng = DLS_MERIDIAN_LNG[meridian]
    range_east_lng = meridian_lng - mi_lng((rng - 1) * 6)
    sec_east_lng = range_east_lng - mi_lng(5 - sec_col_w)
    q_east_lng = sec_east_lng - mi_lng(0.5 * (1 - q_col_w))
    q_west_lng = q_east_lng - mi_lng(0.5)

    # Closed CCW ring starting at SW
    return [
        [q_west_lng, q_south_lat],
        [q_east_lng, q_south_lat],
        [q_east_lng, q_north_lat],
        [q_west_lng, q_north_lat],
        [q_west_lng, q_south_lat],
    ]
```

### PLSS section polygon (Montana flavor)

Same math, different constants and direction handling:

```python
MT_PM_LNG = -111.6592
MT_PM_LAT = 45.7870

def mt_section_polygon(section, twp_n, twp_dir, rng_n, rng_dir):
    # Township direction from baseline
    if twp_dir.upper() == "N":
        twp_south_lat = MT_PM_LAT + mi_to_deg_lat((twp_n - 1) * 6)
    else:  # 'S'
        twp_south_lat = MT_PM_LAT - mi_to_deg_lat(twp_n * 6)

    sec_col_w, sec_row_s = dls_section_to_grid(section)  # same snake layout
    sec_south_lat = twp_south_lat + mi_to_deg_lat(sec_row_s)
    sec_north_lat = sec_south_lat + mi_to_deg_lat(1)

    centre_lat = (sec_south_lat + sec_north_lat) / 2
    mi_lng = lambda m: mi_to_deg_lng(m, centre_lat)

    # Range direction from meridian
    if rng_dir.upper() == "E":
        range_east_lng = MT_PM_LNG + mi_lng(rng_n * 6)
    else:  # 'W'
        range_east_lng = MT_PM_LNG - mi_lng((rng_n - 1) * 6)

    sec_east_lng = range_east_lng - mi_lng(5 - sec_col_w)
    sec_west_lng = sec_east_lng - mi_lng(1)

    return [[sec_west_lng, sec_south_lat], [sec_east_lng, sec_south_lat],
            [sec_east_lng, sec_north_lat], [sec_west_lng, sec_north_lat],
            [sec_west_lng, sec_south_lat]]
```

## Gotchas and lessons learned

### 1. **"Parcel count" in owner data ≠ number of quarters**

Owner portfolios typically count **certificates of title**, not distinct quarter-sections. A single title can cover 6–10 quarters. If the source says "27 parcels" but the XLSX has 255 rows, don't assume it's duplicates — it's usually sub-parcel legal rows on each title. Render by unique legal description, not by title.

### 2. **Dedupe by legal-description key, aggregate titled acres**

Multiple rows on the same `(qtr, sec, twp, rng, meridian)` should merge into one polygon:

```python
def aggregate_by_key(records):
    merged = {}
    for r in records:
        key = r["_key"]
        if key in merged:
            merged[key]["title_count"] += 1
            merged[key]["titled_ac"] = safe_sum(merged[key]["titled_ac"], r["titled_ac"])
        else:
            r["title_count"] = 1
            merged[key] = dict(r)
    return list(merged.values())
```

Skip this step and you'll get N overlapping identical polygons drawing on top of each other — invisible in rendering but wasteful and wrong in feature counts.

### 3. **Correction lines are mostly ignorable**

DLS introduces correction lines every 4 townships (every 24 miles N) to compensate for meridian convergence. My first-principles math ignores them and accumulates ~100 m error at T20+ latitudes. **At overview zoom (≤12), this is invisible.** Skip unless you're producing survey-grade output.

### 4. **Default the meridian carefully**

Manitoba's compact format drops the meridian number from LLD strings. Defaulting to W1 works for Manitoba RMs east of Portage la Prairie. For west-of-PM parcels (far western MB), you'll be 4° longitude off. Validate by computing the centroid and comparing to the RM's known location.

### 5. **Village lots don't follow the grid**

Towns and villages inside DLS townships have their own subdivision plans — street grids, not 0.5-mile squares. If the data includes village lots, they'll share a quarter-section legal description with dozens of other lots. Rendering at quarter granularity is still correct (the village sits inside that quarter), but don't mistake the lot count for rural parcel count.

### 6. **Always verify centroid against a known town**

After generating polygons, compute each property's centroid and compare to a reference town (village lat/lng, easily Googled). Expect 10–30 km offset (data-provider anchors vs. parcel-cluster centroids) — that's fine. **Any offset >50 km is a bug.** Common bugs:

| Symptom                                    | Likely cause |
|--------------------------------------------|--------------|
| Centroid ~4° east or west of expected      | Wrong meridian (W1 vs W2, or PM default wrong) |
| Centroid ~6° too far south (Canada)        | Forgot the 49° baseline |
| Centroid hundreds of km off (Montana)      | Township direction (N vs S) flipped or owner metadata stale |
| Polygons form a checkerboard, not a block  | Snake-numbering broken: check even/odd row parity |

### 7. **Expected accuracy for this math**

With the first-principles math above and no correction-line compensation:

- Within ~100 m of true survey corners at T1–T20 (southern prairies)
- Within ~200 m at T30+ (northern prairies)
- Aspect-ratio correct at every latitude (cos-lat scaling per-parcel)

This is well under the Mapbox pixel footprint at zoom ≤12, so the grid appears crisp and correctly aligned at every overview zoom. At zoom ≥13, the offset becomes visible near township edges.

## When to reach for real GIS data instead

Use a real shapefile (ArcGIS, OpenStreetMap, provincial cadastre) when:

- Parish lots or other non-grid surveys are involved (The Pas, Red River)
- You need aliquot-level precision (quarter-quarter, LSD) on large portfolios
- The user needs to cross-reference land titles with official registries
- The visualization zooms to ≥14 where survey jogs become visible

For overview/portfolio visualization at zoom 4–12, the first-principles math is faster, more portable (no shapefile dependencies), and accurate enough.

## Mapbox rendering recipe

Emit as a GeoJSON FeatureCollection. Load with `promoteId: "loc"` so feature-state hover works on the natural key:

```js
map.addSource("parcels", { type: "geojson", data: geojson, promoteId: "loc" });
map.addLayer({
  id: "parcels-fill", type: "fill", source: "parcels",
  paint: {
    "fill-color": ["match", ["get", "property_id"], /* per-owner colors */],
    "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.72, 0.38],
  },
});
map.addLayer({
  id: "parcels-outline", type: "line", source: "parcels",
  paint: {
    "line-color": /* same match */,
    "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 8, 0.8, 11, 1.6],
  },
});
```

Install parcel layers on the **`idle` event**, not `style.load` — the latter fires before `isStyleLoaded()` is true in some Babel-standalone setups, and `once("style.load")` never re-fires. The `idle` event fires after initial load AND after any setStyle, so it's idempotent if your install function guards with `getSource`/`getLayer` checks.

## Quick sanity-check scripts

For DLS: NE-10-11-10-W3 → centroid should be ≈ (49.88°N, −107.28°W) — that's the Vanguard, SK area. Off by >0.5° = something is wrong.

For MT PLSS: T04S-R31E-S26 on MPM → centroid ≈ (45.43°N, −107.64°W) — Big Horn County, SE of Hardin. Off by >1° = direction flip or wrong meridian.
