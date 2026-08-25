# The Monette Ledger - local dev

Run `npm install` once, then double-click `serve.bat`. It compiles the JSX into
plain browser scripts under `build/`, starts Python's HTTP server on port 8765,
and opens http://localhost:8765/.

## Why not just open index.html?

The app now ships precompiled browser scripts instead of Babel running in the
browser, but it still needs HTTP because the page loads sibling assets (`.js`,
GeoJSON, CSS, Mapbox) by URL. Any static server works; `serve.bat` is the
default path.

## Files

- `index.html` - entry point; loads production React UMD, Mapbox GL v3, and the compiled scripts.
- `build/` - generated browser-safe JS files used by local static serving. Rebuilt by `npm run build`.
- `public/` - generated Vercel deploy artifact. Rebuilt by `npm run build`.
- `config.js` - runtime config (Mapbox public token, map styles, home view, Agnonymous discussion URL).
- `data.js` - 30 property records, portfolio court-file totals, point-only geometry flags, operator relationships, sold-asset markers, and public SISP asking-price metadata.
- `creditors-data.js` - generated searchable creditor rows from the FTI creditor listing posted April 24, 2026, with country, province/state, industry, and PDF-total reconciliation fields.
- `imagery-data.js` - generated parcel-imagery payload kept for drawer/plumbing work; not exposed as a public atlas mode right now.
- `quarters-data.js` - generated real parcel geometry loaded from `quarters.geojson`.
- `quarters.js` - merged quarter dataset that combines real parcel rows with any synthetic fallback coverage.
- `scripts/build_quarters_geojson.py` - source generator for DLS/PLSS parcel polygons from the XLSX files.
- `scripts/update_montana_from_cadastral.mjs` - refreshes Montana directly from the public DNRC/DOR cadastral owner query.
- `scripts/build_creditors_data.py` - extracts `docs/Court/Monette Creditor Listing (FTI), posted April 24 2026.pdf` into `creditors-data.js`.
- `scripts/review_quarter_alignment.py` - satellite review helper for parcel alignment checks.
- `scripts/quarter_geometry_calibration.json` - per-property geometry correction file used to tune the generated parcel boxes against satellite.
- `.vercelignore` - excludes internal docs and review artifacts from static deploy uploads.
- `components.jsx` - primitives + shared helpers.
- `quarter-panel.jsx` - read-only quarter row + expanded parcel detail panel.
- `property-drawer.jsx` - right-side property drawer.
- `view-editorial.jsx` / `view-list.jsx` / `view-creditors.jsx` / `view-map.jsx` - the main ledger views.
- `view-dossiers-index.jsx` / `view-dossier.jsx` - dossier roadmap and single-dossier reader.
- `dossiers/index.js` - internal 14-file dossier roadmap. The public page only reveals the next three upcoming dossiers.
- `app.jsx` - top-level shell with hash routing.

## Land Source Hierarchy

Use `docs/Land/Acre Sheet.jpg` as the baseline land inventory. It is the Monette Property Summary and should be treated as the January 2026 starting point for farmed, owned, rented, building replacement value, comp high $/ac, and total land/building value.

Montana exception: use the Montana DNRC/DOR public cadastral owner query as the original title/geometry source of truth for the Big Horn County Montana map. As of the 2026-04-26 pull, `MONETTE FARMS USA INC` returns `220` TaxYear 2026 parcels totaling `51,528.893` assessed acres / `51,711.930` GIS acres. The Acre Sheet's `77,727` farmed acres remains a January 2026 operational/farmed-acre reconciliation overlay, leaving `26,198` acres to identify as rented, differently titled, or otherwise unreconciled.

The [Premier Land Company Monette Portfolio](https://www.premierlandcompany.com/ranch/monette-portfolio/) is the current public **offering** source, not the title-geometry source. It markets five integrated assets for `$96,000,000 USD`: `53,756` deeded acres, `43,436` leased acres, and `97,192` total acres. Keep the umbrella listing separate from child assets and do not map leased acreage without source geometry. The exact next-session reconciliation rules live in `.claude/skills/farmland-legal-descriptions/SKILL.md` and `PROJECT_STATE.md`.

The per-property PDFs and XLSX files in `docs/Land/` are overlays: they show what Monette put for sale, provide quarter/title/geometry detail where available, and help identify later dispositions. Do not use those sale packages to overwrite the baseline unless the app clearly labels the change as a post-baseline sale, vote, or reviewed update.

Current-state changes must be taken away from, or reclassified within, the Acre Sheet baseline. A sold block, returned lease, or reviewed vote is not additive inventory; it reduces or changes the relevant baseline farmed/owned/rented bucket for that property.

Post-baseline state changes live separately:

- `soldProperties` - known sold assets such as Hafford partial and Wymark/Waldeck.
- `operatorRelationships` - partner-owned or co-managed assets such as CypressView/D&R. These are relationship/provenance markers only and are excluded from Monette owned/rented/farmed acreage totals until title, lease, or court evidence proves the acreage treatment.
- Read-only quarter status - reviewed ownership/listing/season observations.
- Property notes/change logs - community or court-file updates that explain why the current map state differs from the January baseline.

In `data.js`, `propertySummary` is the marker that a property is tied back to the Acre Sheet baseline. Records without `propertySummary` are overlay/court-only records until reconciled.

Wymark working rule: start from the Acre Sheet baseline of `21,951` farmed acres. The later Wymark sale/title package maps `14,943.03` acres titled to Monette entities. The Phase 2 Wymark/Waldeck sale subtracts `485` acres from that owned bucket, leaving `14,458.03` current working Monette-owned acres; the remaining `7,007.97` acres are treated as rented/unmapped until lease-quarter legal descriptions are found. Do not paint the sold 485 acres onto specific quarters until the legal descriptions for the three reported Waldeck pieces are confirmed.

## Reference docs

- `PROJECT_STATE.md` - current deployed state, blockers, and next-session objective.
- `docs/logs/seeding-calibration.md` - GEE seeding-calibration history and operating notes.
- `docs/superpowers/specs/2026-05-06-montana-parcel-audit-spec.md` - Montana cadastral/parcel audit contract.
- `docs/superpowers/specs/2026-05-06-montana-parcel-audit-data.json` - Montana audit evidence snapshot.
- `.claude/skills/farmland-legal-descriptions/SKILL.md` - DLS/PLSS parsing and Montana portfolio integration gates.

## Route contract

- `/` or `/#map` - Atlas homepage
- `/#dossier/<slug>` - Single dossier reader or scheduled placeholder.
- `/#creditors` - Searchable creditor database, defaulting to the top 20 listed balances and filterable by country, province/state, industry, debtor, claim type, and currency
- `/#structure` - Corporate structure view
- `/#stack` - Debt stack view
- `/#map/<property>` - open a property in the atlas
- `/#map/<property>/<quarter>` - open a property and quarter directly

Retired `/#list`, `/#editorial`, and `/#dossiers` links redirect to `/#map`.

## Monette vs Agnonymous

Monette is the read-only source-of-truth surface: court-file roster, mapped parcel rows, reviewed ownership/listing/season status, court updates, and source notes stay here. It has no live database, submission queue, or headline feed.

Agnonymous is the public discussion surface: correction threads, banter, requests for clarification, and property evidence threads now open at `window.AGNONYMOUS_URL` (`https://agnonymous.buperac.com`). The shared helper `window.buildAgnonymousUrl(...)` sends query context (`source=monette`, `kind`, `category`, `title`, `body`, `property`, `return`) so the Agnonymous app can prefill or route posts without Monette owning that conversation.

## Property evidence and point-only assets

Mapped properties let visitors open a read-only quarter row showing reviewed ownership, listing, and season status.

Point-only assets do not have quarter rows yet. The current point-only set includes Alberta and British Columbia facilities or ranches plus Montana's 7-acre Hardin Infrastructure & Rail Site, whose exact parcel is not published. Their evidence CTAs open Agnonymous discussion threads with property context attached; reviewed evidence can later be promoted back into Monette as parcel rows, source notes, or status updates.

The atlas has both a floating map legend and a right-panel legend. Use it to distinguish mapped land blocks, point-only court-file assets, historical sold markers, and the selected-property gold ring.

## Homepage shell

The homepage opens directly on the satellite-driven Atlas at `/` or `/#map`, with the current sales toolbar above the map. The former editorial hero and non-functional Register shell are retired. `/#list`, `/#editorial`, and `/#dossiers` redirect to `/#map`; individual `#dossier/<slug>` reader URLs are preserved, and `/#map/{property}` opens the selected property directly.

## Coverage model

The app now separates four things that should not be blended:

- January 2026 baseline Property Summary: `392,940` farmed acres, `213,889` owned acres, `183,712` rented acres, and `$1.059B` total land/building value from `docs/Land/Acre Sheet.jpg`.
- Court-file portfolio totals: `400,000+` farmed footprint, about `274,000` owned acres, about `218,000` leased acres, and `274,744` owned acres in the extracted real-property roster.
- Public property records: `31` records in `data.js`, including court-file assets and current public sales metadata.
- Community geometry/voting rows: generated from `quarters-data.js`; synthetic records remain explicitly labelled and are not treated as confirmed SISP outlines.
- Point-only assets: records without source-backed parcel geometry remain visible as location markers until their legal descriptions or cadastral boundaries are reconciled.
- Operator relationships: CypressView/D&R partner-managed or jointly managed assets are visible as gold `OP` markers. They explain Monette's management network and current creditor exposure, but they do not change portfolio acreage totals.

Property-file and broker acres are source-specific and may overlap other sale-file blocks. Do not treat their sum as the audited court-file owned acreage total.

## Montana portfolio mapping

The five assets in Premier Land Company's current Monette Portfolio offering are mapped with broker figures kept separate from DNRC/DOR cadastral geometry:

1. Fly Creek Farm — `32,756` deeded + `6,454` leased = `39,210` total acres.
2. Camp 4 Farm — `11,455` deeded + `22,828` leased = `34,282` published total acres.
3. Camp 1 Farm — `8,060` deeded + `9,159` leased = `17,219` total acres.
4. The Pivot Farm — `1,473` deeded acres.
5. Hardin Infrastructure & Rail Site — `7` deeded acres.

The public offering is a `$96,000,000` umbrella portfolio with published figures of `53,751` deeded, `38,441` leased, `92,193` total, and `63,049` seeded acres. Premier's visible rows contain a `1–2 ac` arithmetic discrepancy: deeded plus leased is `92,192`, while the five child total cells sum to `92,191`. The Atlas preserves the source values and shows the delta rather than inventing a reconciliation. The umbrella stays separate from its five children so acres and asking price are not double-counted. DNRC polygons are assigned only to Fly Creek, Camp 4, Camp 1, and Pivot; the rail site remains an approximate point, leased boundaries are not fabricated, and the unreconciled 737-acre Ragland Camp 1 court row is excluded from the offering. Run `npm run validate:montana` before deployment.

## Colorado portfolio mapping

[Clark & Associates' Monette Farm & Ranch listing](https://www.clarklandbrokers.com/property-listings/monette-farm-%26-ranch-) is the current public offering source: `$5,106,250 USD` for `4,085±` acres near Genoa, split between about `3,085` acres of organic farm ground and `1,000` acres of native grass. The listing controls marketing name, price, and land-use presentation; it does not control parcel geometry.

The current Lincoln County EagleWeb owner search returns six accounts under `MONETTE FARMS USA, INC., A MONTANA CORPORATION`, totaling exactly `4,085` assessed acres. Those assessor legal descriptions control the ownership crosswalk, and BLM CadNSDI PLSS sections supply the map geometry. Full sections use the public BLM polygons. `S2SW4 Sec 18` and `NW4 Sec 4` are derived from their section bounding boxes for portfolio-scale display and are explicitly labelled as non-survey boundaries. The older Helkaa declaration reports `4,079` Colorado acres, so the Atlas preserves a `6 ac` source-method difference rather than forcing the figures to match. Run `npm run refresh:colorado` and `npm run validate:colorado` before deployment.

## Swapping the Mapbox token

Edit `config.js`. The current token is a public `pk.*` and is safe to ship in
the browser if URL restrictions are enforced in the Mapbox dashboard.

## Rebuilding generated assets

- `python scripts/build_quarters_geojson.py` - rebuilds `quarters.geojson` from the XLSX source plus any calibration overrides
- `npm run refresh:montana` - replaces only the Montana parcel slice from the public cadastral owner query, then rebuilds `quarters-data.js`
- `npm run refresh:colorado` - replaces only the six Lincoln County Colorado account features from BLM PLSS geometry, then rebuilds `quarters-data.js`
- `npm run validate:colorado` - checks the Clark offering, six-account assessor crosswalk, 4,085-acre total, and court-source delta
- `python scripts/build_creditors_data.py` - rebuilds `creditors-data.js` from the FTI creditor-listing PDF
- `python scripts/build_imagery_data_js.py` - rebuilds `imagery-data.js`
- `python scripts/build_quarters_data_js.py` - rebuilds `quarters-data.js`
- `python scripts/review_quarter_alignment.py --property vanguard` - renders a repeatable satellite overlay to `_refs/quarter-alignment/` for geometry review
- `npm run build` - recompiles the JSX files into `build/` and assembles the deployable static site in `public/`

## Geometry alignment

The current SK/MB/MT parcel grid is generated from legal descriptions by `scripts/build_quarters_geojson.py`.
At runtime, the atlas derives its parcel FeatureCollection from `quarters-data.js` so Vercel does not need a second `quarters.geojson` network fetch before parcel lines appear.
The public atlas is intentionally status-only right now, so geometry QA should happen through the review script and internal checks, not by re-enabling parcel lines in the public map.

The public map uses:

- filled shapes for parcel-mapped records
- point markers for court-file assets that need geometry
- red sold markers for completed 2025-2026 transactions
- Agnonymous discussion threads for free-form community geometry evidence, field observations, and correction debate

## Mobile atlas rules

Most visitors will use the atlas on a phone. The mobile route intentionally keeps the first screen focused on the map:

- floating desktop legend, long geometry badge, duplicate sold-note, and Mapbox zoom buttons are hidden on mobile
- legend and trust language move into a below-map accordion
- property files remain available in a constrained scroll area below the map
- selected property files open as a bottom sheet instead of a right-side desktop drawer

Do not reintroduce desktop overlays on the mobile map. If a new explanation is needed, put it below the map or inside the drawer.

If the parcel boxes do not line up tightly with satellite:

1. edit `scripts/quarter_geometry_calibration.json`
2. run `python scripts/build_quarters_geojson.py`
3. run `python scripts/build_quarters_data_js.py`
4. run `python scripts/review_quarter_alignment.py --property <property-id>`
5. run `npm run build`
6. verify with `scripts/review_quarter_alignment.py` output or an internal-only local check before deploying

The review script is a secondary check only. It confirms whether the generated parcel boxes still sit on the visible field / road fabric before the atlas goes live.
