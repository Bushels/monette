# PROJECT_STATE.md

## Last verified production state
- Supabase retirement / Agnonymous-only intake release: `07eaf26`.
- Vercel production deployment: `dpl_C5KuvFSgP4QmGe8j6a7dMCtmPrCN` at `https://monette.buperac.com`.
- Production verified 2026-08-25 at desktop and 390x844 mobile: Monette loads no Supabase SDK or client, exposes no Supabase submission/headline globals, emits no browser warnings, and retains the Atlas and court-update module with no horizontal overflow. `Submit Update` is a real external link to Agnonymous carrying source, return URL, category, title, and clarification context.
- Compact desktop court-update release: `96c0b81`.
- Prior Vercel production deployment: `dpl_M4EDPyLiWoj4D9L68WhLPHoEDRx2`.
- Production verified 2026-08-25 at 1440x1000, 1024x768, 901x768, and 390x844. The desktop court-update module is a 77px collapsed disclosure that moves the map start approximately 226px higher and increases map visible above the 1000px fold from approximately 530px to 755px. Expanding preserves all three court cards and exact FTI source links. Mobile retains its 73px collapsed treatment with no horizontal overflow.
- The desktop accessible name includes the legally material `closing pending` caveat, visible desktop/mobile summary copy is data-driven, and the summary has an explicit keyboard focus treatment. Production component, data, and CSS assets matched the release build byte-for-byte.
- Searchable grouped property finder release: `157a59e`.
- Prior Vercel production deployment: `dpl_8vUdS6tmgoCAGVvqmp2j7zAXgyBX`.
- Production verified 2026-08-25 at desktop and mobile: property search supports province/state group browsing, exact jurisdiction aliases, internal names, legacy IDs, point-only assets, Arrow-key selection, portfolio reset, and deep-link drawer routing. The live component and CSS matched the release build byte-for-byte; browser QA logged no errors.
- Production verified 2026-08-25 at desktop and 390x844 mobile. The Debt view shows C$88.2M drawn against the C$90M DIP maximum at July 31, C$1.8M remaining, and C$22.2M of period net draws; forecast figures are separately labelled. The deployed data, component, and CSS matched the release build byte-for-byte.
- Mobile map reset, zoom, and compass controls are restored at 44x44px with no horizontal overflow. Desktop controls are 36x36px.

## Active task
**SHIPPED + VERIFIED IN PRODUCTION (2026-08-25): Supabase retired; Agnonymous is the only public intake.**
The public Ledger now separates a court-approved sale from a completed closing.
Aguila Farm is `sale-approved`: the approved buyer is Byner Cattle Company
and/or nominee, the purchase price remains sealed, and closing is not publicly
confirmed because the Monitor's Closing Certificate and U.S. recognition remain
outstanding in the public evidence. The Arizona Produce Cooler & Seed Facility
remains a separate active listing at the reduced US$5M combined ask.

## Current public Atlas state
- Atlas is the homepage. The retired Register route redirects to `#map`.
- Hovering a publicly priced property shows its asking price; clicking opens the
  full package breakdown and broker links.
- The top navigation and Atlas toolbar derive their sales totals from the same
  per-property records used by the map and drawer.
- Monette is read-only and has no live database, submission queue, or headline
  ticker. Every public correction/evidence action routes to Agnonymous with the
  relevant Monette context attached.
- A source-linked court-update module now leads with the Aug. 19 Arizona order,
  the unresolved SCIC C$1.9M assertion, the Arizona price reset, and the unnamed
  selected B.C. broker. Desktop collapses the module behind a 77px summary and
  mobile behind a 73px summary so the filings remain available without burying
  the property finder or map.
- Mobile has an always-visible 46px property selector above the map. It includes
  grouped search across point-only assets and parcel-mapped properties;
  jurisdiction aliases and legacy IDs resolve without substring false positives.
  Status/deadline pills and Atlas mode buttons are at least
  44px high. Reset, zoom, and compass map controls are also 44px touch targets.
  The property drawer begins below the two-row navigation.
- Structure and Debt section labels are semantic `h2` elements. Main headings
  measure 15.74:1 against paper and source notes 5.09:1 in browser QA.
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
- `sale-approved` is a separate state: remove the active-listing outline, retain
  current ownership until closing evidence exists, and never infer a sealed price.
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
No work remains in this release. Monitor the official file for: (1) a filed
Monitor's Closing Certificate and U.S. recognition before changing Aguila to
closed/sold; (2) any ruling or agreement resolving SCIC's asserted C$1.9M claim
and 2026 coverage position; and (3) the named B.C. broker and live listings.
The next update must preserve the distinction between an order, satisfied
closing conditions, and a completed title transfer.
