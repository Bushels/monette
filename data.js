// Monette Farms — land portfolio data
// CCAA filing date: April 21, 2026 (Day 0)
//
// Status model has THREE layers (all crowdsourced, all per-quarter):
//   Layer 1 — OWNERSHIP (Monette's control)
//     owned-monette / sold / rented-monette / returned-to-ll / unknown
//   Layer 2 — LISTING overlay (optional)
//     listed-for-sale / listed-for-rent / not-listed
//   Layer 3 — SEASON activity (this growing season)
//     seeded (timestamp) / unseeded
//     sprayerSpotted[] (timestamped events, many allowed)
//     harvested (timestamp) / unharvested

window.MONETTE_DATA = {
  filingDate: "2026-04-21",
  day: 0,

  sourceHierarchy: {
    baseline: {
      source: "docs/Land/Acre Sheet.jpg",
      label: "Monette Property Summary",
      effectiveAsOf: "January 2026",
      farmedAcres: 392940,
      ownedAcres: 213889,
      rentedAcres: 183712,
      totalLandBuildingValue: 1059377635,
      note: "Use this as the starting inventory for farmed, owned, rented, building replacement value, comp high $/ac, and total land/building value. Per-property PDF/XLSX files in docs/Land are sale-package/update overlays, not the initial portfolio baseline.",
    },
    baselineRecordMarker: "properties[].propertySummary",
    adjustmentRule: "Post-January sales, returned land, and reviewed vote/status changes are adjustments against the Acre Sheet baseline. Do not add sold acres as new inventory; subtract or reclassify them from the relevant baseline farmed/owned/rented amounts when producing current-state rollups.",
    overlays: [
      "docs/Land/*.pdf and docs/Land/*.xlsx: tender/sale-package details, quarter geometry, ISC title rows, and sale-offer scope",
      "soldProperties: known historical transactions and post-baseline sale results",
      "public votes: post-baseline community ownership/listing/season observations by quarter",
    ],
  },

  portfolioTotals: {
    source: "Monette affidavit real-property table and acreage narrative, April 2026",
    farmedAcresLabel: "400,000+",
    ownedAcresApprox: 274000,
    ownedRosterAcres: 274744,
    leasedAcresApprox: 218000,
    availableAcres: 412000,
    plannedSeededAcres: 352000,
    bcGrazingLicencesAcres: 1200000,
    courtAssetRows: 22,
    mappedLedgerRows: 1259,
  },

  totals: {
    sk: { properties: 10, totalAcres: 252676, owned: 131176, rented: 121500, pctOwned: 52, largest: "Hafford", largestAcres: 46466 },
    mb: { properties: 2,  totalAcres: 50561,  owned: 49257,  rented: 5964,   pctOwned: 97, largest: "The Pas",  largestAcres: 28589 },
    mt: { properties: 1,  totalAcres: 8400,   owned: 8400,   rented: 0,      pctOwned: 100, note: "Previously listed — status unknown" },
  },

  properties: [
    { id:"admiral", name:"Admiral", province:"SK", region:"Southwest SK", lat:49.43, lng:-108.03,
      rms:["RM of Bone Creek No. 108"],
      parcels:16, titled:2385, cultivated:2242, waste:143, assessment:4391100, owned:2385, rented:0,
      soils:[["H",1747],["G",318],["F",161],["K",160]],
      crops2025:[["Durum",2385]], crops2024:[["LGL",2385]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RM 108",
        farmedAc:10870,
        unmappedAc:8485,
        ownedAc:2385,
        rentedAc:8485,
        buildingValue:0,
        pricePerAc:5218,
        totalValue:12444930
      },
      notes:"All durum in '25. Single RM, tight block." },
    { id:"calderbank", name:"Calderbank", province:"SK", region:"Central SK", lat:50.28, lng:-106.78,
      rms:["RM of Morse No. 165","RM of Enfield No. 194"],
      parcels:141, titled:17128, cultivated:14919, waste:2209, assessment:21052500, owned:8500, rented:8628,
      soils:[["K",7036],["J",5857],["L",1973],["H",995],["M",959],["G",308]],
      crops2025:[["Pasture",11432],["Barley",3478],["Canola",2218]],
      crops2024:[["Pasture",11432],["LGL",4591],["Barley",1105]],
      notes:"Mostly pasture. Big lease component." },

    { id:"cabri-bank", name:"Cabri Bank", province:"SK", region:"South-West SK",
      lat:50.62, lng:-108.45,
      rms:["RM of Riverside No. 168","RM of Lacadena No. 228"],
      parcels:0, titled:17126, cultivated:0, waste:0, assessment:0,
      owned:17126, rented:215,
      soils:[],
      crops2025:[], crops2024:[],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 65/96",
        farmedAc:17349,
        unmappedAc:223,
        ownedAc:17126,
        rentedAc:215,
        buildingValue:2720000,
        pricePerAc:4572,
        totalValue:81029948,
        note:"NEW property added 2026-04-25. No per-property XLSX/PDF yet so no quarter-level geometry. Lat/lng + RM numbers approximated."
      },
      operator:"Monette",
      notes:"Court-file asset added from the Property Summary master holdings doc. Not yet in any per-property XLSX/PDF in our possession; awaiting tender package or ISC pull for quarter-level mapping. 17,349 farmed ac per Monette Property Summary." },
    { id:"rosetown", name:"Rosetown", province:"SK", region:"West-Central SK",
      lat:51.55, lng:-107.99,
      rms:["RM of St. Andrews No. 287","RM of Marriott No. 317","RM of Pleasant Valley No. 288"],
      parcels:0, titled:16530, cultivated:0, waste:0, assessment:0,
      owned:16530, rented:6727,
      soils:[],
      crops2025:[], crops2024:[],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 219/250/279",
        farmedAc:23357,
        unmappedAc:6827,
        ownedAc:16530,
        rentedAc:6727,
        buildingValue:5500000,
        pricePerAc:5811,
        totalValue:101556760,
        note:"NEW property added 2026-04-25. No per-property XLSX/PDF yet so no quarter-level geometry. Lat/lng + RM numbers approximated."
      },
      operator:"Monette",
      notes:"Court-file asset added from the Property Summary master holdings doc. Not yet in any per-property XLSX/PDF in our possession; awaiting tender package or ISC pull for quarter-level mapping. 23,357 farmed ac per Monette Property Summary." },
    { id:"hafford", name:"Hafford", province:"SK", region:"West-Central SK", lat:52.74, lng:-107.37,
      rms:["RM of Douglas No. 436","RM of North Battleford No. 437"],
      parcels:158, titled:24453, cultivated:5648, waste:18805, assessment:60823400, owned:3658, rented:20795,
      tender:{
        source:"Monette Land Tender Information Package + Property Summary — Hafford, SK (RMs 436/437)",
        deadline:"2026-03-02",
        farmedAc:46466,
        ownedAc:2554,
        rentedAc:43912,
        unmappedAc:22013,
        note:"Monette's Property Summary (docs/Land/Acre Sheet.jpg) lists Hafford as 46,466 farmed acres — 2,554 ac owned (Monette Farms Ltd. only) + 43,912 ac 'rented' (includes Monette Ag Ventures 1,104 + Raptor/Simmons 20,795 + 22,013 ac of additional unmapped rented ground). Update 2026-04-25: community intel confirms Simmons OWNS Raptor Enterprises Inc., AND that Walter Farms purchased ALL 46,466 ac at Hafford — Monette portion + Simmons/Raptor portion. Whether Monette is still farming under leaseback is unconfirmed. The earlier per-property XLSX/PDF tender packages reflect what Monette was offering for sale, not necessarily their full operating footprint."
      },
      soils:[["C",7935],["E",3924],["F",3763],["G",3117],["H",1896],["J",1273],["D",1259],["K",781],["P",159],["M",152],["O",113],["L",81]],
      crops2025:[["Canola",10124],["Wheat",5910],["RL",3506],["RR Canola",2856],["Peas",1740]],
      crops2024:[["Wheat",12212],["Canola",7405],["Lentils",2190],["LL Canola",1247],["RR Canola",1081]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 435/437",
        farmedAc:46466,
        unmappedAc:22013,
        ownedAc:2554,
        rentedAc:43912,
        buildingValue:20291000,
        pricePerAc:5032,
        totalValue:33140665,
        note:"Property Summary 'Owned' (2,554) only counts Monette Farms Ltd. ISC titles split: Raptor 20,795 (Simmons-owned, confirmed 2026-04-25) + Monette Farms Ltd. 2,554 + Monette Ag Ventures Ltd. 1,104. Walter Farms reportedly bought ALL 46,466 ac; Monette to custom-farm 2026 under leaseback."
      },
      landowners:[
        {name:"Raptor Enterprises Inc. (Simmons)", acres:20795, role:"third-party", note:"Hafford.xlsx rows 30-163 — 134 quarters, 20,795.07 ac. Confirmed Simmons-owned via Raptor (community intel 2026-04-25). Reportedly sold to Walter Farms along with the Monette portion."},
        {name:"Monette Farms Ltd.",      acres:2554,  role:"monette", note:"Hafford.xlsx Monette Farms Ltd. rows — 2,553.59 ac. Reportedly sold to Walter Farms (community intel 2026-04-24/25, court confirmation pending)."},
        {name:"Monette Ag Ventures Ltd.", acres:1104, role:"monette", note:"Hafford.xlsx Monette Ag Ventures Ltd. rows — 1,104.49 ac. Reportedly sold to Walter Farms (community intel 2026-04-24/25, court confirmation pending)."},
      ],
      communityAsk:{
        label:"Hafford rented-quarter location request",
        acres:"22,013 ac unmapped",
        body:"Monette's official Land Tender Information Package (offer deadline 2026-03-02) discloses 46,466 farmed acres at Hafford — 24,453 ac owned (the 158 quarters we map) PLUS 22,013 ac rented. We do NOT have quarter-level locations for the 22,013 rented portion; it is believed to be Simmons-linked ground that Monette has been custom-farming. Update 2026-04-24: Walter Farms is rumored to be the buyer of the Hafford yard plus the Monette-owned 3,658 ac (the 2,553 ac Monette Farms Ltd. portion via CCAA Phase 2, reported price ~$29M; the 1,104 ac Monette Ag Ventures Ltd. portion via community intel — both pending Monitor's Report / court confirmation). The 20,795 ac Raptor Enterprises Inc. block remains separately titled. We are looking for: (a) quarter/legal descriptions for the 22,013 rented acres, (b) the landlord/lessor name(s) on those quarters, (c) any 2026 field-activity observations.",
        prefill:"Hafford Simmons / rented-quarter location update — quarter/legal descriptions for any of the 22,013 rented ac, landlord/lessor name(s), lease term, 2026 field activity, source, and confidence level: "
      },
      purchaserRumor:{
        status:"reported (multi-source) — Monette portion price court-documented; buyer pending court confirmation",
        buyer:"Walter Farms",
        source:"community intel 2026-04-24 + 2026-04-25",
        priceKnown:true,
        priceCourtDocumented:true,
        label:"Walter Farms purchase",
        metric:"$29M / 3,657 ac (Monette portion ≈ $7,930/ac blended; cropland alone ≈ $4,650/ac)",
        body:"Community intel from multiple sources reports Walter Farms purchased ALL Hafford land — the 3,657 ac Monette-owned position (Monette Farms Ltd. 2,553 + Monette Ag Ventures Ltd. 1,104) AND the 20,795 ac Raptor Enterprises Inc. position (Simmons-owned via Raptor). Total 24,452 mapped acres + 22,013 unmapped rented ac = 46,465 ac. CCAA Phase 2 result is court-documented (affidavit ¶158): $29M for the Monette-owned Hafford position. The affidavit lists 2,553 ac for $29M, but Ledger working assumption is the Monette Ag Ventures 1,104 ac portion was bundled into the same $29M deal — that resolves the blended price to ~$7,930/ac. Within the $29M, community intel (kyle first-hand 2026-04-24) puts the Hafford yard / shop infrastructure at ~$12M (yard chain: Raptor → Monette → Walter Farms), implying ~$17M for the ~3,657 ac of cropland alone (~$4,650/ac — normal SK cropland range). For reference, Monette's Property Summary carries the Hafford building replacement value at $20.29M (insurance basis; higher than market). The 20,795 ac Raptor (Simmons) position and 22,013 ac unmapped rented portion were reportedly bundled into the Walter Farms deal at undisclosed prices. Update 2026-04-25: confirmed that Monette will custom-farm all ~46,466 ac in 2026 under sale-leaseback with Walter Farms.",
        ask:"Help confirm the price paid for Hafford (yard, Monette portion, Raptor/Simmons portion, additional rented portion) and the lease terms of the Walter Farms ↔ Monette leaseback.",
        prefill:"Hafford / Walter Farms deal: portion, reported price (total or $/ac), buyer corporate entity, leaseback terms (rent, duration), source, confidence level: "
      },
      operator:"Monette (CONFIRMED 2026-04-25) — Monette will custom-farm all 46,466 ac at Hafford for the 2026 crop year under sale-leaseback with Walter Farms (the new owner of record per multi-source community intel; court documentation pending).",
      notes:"Largest SK unit. Monette's Property Summary (docs/Land/Acre Sheet.jpg) lists 46,466 farmed ac at Hafford = 2,554 owned (Monette Farms Ltd. only) + 43,912 'rented' (which bundles Monette Ag Ventures 1,104 + Raptor 20,795 + 22,013 additional unmapped rented). Update 2026-04-25 (multi-source community intel): Simmons OWNS Raptor Enterprises Inc., AND Walter Farms purchased ALL the Hafford land — both the Monette portion and the Raptor/Simmons portion — totalling 46,466 ac. The CCAA Phase 2 result is court-documented (affidavit ¶158): $29M for the Monette-owned portion. The affidavit lists the line item as 2,553 ac (Monette Farms Ltd.), but Ledger working assumption is the 1,104 ac Monette Ag Ventures Ltd. portion was bundled into the same $29M deal — that gives 3,657 ac at $7,930/ac, which reconciles to comparable cropland-with-yard pricing (vs. the unrealistic $11,360/ac you get from $29M / 2,553). Prices for the Raptor (Simmons) 20,795 ac and 22,013 ac unmapped rented portions remain undisclosed community intel. Operator confirmed 2026-04-25: Monette will custom-farm all 46,466 ac under sale-leaseback for the 2026 crop year. Per-quarter ownership pills show provisional 'sold-rented-back' (dashed gold) across all 158 mapped quarters until court documentation confirms the Walter Farms title transfer.",
      changeLog:[
        {at:"2026-04-26T16:30:00-06:00", type:"data-fix", title:"Hafford $29M sale price broken out — yard ~$12M + cropland ~$17M (~$4,650/ac)", detail:"Added an internal breakdown of the $29M Phase 2 deal so readers can see why the blended $7,930/ac doesn't read like raw cropland. Yard / shop infrastructure ~$12M (community intel — kyle first-hand 2026-04-24, yard chain Raptor → Monette → Walter Farms). Implied cropland: $29M − ~$12M = ~$17M for ~3,657 ac ≈ ~$4,650/ac (normal SK cropland-with-no-yard range). For context, Monette's Property Summary carries Hafford building replacement value at $20.29M, but that is insurance/replacement basis and runs higher than market. Breakdown lives on `soldProperties.sold-hafford-phase-2.priceBreakdown` and is mirrored in human-readable form in the sold-marker tooltip notes + property purchaserRumor body."},
        {at:"2026-04-26T16:00:00-06:00", type:"data-fix", title:"$29M Phase 2 sale reattributed to 3,657 ac (both Monette entities), $/ac corrected to $7,930", detail:"Working assumption updated 2026-04-26: the $29M CCAA Phase 2 result for the Monette-owned Hafford position covers BOTH the 2,553 ac Monette Farms Ltd. portion AND the 1,104 ac Monette Ag Ventures Ltd. portion (3,657 ac total). The court affidavit ¶158 lists the line item as 2,553 ac, but $29M / 2,553 = $11,360/ac implied an unrealistic yard premium; $29M / 3,657 = $7,930/ac reconciles to comparable cropland-with-yard pricing. soldProperties.sold-hafford-phase-2 updated: acres 2,553 → 3,657, pricePerAcre 11,360 → 7,930, name 'Hafford partial' → 'Hafford (Monette portion)'. Pricing for the 20,795 ac Raptor (Simmons) portion and 22,013 ac unmapped rented portion remains undisclosed."},
        {at:"2026-04-25T23:45:00-06:00", type:"intel", title:"Operator confirmed: Monette will custom-farm all 46,466 ac at Hafford in 2026", detail:"Community intel 2026-04-25 (later same day): Monette WILL be farming all the Hafford land purchased by Walter Farms — sale-leaseback structure for the 2026 crop year. Drops the prior 'operator uncertain' framing. Per-quarter pills stay provisional sold-rented-back until the Walter Farms title transfer is court-documented."},
        {at:"2026-04-25T23:30:00-06:00", type:"intel", title:"Walter Farms bought ALL Hafford land — Monette + Simmons/Raptor — 46,466 ac total", detail:"Community intel 2026-04-25: Simmons OWNS Raptor Enterprises Inc., AND Walter Farms purchased the entire Hafford block — Monette's 3,658 ac PLUS Simmons/Raptor's 20,795 ac PLUS the 22,013 unmapped rented portion = 46,466 ac total. All 158 mapped quarters now seed as 'sold-rented-back' (provisional dashed pill), not just the Monette quarters."},
        {at:"2026-04-25T23:15:00-06:00", type:"intel", title:"Raptor Enterprises Inc. = Simmons (confirmed)", detail:"Community intel 2026-04-25: Simmons family owns Raptor Enterprises Inc. The 20,795 ac Raptor-titled portion at Hafford is therefore the 'Simmons land' referenced in earlier intel. Drops the long-running 'presumed Simmons, pending corporate-registry confirmation' qualifier."},
        {at:"2026-04-25T23:00:00-06:00", type:"data-fix", title:"Property Summary (Acre Sheet.jpg) integrated as the master holdings doc", detail:"User clarified 2026-04-25: docs/Land/Acre Sheet.jpg (Property Summary) is the authoritative Monette holdings document. The per-property XLSX/PDF tender packages reflect what was being offered for sale, NOT necessarily the full operating footprint. Updated tender block to use Property Summary's 2,554 owned + 43,912 rented split (vs. the tender PDF's 24,453 owned + 22,013 rented framing)."},
        {at:"2026-04-25T22:00:00-06:00", type:"data-fix", title:"Per-quarter ownership now sourced from Hafford.xlsx (real ISC titles)", detail:"Replaced the prior hash-based 80/20 owned-rented synthesis with a per-quarter Owner lookup extracted directly from Hafford.xlsx (rows 3-29 Monette = 3,658.08 ac across 25 unique quarters; rows 30-163 Raptor = 20,795.07 ac across 133 unique quarters). New file quarter-owners.js carries window.MONETTE_QUARTER_OWNERS keyed by Land Location. Drawer rollup, ownership pills, dominant-color, and rollup bar now reflect real titles."},
        {at:"2026-04-25T21:30:00-06:00", type:"intel", title:"Simmons land = 45,000-50,000 ac ADDITIONAL (separate from tender)", detail:"User clarified 2026-04-25: the Simmons-linked custom-farm relationship is 45,000-50,000 acres ADDITIONAL to anything in the tender package. Distinct from the tender's 22,013 ac rented. Locations unknown for any of the Simmons ground. Effective Hafford-area Monette farming footprint may exceed 90,000 ac when Simmons is included."},
        {at:"2026-04-25T20:30:00-06:00", type:"data-fix", title:"Tender package integrated — 46,466 ac total (24,453 owned + 22,013 rented)", detail:"Monette Land Tender Information Package (offer deadline 2026-03-02) added as a SOURCE document. Confirms 46,466 farmed acres at Hafford. Public status view + summary card now show the full 46,466 ac figure with 22,013 rented-but-unmapped flagged."},
        {at:"2026-04-25T20:00:00-06:00", type:"correction", title:"Public lead status no longer says 'Still Monette-owned'", detail:"Map sidebar's 'Lead status' was reading 'STILL MONETTE-OWNED' even though the Hafford block is mostly Raptor-titled (20,795 ac) and the Monette-owned 3,658 ac is rumored sold to Walter Farms. dominantOwnershipKey() now ranks sold-rented-back into the calculation; Hafford's lead reads 'Sold + rented back — rumored' on the public status view."},
        {at:"2026-04-25T19:00:00-06:00", type:"ledger-status", title:"Owned quarters reseeded as 'Sold + rented back' (Ledger-provisional)", detail:"All previously-Monette-owned Hafford quarters now display under the new sold-rented-back ownership status, marked provisional (dashed pill). Reflects Walter Farms purchase + leaseback rumor; awaits community votes / Monitor's Report to graduate to confirmed."},
        {at:"2026-04-25T18:30:00-06:00", type:"correction", title:"Spelling fix: Simmonds → Simmons", detail:"Corrected the surname in the Hafford community ask (was 'Simmonds / Simmons', now just 'Simmons')."},
        {at:"2026-04-24T18:00:00-06:00", type:"editorial-scope", title:"Walter Farms rumor scoped to Hafford only", detail:"Earlier portfolio-wide framing was narrowed to a per-property purchaserRumor on Hafford. Other property drawers no longer carry the Walter Farms card until/unless we get block-specific intel."},
        {at:"2026-04-24T16:00:00-06:00", type:"intel", title:"Walter Farms named as Phase 2 buyer (rumor)", detail:"Community tip from a 'good source': Walter Farms purchased the Hafford yard + the 3,658 ac Monette-owned position. The CCAA Phase 2 'Hafford partial' ($29M / 2,553 ac) is the documented portion; the 1,104 ac Monette Ag Ventures Ltd. portion is community intel pending court confirmation. Buyer name itself is unverified."},
        {at:"2026-04-23T10:00:00-06:00", type:"data-fix", title:"Hafford rollup corrected to 158 quarters / 24,453 ac", detail:"data.js previously showed 27 parcels / 3,658 ac (only Monette-owned). Re-audited from Hafford.xlsx: full title roll-up is 158 unique Land Locations totaling 24,453 ac, of which 20,795 ac is owned by Raptor Enterprises Inc. (presumed Simmons)."},
      ],
      headline:true },
    { id:"kamsack", name:"Kamsack", province:"SK", region:"East-Central SK", lat:51.56, lng:-101.89,
      rms:["RM of Cote No. 271","RM of Sliding Hills No. 273","RM of St. Philips No. 301"],
      parcels:107, titled:11377, cultivated:10090, waste:1287, assessment:26541300, owned:7800, rented:3577,
      soils:[["E",5017],["F",3007],["G",1798],["D",897],["C",338],["H",161],["J",159]],
      crops2025:[["Canola",9634],["Wheat",1515]], crops2024:[["Wheat",9634],["LL",1515]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 271/273/301",
        farmedAc:40245,
        unmappedAc:28868,
        ownedAc:11377,
        rentedAc:28868,
        buildingValue:14171500,
        pricePerAc:6303,
        totalValue:85877958,
        note:"Note: Property Summary labels this row 'Kindersley' but RM numbers (Cote 271, Sliding Hills 273, St. Philips 301) match Kamsack's east-central SK location. Likely a label typo in the source doc."
      },
      notes:"Heavy canola rotation. Black-soil belt." },
    { id:"outlook", name:"Outlook", province:"SK", region:"Central SK — Irrigation", lat:51.50, lng:-107.06,
      rms:["RM of Rudy No. 284","RM of Montrose No. 315","RM of Rosedale No. 283"],
      parcels:26, titled:3607, cultivated:3474, waste:133, assessment:4508500, owned:2200, rented:1407,
      soils:[["M",2076],["L",602],["O",479],["P",162],["K",146],["J",143]],
      crops2025:[["WW",146]], crops2024:[["Veggies",1119],["Wheat",482]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 319/384",
        farmedAc:6618,
        unmappedAc:3011,
        ownedAc:1852,
        rentedAc:4766,
        buildingValue:39023000,
        pricePerAc:12927,
        totalValue:62968328,
        note:"Note: Property Summary RMs (319/384) differ from data.js's (Rudy 284, Montrose 315, Rosedale 283). Cross-check needed."
      },
      notes:"Irrigated vegetable ground — high interest.", headline:true },
    { id:"ponteix", name:"Ponteix", province:"SK", region:"Southwest SK", lat:49.77, lng:-107.43,
      rms:["RM of Auvergne No. 076","RM of Pinto Creek No. 075","RM of Wise Creek No. 077"],
      parcels:130, titled:20651, cultivated:20021, waste:630, assessment:39269500, owned:12500, rented:8151,
      soils:[["G",8728],["H",4913],["J",2383],["F",1592],["M",1121],["L",1115],["K",800]],
      crops2025:[["Canola",13969],["Hay",4129],["LGL",2393],["Durum",160]],
      crops2024:[["Durum",12068],["Durum CF",3178],["Hay",2535],["Canola",1276]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 75/76/77",
        farmedAc:20016,
        ownedAc:19697,
        rentedAc:319,
        buildingValue:0,
        pricePerAc:3555,
        totalValue:70022835
      },
      notes:"Largest by assessment. Canola → durum rotation." },
    { id:"prince-albert", name:"Prince Albert", province:"SK", region:"North-Central SK", lat:53.20, lng:-105.75,
      rms:["RM of Garden River No. 490","RM of Paddockwood No. 520"],
      parcels:22, titled:3020, cultivated:2695, waste:325, assessment:5338395, owned:1820, rented:1200,
      operatedEst:20000, operatedVerified:false,
      soils:[["G",977],["H",797],["J",765],["K",321],["L",159]],
      crops2025:[["Wheat",2700],["RR Canola",160]], crops2024:[["RR Canola",2700],["Wheat",160]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RM 490",
        farmedAc:20724,
        unmappedAc:17704,
        ownedAc:3020,
        rentedAc:17704,
        buildingValue:4878508,
        pricePerAc:5745,
        totalValue:22229614
      },
      notes:"Meath Park block. Titled footprint is 3,020 ac, but source reports operated acreage is closer to ~20,000+ (?) — combine fleet reportedly 5 → 6 units in 2026. Operated estimate UNVERIFIED; title vs. custom-farm split not yet reconciled.", headline:true },
    { id:"raymore", name:"Raymore", province:"SK", region:"East-Central SK", lat:51.39, lng:-104.64,
      rms:["RM of Longlaketon No. 219","RM of Last Mountain Valley No. 250","RM of Mount Hope No. 279"],
      parcels:125, titled:19094, cultivated:16968, waste:2126, assessment:34183800, owned:11600, rented:7494,
      soils:[["J",9092],["H",4138],["K",3678],["G",1387],["L",479],["M",319]],
      crops2025:[["Wheat",6065],["Canola",5984],["RL",3688],["Peas",3179]],
      crops2024:[["Wheat",9672],["Canola",6809],["Peas",2275]],
      notes:"Diverse rotation; heavy pea acres." },
    { id:"vanguard", name:"Vanguard", province:"SK", region:"Southwest SK", lat:49.92, lng:-107.24,
      rms:["RM of Whiska Creek No. 106","RM of Glen Bain No. 105"],
      parcels:111, titled:14358, cultivated:13851, waste:506, assessment:32448000, owned:9900, rented:4458,
      soils:[["F",4131],["G",3796],["E",2561],["H",2237],["D",958],["J",674]],
      crops2025:[["LGL",6385],["Durum",4526],["Canola",1286],["Hay",1122],["C. Peas Reg",642]],
      crops2024:[["Canola",6952],["Durum",4791],["LGL",1255],["Hay",1122]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 105/106",
        farmedAc:44231,
        unmappedAc:29873,
        ownedAc:14358,
        rentedAc:29873,
        buildingValue:444000,
        pricePerAc:5583,
        totalValue:80000694
      },
      notes:"Community watch list — reports of changed signage.", headline:true },
    { id:"wymark", name:"Wymark", province:"SK", region:"Southwest SK", lat:50.11, lng:-107.63,
      rms:["RM of Lac Pelletier No. 107","RM of Coulee No. 136","RM of Swift Current No. 137","RM of Excelsior No. 166"],
      parcels:131, titled:14943.03, cultivated:14409, waste:534, assessment:27120200, owned:14458.03, rented:7007.97, soldAc:485,
      soils:[["K",4938],["J",4399],["H",2329],["G",2316],["L",480]],
      crops2025:[["Durum",5189],["Canola",3429],["Pasture",1925],["Barley",1395]],
      crops2024:[["Peas",5993],["Durum",2948],["LGL",962],["Hay",947]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RMs 107/136/137",
        farmedAc:21951,
        unmappedAc:7008,
        ownedAc:12753,
        rentedAc:9198,
        buildingValue:27930050,
        pricePerAc:7690,
        totalValue:126000570,
        note:"January 2026 Acre Sheet baseline: 21,951 farmed ac = 12,753 owned + 9,198 rented. Later Wymark sale/title package maps 14,943.03 ac titled to Monette entities. Post-baseline Phase 2 sale subtracts 485 ac from the Monette-owned bucket, but exact sold-quarter legal descriptions are not yet identified. Current working treatment: 14,458.03 ac still Monette-owned, 485 ac sold/unlocated, remaining ~7,008 ac assumed rented/unmapped."
      },
      currentLandStatus:{
        label:"Mapped owned + sold dot + rented unmapped",
        color:"#b48638",
        source:"Wymark sale/title package after January Acre Sheet",
        salePackageOwnedAc:14943.03,
        mappedOwnedAc:14458.03,
        soldUnlocatedAc:485,
        assumedRentedUnmappedAc:7007.97,
        baselineOwnedAc:12753,
        baselineRentedAc:9198,
        note:"Do not read the green mapped Wymark quarters as the whole Wymark operation. The visible quarter geometry comes from the 14,943.03 ac sale/title package. The 485 ac Wymark/Waldeck sale is represented by the red sold marker until legal descriptions identify the exact quarters to paint red; the balance of the 21,951-ac Wymark operating footprint is assumed rented and currently unmapped."
      },
      feedlotProposalQuarters:["SE-18-12-14-W3","NE-18-12-14-W3","NW-18-12-14-W3","SW-18-12-14-W3"],
      feedlotProposalMeta:{
        anchorQuarter:"SE-18-12-14-W3",
        sectionQuarters:["NE-18-12-14-W3","NW-18-12-14-W3","SE-18-12-14-W3","SW-18-12-14-W3"],
        rm:"RM of Lac Pelletier No. 107",
        proximity:"~30 min south of Swift Current; adjacent to Lac Pelletier (lake + regional park) cabin owners + recreational users",
        proposal:"12-month year-round 2,000-head cattle feedlot",
        owner:"Monette Farms Ltd. per ISC titles (98SC10138 / 98SC10138A / 98SC10139). Community tip says 'Darrell Monette purchased land 2022' — title-certificate prefix predates 2022 so the personal-vs-corporate ownership chain needs ISC verification.",
        counterparty:"MLT Aikins (law firm representing Monette before RM of Lac Pelletier No. 107 council)",
        communityResponse:"Petitions circulated; community demands council refuse the proposal. Cabin owners + Lac Pelletier regional park users among opposition.",
        source:"Anonymous Farmer community submission via agnonymous.buperac.com — 2026-04-27 04:33",
        status:"active regulatory dispute — RM council decision pending",
        verificationQueue:[
          "ISC title pull on the 4 quarters of Section 18-12-14-W3 (confirm corporate vs. personal ownership)",
          "Pull RM of Lac Pelletier No. 107 council minutes for the feedlot application + any zoning bylaw amendments",
          "Confirm MLT Aikins is on file as Monette's counsel in the application",
          "Locate the petition + count signatories",
          "Map cabin-owner / regional-park boundaries vs. proposed feedlot footprint"
        ],
        relatedTo:"May explain the Waldeck Lot feedlot carve-out from the Carefoot deal — if Monette is consolidating cattle ops at Lac Pelletier (SE-18-12-14-W3), they would shed the Waldeck Lot feedlot. Or vice versa: the Waldeck Lot feedlot exclusion could be evidence Monette is keeping the cattle business and just selling cropland."
      },
      rumoredSoldQuarters:["NW-3-16-12-W3","SE-15-16-12-W3","SW-15-16-12-W3","NE-17-16-12-W3","NW-17-16-12-W3"],
      rumoredSoldQuartersMeta:{
        buyer:"Carefoot Acres",
        source:"community intel 2026-04-26",
        pieces:3,
        affidavitPrice:1780000,
        affidavitPriceLabel:"$1.78M",
        affidavitAcres:485,
        affidavitPricePerAc:3670,
        affidavitCitation:"CCAA affidavit ¶158 — Phase 2 result",
        quarterAssessments:{
          "NW-3-16-12-W3":297400,
          "NE-17-16-12-W3":263500,
          "NW-17-16-12-W3":148300,
          "SW-15-16-12-W3":281000,
          "SE-15-16-12-W3":228500
        },
        totalAssessment:1218700,
        assessmentSource:"SAMA per Wymark.xlsx (sale-package XLSX, sheet 1-Wymark)",
        pieceBreakdown:[
          {label:"NW-3-16-12-W3 (1 quarter — cropland)", quarters:["NW-3-16-12-W3"], titledAc:162.46, cultivatedAc:157.46, assessment:297400, soil:"J"},
          {label:"S½ Sec 15 (SE-15 + SW-15) — cropland", quarters:["SE-15-16-12-W3","SW-15-16-12-W3"], titledAc:322.35, cultivatedAc:322.35, assessment:509500, soils:["L","M"]},
          {label:"N½ Sec 17 (NE-17 + NW-17) — INCLUDES Waldeck Lot yard", quarters:["NE-17-16-12-W3","NW-17-16-12-W3"], titledAc:261.89, cultivatedAc:259.89, assessment:411800, soil:"J", note:"NW-17-16-12-W3 is the 'Waldeck Lot' per Monette's tender package — see infrastructure block."},
        ],
        totalTitledAc:746.70,
        totalCultivatedAc:739.70,
        totalAssessment:1218700,
        rm:"RM of Excelsior No. 166",
        infrastructure:{
          location:"NW-17-16-12-W3 (Waldeck Lot)",
          source:"Monette Land Tender Information Package — Wymark, SK (docs/Land/Wymark.pdf, Location No. 13)",
          items:[
            "Grain storage: 41,000 bushels",
            "Fertilizer storage: 270 tonnes",
            "2 shops: 40ft × 80ft + 50ft × 80ft (heated)",
            "Office space"
          ],
          excludedFromDeal:[
            "Feedlot / winter feeding"
          ],
          excludedFromDealNote:"Per community intel 2026-04-26 (follow-up): the feedlot at the Waldeck Lot is NOT part of the Carefoot Acres purchase. Post-deal feedlot ownership / operator unknown — may be retained by Monette, sold separately, or carved out for another operator. Note: NW-17-16-12-W3 carries TWO title certificates per Wymark.xlsx (92SC14054 #78 = 107.26 ac main parcel + 92SC14054 #52 = 13.69 ac sub-parcel with 'included' assessment). The 13.69 ac sub-parcel is a strong candidate for the feedlot carve-out footprint, since sub-parcels with separable titles are commonly how working livestock yards are kept out of cropland sales.",
          note:"Waldeck Lot improvements included in the Carefoot deal: grain storage (41,000 bu), fertilizer storage (270 t), 2 heated shops, office space. NOT included: the feedlot/winter feeding facility."
        },
        affidavitMismatch:{
          affidavitAc:485,
          quartersTitledAc:746.70,
          quartersCultivatedAc:739.70,
          gapAc:261.70,
          note:"Quarters total 746.70 ac titled / 739.70 ac cultivated vs. affidavit's 485 ac for the Wymark/Waldeck Phase 2 line item. The presence of the Waldeck Lot yard on NW-17 (41,000 bu grain + 270 t fert + 2 heated shops + feedlot + office) means the 485 ac affidavit figure may be a cropland-equivalent metric that excludes the yard quarter and/or some non-cultivable improved land. Alternatively the Carefoot deal is structured separately from the Phase 2 line item, or only a subset of the 5 quarters is involved. Pending Monitor's Report / ISC titles to reconcile."
        }
      },
      purchaserRumor:{
        status:"buyer + quarters rumored — affidavit ac (485) does NOT match quarter total (746.70)",
        buyer:"Carefoot Acres",
        source:"community intel 2026-04-26",
        priceKnown:true,
        priceCourtDocumented:true,
        label:"Carefoot Acres purchase (Waldeck pieces)",
        metric:"5 quarters / 746.70 ac rumored — affidavit shows 485 ac / $1.78M (gap unresolved)",
        publicBody:"Community intel 2026-04-26 names Carefoot Acres as the buyer of 3 Waldeck pieces — now identified as NW-3-16-12-W3 (1 quarter), S½ Sec 15 (SE-15 + SW-15), and N½ Sec 17 (NE-17 + NW-17), all in RM of Excelsior No. 166. Those 5 quarters total 746.70 ac. CCAA Phase 2 affidavit ¶158 documents 485 ac at Wymark/Waldeck for $1.78M ($3,670/ac) — that figure does NOT match the 746.70 ac of identified quarters. Either the Carefoot deal extends beyond the Phase 2 line item, the Carefoot deal is a separate transaction not in the $1.78M figure, or only a subset of the 5 quarters is actually involved. Pending Monitor's Report / ISC titles to reconcile.",
        publicAsk:"Help confirm whether all 5 named quarters are part of the Carefoot deal, whether the deal price exceeds the affidavit's $1.78M, and whether any portion is a leaseback.",
        publicPrefill:"Wymark / Waldeck Carefoot Acres deal: confirmation of the 5 quarters (NW-3-16-12-W3, SE-15-16-12-W3, SW-15-16-12-W3, NE-17-16-12-W3, NW-17-16-12-W3), full deal price (if different from affidavit's $1.78M), buyer corporate entity, leaseback terms (if any), source, confidence level: ",
        body:"Community intel 2026-04-26 names Carefoot Acres as the buyer of 3 Waldeck pieces, identified as: NW-3-16-12-W3 (1 quarter, 162.46 ac); S½ Sec 15 — SE-15 + SW-15 (2 quarters, 322.35 ac); N½ Sec 17 — NE-17 + NW-17 (2 quarters, 261.89 ac). All in RM of Excelsior No. 166. Total: 5 quarters / 746.70 ac. The Waldeck Lot improvements on NW-17-16-12-W3 are partially included: grain storage (41,000 bu), fertilizer storage (270 t), 2 heated shops, and office space ARE in the deal; the FEEDLOT / winter feeding facility is NOT included (community intel 2026-04-26 follow-up). Note: NW-17 carries two title certificates (107.26 ac main + 13.69 ac sub-parcel) — the 13.69 ac sub-parcel is a strong candidate for the carved-out feedlot footprint. CCAA Phase 2 affidavit ¶158 documents 485 ac at Wymark/Waldeck sold for $1.78M ($3,670/ac) — the 746.70 ac tip total exceeds this by 261.70 ac (54%). Possible reasons: (a) Carefoot deal extends beyond the Phase 2 line item; (b) Carefoot deal is a separate transaction not captured in the $1.78M; (c) only a subset of the 5 quarters is actually involved. Buyer name, quarter list, and feedlot exclusion all rumored. Pending Monitor's Report / ISC titles to reconcile.",
        ask:"Help confirm whether all 5 named quarters (NW-3-16-12-W3, SE-15-16-12-W3, SW-15-16-12-W3, NE-17-16-12-W3, NW-17-16-12-W3) are part of the Carefoot deal, whether the total deal price exceeds the affidavit's $1.78M, and whether any portion is a leaseback.",
        prefill:"Wymark / Waldeck — Carefoot Acres deal: confirmation of the 5 quarters listed, full deal price (if different from affidavit's $1.78M), buyer corporate entity, leaseback terms (if any), source, confidence level: "
      },
      changeLog:[
        {at:"2026-04-27T04:33:00-06:00", type:"intel", title:"Lac Pelletier feedlot proposal — Monette + MLT Aikins vs. RM council", detail:"Anonymous Farmer community submission 2026-04-27 04:33 reports Monette has hired MLT Aikins to push a 12-month year-round 2,000-head cattle feedlot through RM of Lac Pelletier No. 107 council. Proposed location: SE-18-12-14-W3 (anchor) on existing Monette Farms Ltd. Section 18 holdings (~30 min south of Swift Current). Adjacent to Lac Pelletier lake + regional park; cabin owners + recreational users opposed. Petitions circulated, community demanding council refuse the application. Background: tip says Darrell Monette purchased the land in 2022, but ISC title certificates (98SC10138 / 98SC10138A / 98SC10139) predate that — corporate-vs-personal ownership chain needs verification. POSSIBLE CONNECTION TO CAREFOOT DEAL: if Monette is consolidating cattle ops here, that may explain why the Waldeck Lot feedlot was carved out of the Carefoot purchase. All 4 quarters of Section 18 now display a feedlot-proposal popup on the Wymark map."},
        {at:"2026-04-26T18:00:00-06:00", type:"intel", title:"Feedlot at Waldeck Lot is NOT part of Carefoot deal", detail:"Community intel 2026-04-26 (further follow-up): the feedlot / winter feeding facility on the Waldeck Lot (NW-17-16-12-W3) is NOT included in the Carefoot Acres purchase. Other infrastructure on that quarter (41,000 bu grain, 270 t fertilizer, 2 heated shops, office) IS in the deal. Post-deal feedlot ownership/operator unknown. Note: NW-17 carries two title certificates (107.26 ac main + 13.69 ac sub-parcel marked 'included' in assessment per Wymark.xlsx) — the 13.69 ac sub-parcel is a strong candidate for the carved-out feedlot footprint. Map popup for NW-17 now shows feedlot under 'NOT included in Carefoot deal' with a strikethrough."},
        {at:"2026-04-26T17:00:00-06:00", type:"intel", title:"Carefoot Waldeck quarters identified — 5 quarters / 746.70 ac (does NOT match affidavit's 485 ac)", detail:"Community intel 2026-04-26 (follow-up): the 3 Waldeck pieces rumored sold to Carefoot Acres are now identified as NW-3-16-12-W3 (1 quarter, 162.46 ac); S½ Sec 15 — SE-15 + SW-15 (2 quarters, 322.35 ac); N½ Sec 17 — NE-17 + NW-17 (2 quarters, 261.89 ac). All in RM of Excelsior No. 166. Total: 5 quarters / 746.70 ac. The 5 quarters now display as 'sold' (provisional) on the Wymark map via the new property-level `rumoredSoldQuarters` mechanism. ACREAGE DISCREPANCY: 746.70 ac > affidavit's 485 ac (gap 261.70 ac, 54%). Either the Carefoot deal exceeds the Phase 2 line item, the Carefoot deal is separate from the affidavit's $1.78M figure, or only a subset of the 5 quarters is actually involved. Buyer attribution dropped from sold-wymark-waldeck row pending reconciliation."},
        {at:"2026-04-26T15:30:00-06:00", type:"data-fix", title:"Wymark split clarified from Acre Sheet baseline", detail:"Acre Sheet baseline remains 21,951 farmed ac. Later Wymark sale/title package shows 14,943.03 ac titled to Monette entities. Phase 2 sale subtracts 485 ac from the Monette-owned bucket, leaving 14,458.03 ac current working owned; the remaining ~7,008 ac is treated as rented/unmapped until legal locations are identified."},
        {at:"2026-04-26T00:00:00-06:00", type:"intel", title:"Carefoot Acres rumored to be the Waldeck buyer (3 pieces)", detail:"Community intel 2026-04-26: 3 pieces near Waldeck reportedly sold to local farm Carefoot Acres. Court affidavit ¶158 documents the Phase 2 result as 485 ac for $1.78M ($3,670/ac) at Wymark (Waldeck) — bundled as a single line item. The buyer name (Carefoot Acres) is community intel only; the per-piece breakdown is not in the affidavit."},
      ],
      publicNotes:"Wymark starts from the January Acre Sheet baseline of 21,951 farmed ac. The later Wymark sale/title package identifies 14,943.03 ac titled to Monette entities; the remaining ~7,008 ac is treated as rented/unmapped until lease-quarter locations are identified. CCAA Phase 2 result for Wymark (Waldeck) is court-documented at 485 ac / $1.78M (affidavit ¶158); Carefoot Acres is a community-intel buyer rumor for the 3 Waldeck pieces, and the per-piece breakdown of the 485 ac is not in the affidavit.",
      notes:"Neville village parcels included. CCAA Phase 2 disposed 485 ac at Wymark (Waldeck) for $1.78M ($3,670/ac) per court affidavit ¶158 — Carefoot Acres rumored to be the buyer of the 3 pieces (community intel 2026-04-26, buyer not court-confirmed)." },
    { id:"eddystone", name:"Eddystone", province:"MB", region:"Interlake MB", lat:51.13, lng:-99.47,
      rms:["Municipality of Alonsa","Municipality of McCreary"],
      parcels:167, titled:26632, cultivated:18400, waste:3572, assessment:28900000, owned:10114, rented:16518,
      soils:[["E",9200],["F",6800],["G",3100],["J",1800]],
      crops2025:[["LL Canola",15505],["Barley",5277],["RR Canola",4051]],
      crops2024:[["RR Canola",13594],["RR Corn",4444],["TWTS",4370],["RR Corn/RR Canola",2320],["Millet",791]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RM Alonsa",
        farmedAc:21972,
        ownedAc:26632,
        rentedAc:0,
        buildingValue:8500000,
        pricePerAc:2316,
        totalValue:70179712,
        note:"Note: Property Summary owned (26,632) > farmed (21,972). The 'owned' column likely counts total titled ac including pasture/non-cultivated. Edgelytone in source doc = Eddystone in data.js."
      },
      landowners:[
        {name:"Non-MFL third parties (anonymized)", acres:16518, role:"third-party", note:"XLSX masks these as '3rd Party Vendor'; buildings sheet lists yards by surname (Huber, Hammel, Regan, Finney, Bretecher, Reykjavik) suggesting multiple landlord families."},
        {name:"Monette Farms Ltd.", acres:10114, role:"monette"},
      ],
      communityAsk:{
        label:"Eddystone landlord identification request",
        acres:"~16,500 ac",
        body:"About 62% of the Eddystone block (~16,518 of 26,632 ac) is NOT owned by Monette Farms Ltd. — the source XLSX masks these titles as '3rd Party Vendor'. The buildings sheet is explicit: every named yard (Huber, Hammel, Regan, Finney, Bretecher, Reykjavik, 481, Haunted House, Bin) sits on non-MFL land. We're trying to identify the actual landlord families/entities, confirm lease vs. custom-farm terms, and flag any 2026 listing or sale activity.",
        prefill:"Eddystone non-MFL landlord info - quarter/legal descriptions, owner or entity name, operator/lease/sale/listing status, seeded/sprayed/harvested observation, source, and confidence level: "
      },
      operator:"Monette (custom-farming ~16,500 ac of multi-family non-MFL land)",
      notes:"Manitoba Interlake block, 26,632 ac across 167 unique quarters (178 title lines). Only 10,114 ac (38%) held by Monette Farms Ltd.; the remaining 16,518 ac (62%) is non-MFL third-party land anonymized in source as '3rd Party Vendor'. Multiple landlord families indicated by yard names (Huber, Hammel, Regan, Finney, Bretecher). All 10 named building complexes sit on non-MFL land per the buildings sheet header. Cultivated/waste/assessment figures reflect the earlier scope and are not yet reconciled to the full 26,632 ac.", headline:true },
    { id:"the-pas", name:"The Pas", province:"MB", region:"Northern MB", lat:53.82, lng:-101.25,
      rms:["Rural Municipality of Kelsey"],
      parcels:147, titled:28589, cultivated:24100, waste:4489, assessment:38200000, owned:28257, rented:332,
      soils:[["E",11000],["F",8400],["G",5200],["D",2100]],
      crops2025:[["Wheat",9400],["RR Canola",7800],["Grass",4600],["LL/RR Canola",3800]],
      crops2024:[["RR Canola",10200],["LL Canola",5400],["Wheat",4900],["Grass",2200]],
      propertySummary:{
        source:"Monette Property Summary (docs/Land/Acre Sheet.jpg)",
        rmArea:"RM Kelsey",
        farmedAc:28589,
        ownedAc:21676,
        rentedAc:6913,
        buildingValue:6333000,
        pricePerAc:3752,
        totalValue:87661352
      },
      notes:"Largest single block in Manitoba. 97% owned.", headline:true },
    { id:"airdrie", name:"Airdrie / Soderglen", province:"AB", region:"Balzac / Airdrie, AB", lat:51.2917, lng:-114.0144,
      rms:["Rocky View County (Balzac)"],
      parcels:0, titled:7000, cultivated:0, waste:0, assessment:0, owned:160, rented:6840,
      soils:[], crops2025:[], crops2024:[],
      segment:"Grain / Cattle", legalOwner:"Monette Farms", beneficialOwner:"Unrestricted LP",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","hq","soderglen","rented-block","needs-geometry"],
      landowners:[
        {name:"Soderglen Ranches Ltd. / Grad estate", acres:6840, role:"third-party", note:"Presumed — user intel (2026): Monette rents 'all Soderglen land' in Rocky View County. 28.5 km² (~7,042 ac) ranch footprint per The Albertan (2023-08-02). Monitor real-property schedule not yet public."},
        {name:"Monette Farms Ltd.", acres:160, role:"monette", note:"SW-5-28-1-W5 purchased 2024-04-12 for $20,144,000 from the Grad estate; $16,967,000 first-ranking vendor-take-back at 0%; Jane E. Grad life-tenancy at $1/yr."}
      ],
      communityAsk:{
        label:"Soderglen lease evidence request",
        acres:"~6,800-7,000 ac",
        body:"User report: Monette custom-farms all Soderglen Ranches land in Rocky View County (Balzac, between Calgary and Airdrie). Only 160 ac (SW-5-28-1-W5) was actually purchased from the Grad estate in 2024 for $20.144M — the remaining ~6,840 ac of the ~7,000-ac ranch appears to be rented or custom-farmed under the vendor-take-back arrangement. Soderglen.com is offline and the Monitor's Real-Property Schedule isn't yet public. We're looking for lease terms, parcel-level legal descriptions, rent per acre, or on-the-ground confirmation that Monette is working the full Soderglen block.",
        prefill:"Soderglen / Balzac Monette lease info - quarter/legal descriptions, lease term, rent per acre, operator observation, source, confidence level: "
      },
      operator:"Monette (custom-farms the full Soderglen block; owns only SW-5-28-1-W5)",
      notes:"Airdrie / Soderglen block in Rocky View County, AB — 28.5 km² (~7,000 ac) ranch between Calgary and Airdrie. Soderglen owner Stan Grad passed 2023-07-29; the ranch went to market in August 2023. Monette purchased one 160-ac quarter (SW-5-28-1-W5) on 2024-04-12 for $20.144M with a $16.967M vendor-take-back mortgage and a $1/yr life-tenancy for Jane E. Grad. Per user intel (2026), Monette custom-farms the balance of Soderglen — presumed rented, pending Monitor schedule. A 160-ac Janet Dunn 66 2/3% JV also sits within this block per the Darrel Monette affidavit.", headline:true },
    { id:"swift-current", name:"Swift Current", province:"SK", region:"Southwest SK", lat:50.2851, lng:-107.7972,
      rms:["Swift Current area"],
      parcels:0, titled:49775, cultivated:0, waste:0, assessment:0, owned:49775, rented:0,
      soils:[], crops2025:[], crops2024:[],
      segment:"Grain / Cattle", legalOwner:"Monette Farms", beneficialOwner:"Restricted LP",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","origin","stewart-valley","needs-geometry"],
      notes:"Court-file Swift Current block and family-origin asset. Includes the Stewart Valley sale story but needs parcel-level reconciliation before it can be drawn as boundaries.", headline:true },
    { id:"regina-south", name:"Regina South", province:"SK", region:"Regina, SK", lat:50.215, lng:-104.618,
      rms:["Regina South area"],
      parcels:0, titled:32056, cultivated:0, waste:0, assessment:0, owned:32056, rented:0,
      soils:[], crops2025:[], crops2024:[],
      segment:"Grain", legalOwner:"Monette Farms", beneficialOwner:"Restricted LP",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","regina-i","needs-geometry"],
      notes:"Court-file Regina South asset. Regina I sale proceeds are part of the restructuring story; boundary mapping is still pending.", headline:true },
    { id:"outlook-seeds", name:"Outlook Seeds Plant", province:"SK", region:"Outlook, SK", lat:51.489, lng:-107.054,
      rms:["Outlook area"],
      parcels:0, titled:2, cultivated:0, waste:0, assessment:0, owned:2, rented:0,
      soils:[], crops2025:[["Seed processing",2]], crops2024:[],
      segment:"Seeds", legalOwner:"Seeds Ltd.", beneficialOwner:"Unrestricted LP",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","seed-processing","needs-geometry"],
      notes:"Court-file seed manufacturing plant: 2 acres with a roughly 160,000 sq ft building. Point-only because this is a facility, not a quarter-section block." },
    { id:"bc-ranches", name:"BC Ranches", province:"BC", region:"Kamloops, BC", lat:50.6745, lng:-120.3273,
      rms:["Kamloops area"],
      parcels:0, titled:44966, cultivated:0, waste:0, assessment:0, owned:44966, rented:0,
      soils:[], crops2025:[["Cattle / Produce",44966]], crops2024:[],
      segment:"Cattle / Produce", legalOwner:"Monette Farms BC", beneficialOwner:"MF BC LP",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","bc-ranches","blue-goose","ritchie-bros","needs-geometry"],
      notes:"Court-file BC Ranches asset. The land is tied to 1.2 million acres of grazing licences and the failed Ritchie Bros tender. Point-only until ranch polygons are sourced.", headline:true },
    { id:"goats-peak", name:"Goat's Peak Vineyard", province:"BC", region:"Cache Creek, BC", lat:50.8100, lng:-121.3250,
      rms:["Cache Creek area"],
      parcels:0, titled:60, cultivated:0, waste:0, assessment:0, owned:60, rented:0,
      soils:[], crops2025:[["Vineyard",60]], crops2024:[],
      segment:"Vineyard", legalOwner:"Goat's Peak Winery", beneficialOwner:"Goat's Peak",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","goats-peak","winery","needs-geometry"],
      notes:"Court-file Goat's Peak Winery real property. The winery is defunct but still carries real property, barrels, equipment, and vineyard assets." },
    { id:"aguila", name:"Aguila Farm", province:"AZ", region:"Aguila, AZ", lat:33.9428, lng:-113.1741,
      rms:["Aguila area"],
      parcels:0, titled:3134, cultivated:0, waste:0, assessment:0, owned:3134, rented:0,
      soils:[], crops2025:[["Produce",3134]], crops2024:[],
      segment:"Produce", legalOwner:"MF Arizona", beneficialOwner:"Direct",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","produce","arizona","needs-geometry"],
      notes:"Court-file Arizona produce farm. Added as a point-only asset until US parcel boundaries are sourced." },
    { id:"genoa", name:"Genoa Farm", province:"CO", region:"Genoa, CO", lat:39.2767, lng:-103.4988,
      rms:["Genoa area"],
      parcels:0, titled:4079, cultivated:0, waste:0, assessment:0, owned:4079, rented:0,
      soils:[], crops2025:[["Grain",4079]], crops2024:[],
      segment:"Grain", legalOwner:"Monette USA", beneficialOwner:"Direct",
      geometryStatus:"point-only", locationPrecision:"regional", tags:["court-file","colorado","needs-geometry"],
      notes:"Court-file Colorado grain farm. Added as a point-only asset until county parcel boundaries are sourced." },
    { id:"tonopah", name:"Tonopah Seeds Facility", province:"AZ", region:"Tonopah, AZ", lat:33.4936, lng:-112.9364,
      rms:["Tonopah area"],
      parcels:0, titled:23, cultivated:0, waste:0, assessment:0, owned:23, rented:0,
      soils:[], crops2025:[["Idle seed facility",23]], crops2024:[],
      segment:"Produce / Seed", legalOwner:"Seeds USA", beneficialOwner:"Direct",
      geometryStatus:"point-only", locationPrecision:"address-approx", tags:["court-file","seed-processing","listed","needs-geometry"],
      notes:"Court-file Arizona Seeds Facility. Idle and listed; point is approximate to the Tonopah facility address until parcel evidence is attached." },
    { id:"montana", name:"Montana", province:"MT", region:"Big Horn County, SE Montana", lat:45.62, lng:-107.81,
      rms:["Big Horn County"],
      parcels:220, titled:51529, cultivated:0, waste:0, assessment:12947977, owned:51529, rented:42395,
      soils:[],
      crops2025:[], crops2024:[],
      propertySummary:{
        source:"Montana DNRC/DOR cadastral (owned) + March 2026 tender packages (rented)",
        rmArea:"Big Horn County",
        farmedAc:93924,           // 51,529 cadastral-owned + 42,395 tender-rented
        ownedAc:51529,            // DNRC cadastral, MONETTE FARMS USA INC, pulled 2026-04-26
        rentedAc:42395,           // Sum across Camp 1 + Camp 4 + Fly Creek tender PDFs (AgriLeasing + Private)
        buildingValue:12600091,
        pricePerAc:3000,
        totalValue:163661089,
        note:'Source-of-truth flipped 2026-04-26: Montana DNRC/DOR cadastral query (refreshed monthly) now seeds owned acres directly — 220 parcels under MONETTE FARMS USA INC = 51,528.893 assessed ac. Rented acres come from the March 2026 tender packages (Camp 1, Camp 4, Fly Creek), which explicitly break out AgriLeasing + Private lessor categories: 41,031 ac AgriLeasing + 1,364 ac Private = 42,395 ac rented. The January 2026 Acre Sheet is retained only as a reconciliation overlay; its lower 23,982 ac rented total is unexplained and likely stale or methodology-specific.'
      },
      sourceOfTruth:{
        role:"primary-owned-baseline",
        label:"Montana DNRC/DOR public cadastral records (refreshed monthly)",
        ownerQuery:"OwnerName = 'MONETTE FARMS USA INC'",
        service:"https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/MapServer/0/query",
        metadataDate:"2026-03-05",
        pulledAt:"2026-04-26",
        taxYear:2026,
        cadence:"Montana State Library publishes county cadastral data monthly; check first week of each month for refresh.",
        parcels:220,
        assessedAcres:51528.893,
        gisAcres:51711.93,
        rule:"Owned acres in MT are sourced from this monthly cadastral pull (not the Acre Sheet). When parcel count, assessed acreage, or owner names change month-over-month, treat the change as evidence of a sale/transfer and update the map. Acre Sheet is reconciliation overlay only."
      },
      tenderRentedBreakdown:{
        source:"March 2026 Land Tender Information Packages (offer deadline 2026-03-02)",
        files:["docs/Land/Camp_1.pdf","docs/Land/Camp_4.pdf","docs/Land/Flycreek.pdf"],
        note:"Tender PDFs explicitly categorize each block's farmed footprint into MFUSA (Monette-titled), AgriLeasing (Monette-affiliated leasing entity), and Private (third-party landlord). MFUSA totals match the Acre Sheet's owned figure (53,745 ac) almost exactly, but the cadastral query only catches 51,529 of those — a ~2,216 ac gap likely titled in a subsidiary/variant name. Rented = AgriLeasing + Private.",
        blocks:[
          { id:"camp-1",   name:"Camp 1, MT",   yardLocation:"1255 Ragland Road, Hardin",   totalFarmedAc:18692.63, mfusaAc:9533.44,  agriLeasingAc:9159.19,  privateAc:0,       rentedAc:9159.19 },
          { id:"camp-4",   name:"Camp 4, MT",   yardLocation:"S09 T05S R31E + S14 T06S R31E", totalFarmedAc:38201.51, mfusaAc:11454.65, agriLeasingAc:25417.76, privateAc:1329.10, rentedAc:26746.86 },
          { id:"fly-creek",name:"Fly Creek, MT",yardLocation:"5335 S Fly Creek Rd, Hardin",  totalFarmedAc:39245.80, mfusaAc:32756.50, agriLeasingAc:6454.30,  privateAc:35.00,   rentedAc:6489.30 },
        ],
        totals:{ farmedAc:96139.94, mfusaAc:53744.59, agriLeasingAc:41031.25, privateAc:1364.10, rentedAc:42395.35 }
      },
      acreSheetReconciliation:{
        source:"docs/Land/Acre Sheet.jpg (January 2026 Property Summary)",
        ownedAc:53745,
        rentedAc:23982,
        rentedBreakdownAsReported:{ flyCreekAc:1332, camp1Ac:5293, camp4Ac:17357 },
        status:"superseded-by-tender-pdfs-and-cadastral",
        discrepancy:"Acre Sheet owned (53,745) ties to tender-PDF MFUSA total (53,745). Acre Sheet rented (23,982) is ~18,400 ac below tender-PDF rented (42,395) — methodology unknown. Likely the Acre Sheet excludes AgriLeasing acres on the theory they are effectively owned through a Monette-affiliated leasing entity. Tender PDFs are the operationally-correct source for what Monette currently farms."
      },
      currentLandStatus:{
        source:"DNRC cadastral (owned) + March 2026 tender PDFs (rented)",
        mappedOwnedAc:51529,
        rentedAc:42395,
        unmappedMfusaAc:2216,
        note:"Owned acres come from monthly DNRC cadastral pull (51,529 ac mapped). Rented acres come from the March 2026 tender packages (42,395 ac across Camp 1 / Camp 4 / Fly Creek). The ~2,216 ac gap between cadastral owned and tender MFUSA totals reflects parcels likely titled in a Monette subsidiary/variant name not caught by the OwnerName='MONETTE FARMS USA INC' filter. Treat rented blocks as still operated by Monette unless community votes (or a future cadastral pull showing a transfer) prove otherwise."
      },
      segment:"Grain", legalOwner:"Monette USA", beneficialOwner:"Direct",
      geometryStatus:"public-cadastral-owner-query", locationPrecision:"state-cadastral-boundary", tags:["court-file","montana","ekagrata","monthly-cadastral-refresh"],
      subAssets:[
        { name:"DNRC owner query — Monette Farms USA Inc.", acres:51529 },
        { name:"Camp 1 — AgriLeasing + Private (rented)", acres:9159 },
        { name:"Camp 4 — AgriLeasing + Private (rented)", acres:26747 },
        { name:"Fly Creek — AgriLeasing + Private (rented)", acres:6489 },
      ],
      changeLog:[
        {at:"2026-04-26T00:00:00-06:00", type:"source-of-truth", title:"Montana baseline switched to public cadastral owner records", detail:"Montana DNRC/DOR cadastral owner query for MONETTE FARMS USA INC now seeds the original map layer: 220 Big Horn County parcels, TaxYear 2026, 51,528.893 assessed ac / 51,711.930 GIS ac. The January 2026 Acre Sheet remains a farmed-acre reconciliation overlay, not the controlling title geometry for this area."},
        {at:"2026-04-26T12:00:00-06:00", type:"source-of-truth", title:"Rented acres switched from Acre Sheet to March 2026 tender PDFs", detail:"Per-block tender packages (Camp 1 / Camp 4 / Fly Creek) explicitly categorize farmed land into MFUSA / AgriLeasing / Private. Total rented (AgriLeasing + Private) = 42,395 ac, ~18,400 ac higher than the Acre Sheet's 23,982 ac rented. Acre Sheet's MFUSA-equivalent owned figure (53,745) ties exactly to the tender PDFs, suggesting the Acre Sheet excluded AgriLeasing as effectively-owned. The dropped derived figure assumedRentedUnmappedAc:26,198 (= 77,727 farmed − 51,529 cadastral-owned) is no longer used; explicit rented breakdown supersedes it."}
      ],
      notes:"Court-file Big Horn County composite: Fly Creek, Camp 1 (Hardin/Dunmore/Crow Agency), Camp 4 (Crow Reservation, St-Xavier/Fort Smith), plus Nieden/Niessen and Ragland blocks. Owned footprint = monthly DNRC cadastral pull (51,529 ac under MONETTE FARMS USA INC). Rented footprint = March 2026 tender PDFs (42,395 ac across the three blocks, AgriLeasing + Private lessors). Total operational footprint ~93,924 ac. Treat rented blocks as still farmed by Monette unless community votes report otherwise.", headline:true },
  ],

  soldProperties: [
    { id:"sold-regina-i", name:"Regina I", province:"SK", region:"Regina, SK", lat:50.4452, lng:-104.6189, acres:null, price:41180000, pricePerAcre:null, closed:"2025", phase:"Pre-Forbearance", notes:"Regina farmland sale consented before the CCAA filing." },
    { id:"sold-havre", name:"Havre Land", province:"MT", region:"Havre / Box Elder, MT", lat:48.55, lng:-109.68, acres:17000, price:47500000, pricePerAcre:2794, closed:"2025", phase:"Pre-Forbearance", notes:"Montana Box Elder/Havre lands sold before the CCAA filing." },
    { id:"sold-stewart-valley", name:"Stewart Valley", province:"SK", region:"Swift Current, SK", lat:50.44, lng:-107.88, acres:12932, price:54080000, priceLabel:"$54.08M", pricePerAcre:null, reportedPricePerAcre:5312, appraisalPremium2025Pct:158, closed:"Mar 2026", phase:"Phase 1", notes:"Swift Current-area sale that closed after Phase 1. Court materials report $5,312/ac, but that does not reconcile arithmetically with 12,932 acres and $54.08M, so public UI should hold price-per-acre until reconciled." },
    { id:"sold-hafford-phase-2", name:"Hafford (Monette portion)", province:"SK", region:"Hafford, SK", lat:52.74, lng:-107.37, acres:3657, price:29000000, pricePerAcre:7930, closed:"Phase 2", phase:"Phase 2", buyer:"Walter Farms (rumored)", buyerStatus:"rumored",
      priceBreakdown:{
        total:29000000, totalLabel:"$29M",
        components:[
          {label:"Yard / shop infrastructure (rumored)", amount:12000000, amountLabel:"~$12M", source:"community intel 2026-04-24 — yard chain Raptor → Monette → Walter Farms; Monette reportedly paid Raptor ~$12M for the yard"},
          {label:"Cropland (implied)", amount:17000000, amountLabel:"~$17M", acres:3657, pricePerAcre:4650, note:"Implied: $29M total − ~$12M yard ≈ $17M for ~3,657 ac ≈ ~$4,650/ac, in line with comparable SK cropland."},
        ],
        replacementValueRef:{label:"Insured/replacement value of Hafford buildings (Property Summary)", amount:20291000, amountLabel:"$20.29M", note:"Replacement value (insurance basis) — typically higher than market price."}
      },
      notes:"CCAA Phase 2 result (court affidavit ¶158): $29M for the Monette-owned Hafford position. The affidavit lists the line item as 2,553 ac (Monette Farms Ltd.), but Ledger working assumption is that the 1,104 ac Monette Ag Ventures Ltd. portion was bundled into the same $29M transaction (= 3,657 ac total at $7,930/ac). Within the $29M, community intel (kyle first-hand 2026-04-24) puts the Hafford yard / shop infrastructure at ~$12M (yard chain: Raptor → Monette → Walter Farms). That implies ~$17M for the ~3,657 ac of cropland alone (~$4,650/ac), which sits in the normal SK cropland-with-no-yard range. For reference: Monette's Property Summary lists Hafford building replacement value at $20.29M — that is insured/replacement cost and runs higher than market. Walter Farms rumored to be the buyer (community intel 2026-04-24/25, pending Monitor's Report). The 20,795 ac Raptor (Simmons) position and 22,013 ac unmapped rented portion are not included in the $29M figure — separate community-intel claims with no disclosed price." },
    { id:"sold-wymark-waldeck", name:"Wymark / Waldeck", province:"SK", region:"Wymark, SK", lat:50.11, lng:-107.63, acres:485, price:1780000, pricePerAcre:3670, closed:"Phase 2", phase:"Phase 2", buyer:null, buyerStatus:"unknown", hideMapMarker:true, notes:"CCAA Phase 2 result (court affidavit ¶158): 485 ac for $1.78M ($3,670/ac), bundled as a single Phase 2 line item. Community intel 2026-04-26 named Carefoot Acres as buyer of 3 Waldeck pieces — but the 5 quarters identified in the tip total 746.70 ac, which exceeds this 485 ac affidavit figure by 261.70 ac (54%). Buyer attribution removed from this row pending reconciliation. Map marker hidden because the 5 quarters now display in their actual locations as red 'sold' parcels on the Wymark map (with hover popups carrying the Carefoot rumor + Waldeck Lot infrastructure context)." },
  ],

  // Community-submitted scrolling headlines. Launch-day seed is the CCAA
  // filing; everything else arrives via the "+ Submit headline" button.
  headlines: [
    { id:1, text:"Monette Farms files for CCAA protection — 311,637 acres enter stay",  author:"Ledger", when:"0d" },
  ],

  // CCAA + portfolio timeline
  timeline: [
    { date:"Apr 21, 2026", label:"CCAA filing (Day 0)",          detail:"Initial stay of proceedings granted" },
    { date:"May 05, 2026", label:"First Monitor's Report",        detail:"Asset schedule filed" },
    { date:"May 12, 2026", label:"SISP motion",                   detail:"Sale and Investment Solicitation Process to be approved" },
    { date:"Jun 02, 2026", label:"Comeback hearing",              detail:"Stay extension expected" },
    { date:"Jul 15, 2026", label:"Phase 1 bids due",              detail:"Letters of intent deadline" },
  ],
};

// ------- STATUS META -------
window.MONETTE_DATA.ownership = {
  "owned-monette":     { label:"Still Monette-owned",                color:"#4e6a30", short:"Owned" },
  "sold":              { label:"Sold",                               color:"#9a3a2a", short:"Sold" },
  "sold-rented-back":  { label:"Sold + rented back (sale-leaseback)", color:"#b48638", short:"Sold/R-back" },
  "rented-monette":    { label:"Still Monette-rented",               color:"#5aa6c9", short:"Rented" },
  "returned-to-ll":    { label:"Returned to landlord",               color:"#8a7a5a", short:"Returned" },
  "unknown":           { label:"Status unknown",                     color:"#6a6a6a", short:"Unknown" },
};
window.MONETTE_DATA.listing = {
  "not-listed":       { label:"Not listed",       color:"#8a7a5a" },
  "listed-for-sale":  { label:"Listed for sale",  color:"#b48638" },
  "listed-for-rent":  { label:"Listed for rent",  color:"#7a8538" },
};
window.MONETTE_DATA.season = {
  seeded:     { yes:"Seeded",      no:"Unseeded",    color:"#5a7a3a" },
  sprayed:    { yes:"Sprayed",     no:"No spray report", color:"#b48638" },
  harvested:  { yes:"Harvested",   no:"Unharvested", color:"#b48638" },
};

window.MONETTE_DATA.headlines = [
  { id: 5, text: "Lac Pelletier feedlot fight: Monette + MLT Aikins pushing RM 107 council to approve 12-month 2,000-head feedlot at SE-18-12-14-W3 — cabin owners + park users opposed, petitions circulating (Anonymous Farmer tip 2026-04-27)", author: "Ledger", when: "0d" },
  { id: 4, text: "Carefoot Acres rumored to have bought 3 Waldeck pieces / 5 quarters (NW-3, S½ Sec 15, N½ Sec 17 in RM Excelsior 166) — feedlot at Waldeck Lot is NOT in the deal; grain, fertilizer, shops, office are (community intel 2026-04-26)", author: "Ledger", when: "1d" },
  { id: 3, text: "Walter Farms rumored to be the unofficial purchaser of the entire Monette portfolio — price unknown, Monitor's Report pending", author: "Ledger", when: "0d" },
  { id: 2, text: "Hafford yard + Monette-owned 3,658 ac — Walter Farms rumored to be the buyer (community intel 2026-04-24)", author: "Ledger", when: "0d" },
  { id: 1, text: "Court-file roster added - 22 property records plus sold assets now visible", author: "Ledger", when: "1d" },
];

// Keep province totals derived from the property rows so the public copy
// cannot drift away from the underlying dataset.
(function recomputeTotals() {
  const totals = {};
  for (const prop of window.MONETTE_DATA.properties || []) {
    const key = prop.province.toLowerCase();
    const slot = totals[key] || {
      properties: 0,
      totalAcres: 0,
      owned: 0,
      rented: 0,
      pctOwned: 0,
      largest: null,
      largestAcres: 0,
    };
    slot.properties += 1;
    slot.totalAcres += prop.titled || 0;
    slot.owned += prop.owned || 0;
    slot.rented += prop.rented || 0;
    if ((prop.titled || 0) > slot.largestAcres) {
      slot.largest = prop.name;
      slot.largestAcres = prop.titled || 0;
    }
    totals[key] = slot;
  }
  for (const slot of Object.values(totals)) {
    slot.pctOwned = slot.totalAcres ? Math.round((slot.owned / slot.totalAcres) * 100) : 0;
  }
  window.MONETTE_DATA.totals = totals;
})();
