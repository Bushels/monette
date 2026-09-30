# PROJECT_STATE.md

## Active task (2026-09-30)
- **DEPLOYED 2026-09-30 ~13:45 MDT (Kyle: "Yes, deploy it"), `dpl_4RyEL9YgpFNMr4JvabRB2Ho8dJg2`: Hafford internal-notes pull.**
  Removed from public files: every Simmons family reference, the "kyle first-hand" source on the ~$12M yard split, the
  Raptor -> Monette yard-chain line, 11 internal Hafford change-log entries, internal file paths (docs/Land, docs/logs) in
  all source labels. Kept, labelled reported/unverified: Walter Farms wider purchase, 2026 leaseback, ~$12M yard share.
  The pulled claims stay in `G:\My Drive\Agriculture\Monette\intel_unverified.md` (2026-09-30 note). Live-verified 390/1440.
  Deployed twice by mistake (identical content). NOT committed yet (awaiting Kyle). Asset versions: data 46, components 42,
  property-drawer 42, quarter-owners 3.
- **BUILT, REVIEWED, NOT DEPLOYED: Court File (ideas 2-5)** in worktree `C:\Users\kyle\Agriculture\Monette-courtfile`
  (branch feat/court-file, uncommitted). New `#court` tab + `court-file-data.js` (100 filings, 24 key with cited summaries,
  17 milestones), shorter court strip with cited points, per-property court-document list, Hafford "sold under court order"
  lead block, stale-fact fixes (stay to Nov 13, Chapter 15 petitions Apr 21, 18 Applicants, Kobre & Kim, DIP milestones).
  Gate `npm run validate:court` (runs first in `npm run build`; 18/18 mutations caught). Awaiting Kyle's deploy OK.
  To ship: copy the worktree's changed files onto main (worktree = main + this), run all gates, build, deploy.
- **Court watch**: U.S. docket D.I. 63 (Cert. of Service, Sept 29), D.I. 64 (Cert. of Counsel, Sept 30), D.I. 65 ("Sell
  Property", Sept 30 2:56 pm ET) all PACER-only, text unread; FTI site unchanged since Sept 21. Kyle: no PACER purchase, wait.
- Open for Kyle: Wymark "Carefoot Acres" buyer name is community intel still public; public GitHub history still holds the
  pulled Hafford text (rewriting history is his call).

## Previous task (2026-09-29)
**DEPLOYED 2026-09-29 ~09:45 MDT (Kyle OK'd: "deploy it now"), `dpl_9ubbMjv4z7aKnFLQYZjB3T91CvDP`, aliased to monette.buperac.com:**
map fixes plus a full source pass over the public sale data. Production verified at 1440 and 390 wide (0 render / 0 idle
at rest, no console errors, no 4xx, no /snow/manifest request, corrected Hafford + Aguila drawers live).

Map:
- Desktop frame bug fixed: the side panel used to stretch the map canvas to ~2x its frame,
  so the first view showed empty Arctic and the zoom / Seeding-Land Status controls sat
  below the last scrollable pixel. Grid row is now the shell height; the panel scrolls inside.
- Wide-zoom footprint glow (`monette-footprint-glow`): a quarter section is under one pixel at
  continental zoom, so SK/MB looked empty. Gold = officially for sale, red = sold, green = owned,
  blue = rented; darker gold = package listed but quarters/location not matched. No farmland dots.
- Opening view is `MAPBOX_HOME.bounds` fitted to the measured frame (BC to AZ, all seven
  jurisdictions); re-fits on resize until a visitor moves the map.
- Header/toolbar: `35 listings · C$1.01B ask` (SK 18 / C$773.9M, MB 6 / C$103.1M, BC 11 / C$132.7M,
  all CAD; U.S. packages stay in USD in each drawer), `Bids due Oct 15, 2026 · N days`, and a
  breakdown line with the check date. Court strip date is now data-driven (was hard-coded Aug 19).
- `/snow/manifest.json` 404 on every load removed (`MONETTE_SNOW_ENABLED` flag, default off).
- Idle re-render loop fixed: production redrew the map at ~60 fps forever (18 idle events / ~360 frames
  per 6 s with nobody touching it) because every `idle` re-ran ~18 map-level style setters, each of which
  schedules a repaint. Now 0 idle events and 0 frames at rest. Rule recorded in README (render discipline).

Data (all re-read from the live source 2026-09-29; see `sourceCheckedAt` per record):
- Manitoba is public MLS, not broker-direct: Eddystone C$19,125,000 (9,794 ac, 5 MLS listings),
  The Pas C$84,000,000 (22,625 ac, MLS 202615841).
- BC is live: LandQuest Realty Corp., 11 listings (nos. 26224-26234), C$132,739,000, 45,002 ac,
  listed 2026-07-31 (Monitor Third Report ¶¶39-40). Pages print no currency (read as CAD).
- Aguila: sale-approved (Alberta, Aug 19), NOT closed. The executed PSA (D.I. 56-1 §3.1) states
  US$17,000,000 with US$850,000 earnest money (5%); the Monitor's Sept 4 U.S. motion (D.I. 54 ¶¶23-24)
  says "$17 million". Alberta seal covers only the Confidential Affidavit. U.S. approval hearing set
  2026-09-29 3:00 p.m. ET (docket also lists a Certificate of No Objection, D.I. 59, Sept 24); outcome
  NOT reflected in the data.
- Hafford: buyer is court-confirmed (G and K Walter Farms and Harvesting Ltd. and/or nominee);
  closed May 13; Monitor received $28.9M. The vesting order (para 7(a)(i), Schedule B) covers 19 titles =
  18 quarter-section titles covering 16 quarters + Lot 20 (a town lot with a mobile home; the main yard
  is on SW 26-44-11-W3), so ONLY those 16 quarters paint as sold; the other 142 stay provisional (dashed, lighter).
  The 3,657 ac / $7,930-per-ac working assumption is withdrawn (sellers were Monette Farms Ltd. and
  Monette Farms Land II LP; affidavit line item is 2,553 ac / $29M).
- Wymark 12,834.5 -> 13,015.1 ac ($6,224/ac). All other Hammond listings unchanged (19/19 live).
- SISP dates: bids Oct 15; court-approval outside date Oct 31 (bids before Sept 1) / Nov 30 (later
  bids); Nov 30 is the SISP Termination Date, NOT a closing date (`sisp.closing` retired).
- Broker roster/contacts re-read from the FTI SISP page (adds LandQuest, Corey Schultz, Charlie Havranek).
- Fable (second-model) adversarial review 2026-09-29, facts + code passes; every finding checked against the
  filings before acting. Fixed: Lot 20 is a Hafford TOWN LOT with a mobile home (not the yard; yard is on
  SW 26-44-11-W3); order cites are para 7(a)(i) / Schedule B (not Schedule A); 19 TITLES = 18 quarter titles
  covering 16 quarters + Lot 20; Aguila currency now cites the executed PSA (D.I. 56-1 §3.1) instead of an
  inference; hearing wording no longer goes stale; a broker cell number and an unsupported press sentence
  removed; side-panel scroll trap (`overscroll-behavior`) and reduced-motion Home fixed; validator now PINS
  the header numbers (10 of 28 mutations used to pass). Hafford is no longer marked as an SISP listing
  (nothing public supports it; status `unknown`); `#map/hafford` still opens its drawer via `courtConfirmedSoldQuarters`.

## Deployment state
- Last production deploy: 2026-09-29 ~09:45 MDT, `dpl_9ubbMjv4z7aKnFLQYZjB3T91CvDP` (`https://monette.buperac.com`); asset
  versions served: styles 35, data 44, components 41, property-drawer 41, view-map 55, app 39. Previous deploy 2026-08-25, `07eaf26`.
- Committed on main as `cf9a89f` (own files only) and PUSHED to GitHub (Bushels/monette, origin/main = cf9a89f, 2026-09-29;
  the push also carried the earlier unpushed Emerald Meridian print-script commit `1b3f557`, OK'd by Kyle). Deploy from C: with `npm run build` then
  `vercel --prod --yes` (the MAPBOX_TOKEN drift did not recur this time).
- Court strip updated 2026-09-29 ~14:11 MDT (`dpl_fdAFhVRRrTza3YM8rk4FgR84nny3`, data.js v45): the U.S. docket (26-10547) shows
  entry 62 "Order" filed Sept 29 (CourtListener; PACER-only text, FTI had NOT posted it). The page says only that; it does NOT say what
  the order decides. Replace with the real text as soon as FTI posts it (watcher `court_watch.sh` in the session scratchpad).
- Gates before deploy: `npm run validate:sisp`, `validate:montana`, `validate:colorado`, `npm run build`.

## Current public Atlas state
- Atlas is the homepage (`#map`); Register route redirects there. Monette is read-only; every
  correction/evidence action routes to Agnonymous with context attached.
- Hovering a priced property shows its ask; clicking opens the package breakdown and broker links.
- Court-update module (source-linked, collapsed behind a summary bar) leads with Aguila.
- Mobile keeps a 46px property selector above the map, 44px map controls, 44px status pills.
- Public binding-bid deadline: 2026-10-15.

## SK Titles shipped state
- 559/559 CSV parcels reconciled (unmatched: 0); 1,410 records across 14 SK buckets carry
  `mflTitleSnapshot`; Swift Current 28 records, Regina South 120; 159 polygons via DLS/LSD math.
- Runtime audit asserts `property_id:loc` uniqueness across all 1,410 rows.

## SISP evidence rules
- Solid gold outlines require a confirmed listing and source-backed parcel tenure.
- Provisional outlines identify likely in-scope land without a public asking price.
- `sale-approved` is a separate state: no active-listing outline, ownership stays until closing
  evidence exists, and never infer a sealed price (the only price shown is the one the Monitor's
  public filing states, labelled as such).
- Dominant-owner inference, hash fallbacks and synthetic parcels never get a per-quarter outline.
  The wide-zoom glow may show a listed package in darker gold at PACKAGE level only.
- Broker acreage and atlas file acreage stay separate wherever they differ.

## Known data gaps
1. Eddystone's quarter-owner keys do not match parcel locations and the table is incomplete; its
   parcels cannot carry evidence-backed outlines (its package is priced and glows darker gold).
2. Raymore has no quarter-owner table (same consequence). Deferred until after Oct 15.
3. Swift Current and The Pas have no real quarter geometry (The Pas = Red River river lots).
4. BC ranches are point-only; Goat's Peak has no LandQuest listing (stays `likely`).
5. Montana parcel re-check blocked 2026-09-29: the DNRC cadastral server returned 504 / timeouts.
   Baseline stays 220 parcels / 51,528.893 assessed ac (2026-04-26 pull).
6. Unverified: whether SCIC's C$1.9M claim was paid; whether Clark's separate 7,051-ac Genoa farm
   is Monette's (assessor data supports 4,085 ac only); Aguila leased acres (2,204 in the U.S. motion
   vs 2,213 in Southwest's brochure; both disclosed).

## Montana portfolio mapped state
- Premier re-read 2026-09-29: `$96,000,000`, `53,751` deeded, `38,441` leased, `92,193` total,
  `63,049` seeded; children Fly Creek $38.0M, Camp 4 $27.5M, Camp 1 $17.0M, Pivot $11.5M (own page
  now), Hardin rail site 7 ac (no price). Premier's own arithmetic is 1-2 ac off; the delta is disclosed.
- DNRC owner-query geometry: 220 parcels / 51,528.893 assessed ac (Fly Creek 95, Camp 4 66, Camp 1 56,
  Pivot 3). No leased-land geometry is inferred. `npm run validate:montana` is the gate.

## Colorado portfolio mapped state
- Clark re-read 2026-09-29: `$5,106,250 USD`, `4,085±` ac (3,085 organic + 1,000 native grass).
- Lincoln County EagleWeb: six accounts, exactly 4,085 assessed ac (pulled 2026-07-15); BLM CadNSDI
  geometry; Helkaa ¶58(e) reports 4,079 ac and the 6 ac delta is disclosed. `npm run validate:colorado`.

## Next
1. (DONE) going-live list approved, deployed, verified.
2. Read the D.I. 62 order text when FTI posts it (Chapter 15 page) -> update `latestCourtUpdate` + `sispByProperty.aguila`
   (`usHearing`, `closingStatus`, `closingConditions`, notes) strictly from the text, bump `data.js?v=`, validate, build, deploy.
   An order approving the sale still does NOT mean closed; only a Monitor's Closing Certificate does.
3. Watch for: the Monitor's Closing Certificate (Aguila), any Alberta order after Aug 19, a Fourth
   Monitor's Report / DIP update (latest filed: C$88.2M of C$90M at July 31), SCIC resolution.
4. After Oct 15: Eddystone owner table, Raymore owner table, geometry for Swift Current / The Pas.
5. Working-tree strays from other sessions (SK-titles audit log, two planning docs, dust scripts)
   are NOT part of this work. The Emerald Meridian poster moved out of this repo on 2026-09-29
   to C:\Users\kyle\Agriculture\Maps\emerald-meridian (its own local git repo).
