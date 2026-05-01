// VIEW 3 - Map. Public-facing status atlas.
//
// Experience order:
//   portfolio -> property status board
//   property  -> footprint focus + ownership context
// Mapped quarters expose status colors, season marks, and vote routing.

const STATUS_MODE = {
  key: "status",
  label: "Status Atlas",
  heading: "Portfolio status view",
  description: "Use this to scan control, sale pressure, portfolio shape, and quarter status wherever mapped geometry is available.",
};

const EMPTY_FILTER = ["==", ["get", "property_id"], "__none__"];
const EMPTY_PROP_FILTER = ["==", ["get", "id"], "__none__"];
const ALL_PARCELS_FILTER = ["has", "property_id"];

const PROPERTY_SOURCE = "monette-properties";
const PROPERTY_LABEL_SOURCE = "monette-property-labels";
const PROPERTY_POINT_SOURCE = "monette-property-points";
const SOLD_ASSET_SOURCE = "monette-sold-assets";
const OPERATOR_RELATIONSHIP_SOURCE = "monette-operator-relationships";
const PARCEL_SOURCE = "monette-parcels";

const PROPERTY_FILL_LAYER = "monette-property-fill";
const PROPERTY_GLOW_LAYER = "monette-property-glow";
const PROPERTY_OUTLINE_LAYER = "monette-property-outline";
const PROPERTY_SELECTED_LAYER = "monette-property-selected";
const PROPERTY_POINT_LAYER = "monette-property-point";
const SOLD_ASSET_LAYER = "monette-sold-asset-point";
const SOLD_ASSET_LABEL_LAYER = "monette-sold-asset-labels";
const OPERATOR_RELATIONSHIP_LAYER = "monette-operator-relationship-point";
const OPERATOR_RELATIONSHIP_LABEL_LAYER = "monette-operator-relationship-labels";
const PROPERTY_LABEL_LAYER = "monette-property-labels";
const SELECTED_PARCEL_FILL_LAYER = "monette-selected-parcel-fill";
const SELECTED_PARCEL_OUTLINE_LAYER = "monette-selected-parcel-outline";
const SELECTED_PARCEL_SEASON_LAYER = "monette-selected-parcel-season-labels";
const SELECTED_QUARTER_EVIDENCE_FILL_LAYER = "monette-selected-quarter-evidence-fill";
const SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER = "monette-selected-quarter-evidence-outline";
const EMPTY_PARCEL_FILTER = ["==", ["get", "loc"], "__none__"];

// ─── Atlas display modes ───────────────────────────────────────────────────
// Two modes: "seeding" (SAR change-detection per parcel) and "land-status"
// (ownership colors; renamed from the old "tenure" key by Codex bvqyinxv4
// Q3 — using new mode-key VALUES intentionally invalidates any old saved
// "tenure"/"vigor" localStorage entries so users naturally fall back to
// the Seeding default during the active window).
// Default = "seeding" during Apr 1–Jun 30 seeding window; falls back to
// "land-status" outside that window. Vigor (NDVI) was dropped as a public
// mode in the homepage redesign 2026-04-29; ndvi_mean stays in the producer
// pipeline as model evidence and may return as a Seeding overlay in v1.5.
const ATLAS_MODE_KEY = "monette.atlas.mode.v2";

const ATLAS_MODES = [
  {
    key: "seeding",
    label: "Seeding Progress",
    heading: "Seeding progress map",
    description: "GEE-backed seeding read: green is likely seeded; grey is unseeded or not confident enough to call.",
  },
  {
    key: "land-status",
    label: "Land Status",
    heading: "Land status map",
    description: "Ownership status fill: green owned, blue rented, red sold or sale-leaseback.",
  },
];

function defaultAtlasMode() {
  const saved = (function() { try { return localStorage.getItem(ATLAS_MODE_KEY); } catch (e) { return null; } })();
  if (saved && ATLAS_MODES.some((m) => m.key === saved)) return saved;
  const now = new Date();
  const mo = now.getMonth() + 1; // 1-indexed
  return (mo >= 4 && mo <= 6) ? "seeding" : "land-status";
}

// Seeding mode is intentionally binary on the public map: green means the
// GEE/SAR read cleared the seeded threshold; grey means unseeded, uncertain,
// out-of-season, or not enough baseline. Confidence still modulates the green
// strength and remains visible in the drawer.
function _lerpRgb(low, high, t) {
  const r = Math.round(low[0] + (high[0] - low[0]) * t);
  const g = Math.round(low[1] + (high[1] - low[1]) * t);
  const b = Math.round(low[2] + (high[2] - low[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function seedingFillColor(applicability, seeded, confidence) {
  if (applicability === "active") {
    const t = Math.max(0.25, Math.min(1, (confidence || 0) / 100));
    if (seeded === true) return _lerpRgb([174, 205, 165], [58, 140, 42], t);
    return "#686868";
  }
  if (applicability === "insufficient_baseline") return "#5f5f5f";
  if (applicability === "out-of-season" || applicability === "perennial") return "#555d5f";
  return "#4f4f4f";
}

const PARCEL_SEEDING_FILL_LAYER = "monette-parcel-seeding-fill";
const PARCEL_SEEDING_OUTLINE_LAYER = "monette-parcel-seeding-outline-lowqc";

function imageryKey(propId, loc) {
  return `${propId}:${loc}`;
}

function parcelTitledAcres(props) {
  const raw = props && (props.titled_ac ?? props.title_acres ?? props.acres ?? props.ac);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function makeBounds() {
  return [Infinity, Infinity, -Infinity, -Infinity];
}

function hasBounds(bounds) {
  return Array.isArray(bounds) &&
    bounds.length === 4 &&
    Number.isFinite(bounds[0]) &&
    Number.isFinite(bounds[1]) &&
    Number.isFinite(bounds[2]) &&
    Number.isFinite(bounds[3]);
}

function extendBounds(bounds, geometry) {
  if (!bounds || !geometry) return;
  const polys =
    geometry.type === "Polygon" ? [geometry.coordinates] :
    geometry.type === "MultiPolygon" ? geometry.coordinates :
    [];

  polys.forEach((poly) => {
    poly.forEach((ring) => {
      ring.forEach((coord) => {
        const lng = coord[0];
        const lat = coord[1];
        if (lng < bounds[0]) bounds[0] = lng;
        if (lat < bounds[1]) bounds[1] = lat;
        if (lng > bounds[2]) bounds[2] = lng;
        if (lat > bounds[3]) bounds[3] = lat;
      });
    });
  });
}

function centerFromBounds(bounds, fallback) {
  if (!hasBounds(bounds)) return fallback;
  return [
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  ];
}

function toLngLatBounds(bounds) {
  if (!hasBounds(bounds)) return null;
  return [
    [bounds[0], bounds[1]],
    [bounds[2], bounds[3]],
  ];
}

function dominantOwnershipColor(rollup) {
  if (!rollup) return OWN.unknown.color;
  return (OWN[dominantOwnershipKey(rollup)] || OWN.unknown).color;
}

function dominantOwnershipKey(rollup) {
  if (!rollup || !rollup.total) return "unknown";
  const ranked = [
    ["owned-monette",    rollup.owned          || 0],
    ["sold-rented-back", rollup.soldRentedBack || 0],
    ["rented-monette",   rollup.rented         || 0],
    ["sold",             rollup.sold           || 0],
    ["returned-to-ll",   rollup.returned       || 0],
    ["unknown",          rollup.unknown        || 0],
  ].sort((a, b) => b[1] - a[1]);
  return (ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : "unknown");
}

function dominantOwnershipLabel(rollup) {
  const key = dominantOwnershipKey(rollup);
  const meta = OWN[key] || OWN.unknown;
  // Provisional Ledger-editorial seed overrides (currently sold-rented-back)
  // get a "(rumored)" suffix on the public lead label so the public-status
  // view reads as a working hypothesis, not a confirmed fact.
  if (key === "sold-rented-back") return `${meta.label} — rumored`;
  return meta.label;
}

function propertyDisplayLabel(property, rollup) {
  if (property && property.currentLandStatus && property.currentLandStatus.label) {
    return property.currentLandStatus.label;
  }
  return dominantOwnershipLabel(rollup);
}

function propertyDisplayColor(property, rollup) {
  if (property && property.currentLandStatus && property.currentLandStatus.color) {
    return property.currentLandStatus.color;
  }
  return dominantOwnershipColor(rollup);
}

const MAP_OWNERSHIP_COLORS = {
  "owned-monette": "#5f9a45",
  "rented-monette": "#32a7dd",
  "sold": "#d4553d",
  "sold-rented-back": "#d4553d",
  "returned-to-ll": "#8a7a5a",
  "unknown": "#6a6a6a",
};

function mapOwnershipColor(status) {
  return MAP_OWNERSHIP_COLORS[status] ||
    ((OWN[status] || OWN.unknown).color);
}

function CurrentLandStatusBar({ status, compact }) {
  const owned = status && status.mappedOwnedAc ? status.mappedOwnedAc : 0;
  const sold = status && status.soldUnlocatedAc ? status.soldUnlocatedAc : 0;
  const rented = status && status.assumedRentedUnmappedAc ? status.assumedRentedUnmappedAc : 0;
  const total = owned + sold + rented || 1;
  const segs = [
    ["owned", owned, OWN["owned-monette"].color, "current owned"],
    ["sold", sold, OWN.sold.color, "sold/unlocated"],
    ["rented", rented, OWN["rented-monette"].color, "rented/unmapped"],
  ];
  return (
    <div style={{ display: "flex", width: "100%", height: compact ? 5 : 6, background: "var(--rule)" }}>
      {segs.map(([key, value, color, label]) =>
        value ? <div key={key} title={`${label}: ${fmt(value)} ac`} style={{ width: `${(value / total) * 100}%`, background: color }} /> : null
      )}
    </div>
  );
}

function SeedingProgressBar({ summary }) {
  const activeAc = summary && summary.activeAc ? summary.activeAc : 0;
  const seededAc = summary && summary.seededAc ? summary.seededAc : 0;
  const pct = activeAc > 0 ? Math.max(0, Math.min(100, Math.round((seededAc / activeAc) * 100))) : 0;
  return (
    <div className="atlas-property-seeding" aria-label={`Seeding progress ${pct}%`}>
      <div className="atlas-property-seeding-head mono">
        <span>Seeding progress</span>
        <strong>{activeAc > 0 ? `${pct}%` : "No active read"}</strong>
      </div>
      <div className="atlas-property-seeding-track">
        <span
          className="atlas-property-seeding-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="atlas-property-seeding-meta mono">
        <span>{fmtAc(seededAc)} seeded</span>
        <span>{fmtAc(activeAc)} active read</span>
      </div>
    </div>
  );
}

const OWNERSHIP_FOCUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "owned-monette", label: "Monette owned" },
  { key: "rented-monette", label: "Rented" },
  { key: "sold", label: "Sold" },
  { key: "returned-to-ll", label: "Returned" },
];

function ownershipFocusMeta(key) {
  if (key === "all") return { label: "All statuses", color: "var(--ink)" };
  if (key === "sold") return { label: "Sold / sale-leaseback", color: OWN.sold.color };
  const meta = OWN[key] || OWN.unknown;
  return { label: meta.label || key, color: meta.color };
}

function aggregateRollups(rollups) {
  return Object.values(rollups || {}).reduce((acc, rollup) => {
    if (!rollup) return acc;
    acc.total += rollup.total || 0;
    acc.owned += rollup.owned || 0;
    acc.sold += rollup.sold || 0;
    acc.rented += rollup.rented || 0;
    acc.returned += rollup.returned || 0;
    acc.unknown += rollup.unknown || 0;
    acc.forSale += rollup.forSale || 0;
    acc.forRent += rollup.forRent || 0;
    return acc;
  }, {
    total: 0,
    owned: 0,
    sold: 0,
    rented: 0,
    returned: 0,
    unknown: 0,
    forSale: 0,
    forRent: 0,
  });
}


function escapePopupHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function feedlotProposalPopupHtml(props) {
  const loc = props.loc || "";
  const anchor = props.feedlot_proposal_anchor || "";
  const rm = props.feedlot_proposal_rm || "";
  const proposal = props.feedlot_proposal_proposal || "";
  const proximity = props.feedlot_proposal_proximity || "";
  const owner = props.feedlot_proposal_owner || "";
  const counterparty = props.feedlot_proposal_counterparty || "";
  const community = props.feedlot_proposal_community || "";
  const source = props.feedlot_proposal_source || "";
  const status = props.feedlot_proposal_status || "";
  const isAnchor = anchor && loc && (anchor === loc);

  const rows = [
    ["Quarter", loc],
    ["RM", rm],
    ["Proposal", proposal],
    ["Status", status],
    ["Counsel", counterparty],
  ].filter((row) => row[1]);

  return `
    <div class="atlas-sale-popup atlas-sale-popup-feedlot">
      <div class="atlas-sale-popup-kicker">${isAnchor ? "Active feedlot proposal — anchor quarter" : "Active feedlot proposal — same Section 18"}</div>
      <div class="atlas-sale-popup-title">${escapePopupHtml(proposal || "Feedlot proposal")}</div>
      ${rows.map(([label, value]) => `
        <div class="atlas-sale-popup-row">
          <span>${escapePopupHtml(label)}</span>
          <strong>${escapePopupHtml(value)}</strong>
        </div>
      `).join("")}
      ${proximity ? `<div class="atlas-sale-popup-section"><div class="atlas-sale-popup-section-title">Proximity</div><p class="atlas-sale-popup-fineprint">${escapePopupHtml(proximity)}</p></div>` : ""}
      ${community ? `<div class="atlas-sale-popup-section"><div class="atlas-sale-popup-section-title">Community response</div><p class="atlas-sale-popup-fineprint">${escapePopupHtml(community)}</p></div>` : ""}
      ${owner ? `<div class="atlas-sale-popup-section"><div class="atlas-sale-popup-section-title">Title of record</div><p class="atlas-sale-popup-fineprint">${escapePopupHtml(owner)}</p></div>` : ""}
      ${source ? `<div class="atlas-sale-popup-section"><p class="atlas-sale-popup-fineprint">Source: ${escapePopupHtml(source)}</p></div>` : ""}
    </div>
  `;
}

function rumoredSoldQuarterPopupHtml(props) {
  const buyer = props.rumored_sold_buyer || "Unknown";
  const source = props.rumored_sold_source || "community intel";
  const loc = props.loc || "";
  const titledAc = props.titled_ac || props.title_acres || null;
  const rm = props.rumored_sold_rm || "";
  const infraLoc = props.rumored_sold_infra_loc || null;
  const isInfraQuarter = infraLoc && loc && (infraLoc.indexOf(loc) >= 0);
  let infraItems = [];
  if (isInfraQuarter && props.rumored_sold_infra_items) {
    try { infraItems = JSON.parse(props.rumored_sold_infra_items); } catch (e) { infraItems = []; }
  }
  let infraExcluded = [];
  if (isInfraQuarter && props.rumored_sold_infra_excluded) {
    try { infraExcluded = JSON.parse(props.rumored_sold_infra_excluded); } catch (e) { infraExcluded = []; }
  }
  const infraExcludedNote = (isInfraQuarter && props.rumored_sold_infra_excluded_note) || null;
  const affidavitAc = props.rumored_sold_affidavit_ac;
  const tilTitled = props.rumored_sold_quarters_titled_ac;
  const tilCult = props.rumored_sold_quarters_cultivated_ac;
  const quarterAssessment = props.rumored_sold_quarter_assessment;
  const affidavitPrice = props.rumored_sold_affidavit_price;
  const affidavitPriceLabel = props.rumored_sold_affidavit_price_label;
  const affidavitPricePerAc = props.rumored_sold_affidavit_price_per_ac;
  const affidavitCitation = props.rumored_sold_affidavit_citation;
  const assessmentSource = props.rumored_sold_assessment_source;

  const fmtMoney = (n) => "$" + Number(n).toLocaleString("en-CA");
  const priceLabel = affidavitPriceLabel || (affidavitPrice ? fmtMoney(affidavitPrice) : null);

  const rows = [
    ["Quarter", loc],
    ["Titled ac", titledAc ? `${Number(titledAc).toFixed(2)} ac` : null],
    ["RM", rm],
    ["Assessed value", quarterAssessment ? fmtMoney(quarterAssessment) : null],
    ["Rumored buyer", buyer],
    ["Source", source],
  ].filter((row) => row[1]);

  const dealBlock = priceLabel ? `
    <div class="atlas-sale-popup-section">
      <div class="atlas-sale-popup-section-title">Affidavit-reported deal price</div>
      <div class="atlas-sale-popup-row"><span>Total paid</span><strong>${escapePopupHtml(priceLabel)}</strong></div>
      ${affidavitAc ? `<div class="atlas-sale-popup-row"><span>For (court ac)</span><strong>${affidavitAc} ac</strong></div>` : ""}
      ${affidavitPricePerAc ? `<div class="atlas-sale-popup-row"><span>Implied $/ac</span><strong>$${Number(affidavitPricePerAc).toLocaleString("en-CA")}/ac</strong></div>` : ""}
      ${affidavitCitation ? `<p class="atlas-sale-popup-fineprint">Source: ${escapePopupHtml(affidavitCitation)}. The affidavit reports the bundled total for the Wymark/Waldeck Phase 2 line item — it does not break the price down per quarter.</p>` : ""}
    </div>` : "";

  const infraBlock = isInfraQuarter && infraItems.length ? `
    <div class="atlas-sale-popup-section">
      <div class="atlas-sale-popup-section-title">Included in deal (Waldeck Lot improvements)</div>
      <ul class="atlas-sale-popup-list">
        ${infraItems.map((item) => `<li>${escapePopupHtml(item)}</li>`).join("")}
      </ul>
    </div>` : "";

  const infraExcludedBlock = isInfraQuarter && infraExcluded.length ? `
    <div class="atlas-sale-popup-section">
      <div class="atlas-sale-popup-section-title atlas-sale-popup-excluded-title">NOT included in Carefoot deal</div>
      <ul class="atlas-sale-popup-list atlas-sale-popup-excluded-list">
        ${infraExcluded.map((item) => `<li>${escapePopupHtml(item)}</li>`).join("")}
      </ul>
      ${infraExcludedNote ? `<p class="atlas-sale-popup-fineprint">${escapePopupHtml(infraExcludedNote)}</p>` : ""}
    </div>` : "";

  const acGapNote = (affidavitAc && tilTitled) ? `
    <div class="atlas-sale-popup-section">
      <div class="atlas-sale-popup-section-title">Acreage check</div>
      <div class="atlas-sale-popup-row"><span>Court affidavit</span><strong>${affidavitAc} ac</strong></div>
      <div class="atlas-sale-popup-row"><span>5 quarters (titled)</span><strong>${tilTitled} ac</strong></div>
      ${tilCult ? `<div class="atlas-sale-popup-row"><span>5 quarters (cultivated)</span><strong>${tilCult} ac</strong></div>` : ""}
      <p class="atlas-sale-popup-fineprint">Quarter total exceeds the affidavit figure — likely because affidavit counts cropland only and excludes the Waldeck Lot improvements; or the Carefoot deal is structured differently than the Phase 2 line item.${assessmentSource ? ` Per-quarter assessments from ${escapePopupHtml(assessmentSource)}.` : ""}</p>
    </div>` : "";

  return `
    <div class="atlas-sale-popup">
      <div class="atlas-sale-popup-kicker">Rumored sold quarter</div>
      <div class="atlas-sale-popup-title">${escapePopupHtml(loc || "Rumored sold")}</div>
      ${rows.map(([label, value]) => `
        <div class="atlas-sale-popup-row">
          <span>${escapePopupHtml(label)}</span>
          <strong>${escapePopupHtml(value)}</strong>
        </div>
      `).join("")}
      ${dealBlock}
      ${infraBlock}
      ${infraExcludedBlock}
      ${acGapNote}
    </div>
  `;
}

function soldAssetPopupHtml(props) {
  const rows = [
    ["Sale", props.name],
    ["Phase", props.phase],
    ["Closed", props.closed],
    ["Acres", props.acres_label],
    ["Price", props.price_label],
    ["$/ac", props.price_per_acre_label],
    ["Buyer", props.buyer_label],
  ].filter((row) => row[1] && row[1] !== "n/a");

  return `
    <div class="atlas-sale-popup">
      <div class="atlas-sale-popup-kicker">Historical sale marker</div>
      <div class="atlas-sale-popup-title">${escapePopupHtml(props.name || "Sold land")}</div>
      ${rows.map(([label, value]) => `
        <div class="atlas-sale-popup-row">
          <span>${escapePopupHtml(label)}</span>
          <strong>${escapePopupHtml(value)}</strong>
        </div>
      `).join("")}
      ${props.notes ? `<p>${escapePopupHtml(props.notes)}</p>` : ""}
    </div>
  `;
}

function seedingConfidenceLabel(confidence, vetoReason) {
  if (vetoReason === "snow_or_freeze_risk") return "Withheld (snow/freeze risk)";
  const pct = Number(confidence || 0);
  if (pct >= 80) return `High (${pct}%)`;
  if (pct >= 50) return `Medium (${pct}%)`;
  if (pct > 0) return `Low (${pct}%)`;
  return "Not available";
}

function seedingParcelPopupHtml(props) {
  const loc = props.loc || "Selected parcel";
  const confidence = Number(props.seeding_confidence || 0);
  const vetoReason = props.seeding_veto_reason || null;
  const rows = [
    ["Parcel", loc],
    ["Acres", fmtAc(Number(props.seeding_acres || props.titled_ac || props.title_acres || 0))],
    ["Call", seedingCallText(props.seeding_applicability, props.seeding_seeded, confidence, vetoReason)],
    ["Confidence", seedingConfidenceLabel(confidence, vetoReason)],
  ];

  return `
    <div class="atlas-sale-popup atlas-seeding-popup">
      <div class="atlas-sale-popup-kicker">Seeding confidence</div>
      <div class="atlas-sale-popup-title">${escapePopupHtml(loc)}</div>
      ${rows.map(([label, value]) => `
        <div class="atlas-sale-popup-row">
          <span>${escapePopupHtml(label)}</span>
          <strong>${escapePopupHtml(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function operatorRelationshipPopupHtml(props) {
  const isWatchlist = props.confidence === "watchlist";
  const rows = [
    ["Owner / landholder", props.owner],
    ["Monette role", props.monette_role],
    ["Acreage treatment", props.acreage_label],
    ["Linked record", props.linked_property_name],
    ["Current exposure", props.current_exposure_label],
  ].filter((row) => row[1]);

  return `
    <div class="atlas-sale-popup atlas-operator-popup">
      <div class="atlas-sale-popup-kicker">${isWatchlist ? "Operator relationship watchlist" : "Operator relationship layer"}</div>
      <div class="atlas-sale-popup-title">${escapePopupHtml(props.name || "Partner relationship")}</div>
      ${rows.map(([label, value]) => `
        <div class="atlas-sale-popup-row">
          <span>${escapePopupHtml(label)}</span>
          <strong>${escapePopupHtml(value)}</strong>
        </div>
      `).join("")}
      ${props.evidence ? `<div class="atlas-sale-popup-section"><div class="atlas-sale-popup-section-title">Evidence</div><p class="atlas-sale-popup-fineprint">${escapePopupHtml(props.evidence)}</p></div>` : ""}
      ${props.public_note ? `<div class="atlas-sale-popup-section"><div class="atlas-sale-popup-section-title">${isWatchlist ? "Boundary" : "Acreage rule"}</div><p class="atlas-sale-popup-fineprint">${escapePopupHtml(props.public_note)}</p></div>` : ""}
      ${props.source_label ? `<div class="atlas-sale-popup-section"><p class="atlas-sale-popup-fineprint">Source: ${escapePopupHtml(props.source_label)}</p></div>` : ""}
    </div>
  `;
}

function moveMapLayerToTop(map, layerId) {
  if (!map || !map.getLayer(layerId)) return;
  try {
    map.moveLayer(layerId);
  } catch (error) {
    console.warn("map layer order skipped:", layerId, error);
  }
}

function moveMapLayerBefore(map, layerId, beforeId) {
  if (!map || !map.getLayer(layerId) || !map.getLayer(beforeId)) return;
  try {
    map.moveLayer(layerId, beforeId);
  } catch (error) {
    console.warn("map layer order skipped:", layerId, error);
  }
}

function buildQuarterStateIndex() {
  const index = {};
  Object.entries(Q || {}).forEach(([propId, quarters]) => {
    (quarters || []).forEach((q, i) => {
      const st = loadQState(propId, q, i);
      index[imageryKey(propId, q.loc)] = {
        ownership: st.ownership,
        listing: st.listing,
        seeded: false,
        harvested: false,
        sprayCount: 0,
        seasonLabel: "",
        statusColor: (OWN[st.ownership] || OWN.unknown).color,
        mapColor: mapOwnershipColor(st.ownership),
      };
    });
  });
  return index;
}

function buildPreparedMapData(geojson, quarterStateIndex, imageryStore, rollups, propertyById) {
  const parcels = [];
  const byProperty = {};
  const imageryParcels = imageryStore && imageryStore.parcels ? imageryStore.parcels : {};

  // Per-property feedlot-proposal lookup: maps "propId:loc" to the active
  // RM regulatory dispute metadata (e.g. Lac Pelletier 2,000-head feedlot
  // application). Renders as a separate popup section so a single quarter
  // can carry both a rumored-sold flag and an active-dispute flag.
  const feedlotProposalLookup = {};
  (Object.values(propertyById) || []).forEach((property) => {
    if (!property || !Array.isArray(property.feedlotProposalQuarters)) return;
    const meta = property.feedlotProposalMeta || {};
    property.feedlotProposalQuarters.forEach((qloc) => {
      feedlotProposalLookup[`${property.id}:${qloc}`] = {
        anchor: meta.anchorQuarter || null,
        rm: meta.rm || null,
        proposal: meta.proposal || null,
        proximity: meta.proximity || null,
        owner: meta.owner || null,
        counterparty: meta.counterparty || null,
        communityResponse: meta.communityResponse || null,
        source: meta.source || null,
        status: meta.status || null,
      };
    });
  });

  // Per-property rumored-sold-quarter lookup: maps "propId:loc" to the rumor
  // metadata so the parcel hover popup can render Carefoot-style sale details
  // directly from the feature properties (no window-scope lookup at hover time).
  const rumoredSoldLookup = {};
  (Object.values(propertyById) || []).forEach((property) => {
    if (!property || !Array.isArray(property.rumoredSoldQuarters)) return;
    const meta = property.rumoredSoldQuartersMeta || {};
    const assessments = meta.quarterAssessments || {};
    property.rumoredSoldQuarters.forEach((qloc) => {
      rumoredSoldLookup[`${property.id}:${qloc}`] = {
        propertyId: property.id,
        propertyName: property.name,
        buyer: meta.buyer || null,
        source: meta.source || null,
        pieces: meta.pieces || null,
        rm: meta.rm || null,
        infraLoc: meta.infrastructure ? meta.infrastructure.location : null,
        infraItems: meta.infrastructure ? meta.infrastructure.items || [] : [],
        infraExcluded: meta.infrastructure ? meta.infrastructure.excludedFromDeal || [] : [],
        infraExcludedNote: meta.infrastructure ? meta.infrastructure.excludedFromDealNote || null : null,
        affidavitAc: meta.affidavitMismatch ? meta.affidavitMismatch.affidavitAc : null,
        quartersTitledAc: meta.affidavitMismatch ? meta.affidavitMismatch.quartersTitledAc : null,
        quartersCultivatedAc: meta.affidavitMismatch ? meta.affidavitMismatch.quartersCultivatedAc : null,
        quarterAssessment: typeof assessments[qloc] === "number" ? assessments[qloc] : null,
        affidavitPrice: typeof meta.affidavitPrice === "number" ? meta.affidavitPrice : null,
        affidavitPriceLabel: meta.affidavitPriceLabel || null,
        affidavitPricePerAc: typeof meta.affidavitPricePerAc === "number" ? meta.affidavitPricePerAc : null,
        affidavitCitation: meta.affidavitCitation || null,
        assessmentSource: meta.assessmentSource || null,
      };
    });
  });

  (geojson.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const propId = props.property_id;
    const loc = props.loc;
    const property = propertyById[propId];
    if (!propId || !loc || !property || !feature.geometry) return;

    const lookupKey = imageryKey(propId, loc);
    const st = quarterStateIndex[lookupKey] || {
      ownership: "unknown",
      listing: "not-listed",
      seeded: false,
      harvested: false,
      sprayCount: 0,
      statusColor: OWN.unknown.color,
      mapColor: mapOwnershipColor("unknown"),
    };
    const imagery = imageryParcels[lookupKey] || null;
    const group = byProperty[propId] || {
      bounds: makeBounds(),
      polygons: [],
      parcelCount: 0,
      imageryCount: 0,
      missingImageryCount: 0,
      seedingTotal: 0,
      seedingActive: 0,
      seedingSeeded: 0,
      seedingUnseeded: 0,
      seedingUncertain: 0,
      seedingUnavailable: 0,
      seedingLowQc: 0,
      seedingTotalAc: 0,
      seedingActiveAc: 0,
      seedingSeededAc: 0,
      seedingUnseededAc: 0,
      seedingUncertainAc: 0,
      seedingUnavailableAc: 0,
      seedingLowQcAc: 0,
      imageFrom: null,
      imageTo: null,
    };
    const parcelAcres = parcelTitledAcres(props);

    if (feature.geometry.type === "Polygon") {
      group.polygons.push(feature.geometry.coordinates);
    } else if (feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach((poly) => group.polygons.push(poly));
    }
    extendBounds(group.bounds, feature.geometry);
    group.parcelCount += 1;

    if (imagery && imagery.status === "ok" && typeof imagery.ndvi_mean === "number") {
      group.imageryCount += 1;
      if (!group.imageFrom || (imagery.image_from && imagery.image_from < group.imageFrom)) {
        group.imageFrom = imagery.image_from || group.imageFrom;
      }
      if (!group.imageTo || (imagery.image_to && imagery.image_to > group.imageTo)) {
        group.imageTo = imagery.image_to || group.imageTo;
      }
    } else if (imagery && imagery.status) {
      group.missingImageryCount += 1;
    }

    if (imagery && imagery.status === "ok") {
      group.seedingTotal += 1;
      group.seedingTotalAc += parcelAcres;
      if (imagery.polygon_quality === "low") {
        group.seedingLowQc += 1;
        group.seedingLowQcAc += parcelAcres;
      }
      if (imagery.seeding_applicability === "active") {
        group.seedingActive += 1;
        group.seedingActiveAc += parcelAcres;
        if (imagery.seeding_seeded === true) {
          group.seedingSeeded += 1;
          group.seedingSeededAc += parcelAcres;
        } else if (imagery.seeding_seeded === false) {
          group.seedingUnseeded += 1;
          group.seedingUnseededAc += parcelAcres;
        } else {
          group.seedingUncertain += 1;
          group.seedingUncertainAc += parcelAcres;
        }
      } else {
        group.seedingUnavailable += 1;
        group.seedingUnavailableAc += parcelAcres;
      }
    }

    byProperty[propId] = group;

    const rumoredSold = rumoredSoldLookup[`${propId}:${loc}`] || null;
    const feedlotProposal = feedlotProposalLookup[`${propId}:${loc}`] || null;
    parcels.push({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        ...props,
        id: lookupKey,
        title_acres: props.titled_ac,
        ownership_status: st.ownership,
        ownership_label: (OWN[st.ownership] || OWN.unknown).label,
        listing_status: st.listing,
        status_color: st.statusColor,
        map_fill_color: st.mapColor || mapOwnershipColor(st.ownership),
        seeded: st.seeded ? 1 : 0,
        harvested: st.harvested ? 1 : 0,
        spray_count: st.sprayCount,
        season_label: st.seasonLabel || "",
        ndvi_mean: imagery && imagery.status === "ok" ? imagery.ndvi_mean : null,
        imagery_status: imagery ? imagery.status : null,
        imagery_from: imagery ? imagery.image_from || null : null,
        imagery_to: imagery ? imagery.image_to || null : null,
        // Seeding mode fields — from the seeding sub-block when applicability is active
        seeding_applicability: imagery ? (imagery.seeding_applicability || null) : null,
        seeding_seeded: imagery ? (imagery.seeding_seeded != null ? imagery.seeding_seeded : null) : null,
        seeding_confidence: imagery ? (imagery.seeding_confidence || 0) : 0,
        seeding_confidence_withheld: imagery ? (imagery.seeding_confidence_withheld ? 1 : 0) : 0,
        seeding_veto_reason: imagery ? (imagery.seeding_veto_reason || null) : null,
        seeding_acres: parcelAcres,
        seeding_fill_color: imagery
          ? seedingFillColor(imagery.seeding_applicability, imagery.seeding_seeded, imagery.seeding_confidence)
          : "#4a4a4a",
        polygon_quality: imagery ? (imagery.polygon_quality || null) : null,
        rumored_sold: rumoredSold ? 1 : 0,
        rumored_sold_buyer: rumoredSold ? rumoredSold.buyer : null,
        rumored_sold_source: rumoredSold ? rumoredSold.source : null,
        rumored_sold_pieces: rumoredSold ? rumoredSold.pieces : null,
        rumored_sold_rm: rumoredSold ? rumoredSold.rm : null,
        rumored_sold_infra_loc: rumoredSold ? rumoredSold.infraLoc : null,
        rumored_sold_infra_items: rumoredSold ? JSON.stringify(rumoredSold.infraItems) : null,
        rumored_sold_infra_excluded: rumoredSold ? JSON.stringify(rumoredSold.infraExcluded) : null,
        rumored_sold_infra_excluded_note: rumoredSold ? rumoredSold.infraExcludedNote : null,
        rumored_sold_affidavit_ac: rumoredSold ? rumoredSold.affidavitAc : null,
        rumored_sold_quarters_titled_ac: rumoredSold ? rumoredSold.quartersTitledAc : null,
        rumored_sold_quarters_cultivated_ac: rumoredSold ? rumoredSold.quartersCultivatedAc : null,
        rumored_sold_quarter_assessment: rumoredSold ? rumoredSold.quarterAssessment : null,
        rumored_sold_affidavit_price: rumoredSold ? rumoredSold.affidavitPrice : null,
        rumored_sold_affidavit_price_label: rumoredSold ? rumoredSold.affidavitPriceLabel : null,
        rumored_sold_affidavit_price_per_ac: rumoredSold ? rumoredSold.affidavitPricePerAc : null,
        rumored_sold_affidavit_citation: rumoredSold ? rumoredSold.affidavitCitation : null,
        rumored_sold_assessment_source: rumoredSold ? rumoredSold.assessmentSource : null,
        feedlot_proposal: feedlotProposal ? 1 : 0,
        feedlot_proposal_anchor: feedlotProposal ? feedlotProposal.anchor : null,
        feedlot_proposal_rm: feedlotProposal ? feedlotProposal.rm : null,
        feedlot_proposal_proposal: feedlotProposal ? feedlotProposal.proposal : null,
        feedlot_proposal_proximity: feedlotProposal ? feedlotProposal.proximity : null,
        feedlot_proposal_owner: feedlotProposal ? feedlotProposal.owner : null,
        feedlot_proposal_counterparty: feedlotProposal ? feedlotProposal.counterparty : null,
        feedlot_proposal_community: feedlotProposal ? feedlotProposal.communityResponse : null,
        feedlot_proposal_source: feedlotProposal ? feedlotProposal.source : null,
        feedlot_proposal_status: feedlotProposal ? feedlotProposal.status : null,
      },
    });
  });

  const propertyFeatures = [];
  const pointFeatures = [];
  const labelFeatures = [];
  const coverageByProperty = {};

  D.properties.forEach((property) => {
    // Skip aggregator-only parents (e.g. Montana parent rollup) — children
    // are rendered individually so the parent would just create a duplicate
    // pin at the centroid of its children.
    if (property.aggregator) return;
    const group = byProperty[property.id];
    if (!group || !group.polygons.length) {
      const rows = (Q && Q[property.id]) || [];
      const pointOnly = !rows.length;
      const rollup = rollups[property.id];
      coverageByProperty[property.id] = {
        hasRealGeometry: false,
        pointOnly,
        mappedParcels: rows.length,
        totalParcels: property.parcels || 0,
        imageryParcels: 0,
        missingImageryParcels: 0,
        seedingSummary: {
          total: 0,
          active: 0,
          seeded: 0,
          unseeded: 0,
          uncertain: 0,
          unavailable: 0,
          lowQc: 0,
          totalAc: 0,
          activeAc: 0,
          seededAc: 0,
          unseededAc: 0,
          uncertainAc: 0,
          unavailableAc: 0,
          lowQcAc: 0,
        },
        imageFrom: null,
        imageTo: null,
        geometryStatus: pointOnly ? "point-only" : "synthetic",
      };

      if (Number.isFinite(property.lng) && Number.isFinite(property.lat)) {
        const center = [property.lng, property.lat];
        pointFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: {
            id: property.id,
            name: property.name,
            province: property.province,
            region: property.region,
            titled: property.titled || 0,
            parcels_total: property.parcels || 0,
            acres_label: `${fmt(property.titled || 0)} ac`,
            dominant_color: propertyDisplayColor(property, rollup),
            geometry_status: pointOnly ? "point-only" : "synthetic",
            location_precision: property.locationPrecision || "approximate",
          },
        });
        labelFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: {
            id: property.id,
            name: property.name,
            acres_label: `${fmt(property.titled || 0)} ac`,
            titled: property.titled || 0,
            geometry_status: pointOnly ? "point-only" : "synthetic",
          },
        });
      }
      return;
    }

    const center = centerFromBounds(group.bounds, [property.lng, property.lat]);
    const rollup = rollups[property.id];

    propertyFeatures.push({
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: group.polygons,
      },
      properties: {
        id: property.id,
        name: property.name,
        province: property.province,
        region: property.region,
        titled: property.titled || 0,
        parcels_total: property.parcels || 0,
        parcels_real: group.parcelCount,
        acres_label: `${fmt(property.titled || 0)} ac`,
        dominant_color: propertyDisplayColor(property, rollup),
      },
    });

    labelFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: center },
      properties: {
        id: property.id,
        name: property.name,
        acres_label: `${fmt(property.titled || 0)} ac`,
        titled: property.titled || 0,
      },
    });

    coverageByProperty[property.id] = {
      hasRealGeometry: true,
      mappedParcels: group.parcelCount,
      totalParcels: property.parcels || 0,
      imageryParcels: group.imageryCount,
      missingImageryParcels: group.missingImageryCount,
      seedingSummary: {
        total: group.seedingTotal,
        active: group.seedingActive,
        seeded: group.seedingSeeded,
        unseeded: group.seedingUnseeded,
        uncertain: group.seedingUncertain,
        unavailable: group.seedingUnavailable,
        lowQc: group.seedingLowQc,
        totalAc: group.seedingTotalAc,
        activeAc: group.seedingActiveAc,
        seededAc: group.seedingSeededAc,
        unseededAc: group.seedingUnseededAc,
        uncertainAc: group.seedingUncertainAc,
        unavailableAc: group.seedingUnavailableAc,
        lowQcAc: group.seedingLowQcAc,
      },
      imageFrom: group.imageFrom,
      imageTo: group.imageTo,
      geometryStatus: property.geometryStatus || "parcel-mapped",
      bounds: group.bounds,
    };
  });

  const seedingSummary = Object.values(coverageByProperty).reduce((acc, coverage) => {
    const s = coverage && coverage.seedingSummary ? coverage.seedingSummary : {};
    acc.total += s.total || 0;
    acc.active += s.active || 0;
    acc.seeded += s.seeded || 0;
    acc.unseeded += s.unseeded || 0;
    acc.uncertain += s.uncertain || 0;
    acc.unavailable += s.unavailable || 0;
    acc.lowQc += s.lowQc || 0;
    acc.totalAc += s.totalAc || 0;
    acc.activeAc += s.activeAc || 0;
    acc.seededAc += s.seededAc || 0;
    acc.unseededAc += s.unseededAc || 0;
    acc.uncertainAc += s.uncertainAc || 0;
    acc.unavailableAc += s.unavailableAc || 0;
    acc.lowQcAc += s.lowQcAc || 0;
    return acc;
  }, {
    total: 0,
    active: 0,
    seeded: 0,
    unseeded: 0,
    uncertain: 0,
    unavailable: 0,
    lowQc: 0,
    totalAc: 0,
    activeAc: 0,
    seededAc: 0,
    unseededAc: 0,
    uncertainAc: 0,
    unavailableAc: 0,
    lowQcAc: 0,
  });

  const soldFeatures = (D.soldProperties || [])
    .filter((asset) => Number.isFinite(asset.lng) && Number.isFinite(asset.lat))
    .filter((asset) => !asset.hideMapMarker)
    .map((asset) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [asset.lng, asset.lat] },
      properties: {
        id: asset.id,
        name: asset.name,
        province: asset.province,
        region: asset.region,
        acres: asset.acres || 0,
        acres_label: asset.acres ? `${fmt(asset.acres)} ac` : "acres n/a",
        price_label: asset.priceLabel || (asset.price ? fmtM(asset.price) : "price n/a"),
        price_per_acre_label: asset.pricePerAcre ? `$${fmt(asset.pricePerAcre)}/ac` : "n/a",
        buyer_label: asset.buyer || "",
        buyer_status: asset.buyerStatus || "",
        notes: asset.notes || "",
        phase: asset.phase || "Sold",
        closed: asset.closed || "closed",
      },
    }));

  const operatorRelationshipFeatures = (D.operatorRelationships || [])
    .filter((rel) => Number.isFinite(rel.lng) && Number.isFinite(rel.lat))
    .map((rel) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [rel.lng, rel.lat] },
      properties: {
        id: rel.id,
        name: rel.name,
        province: rel.province || "",
        region: rel.region || "",
        relationship_type: rel.relationshipType || "operator-relationship",
        relationship_type_label: rel.relationshipType === "overlap-watchlist" ? "Watchlist" : "Partner-managed",
        confidence: rel.confidence || "public-confirmed",
        marker_label: rel.confidence === "watchlist" ? "?" : "OP",
        owner: rel.owner || "",
        monette_role: rel.monetteRole || "",
        acreage_label: rel.acreageLabel || "Acreage not reconciled",
        linked_property_id: rel.linkedPropertyId || "",
        linked_property_name: rel.linkedPropertyName || "",
        source_label: rel.sourceLabel || "",
        source_url: rel.sourceUrl || "",
        current_exposure_label: rel.currentExposureLabel || "",
        evidence: rel.evidence || "",
        public_note: rel.publicNote || "",
      },
    }));

  return {
    propertyGeojson: { type: "FeatureCollection", features: propertyFeatures },
    propertyPointGeojson: { type: "FeatureCollection", features: pointFeatures },
    propertyLabelGeojson: { type: "FeatureCollection", features: labelFeatures },
    parcelGeojson: { type: "FeatureCollection", features: parcels },
    soldGeojson: { type: "FeatureCollection", features: soldFeatures },
    operatorRelationshipGeojson: { type: "FeatureCollection", features: operatorRelationshipFeatures },
    coverageByProperty,
    seedingSummary,
    mappedPropertyCount: propertyFeatures.length,
    pointPropertyCount: pointFeatures.length,
    soldAssetCount: soldFeatures.length,
    operatorRelationshipCount: operatorRelationshipFeatures.length,
    mappedParcelCount: parcels.length,
  };
}

function quarterGeojsonFromRealData(realData) {
  if (!realData || typeof realData !== "object") return null;

  const features = [];
  Object.entries(realData).forEach(([propertyId, rows]) => {
    (rows || []).forEach((row) => {
      if (!row || !row.loc || !row.geometry) return;
      features.push({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          property_id: propertyId,
          loc: row.loc,
          titled_ac: row.ac != null ? row.ac : 0,
          soil: row.soil || null,
          assessment: row.assessment || null,
          rm: row.rm || null,
          parcel_no: row.parcel_no || null,
          title: row.title || null,
          crop_2025: row.crop || null,
        },
      });
    });
  });

  return features.length
    ? { type: "FeatureCollection", features }
    : null;
}

const MapView = ({ forcedSelect, forcedQuarter, onSwitchView, onOpenHeadlineForm }) => {
  const [sel, setSel] = useState(null);
  const [selQLoc, setSelQLoc] = useState(null);
  // Drawer visibility is intentionally independent of `sel`. Closing the
  // drawer keeps the property highlighted on the map so the user can
  // re-engage with quarters without re-finding the block.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoverProperty, setHoverProperty] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [ownershipFocus, setOwnershipFocus] = useState("all");
  const [atlasMode, setAtlasMode] = useState(defaultAtlasMode);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapDataRef = useRef(null);
  const selectionRef = useRef(sel);
  const selectedQuarterRef = useRef(selQLoc);
  const ownershipFocusRef = useRef(ownershipFocus);
  const atlasModeRef = useRef(atlasMode);
  const soldPopupRef = useRef(null);
  const operatorRelationshipPopupRef = useRef(null);
  const rumoredQuarterPopupRef = useRef(null);
  const feedlotProposalPopupRef = useRef(null);
  const seedingPopupRef = useRef(null);
  const pendingFocusRef = useRef(null);

  const rollups = useMemo(() => {
    const out = {};
    D.properties.forEach((property) => {
      out[property.id] = rollupProperty(property.id).rollup;
    });
    return out;
  }, []);

  const propertyById = useMemo(() => {
    const out = {};
    D.properties.forEach((property) => {
      out[property.id] = property;
    });
    return out;
  }, []);

  const quarterStateIndex = useMemo(() => buildQuarterStateIndex(), []);

  const quarterGeojson = useMemo(
    () => quarterGeojsonFromRealData(window.MONETTE_QUARTERS_REAL),
    []
  );

  useEffect(() => {
    selectionRef.current = sel;
  }, [sel]);
  useEffect(() => {
    selectedQuarterRef.current = selQLoc;
  }, [selQLoc]);
  useEffect(() => {
    ownershipFocusRef.current = ownershipFocus;
  }, [ownershipFocus]);
  useEffect(() => {
    atlasModeRef.current = atlasMode;
    try { localStorage.setItem(ATLAS_MODE_KEY, atlasMode); } catch (e) {}
  }, [atlasMode]);
  const currentStyle = window.MAPBOX_STYLE_STATUS;
  const routeToSelection = (propId, qloc) => {
    if (!onSwitchView) return;
    onSwitchView("map", propId || null, qloc || null);
  };

  const focusProperty = (propId, duration) => {
    const property = propertyById[propId];
    if (!property) return;

    const nextFocus = { propId, duration: duration || 1200 };
    const coverage = mapDataRef.current && mapDataRef.current.coverageByProperty
      ? mapDataRef.current.coverageByProperty[propId]
      : null;
    const map = mapRef.current;
    if (!map || !mapDataRef.current) {
      pendingFocusRef.current = nextFocus;
      return;
    }

    pendingFocusRef.current = null;

    if (coverage && coverage.hasRealGeometry && hasBounds(coverage.bounds)) {
      map.fitBounds(toLngLatBounds(coverage.bounds), {
        padding: window.innerWidth < 900
          ? { top: 70, right: 28, bottom: 28, left: 28 }
          : { top: 84, right: 96, bottom: 40, left: 96 },
        duration: duration || 1200,
        maxZoom: 11.4,
        essential: true,
      });
      return;
    }

    map.flyTo({
      center: [property.lng, property.lat],
      zoom: 8.4,
      duration: duration || 1200,
      essential: true,
    });
  };

  const focusOperatorRelationship = (relationship) => {
    if (!relationship || !Number.isFinite(relationship.lng) || !Number.isFinite(relationship.lat)) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [relationship.lng, relationship.lat],
      zoom: Math.max(map.getZoom(), 8),
      duration: 850,
      essential: true,
    });
  };

  const syncMapPresentation = (map) => {
    if (!map) return;

    const selId = selectionRef.current && selectionRef.current.id
      ? selectionRef.current.id
      : null;
    const selectedQuarterLoc = selectedQuarterRef.current || null;
    const propertyFilter = selId
      ? ["==", ["get", "id"], selId]
      : EMPTY_PROP_FILTER;
    const mode = atlasModeRef.current || "land-status";
    const isSeedingMode = mode === "seeding";
    const isLandStatusMode = mode === "land-status";
    if (!isSeedingMode && seedingPopupRef.current) {
      seedingPopupRef.current.remove();
      seedingPopupRef.current = null;
    }
    const focusKey = ownershipFocusRef.current || "all";
    const focusActive = isLandStatusMode && focusKey !== "all";
    const focusMatch = focusKey === "sold"
      ? ["in", ["get", "ownership_status"], ["literal", ["sold", "sold-rented-back"]]]
      : ["==", ["get", "ownership_status"], focusKey];
    const selectedParcelMatch = ["==", ["get", "property_id"], selId || ""];
    const selectedQuarterMatch = selId && selectedQuarterLoc
      ? ["all", ["==", ["get", "property_id"], selId], ["==", ["get", "loc"], selectedQuarterLoc]]
      : EMPTY_PARCEL_FILTER;
    const selectedFocusedParcelMatch = selId
      ? ["all", selectedParcelMatch, focusMatch]
      : focusMatch;
    const parcelFillOpacity = focusActive
      ? (selId
        ? ["case", selectedFocusedParcelMatch, 0.88, selectedParcelMatch, 0.24, 0.06]
        : ["case", focusMatch, 0.72, 0.1])
      : (selId
        ? ["case", selectedParcelMatch, 0.82, 0.32]
        : 0.58);
    const parcelLineOpacity = focusActive
      ? (selId
        ? ["case", selectedFocusedParcelMatch, 0.72, selectedParcelMatch, 0.22, 0.1]
        : ["case", focusMatch, 0.72, 0.16])
      : (selId
        ? ["case", selectedParcelMatch, 0.58, 0.3]
        : 0.4);
    const parcelSeasonOpacity = focusActive
      ? (selId
        ? ["case", selectedFocusedParcelMatch, 1, selectedParcelMatch, 0.08, 0]
        : ["case", focusMatch, 0.95, 0.12])
      : (selId
        ? ["case", selectedParcelMatch, 1, 0.78]
        : 0.88);
    if (map.getLayer(PROPERTY_SELECTED_LAYER)) {
      map.setFilter(PROPERTY_SELECTED_LAYER, propertyFilter);
      map.setPaintProperty(PROPERTY_SELECTED_LAYER, "line-opacity", selId ? 1 : 0);
    }

    if (map.getLayer(PROPERTY_GLOW_LAYER)) {
      map.setFilter(PROPERTY_GLOW_LAYER, propertyFilter);
      map.setPaintProperty(PROPERTY_GLOW_LAYER, "line-opacity", selId ? 0.18 : 0);
    }

    if (map.getLayer(PROPERTY_FILL_LAYER)) {
      map.setPaintProperty(
        PROPERTY_FILL_LAYER,
        "fill-opacity",
        isSeedingMode
          ? (selId ? ["case", ["==", ["get", "id"], selId], 0.012, 0.006] : 0.008)
          : (selId
            ? ["case", ["==", ["get", "id"], selId], 0.04, 0.025]
            : 0.055)
      );
    }

    if (map.getLayer(PROPERTY_POINT_LAYER)) {
      map.setFilter(
        PROPERTY_POINT_LAYER,
        selId
          ? ["all", ["==", ["get", "id"], selId], ["==", ["get", "geometry_status"], "point-only"]]
          : EMPTY_PROP_FILTER
      );
      map.setPaintProperty(
        PROPERTY_POINT_LAYER,
        "circle-opacity",
        selId ? 0.82 : 0
      );
      map.setPaintProperty(
        PROPERTY_POINT_LAYER,
        "circle-stroke-width",
        2.8
      );
      map.setPaintProperty(
        PROPERTY_POINT_LAYER,
        "circle-stroke-color",
        "#f1d284"
      );
    }

    if (map.getLayer(SOLD_ASSET_LAYER)) {
      map.setLayoutProperty(SOLD_ASSET_LAYER, "visibility", "none");
    }

    if (map.getLayer(OPERATOR_RELATIONSHIP_LAYER)) {
      map.setLayoutProperty(OPERATOR_RELATIONSHIP_LAYER, "visibility", "none");
    }

    if (map.getLayer(PROPERTY_OUTLINE_LAYER)) {
      map.setPaintProperty(
        PROPERTY_OUTLINE_LAYER,
        "line-opacity",
        selId
          ? ["case", ["==", ["get", "id"], selId], 0.18, 0.12]
          : 0.22
      );
    }

    if (map.getLayer(PROPERTY_LABEL_LAYER)) {
      map.setLayoutProperty(
        PROPERTY_LABEL_LAYER,
        "visibility",
        selId ? "none" : "visible"
      );
    }

    if (map.getLayer(SELECTED_PARCEL_FILL_LAYER)) {
      map.setFilter(SELECTED_PARCEL_FILL_LAYER, ALL_PARCELS_FILTER);
      map.setPaintProperty(
        SELECTED_PARCEL_FILL_LAYER,
        "fill-opacity",
        isSeedingMode ? 0.01 : parcelFillOpacity
      );
    }

    if (map.getLayer(SELECTED_PARCEL_OUTLINE_LAYER)) {
      map.setFilter(SELECTED_PARCEL_OUTLINE_LAYER, ALL_PARCELS_FILTER);
      map.setPaintProperty(
        SELECTED_PARCEL_OUTLINE_LAYER,
        "line-color",
        isSeedingMode ? "rgba(247,243,234,0.34)" : ["get", "map_fill_color"]
      );
      map.setPaintProperty(
        SELECTED_PARCEL_OUTLINE_LAYER,
        "line-opacity",
        isSeedingMode ? (selId ? ["case", selectedParcelMatch, 0.46, 0.22] : 0.24) : parcelLineOpacity
      );
    }

    if (map.getLayer(SELECTED_QUARTER_EVIDENCE_FILL_LAYER)) {
      map.setFilter(SELECTED_QUARTER_EVIDENCE_FILL_LAYER, selectedQuarterMatch);
      map.setPaintProperty(
        SELECTED_QUARTER_EVIDENCE_FILL_LAYER,
        "fill-opacity",
        isSeedingMode && selectedQuarterLoc ? [
          "case",
          ["==", ["get", "seeding_seeded"], true], 0.24,
          0.14,
        ] : 0
      );
    }

    if (map.getLayer(SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER)) {
      map.setFilter(SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER, selectedQuarterMatch);
      map.setPaintProperty(
        SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER,
        "line-opacity",
        isSeedingMode && selectedQuarterLoc ? 0.92 : 0
      );
    }

    if (map.getLayer(SELECTED_PARCEL_SEASON_LAYER)) {
      map.setFilter(SELECTED_PARCEL_SEASON_LAYER, ALL_PARCELS_FILTER);
      map.setPaintProperty(
        SELECTED_PARCEL_SEASON_LAYER,
        "text-opacity",
        isSeedingMode ? 0 : parcelSeasonOpacity
      );
    }

    // Atlas mode: toggle the seeding-fill layer on top of the land-status fill.
    // Vigor (NDVI) was dropped as a public mode in the homepage redesign;
    // the parcel default fill (map_fill_color) is the land-status palette.
    if (map.getLayer(PARCEL_SEEDING_FILL_LAYER)) {
      map.setLayoutProperty(PARCEL_SEEDING_FILL_LAYER, "visibility", isSeedingMode ? "visible" : "none");
    }
    if (map.getLayer(PARCEL_SEEDING_OUTLINE_LAYER)) {
      map.setLayoutProperty(PARCEL_SEEDING_OUTLINE_LAYER, "visibility", isSeedingMode ? "visible" : "none");
    }
    [SOLD_ASSET_LAYER, SOLD_ASSET_LABEL_LAYER, OPERATOR_RELATIONSHIP_LAYER, OPERATOR_RELATIONSHIP_LABEL_LAYER].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", "none");
      }
    });
  };

  const safeSyncMapPresentation = (map) => {
    if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;
    syncMapPresentation(map);
  };

  const installAtlasLayers = (map, prepared) => {
    if (!map || !prepared) return;

    if (!map.getSource(PROPERTY_SOURCE)) {
      map.addSource(PROPERTY_SOURCE, {
        type: "geojson",
        data: prepared.propertyGeojson,
        promoteId: "id",
      });
    } else {
      map.getSource(PROPERTY_SOURCE).setData(prepared.propertyGeojson);
    }

    if (!map.getSource(PROPERTY_POINT_SOURCE)) {
      map.addSource(PROPERTY_POINT_SOURCE, {
        type: "geojson",
        data: prepared.propertyPointGeojson,
        promoteId: "id",
      });
    } else {
      map.getSource(PROPERTY_POINT_SOURCE).setData(prepared.propertyPointGeojson);
    }

    if (!map.getSource(SOLD_ASSET_SOURCE)) {
      map.addSource(SOLD_ASSET_SOURCE, {
        type: "geojson",
        data: prepared.soldGeojson,
        promoteId: "id",
      });
    } else {
      map.getSource(SOLD_ASSET_SOURCE).setData(prepared.soldGeojson);
    }

    if (!map.getSource(OPERATOR_RELATIONSHIP_SOURCE)) {
      map.addSource(OPERATOR_RELATIONSHIP_SOURCE, {
        type: "geojson",
        data: prepared.operatorRelationshipGeojson,
        promoteId: "id",
      });
    } else {
      map.getSource(OPERATOR_RELATIONSHIP_SOURCE).setData(prepared.operatorRelationshipGeojson);
    }

    if (!map.getSource(PARCEL_SOURCE)) {
      map.addSource(PARCEL_SOURCE, {
        type: "geojson",
        data: prepared.parcelGeojson,
      });
    } else {
      map.getSource(PARCEL_SOURCE).setData(prepared.parcelGeojson);
    }

    if (!map.getSource(PROPERTY_LABEL_SOURCE)) {
      map.addSource(PROPERTY_LABEL_SOURCE, {
        type: "geojson",
        data: prepared.propertyLabelGeojson,
      });
    } else {
      map.getSource(PROPERTY_LABEL_SOURCE).setData(prepared.propertyLabelGeojson);
    }

    if (!map.getLayer(PROPERTY_FILL_LAYER)) {
      map.addLayer({
        id: PROPERTY_FILL_LAYER,
        type: "fill",
        source: PROPERTY_SOURCE,
        paint: {
          "fill-color": ["get", "dominant_color"],
          "fill-opacity": 0.055,
        },
      });
    }

    if (!map.getLayer(SELECTED_PARCEL_FILL_LAYER)) {
      map.addLayer({
        id: SELECTED_PARCEL_FILL_LAYER,
        type: "fill",
        source: PARCEL_SOURCE,
        filter: ALL_PARCELS_FILTER,
        paint: {
          "fill-color": ["get", "map_fill_color"],
          "fill-opacity": 0.58,
        },
      });
    }

    // Seeding mode fill — uses seeding_fill_color property set per-parcel in
    // buildPreparedMapData. Visibility toggled by syncMapPresentation when mode
    // switches between seeding / land-status. Default hidden; shown when
    // atlasMode === "seeding".
    if (!map.getLayer(PARCEL_SEEDING_FILL_LAYER)) {
      map.addLayer({
        id: PARCEL_SEEDING_FILL_LAYER,
        type: "fill",
        source: PARCEL_SOURCE,
        filter: ALL_PARCELS_FILTER,
        layout: { visibility: "none" },
        paint: {
          "fill-color": ["get", "seeding_fill_color"],
          "fill-opacity": [
            "case",
            ["==", ["get", "seeding_seeded"], true], 0.78,
            0.50,
          ],
        },
      });
    }

    // Low-QC dashed outline for seeding mode — highlights parcels where
    // polygon_quality is "low" so the user knows the seeding result is less
    // reliable. Uses a line-dasharray to visually distinguish from normal
    // parcel borders.
    if (!map.getLayer(PARCEL_SEEDING_OUTLINE_LAYER)) {
      map.addLayer({
        id: PARCEL_SEEDING_OUTLINE_LAYER,
        type: "line",
        source: PARCEL_SOURCE,
        filter: ["==", ["get", "polygon_quality"], "low"],
        layout: { visibility: "none" },
        paint: {
          "line-color": "#e0c060",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            7, 1.2,
            9, 1.8,
            11, 2.2,
          ],
          "line-dasharray": [3, 2],
          "line-opacity": 0.75,
        },
      });
    }

    if (!map.getLayer(SELECTED_QUARTER_EVIDENCE_FILL_LAYER)) {
      map.addLayer({
        id: SELECTED_QUARTER_EVIDENCE_FILL_LAYER,
        type: "fill",
        source: PARCEL_SOURCE,
        filter: EMPTY_PARCEL_FILTER,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "seeding_seeded"], true], "#3a8c2a",
            "#f1d284",
          ],
          "fill-opacity": 0,
        },
      });
    }

    if (!map.getLayer(SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER)) {
      map.addLayer({
        id: SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER,
        type: "line",
        source: PARCEL_SOURCE,
        filter: EMPTY_PARCEL_FILTER,
        paint: {
          "line-color": "#f1d284",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            7, 2.2,
            9, 3.4,
            11, 5,
          ],
          "line-opacity": 0,
        },
      });
    }

    if (!map.getLayer(SELECTED_PARCEL_OUTLINE_LAYER)) {
      map.addLayer({
        id: SELECTED_PARCEL_OUTLINE_LAYER,
        type: "line",
        source: PARCEL_SOURCE,
        filter: ALL_PARCELS_FILTER,
        paint: {
          "line-color": ["get", "map_fill_color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            7, 1.1,
            9, 1.7,
            11, 2.3,
          ],
          "line-opacity": 0.74,
        },
      });
    }

    if (!map.getLayer(SELECTED_PARCEL_SEASON_LAYER)) {
      map.addLayer({
        id: SELECTED_PARCEL_SEASON_LAYER,
        type: "symbol",
        source: PARCEL_SOURCE,
        filter: ALL_PARCELS_FILTER,
        minzoom: 8.2,
        layout: {
          "text-field": ["get", "season_label"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            8, 10,
            10, 12,
            12, 14,
          ],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#fff7d6",
          "text-halo-color": "#1b1916",
          "text-halo-width": 1.5,
          "text-opacity": 0.88,
        },
      });
    }

    if (!map.getLayer(PROPERTY_POINT_LAYER)) {
      map.addLayer({
        id: PROPERTY_POINT_LAYER,
        type: "circle",
        source: PROPERTY_POINT_SOURCE,
        filter: EMPTY_PROP_FILTER,
        paint: {
          "circle-color": ["get", "dominant_color"],
          "circle-opacity": 0.92,
          "circle-radius": [
            "interpolate", ["linear"], ["to-number", ["get", "titled"]],
            0, 5,
            5000, 8,
            50000, 16,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "geometry_status"], "point-only"], "#f1d284",
            "rgba(247,243,234,0.92)",
          ],
          "circle-stroke-width": 1.8,
          "circle-blur": 0.08,
        },
      });
    }

    if (!map.getLayer(SOLD_ASSET_LAYER)) {
      map.addLayer({
        id: SOLD_ASSET_LAYER,
        type: "circle",
        source: SOLD_ASSET_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": "#9a3a2a",
          "circle-opacity": 0.9,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 4,
            6, 7,
            9, 10,
          ],
          "circle-stroke-color": "#fffdf7",
          "circle-stroke-width": 1.4,
        },
      });
    }

    if (!map.getLayer(OPERATOR_RELATIONSHIP_LAYER)) {
      map.addLayer({
        id: OPERATOR_RELATIONSHIP_LAYER,
        type: "circle",
        source: OPERATOR_RELATIONSHIP_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "confidence"], "watchlist"], "rgba(180,134,56,0.16)",
            "rgba(241,210,132,0.20)",
          ],
          "circle-opacity": 0.96,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 5,
            6, 8,
            9, 11,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "confidence"], "watchlist"], "#b48638",
            "#f1d284",
          ],
          "circle-stroke-width": 2.2,
        },
      });
    }

    if (!map.getLayer(PROPERTY_GLOW_LAYER)) {
      map.addLayer({
        id: PROPERTY_GLOW_LAYER,
        type: "line",
        source: PROPERTY_SOURCE,
        filter: EMPTY_PROP_FILTER,
        paint: {
          "line-color": "#f1d284",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            5, 5,
            8, 8,
            11, 12,
          ],
          "line-blur": 1.8,
          "line-opacity": 0,
        },
      });
    }

    if (!map.getLayer(PROPERTY_OUTLINE_LAYER)) {
      map.addLayer({
        id: PROPERTY_OUTLINE_LAYER,
        type: "line",
        source: PROPERTY_SOURCE,
        paint: {
          "line-color": "rgba(247,243,234,0.56)",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            4, 1.2,
            7, 1.8,
            10, 2.4,
          ],
          "line-opacity": 0.74,
        },
      });
    }

    if (!map.getLayer(PROPERTY_SELECTED_LAYER)) {
      map.addLayer({
        id: PROPERTY_SELECTED_LAYER,
        type: "line",
        source: PROPERTY_SOURCE,
        filter: EMPTY_PROP_FILTER,
        paint: {
          "line-color": "#f1d284",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            5, 1.4,
            8, 2.2,
            11, 3.2,
          ],
          "line-opacity": 0,
        },
      });
    }

    if (!map.getLayer(SOLD_ASSET_LABEL_LAYER)) {
      map.addLayer({
        id: SOLD_ASSET_LABEL_LAYER,
        type: "symbol",
        source: SOLD_ASSET_SOURCE,
        minzoom: 4.2,
        layout: {
          "visibility": "none",
          "text-field": [
            "format",
            "SOLD ", { "font-scale": 0.72 },
            ["get", "name"], { "font-scale": 0.9 },
            "\n",
            ["get", "price_label"], { "font-scale": 0.7 },
          ],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 11,
          "text-variable-anchor": ["top", "bottom", "left", "right"],
          "text-radial-offset": 1.15,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#f7f3ea",
          "text-halo-color": "#1b1916",
          "text-halo-width": 1.4,
        },
      });
    }

    if (!map.getLayer(OPERATOR_RELATIONSHIP_LABEL_LAYER)) {
      map.addLayer({
        id: OPERATOR_RELATIONSHIP_LABEL_LAYER,
        type: "symbol",
        source: OPERATOR_RELATIONSHIP_SOURCE,
        minzoom: 4.8,
        layout: {
          "visibility": "none",
          "text-field": [
            "format",
            ["get", "marker_label"], { "font-scale": 0.78 },
            " ",
            ["get", "name"], { "font-scale": 0.88 },
            "\n",
            ["get", "relationship_type_label"], { "font-scale": 0.62 },
          ],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 10.5,
          "text-variable-anchor": ["top", "bottom", "left", "right"],
          "text-radial-offset": 1.05,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#f7f3ea",
          "text-halo-color": "#1b1916",
          "text-halo-width": 1.4,
        },
      });
    }

    if (!map.getLayer(PROPERTY_LABEL_LAYER)) {
      map.addLayer({
        id: PROPERTY_LABEL_LAYER,
        type: "symbol",
        source: PROPERTY_LABEL_SOURCE,
        maxzoom: 8.7,
        layout: {
          "text-field": [
            "format",
            ["get", "name"], { "font-scale": 1.0 },
            "\n",
            ["get", "acres_label"], { "font-scale": 0.65 },
          ],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            4, 11,
            6, 13,
            8, 14.5,
          ],
          "text-variable-anchor": ["left", "right", "top", "bottom"],
          "text-radial-offset": 1.1,
          "text-justify": "auto",
          "text-padding": 4,
          "symbol-sort-key": ["-", 100000, ["to-number", ["get", "titled"]]],
        },
        paint: {
          "text-color": "#f7f3ea",
          "text-halo-color": "#1b1916",
          "text-halo-width": 1.5,
          "text-halo-blur": 0.4,
        },
      });
    }

    // The status fill is the primary signal. Gold selection casing sits
    // underneath the fill so it marks selection without tinting every parcel.
    moveMapLayerBefore(map, PROPERTY_GLOW_LAYER, SELECTED_PARCEL_FILL_LAYER);
    moveMapLayerBefore(map, PROPERTY_OUTLINE_LAYER, SELECTED_PARCEL_FILL_LAYER);
    moveMapLayerBefore(map, PROPERTY_SELECTED_LAYER, SELECTED_PARCEL_FILL_LAYER);
    moveMapLayerToTop(map, PARCEL_SEEDING_FILL_LAYER);
    moveMapLayerToTop(map, PARCEL_SEEDING_OUTLINE_LAYER);
    moveMapLayerToTop(map, SELECTED_QUARTER_EVIDENCE_FILL_LAYER);
    moveMapLayerToTop(map, SELECTED_QUARTER_EVIDENCE_OUTLINE_LAYER);
    moveMapLayerToTop(map, SELECTED_PARCEL_OUTLINE_LAYER);
    moveMapLayerToTop(map, SELECTED_PARCEL_SEASON_LAYER);
    moveMapLayerToTop(map, SOLD_ASSET_LAYER);
    moveMapLayerToTop(map, SOLD_ASSET_LABEL_LAYER);
    moveMapLayerToTop(map, OPERATOR_RELATIONSHIP_LAYER);
    moveMapLayerToTop(map, OPERATOR_RELATIONSHIP_LABEL_LAYER);

    if (!map.__monetteAtlasHandlersInstalled) {
      map.__monetteAtlasHandlersInstalled = true;

      map.on("mousemove", PARCEL_SEEDING_FILL_LAYER, (e) => {
        if (atlasModeRef.current !== "seeding") return;
        const feature = e.features && e.features[0];
        if (!feature) return;
        map.getCanvas().style.cursor = "help";
        if (!seedingPopupRef.current) {
          seedingPopupRef.current = new window.mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: "atlas-sale-map-popup atlas-seeding-map-popup",
            offset: 14,
          });
        }
        seedingPopupRef.current
          .setLngLat(e.lngLat)
          .setHTML(seedingParcelPopupHtml(feature.properties || {}))
          .addTo(map);
      });

      map.on("mouseleave", PARCEL_SEEDING_FILL_LAYER, () => {
        if (atlasModeRef.current !== "seeding") return;
        map.getCanvas().style.cursor = "";
        if (seedingPopupRef.current) seedingPopupRef.current.remove();
      });

      map.on("mousemove", SELECTED_PARCEL_FILL_LAYER, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features && e.features[0];
        const fp = feature ? feature.properties || {} : {};
        const isRumored = Number(fp.rumored_sold) === 1;
        const isFeedlot = Number(fp.feedlot_proposal) === 1;

        if (!isRumored && rumoredQuarterPopupRef.current) rumoredQuarterPopupRef.current.remove();
        if (!isFeedlot && feedlotProposalPopupRef.current) feedlotProposalPopupRef.current.remove();
        if (!isRumored && !isFeedlot) return;

        if (isRumored) {
          if (!rumoredQuarterPopupRef.current) {
            rumoredQuarterPopupRef.current = new window.mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: "atlas-sale-map-popup",
              offset: 14,
            });
          }
          rumoredQuarterPopupRef.current
            .setLngLat(e.lngLat)
            .setHTML(rumoredSoldQuarterPopupHtml(fp))
            .addTo(map);
        }
        if (isFeedlot) {
          if (!feedlotProposalPopupRef.current) {
            feedlotProposalPopupRef.current = new window.mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: "atlas-sale-map-popup",
              offset: 14,
              anchor: "top",
            });
          }
          feedlotProposalPopupRef.current
            .setLngLat(e.lngLat)
            .setHTML(feedlotProposalPopupHtml(fp))
            .addTo(map);
        }
      });

      map.on("mouseleave", SELECTED_PARCEL_FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        if (rumoredQuarterPopupRef.current) rumoredQuarterPopupRef.current.remove();
        if (feedlotProposalPopupRef.current) feedlotProposalPopupRef.current.remove();
      });

      map.on("click", SELECTED_PARCEL_FILL_LAYER, (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const propId = feature.properties.property_id;
        const qloc = feature.properties.loc;
        const property = propertyById[propId];
        if (!property) return;
        setSel(property);
        setSelQLoc(qloc || null);
        setDrawerOpen(true);
        routeToSelection(property.id, qloc || null);
      });

      map.on("mousemove", PROPERTY_FILL_LAYER, (e) => {
        if (selectionRef.current) return;
        const feature = e.features && e.features[0];
        if (!feature) return;
        const property = propertyById[feature.properties.id];
        setHoverProperty(property || null);
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", PROPERTY_FILL_LAYER, () => {
        if (!selectionRef.current) setHoverProperty(null);
        map.getCanvas().style.cursor = "";
      });

      map.on("click", PROPERTY_FILL_LAYER, (e) => {
        const parcelHits = map.queryRenderedFeatures(e.point, { layers: [SELECTED_PARCEL_FILL_LAYER] });
        if (parcelHits && parcelHits.length) return;
        const feature = e.features && e.features[0];
        if (!feature) return;
        const property = propertyById[feature.properties.id];
        if (!property) return;
        setSel(property);
        setSelQLoc(null);
        setDrawerOpen(false);
        routeToSelection(property.id, null);
        focusProperty(property.id, 1000);
      });

      map.on("mousemove", PROPERTY_POINT_LAYER, (e) => {
        if (selectionRef.current) return;
        const feature = e.features && e.features[0];
        if (!feature) return;
        const property = propertyById[feature.properties.id];
        setHoverProperty(property || null);
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", PROPERTY_POINT_LAYER, () => {
        if (!selectionRef.current) setHoverProperty(null);
        map.getCanvas().style.cursor = "";
      });

      map.on("click", PROPERTY_POINT_LAYER, (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const property = propertyById[feature.properties.id];
        if (!property) return;
        setSel(property);
        setSelQLoc(null);
        setDrawerOpen(false);
        routeToSelection(property.id, null);
        focusProperty(property.id, 1000);
      });

      map.on("mousemove", OPERATOR_RELATIONSHIP_LAYER, (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        map.getCanvas().style.cursor = "help";
        if (!operatorRelationshipPopupRef.current) {
          operatorRelationshipPopupRef.current = new window.mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: "atlas-sale-map-popup",
            offset: 14,
          });
        }
        operatorRelationshipPopupRef.current
          .setLngLat(feature.geometry.coordinates)
          .setHTML(operatorRelationshipPopupHtml(feature.properties || {}))
          .addTo(map);
      });

      map.on("mouseleave", OPERATOR_RELATIONSHIP_LAYER, () => {
        map.getCanvas().style.cursor = "";
        if (operatorRelationshipPopupRef.current) operatorRelationshipPopupRef.current.remove();
      });

      map.on("click", OPERATOR_RELATIONSHIP_LAYER, (e) => {
        const feature = e.features && e.features[0];
        if (!feature || !feature.geometry || !feature.geometry.coordinates) return;
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(map.getZoom(), 8),
          duration: 850,
          essential: true,
        });
      });

      map.on("mousemove", SOLD_ASSET_LAYER, (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        map.getCanvas().style.cursor = "help";
        if (!soldPopupRef.current) {
          soldPopupRef.current = new window.mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: "atlas-sale-map-popup",
            offset: 14,
          });
        }
        soldPopupRef.current
          .setLngLat(feature.geometry.coordinates)
          .setHTML(soldAssetPopupHtml(feature.properties || {}))
          .addTo(map);
      });

      map.on("mouseleave", SOLD_ASSET_LAYER, () => {
        map.getCanvas().style.cursor = "";
        if (soldPopupRef.current) soldPopupRef.current.remove();
      });
    }

    syncMapPresentation(map);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !window.mapboxgl) return;
    if (window.mapboxgl.supported && !window.mapboxgl.supported()) {
      setMapError("Atlas unavailable: this browser cannot initialize WebGL.");
      return;
    }

    window.mapboxgl.accessToken = window.MAPBOX_TOKEN;
    let map;
    try {
      map = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: currentStyle,
        center: window.MAPBOX_HOME.center,
        zoom: window.MAPBOX_HOME.zoom,
        attributionControl: true,
        projection: "mercator",
        // Free navigation — explicitly opt every gesture in. No maxBounds, no
        // zoom clamping. Defaults already allow these but stating them
        // explicitly insulates us from any future style/options that might
        // disable them, and signals intent for code review.
        interactive: true,
        dragPan: true,
        dragRotate: true,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        touchPitch: true,
        keyboard: true,
        pitchWithRotate: true,
        cooperativeGestures: false,
        renderWorldCopies: true,
      });
    } catch (error) {
      console.warn("atlas map unavailable:", error);
      setMapError("Atlas unavailable: WebGL failed during map startup.");
      return;
    }

    map.addControl(new window.mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), "bottom-right");

    // Reset-to-home button — a user who pans across continents (or pitches/
    // rotates the map) needs a one-click way back to the portfolio overview.
    // Built with safe DOM methods (no innerHTML) for XSS hygiene.
    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.className = "atlas-home-button";
    homeBtn.title = "Reset map to portfolio overview";
    homeBtn.setAttribute("aria-label", "Reset map to portfolio overview");
    const homeIcon = document.createElement("span");
    homeIcon.setAttribute("aria-hidden", "true");
    homeIcon.textContent = "⌂";
    homeBtn.appendChild(homeIcon);
    homeBtn.addEventListener("click", () => {
      map.flyTo({
        center: window.MAPBOX_HOME.center,
        zoom: window.MAPBOX_HOME.zoom,
        bearing: 0,
        pitch: 0,
        duration: 1100,
      });
    });
    map.addControl({
      onAdd: () => {
        const wrap = document.createElement("div");
        wrap.className = "mapboxgl-ctrl mapboxgl-ctrl-group atlas-home-ctrl";
        wrap.appendChild(homeBtn);
        return wrap;
      },
      onRemove: () => { homeBtn.remove(); },
    }, "bottom-right");
    mapRef.current = map;
    map.__monetteStyleUri = currentStyle;
    window.MONETTE_MAP = map;

    const reattach = () => {
      if (!mapDataRef.current) return;
      try {
        installAtlasLayers(map, mapDataRef.current);
        if (pendingFocusRef.current) {
          const pending = pendingFocusRef.current;
          focusProperty(pending.propId, pending.duration);
        }
      } catch (err) {
        console.warn("map layer install retry:", err);
      }
    };

    map.on("load", reattach);
    map.on("style.load", reattach);
    map.on("idle", reattach);

    return () => {
      if (soldPopupRef.current) {
        soldPopupRef.current.remove();
        soldPopupRef.current = null;
      }
      if (operatorRelationshipPopupRef.current) {
        operatorRelationshipPopupRef.current.remove();
        operatorRelationshipPopupRef.current = null;
      }
      if (rumoredQuarterPopupRef.current) {
        rumoredQuarterPopupRef.current.remove();
        rumoredQuarterPopupRef.current = null;
      }
      if (feedlotProposalPopupRef.current) {
        feedlotProposalPopupRef.current.remove();
        feedlotProposalPopupRef.current = null;
      }
      if (seedingPopupRef.current) {
        seedingPopupRef.current.remove();
        seedingPopupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      delete window.MONETTE_MAP;
    };
  }, []);

  useEffect(() => {
    if (!quarterGeojson) {
      setMapError("Parcel geometry asset unavailable.");
    }
  }, [quarterGeojson]);

  const preparedMapData = useMemo(() => {
    if (!quarterGeojson) return null;
    return buildPreparedMapData(
      quarterGeojson,
      quarterStateIndex,
      window.MONETTE_IMAGERY || { parcels: {} },
      rollups,
      propertyById
    );
  }, [quarterGeojson, quarterStateIndex, propertyById, rollups]);

  useEffect(() => {
    if (!preparedMapData) return;
    mapDataRef.current = preparedMapData;
    setMapData(preparedMapData);
    setMapError(null);
    if (mapRef.current) {
      try {
        if (mapRef.current.isStyleLoaded && mapRef.current.isStyleLoaded()) {
          installAtlasLayers(mapRef.current, preparedMapData);
          if (pendingFocusRef.current) {
            const pending = pendingFocusRef.current;
            focusProperty(pending.propId, pending.duration);
          }
        }
      } catch (err) {
        console.warn("initial atlas attach deferred:", err);
      }
    }
  }, [preparedMapData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.__monetteStyleUri === currentStyle) {
      safeSyncMapPresentation(map);
      return;
    }
    map.__monetteStyleUri = currentStyle;
    map.setStyle(currentStyle);
  }, [currentStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) safeSyncMapPresentation(map);
  }, [mapData, sel, selQLoc, ownershipFocus, atlasMode]);

  useEffect(() => {
    if (!sel) {
      pendingFocusRef.current = null;
      return;
    }
    if (!mapDataRef.current) return;
    focusProperty(sel.id);
  }, [sel, mapData]);

  useEffect(() => {
    if (!forcedSelect) {
      pendingFocusRef.current = null;
      setSel(null);
      setSelQLoc(null);
      setDrawerOpen(false);
      return;
    }

    const property = propertyById[forcedSelect];
    if (!property) return;
    pendingFocusRef.current = { propId: property.id, duration: 900 };
    setSel(property);
    setSelQLoc(forcedQuarter || null);
    setDrawerOpen(!!forcedQuarter);
    focusProperty(property.id, 900);
  }, [forcedQuarter, forcedSelect, propertyById]);

  useEffect(() => {
    window.openQuarter = (propId, loc) => {
      const property = propertyById[propId];
      if (!property) return;
      setSel(property);
      setSelQLoc(loc || null);
      setDrawerOpen(true);
      routeToSelection(propId, loc || null);
      focusProperty(propId, 900);
    };
    return () => {
      delete window.openQuarter;
    };
  }, [onSwitchView, propertyById]);

  const activeMode = ATLAS_MODES.find((m) => m.key === atlasMode) || ATLAS_MODES[0];
  const hoverOrSel = hoverProperty || sel;
  const coverageByProperty = mapData && mapData.coverageByProperty ? mapData.coverageByProperty : {};
  const selectedCoverage = sel ? coverageByProperty[sel.id] : null;
  const hasSelectedGeometry = !!(selectedCoverage && selectedCoverage.hasRealGeometry);
  const portfolioMappedCount = mapData ? mapData.mappedPropertyCount : 0;
  const portfolioParcelCount = mapData ? mapData.mappedParcelCount : 0;
  const portfolioSeedingSummary = mapData && mapData.seedingSummary ? mapData.seedingSummary : null;
  const selectedSeedingSummary = selectedCoverage && selectedCoverage.seedingSummary ? selectedCoverage.seedingSummary : null;
  const activeSeedingSummary = sel ? selectedSeedingSummary : portfolioSeedingSummary;
  const selectedParcelImagery = sel && selQLoc
    ? ((window.MONETTE_IMAGERY && window.MONETTE_IMAGERY.parcels) || {})[imageryKey(sel.id, selQLoc)] || null
    : null;
  const selectedQuarterRow = sel && selQLoc
    ? ((Q && Q[sel.id]) || []).find((q) => q.loc === selQLoc)
    : null;
  const selectedParcelAcres = selectedQuarterRow && Number.isFinite(Number(selectedQuarterRow.ac))
    ? Number(selectedQuarterRow.ac)
    : 0;
  const selectedParcelEvidenceRows = seedingEvidenceRows(selectedParcelImagery);
  const selectedParcelSidebarRows = selectedParcelAcres
    ? [["Parcel acres", fmtAc(selectedParcelAcres)], ...selectedParcelEvidenceRows]
    : selectedParcelEvidenceRows;
  const operatorRelationships = D.operatorRelationships || [];
  const operatorRelationshipCount = mapData
    ? mapData.operatorRelationshipCount
    : operatorRelationships.length;
  const portfolioRollup = useMemo(() => aggregateRollups(rollups), [rollups]);
  const activeRollup = hoverOrSel ? rollups[hoverOrSel.id] : portfolioRollup;
  const activeLeadLabel = hoverOrSel ? propertyDisplayLabel(hoverOrSel, activeRollup) : dominantOwnershipLabel(activeRollup);
  const activeLeadColor = hoverOrSel ? propertyDisplayColor(hoverOrSel, activeRollup) : dominantOwnershipColor(activeRollup);
  const ownershipFocusInfo = ownershipFocusMeta(ownershipFocus);
  const pointOnlyProperties = mapData
    ? D.properties.filter((property) => {
      const coverage = coverageByProperty[property.id];
      return coverage && coverage.pointOnly;
    })
    : [];
  const selectProperty = (property, openDrawer = true) => {
    if (!property) return;
    setSel(property);
    setSelQLoc(null);
    setDrawerOpen(openDrawer);
    routeToSelection(property.id, null);
    focusProperty(property.id, 900);
  };

  // Codex bvqyinxv4 Q1 deep-link rule: bare #map shows the HomeHero stats
  // band above the atlas; #map/{property} (forcedSelect non-null) suppresses
  // the hero so shared property links land directly on the map.
  const showHomeHero = !forcedSelect;

  return (
    <div style={{ minHeight: "100%", background: "var(--night)", color: "var(--paper)", fontSize: 13 }}>
      {showHomeHero && (
        <HomeHero
          onSwitchView={onSwitchView}
          onOpenSubmit={onOpenHeadlineForm}
        />
      )}
      <div className="atlas-toolbar">
        <div>
          <div className="serif atlas-toolbar-title">Monette Land Atlas</div>
          <div className="atlas-toolbar-subtitle mono">
            Two map views: seeding progress and land status.
          </div>
        </div>
        <div className="atlas-toolbar-status" aria-label="Portfolio status summary">
          <span className="atlas-toolbar-pill atlas-toolbar-pill-owned mono">Owned {portfolioRollup.owned}</span>
          <span className="atlas-toolbar-pill atlas-toolbar-pill-rented mono">Rented {portfolioRollup.rented}</span>
          <span className="atlas-toolbar-pill atlas-toolbar-pill-sold mono">Sold {portfolioRollup.sold}</span>
          <span className="atlas-toolbar-pill atlas-toolbar-pill-sale mono">For sale {portfolioRollup.forSale}</span>
        </div>
      </div>

      <div className="atlas-grid atlas-shell" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px" }}>
        <div className="scroll atlas-rail atlas-side" style={{ overflowY: "auto" }}>
          <div className="atlas-side-heading">Property status board</div>
          <div className="atlas-side-note">
            Click a land block or property name to reveal mapped quarters, satellite seeding status, and ownership context.
          </div>

          {D.properties.map((property) => {
            const active = sel && sel.id === property.id;
            const rollup = rollups[property.id];
            const coverage = coverageByProperty[property.id];
            const propertySeedingSummary = coverage && coverage.seedingSummary ? coverage.seedingSummary : null;
            return (
              <button
                key={property.id}
                type="button"
                className={`atlas-property-row${active ? " is-active" : ""}`}
                onMouseEnter={() => setHoverProperty(property)}
                onMouseLeave={() => setHoverProperty(null)}
                onClick={() => {
                  setSel(property);
                  setSelQLoc(null);
                  setDrawerOpen(true);
                  routeToSelection(property.id, null);
                  focusProperty(property.id, 900);
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span className="serif atlas-property-name">{property.name}</span>
                  <span className="mono atlas-property-province">{property.province}</span>
                </div>
                <div className="mono atlas-property-meta">
                  {fmt(property.titled)} ac · {property.parcels} titles
                </div>
                <div className="atlas-property-tags">
                  <span
                    className="atlas-chip atlas-chip-state"
                    style={{
                      borderColor: propertyDisplayColor(property, rollup),
                      color: propertyDisplayColor(property, rollup),
                    }}
                  >
                    {propertyDisplayLabel(property, rollup)}
                  </span>
                  {coverage && coverage.hasRealGeometry ? (
                    <span className="atlas-chip">Map shapes {fmt(coverage.mappedParcels)}</span>
                  ) : coverage && coverage.pointOnly ? (
                    <span className="atlas-chip atlas-chip-muted">Point only</span>
                  ) : (
                    <span className="atlas-chip atlas-chip-muted">Synthetic rows</span>
                  )}
                </div>
                {atlasMode === "seeding" && propertySeedingSummary ? (
                  <SeedingProgressBar summary={propertySeedingSummary} />
                ) : (
                  <div className="atlas-property-bar">
                    {property.currentLandStatus ? (
                      <CurrentLandStatusBar status={property.currentLandStatus} compact />
                    ) : (
                      [
                        ["owned", rollup.owned, OWN["owned-monette"].color],
                        ["rented", rollup.rented, OWN["rented-monette"].color],
                        ["sold", rollup.sold, OWN.sold.color],
                        ["unknown", rollup.unknown, OWN.unknown.color],
                      ].map(([key, value, color]) =>
                        value ? <span key={key} style={{ width: `${(value / (rollup.total || 1)) * 100}%`, background: color }} /> : null
                      )
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="atlas-map" style={{ position: "relative" }}>
          <div className="atlas-map-frame">
            <div ref={mapContainerRef} className="mb-container" />
            {mapError && !mapRef.current && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 28,
                background: "linear-gradient(180deg, rgba(245,241,234,0.96), rgba(236,230,219,0.96))",
              }}>
                <div style={{ maxWidth: 360 }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold-ink)" }}>
                    Atlas fallback
                  </div>
                  <div className="serif" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 10 }}>
                    Map preview unavailable
                  </div>
                  <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
                    {mapError} The register, drawer, and property rollups still work, so you can keep inspecting the file even without live map rendering.
                  </div>
                </div>
              </div>
            )}

            <div className="atlas-mode-pills mono" aria-label="Atlas display mode">
              {ATLAS_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  title={m.description}
                  className={`atlas-mode-pill${atlasMode === m.key ? " is-active" : ""}`}
                  onClick={() => setAtlasMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {sel && !hasSelectedGeometry && (
              <div className="atlas-map-note mono">
                {sel.name} is not parcel-mapped yet. The marker is a court-file location cue, not a surveyed boundary.
              </div>
            )}

            {mapError && (
              <div className="atlas-map-error mono">
                {mapError}
              </div>
            )}
          </div>
        </div>

        <div className="atlas-mobile-guide atlas-side">
          <details>
            <summary className="mono">Legend and trust note</summary>
            <div className="atlas-mobile-guide-body">
              {atlasMode === "seeding" ? (
                <>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: "#3a8c2a" }} />
                    <span>Green parcels are likely seeded.</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: "#686868" }} />
                    <span>Grey parcels are unseeded, uncertain, or outside the active read.</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch atlas-swatch-lowqc" />
                    <span>Dashed outline means low polygon quality.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN["owned-monette"].color }} />
                    <span>Green blocks are still Monette-owned.</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN["rented-monette"].color }} />
                    <span>Blue blocks are still Monette-rented.</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN.sold.color }} />
                    <span>Red blocks are sold or sale-leaseback.</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN["returned-to-ll"].color }} />
                    <span>Tan quarter outlines are returned to landlord.</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch atlas-swatch-point" />
                    <span>Point-only assets stay in the property selector until geometry is verified.</span>
                  </div>
                </>
              )}
            </div>
          </details>
        </div>

        <div className="atlas-feed atlas-side">
          <div className="atlas-side-heading">Map view</div>
          <div className="atlas-panel-block">
            <div className="mono atlas-panel-kicker">{activeMode.heading}</div>
            <div className="atlas-side-note" style={{ marginTop: 6 }}>
              {activeMode.description}
            </div>
          </div>

          <div className="atlas-panel-block atlas-property-jump">
            <label className="mono atlas-panel-kicker" htmlFor="atlas-property-jump">Jump to property</label>
            <select
              id="atlas-property-jump"
              className="atlas-property-select mono"
              value={sel ? sel.id : ""}
              onChange={(event) => {
                const property = propertyById[event.target.value];
                if (property) selectProperty(property, true);
              }}
            >
              <option value="">Portfolio overview</option>
              {D.properties.map((property) => {
                const coverage = coverageByProperty[property.id];
                const suffix = coverage && coverage.hasRealGeometry
                  ? ` - ${fmt(coverage.mappedParcels)} shapes`
                  : coverage && coverage.pointOnly
                    ? " - point-only"
                    : " - synthetic";
                return (
                  <option key={property.id} value={property.id}>
                    {property.name}{suffix}
                  </option>
                );
              })}
            </select>
            {pointOnlyProperties.length > 0 && (
              <div className="atlas-pointonly-note mono">
                {pointOnlyProperties.length} point-only records are kept in this selector instead of pinned across the map.
              </div>
            )}
          </div>

          <div className="atlas-panel-block">
            <div className="mono atlas-panel-kicker">{sel ? "Selected property" : "Portfolio coverage"}</div>
            {sel ? (
              <>
                <div className="serif atlas-panel-title">{sel.name}</div>
                <div className="atlas-panel-lead mono" style={{ color: propertyDisplayColor(sel, rollups[sel.id]) }}>
                  {propertyDisplayLabel(sel, rollups[sel.id])}
                </div>
                <div className="atlas-panel-rollup">
                  {sel.currentLandStatus
                    ? <CurrentLandStatusBar status={sel.currentLandStatus} />
                    : <RollupBar rollup={rollups[sel.id]} />}
                </div>
                <div className="atlas-panel-stats mono">
                  <span>Titled ac</span>
                  <span>{fmt(sel.titled)}</span>
                  <span>Registry titles</span>
                  <span>{sel.parcels}</span>
                  <span>Map shapes</span>
                  <span>
                    {selectedCoverage && selectedCoverage.hasRealGeometry
                      ? fmt(selectedCoverage.mappedParcels)
                      : selectedCoverage && selectedCoverage.pointOnly
                        ? "Point only"
                        : "Synthetic"}
                  </span>
                  <span>For sale</span>
                  <span>{rollups[sel.id] ? rollups[sel.id].forSale || 0 : 0}</span>
                  <span>For rent</span>
                  <span>{rollups[sel.id] ? rollups[sel.id].forRent || 0 : 0}</span>
                  {sel.currentLandStatus && (
                    <>
                      <span>Current owned ac</span>
                      <span style={{ color: OWN["owned-monette"].color }}>{fmt(sel.currentLandStatus.mappedOwnedAc || 0)}</span>
                      {sel.currentLandStatus.soldUnlocatedAc ? (
                        <>
                          <span>Sold dot ac</span>
                          <span style={{ color: OWN.sold.color }}>{fmt(sel.currentLandStatus.soldUnlocatedAc)}</span>
                        </>
                      ) : null}
                      <span>Rented/unmapped ac</span>
                      <span style={{ color: OWN["rented-monette"].color }}>{fmt(sel.currentLandStatus.assumedRentedUnmappedAc || 0)}</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="atlas-panel-lead mono" style={{ color: activeLeadColor }}>
                  {activeLeadLabel}
                </div>
                <div className="atlas-panel-rollup">
                  <RollupBar rollup={portfolioRollup} />
                </div>
                <div className="atlas-panel-stats mono">
                  <span>Properties with geometry</span>
                  <span>{mapData ? portfolioMappedCount : "..."}</span>
                  <span>Point-only records</span>
                  <span>{mapData ? mapData.pointPropertyCount : "..."}</span>
                  <span>Sold markers</span>
                  <span>{mapData ? mapData.soldAssetCount : "..."}</span>
                  <span>Operator links</span>
                  <span>{mapData ? operatorRelationshipCount : "..."}</span>
                  <span>Mapped shapes</span>
                  <span>{mapData ? fmt(portfolioParcelCount) : "..."}</span>
                  <span>For sale</span>
                  <span>{portfolioRollup.forSale}</span>
                </div>
              </>
            )}
            {atlasMode === "seeding" && activeSeedingSummary && (
              <div className="atlas-panel-stats mono atlas-seeding-stats">
                <span>Likely seeded acres</span>
                <span style={{ color: "#a8e090" }}>{fmtAc(activeSeedingSummary.seededAc || 0)}</span>
                <span>No confident call acres</span>
                <span>{fmtAc((activeSeedingSummary.unseededAc || 0) + (activeSeedingSummary.uncertainAc || 0) + (activeSeedingSummary.unavailableAc || 0))}</span>
                <span>GEE-read acres</span>
                <span>{fmtAc(activeSeedingSummary.totalAc || 0)}</span>
                <span>Active GEE-read acres</span>
                <span>{fmtAc(activeSeedingSummary.activeAc || 0)}</span>
                <span>Likely seeded parcels</span>
                <span style={{ color: "#a8e090" }}>{activeSeedingSummary.seeded || 0}</span>
                <span>Low-QC acres</span>
                <span>{fmtAc(activeSeedingSummary.lowQcAc || 0)}</span>
              </div>
            )}
            {atlasMode === "seeding" && sel && selQLoc && (
              <div className="atlas-selected-evidence">
                <div className="atlas-selected-evidence-head">
                  <div className="mono atlas-selected-evidence-kicker">Selected parcel read</div>
                  <button
                    type="button"
                    className="atlas-selected-evidence-close"
                    aria-label="Close selected parcel read"
                    title="Close selected parcel read"
                    onClick={() => {
                      setSelQLoc(null);
                      routeToSelection(sel.id, null);
                    }}
                  >
                    X
                  </button>
                </div>
                <div className="atlas-selected-evidence-title">{selQLoc}</div>
                <div className="atlas-side-note" style={{ marginTop: 5 }}>
                  Public read is limited to status and confidence.
                </div>
                {selectedParcelSidebarRows.length > 0 ? (
                  <div className="atlas-selected-evidence-grid mono">
                    {selectedParcelSidebarRows.map(([label, value]) => (
                      <React.Fragment key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="atlas-side-note" style={{ marginTop: 8 }}>
                    No GEE parcel record is attached to this selected shape yet.
                  </div>
                )}
              </div>
            )}
            {atlasMode === "land-status" && (
              <div className="atlas-panel-focus mono">
                <span>Map focus: <strong style={{ color: ownershipFocusInfo.color }}>{ownershipFocusInfo.label}</strong></span>
                <div>
                  {OWNERSHIP_FOCUS_OPTIONS.map((option) => {
                    const active = ownershipFocus === option.key;
                    const meta = ownershipFocusMeta(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={active ? "is-active" : ""}
                        style={active ? { borderColor: meta.color, color: meta.color } : null}
                        onClick={() => setOwnershipFocus(option.key)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {sel && sel.currentLandStatus && ownershipFocus === "rented-monette" && (
                  <em>Rented acres are unmapped here until LSDs / quarter descriptions are identified.</em>
                )}
              </div>
            )}
          </div>

          {atlasMode === "land-status" && (
          <div className="atlas-panel-block">
            <div className="mono atlas-panel-kicker">Operator relationships</div>
            <div className="atlas-side-note" style={{ marginTop: 6 }}>
              Partner-owned or co-managed assets. These stay in the list now instead of putting extra circles on the land map.
            </div>
            <div className="atlas-operator-list">
              {operatorRelationships.map((relationship) => (
                <button
                  key={relationship.id}
                  type="button"
                  className={`atlas-operator-row${relationship.confidence === "watchlist" ? " is-watchlist" : ""}`}
                  onClick={() => focusOperatorRelationship(relationship)}
                >
                  <span className="mono atlas-operator-marker">{relationship.confidence === "watchlist" ? "?" : "OP"}</span>
                  <span>
                    <strong>{relationship.name}</strong>
                    <em>{relationship.relationshipType === "overlap-watchlist" ? "Watchlist - overlap not proved" : "Partner-owned / Monette-managed"}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          <div className="atlas-panel-block">
            <div className="mono atlas-panel-kicker">Legend</div>
            <div className="atlas-legend-list">
              {atlasMode === "seeding" ? (
                <>
                  <div className="atlas-legend-row"><span className="atlas-swatch" style={{ background: "#3a8c2a" }} /><span>Likely seeded</span></div>
                  <div className="atlas-legend-row"><span className="atlas-swatch" style={{ background: "#686868" }} /><span>Grey = unseeded or no confident call</span></div>
                  <div className="atlas-legend-row"><span className="atlas-swatch atlas-swatch-lowqc" /><span>Dashed = low polygon quality</span></div>
                </>
              ) : (
                <>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN["owned-monette"].color }} />
                    <span>Still Monette-owned</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN["rented-monette"].color }} />
                    <span>Still Monette-rented</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN.sold.color }} />
                    <span>Sold</span>
                  </div>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch" style={{ background: OWN["returned-to-ll"].color }} />
                    <span>Returned to landlord</span>
                  </div>
                </>
              )}
              {atlasMode === "land-status" && (
                <>
                  <div className="atlas-legend-row">
                    <span className="atlas-swatch atlas-swatch-point" />
                    <span>Selected point-only asset: approximate location only</span>
                  </div>
                </>
              )}
              <div className="atlas-legend-row">
                <span className="atlas-swatch atlas-swatch-outline" style={{ borderColor: "#f1d284" }} />
                <span>Gold halo = selected property</span>
              </div>
            </div>
          </div>

          <div className="atlas-panel-block">
            <div className="mono atlas-panel-kicker">Trust note</div>
            <div className="atlas-side-note">
              {atlasMode === "seeding"
                ? "Seeding status is a GEE-backed confidence read. Public output is limited to status, acres, and confidence."
                : "Land status colors apply wherever mapped geometry exists. Operator relationships are provenance markers only and do not change acreage totals."}
            </div>
          </div>
        </div>
      </div>

      <PropertyDrawer
        prop={drawerOpen ? sel : null}
        initialQuarterLoc={selQLoc}
        onClose={() => {
          // Close hides the panel but keeps the property highlighted on
          // the map (gold halo + left-rail active state). The user can
          // re-open the drawer by clicking the property again.
          setDrawerOpen(false);
        }}
        onZoomMap={(property) => {
          if (!property) return;
          // Fly to the property's bbox and dismiss the drawer so the user
          // can see the map. Selection is preserved so quarters stay
          // highlighted and clickable.
          setSelQLoc(null);
          setDrawerOpen(false);
          routeToSelection(property.id, null);
          focusProperty(property.id, 900);
        }}
        onQuarterRouteChange={(propId, quarterLoc) => {
          setSelQLoc(quarterLoc || null);
          routeToSelection(propId, quarterLoc || null);
        }}
        onOpenHeadlineForm={onOpenHeadlineForm}
      />
    </div>
  );
};

window.MapView = MapView;
