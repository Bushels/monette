# Codex Independent Audit — Montana Parcels (Random Stratified Sample)

**Date:** 2026-05-06
**Codex effort:** medium (project pin) — routine cross-checking, not architecture
**Decision owner:** Kyle, with Codex providing independent verification

---

## Background

The Monette satellite seeding pipeline currently maps 220 owned cadastral parcels in Montana (Big Horn County) under `OwnerName='MONETTE FARMS USA INC'`. Today's internal audit (`scripts/_montana_audit_2026_05_06.py`) confirms:

- Geometry placement is internally consistent with cadastral baseline (51.7k computed ac vs 51.5k cadastral assessed ac vs 51.7k cadastral GIS ac)
- 220 polygons, mean centroid 45.602°N / -107.804°W
- Live GEE smoke today on 3 representative parcels confirmed fresh 2026-05-01 SAR scene available, no snow vetoes, strong-seeded calls hold

**Purpose of this audit:** independent cross-check by Codex against external/web-verifiable Big Horn County reality. Different validation surface than our internal consistency check. Specifically test whether our parcels' computed coordinates and CDL classifications match independent reality.

---

## What you are auditing

A stratified random sample of 6 Montana parcels — one per signal regime — from the Monette pipeline, saved at `docs/superpowers/specs/2026-05-06-montana-parcel-audit-data.json`. Each parcel includes:

- `loc` — PLSS legal description (e.g. `T02S-R31E-S05-22082805404010000`)
- `twp`, `twp_dir`, `rng`, `rng_dir`, `sec` — parsed PLSS components
- `computed_centroid` — `[lat, lng]` derived by our pipeline from PLSS math
- `computed_area_ac` — polygon area in acres via shoelace formula
- `cropland_coverage` — fraction of polygon pixels classified as cropland in USDA CDL 2025
- `polygon_quality` — `high` if cropland_coverage ≥ 0.50, else `low`
- `prior_crop` — modal CDL class within the polygon
- `applicability` — pipeline classification (`active`, `out-of-season`, `perennial`, `insufficient_baseline`)
- `seeded_call`, `confidence`, `dvh_db`, `last_obs_date` — current SAR-derived seeding decision

---

## Per-parcel checks (do all six)

For each of the 6 parcels in the JSON, perform these independent verifications. **Use web search liberally** — that is exactly the value-add we want from this audit.

### Geographic reality check
1. Does the computed centroid actually fall in **Big Horn County, Montana**? (Cross-reference county boundaries — Big Horn County roughly spans 45.0-45.95°N, -107.05 to -108.50°W.)
2. Is the PLSS legal description (T/R/S) consistent with that centroid? Use the BLM/USGS GeoCommunicator or any other PLSS lookup to verify the township and range fall in Big Horn County. Note: **Montana Principal Meridian** (MPM) baseline is at 45.787°N, -111.659°W. T02S R31E means 2 townships south of baseline, 31 ranges east of MPM — this should put the parcel near the eastern edge of Montana.
3. Is the `rng_dir` ("E" — east of MPM) sensible for a Big Horn County location? Big Horn is in southeastern Montana — Range East of the MPM is correct, but flag if anything looks anomalous.

### Acreage sanity
4. Does `computed_area_ac` match the expected size for a PLSS subdivision based on the `loc` string structure? Standard sizes: full section = 640 ac, half = 320, quarter = 160, quarter-quarter = 40. Our `loc` strings end in cadastral parcel ID suffixes (e.g. `22082805404010000`) — the suffix is a Montana Department of Revenue / DNRC parcel identifier, not a PLSS aliquot. So areas can be irregular. Flag any obvious mismatch (e.g. a parcel claiming to be a quarter section but with area > 200 ac).
5. The 38.6 ac and 40.1 ac parcels (low_pq stratum) are roughly a quarter-quarter — verify these centroids are consistent with sub-parcel geometry.

### Crop/applicability sanity
6. Given the centroid coordinates, would you expect this land to be cropland or grassland? Use any imagery you can find (Google Maps, NAIP, etc.) to spot-check.
7. Does the `prior_crop` classification (e.g. `winter_wheat`, `pasture_grass`, `unknown`) make sense for the location? If the CDL says `pasture_grass` for a parcel near irrigated bottomland, flag it. If the CDL says `winter_wheat` for a hillside that visually looks like rangeland, flag it.
8. The `applicability` is derived in `scripts/gee_pipeline/applicability.py`:
   - `perennial` if crop is alfalfa/pasture/hay
   - `out-of-season` if crop is winter_wheat in a spring run
   - `active` otherwise
   Verify each parcel's applicability matches its `prior_crop`.

### Seeded-call sanity
9. For parcels with `seeded_call=True`: does it make sense that this land was seeded in spring 2026? Time of year + crop type + location should all support the claim.
10. For parcels with `seeded_call=None` and `applicability=active`: the SAR signal was inconclusive. Sanity-check: does this look like land where a farmer would seed annually?

### Identify red flags
11. Any parcel where you would NOT trust our pipeline's call? Why?
12. Any parcel where the PLSS-to-coordinate math looks wrong by more than ~500 m?

---

## Reference materials (in this repo)

- Polygon construction logic: `.claude/skills/farmland-legal-descriptions/SKILL.md` (the PLSS math we use)
- Internal audit script: `scripts/_montana_audit_2026_05_06.py`
- Internal audit run output: see methodology log at `docs/logs/seeding-calibration.md`
- Pipeline applicability rules: `scripts/gee_pipeline/applicability.py`
- Decision rule: `scripts/gee_pipeline/decision_rule.py`
- Methodology log: `docs/logs/seeding-calibration.md`
- Known caveats: `docs/references/satellite-imagery-seeding-detection-2026-05-04.md`

---

## Output format

For each parcel, produce a section with:

```
### Parcel <stratum>: <loc>

**Geographic check:** [PASS/FLAG/FAIL] — [one sentence with cite if FLAG/FAIL]
**Acreage check:** [PASS/FLAG/FAIL] — [one sentence]
**Crop/applicability check:** [PASS/FLAG/FAIL] — [one sentence]
**Seeded-call sanity:** [PASS/FLAG/FAIL] — [one sentence]
**Notes:** [optional, anything else worth surfacing]
```

End with a **Summary section** that:
1. Counts PASS / FLAG / FAIL across all 24 checks (6 parcels × 4 categories)
2. Lists any systemic issues (patterns across multiple parcels)
3. Gives a single overall verdict: do you trust the Montana pipeline output as of 2026-05-06? (yes / yes-with-caveats / no — and if not, what would change your mind)

Cite all web sources used. Keep total response under 2,000 words.
