# PROJECT_STATE.md

## Last verified production state
- `main`: `41add24` — current Hammond prices, price-on-hover Atlas UX, homepage routing, and retired Register navigation.
- Vercel production deployment: `HiEREkUo8JaiyRaojg3s1FqMVow2` at `https://monette.buperac.com`.

## Active task
**IMPLEMENTED + VERIFIED LOCALLY (2026-07-15): Montana and Colorado portfolio mapping; deployment not yet performed.**
The active map data separates Premier's five public packages from the Montana
umbrella and now maps Clark's current Monette Farm & Ranch offering to all six
current Lincoln County Colorado assessor accounts. Montana retains source-backed
DNRC/DOR geometry; Colorado uses assessor legal descriptions plus BLM PLSS
geometry. Unproven leased or partnership boundaries are not fabricated.

## Current public Atlas state
- Atlas is the homepage. The retired Register route redirects to `#map`.
- Hovering a publicly priced property shows its asking price; clicking opens the
  full package breakdown and broker links.
- The top navigation and Atlas toolbar derive their sales totals from the same
  per-property records used by the map and drawer.
- Hammond inventory checked 2026-07-14: 18 farmland packages, 132,019.08 broker-
  listed acres, and $773,851,040 CAD total asking price.
- The separate $10,000,000 Swift Current processing-facility listing is not
  attached to the atlas's 49,775-acre Swift Current land rollup.
- Public binding-bid deadline: 2026-10-15; target closing: 2026-11-30.

## SK Titles shipped state
- 559/559 CSV parcels reconciled (unmatched: 0).
- 1,410 records across 14 SK property buckets carry `mflTitleSnapshot` metadata.
- Swift Current has 28 records; Regina South has 120 records.
- 159 polygons are computed through DLS quarter math, LSD math, and Plan N3619
  placeholders.
- The runtime audit asserts `property_id:loc` uniqueness across all 1,410 rows.
- Farmland-wide marker cleanup remains in place; facility and sold-asset markers
  remain visible.

## SISP evidence rules
- Solid gold outlines require a confirmed listing and source-backed parcel tenure.
- Provisional outlines identify likely in-scope land without a public asking price.
- Dominant-owner inference, hash fallbacks, and synthetic parcels do not receive a
  confirmed for-sale outline.
- Broker acreage and atlas file acreage remain separate wherever they differ.

## Known data gaps
1. Eddystone's quarter-owner keys do not match parcel locations and the source
   table is incomplete; its parcels cannot carry evidence-backed SISP outlines.
2. Raymore has no quarter-owner table, so its public package prices are shown at
   property level without quarter-specific sale outlines.
3. Several point-only or synthetic properties still need defensible parcel geometry.

## Working-tree exclusions
The existing untracked SK-title log directory, two planning documents, and two dust
visualization scripts were not included in this production merge.

## Montana portfolio mapped state
- Premier live check on 2026-07-15: `$96,000,000`, `53,751` deeded, `38,441`
  leased, `92,193` total, and `63,049` seeded acres.
- Premier's own visible arithmetic is inconsistent: deeded + leased = `92,192`;
  the five displayed child totals sum to `92,191`. Preserve the published cells
  and expose the `1–2 ac` source delta.
- DNRC owner-query geometry: 220 parcels / 51,528.893 assessed acres, grouped as
  Fly Creek 95 / 32,557.384 ac; Camp 4 66 / 10,201.820 ac; Camp 1 56 /
  7,982.248 ac; Pivot 3 / 787.441 ac.
- No leased-land geometry is inferred from marketing totals.
- `npm run validate:montana` is the deployment gate for IDs, acreage arithmetic,
  parent/child separation, polygon assignment, and the point-only rail rule.

## Colorado portfolio mapped state
- Clark live check on 2026-07-15: `$5,106,250 USD`, `4,085±` total acres,
  `3,085` organic farm-ground acres, and `1,000` native-grass acres.
- Lincoln County EagleWeb returns six current accounts under `MONETTE FARMS USA,
  INC., A MONTANA CORPORATION`, totaling exactly `4,085` assessed acres.
- BLM CadNSDI geometry covers all six account legal descriptions. Two account
  features are multi-part. `S2SW4 Sec 18` and `NW4 Sec 4` are bbox-derived
  aliquots labelled as portfolio-scale, non-survey boundaries.
- Helkaa ¶58(e) reports `4,079` acres. Preserve the `6 ac` source-method delta;
  do not force the court and current assessor/broker figures to match.
- `npm run validate:colorado` checks the offering, account set, acreage, runtime
  MultiPolygon payload, source dates, and discrepancy disclosure.

## Next ship gate
The production build, Montana validator, Colorado validator, and browser QA pass.
Push `main` and deploy the combined Montana/Colorado map changes; production
remains at the last verified state above until that happens.
