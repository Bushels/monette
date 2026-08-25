// Monette Farms — status helpers + shared UI primitives.
//
// Satellite pivot 2026-04-29: community voting has been removed entirely.
// Ownership/listing/season status is now derived from XLSX-sourced data and
// editorial overrides. The satellite seeding pipeline (imagery-data.js) is
// the source of truth for 2026 field activity.
const { useState, useMemo, useEffect, useRef } = React;
const D = window.MONETTE_DATA;
const Q = window.MONETTE_QUARTERS;
const OWN = D.ownership, LIST = D.listing, SEA = D.season;

const fmt = (n) => (n || 0).toLocaleString("en-CA");
const fmtM = (n) => n >= 1000000 ? "$" + (n / 1000000).toFixed(1) + "M" : "$" + fmt(n);
const fmtAc = (n) => `${Math.round(n || 0).toLocaleString("en-CA")} ac`;
const now = () => new Date().toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ACTION_KEYS = new Set(["Enter", " "]);

function getCcaaDay() {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const filingUtc = Date.UTC(2026, 3, 21);
  return Math.max(0, Math.floor((todayUtc - filingUtc) / 86400000));
}

function parseAskingPriceCAD(value) {
  const match = /\$([\d,]+)/.exec(String(value || ""));
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

// Current public Hammond inventory only. This intentionally excludes the
// separately listed Swift Current processing facility and non-SK brokers.
// All top-level sale figures derive from the same per-property records used by
// the drawer, so navigation copy cannot drift away from the map data.
function getHammondSaleSummary() {
  const listings = Object.values(D.sispByProperty || {}).filter((meta) =>
    meta && meta.status === "listed" && meta.broker === "Hammond Realty" &&
    meta.sourceCheckedAt && meta.price
  );
  return listings.reduce((summary, meta) => {
    summary.listingCount += Array.isArray(meta.listings) ? meta.listings.length : 1;
    summary.totalAskingCAD += parseAskingPriceCAD(meta.price);
    summary.listingAcres += Number(meta.listingAc || 0);
    if (!summary.checkedAt || meta.sourceCheckedAt > summary.checkedAt) {
      summary.checkedAt = meta.sourceCheckedAt;
    }
    return summary;
  }, {
    listingCount: 0,
    totalAskingCAD: 0,
    listingAcres: 0,
    checkedAt: null,
  });
}

function fmtAskingCompact(value) {
  const millions = Number(value || 0) / 1000000;
  return `$${millions.toLocaleString("en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
}

function fmtSatelliteNumber(value, digits = 3, suffix = "") {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(digits)}${suffix ? ` ${suffix}` : ""}`;
}

function seedingCallText(applicability, seeded, confidence, vetoReason) {
  if (!applicability) return "No satellite data";
  if (vetoReason === "snow_or_freeze_risk") return "Snow/freeze risk - confidence withheld";
  if (applicability === "insufficient_baseline") return "Insufficient baseline - SAR pending";
  if (applicability === "out-of-season") return "Out of season";
  if (applicability === "perennial") return "Perennial crop - seeding n/a";
  if (seeded === true) return `Likely seeded${confidence ? ` (${confidence}% confidence)` : ""}`;
  if (seeded === false) return `Likely not seeded${confidence ? ` (${confidence}% confidence)` : ""}`;
  return "No confident seeded call";
}

function seedingEvidenceAsset(imgRow) {
  if (!imgRow) return null;
  const seeding = imgRow.seeding || {};
  const evidence = imgRow.evidence || imgRow.evidence_asset || seeding.evidence || seeding.evidence_asset || {};
  const imageUrl = evidence.image_url
    || evidence.imageUrl
    || evidence.thumbnail_url
    || evidence.thumbnailUrl
    || imgRow.evidence_image_url
    || imgRow.evidence_thumbnail_url
    || null;
  const tileUrl = evidence.tile_url || evidence.tileUrl || imgRow.evidence_tile_url || null;
  if (!imageUrl && !tileUrl) return null;
  return {
    imageUrl,
    tileUrl,
    label: evidence.label || evidence.asset_label || "GEE parcel evidence",
    sourceScene: evidence.source_scene || evidence.scene_date || (seeding.optical && seeding.optical.source_scene) || null,
  };
}

function seedingEvidenceRows(imgRow) {
  if (!imgRow) return [];
  const confidence = Number(imgRow.seeding_confidence || 0);
  const vetoReason = imgRow.seeding_veto_reason || (imgRow.seeding && imgRow.seeding.veto_reason) || null;
  const confidenceLabel = confidence >= 80
    ? "High"
    : confidence >= 50
      ? "Medium"
      : confidence > 0
        ? "Low"
        : "Not available";
  return [
    ["Call", seedingCallText(imgRow.seeding_applicability, imgRow.seeding_seeded, imgRow.seeding_confidence || 0, vetoReason)],
    ["Confidence", vetoReason === "snow_or_freeze_risk" ? "Withheld" : (confidence > 0 ? `${confidenceLabel} (${confidence}%)` : confidenceLabel)],
  ].filter((row) => row[1] != null && row[1] !== "");
}

function onActionKey(e, fn) {
  if (!ACTION_KEYS.has(e.key)) return;
  e.preventDefault();
  fn();
}

function currentMonetteUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.hash || "#map"}`;
}

function buildAgnonymousUrl({
  title = "Monette Ledger correction or clarification",
  body = "What should be corrected, clarified, or investigated?",
  kind = "clarification",
  category = "Farming",
  propertyId = "",
} = {}) {
  const base = window.AGNONYMOUS_URL || "https://agnonymous.buperac.com";
  const url = new URL(base, window.location.href);
  url.searchParams.set("source", "monette");
  url.searchParams.set("kind", kind);
  url.searchParams.set("category", category);
  url.searchParams.set("title", title);
  url.searchParams.set("body", `${body}\n\nMonette source: ${currentMonetteUrl()}`);
  url.searchParams.set("return", currentMonetteUrl());
  if (propertyId) url.searchParams.set("property", propertyId);
  return url.toString();
}

function openAgnonymousDiscussion(payload = {}) {
  const url = buildAgnonymousUrl(payload);
  window.open(url, "_blank", "noopener,noreferrer");
  return url;
}

function AgnonymousRibbon({
  title = "Clarification request: Hafford / Simmons rented land",
  body = "Help identify the legal land locations for Hafford land reported as rented from Simmons. Add legal descriptions, title clues, field observations, or public source links.",
  eyebrow = "Clarification request",
  cta = "+ Submit Update",
  propertyId = "hafford",
} = {}) {
  return (
    <section className="agnonymous-ribbon" aria-label={eyebrow}>
      <div className="agnonymous-ribbon-copy">
        <div className="mono agnonymous-ribbon-eyebrow">{eyebrow}</div>
        <div className="serif agnonymous-ribbon-title">{title}</div>
        <p>
          Field observations and verified source-of-truth updates can be submitted via agnonymous.buperac.com
          so others can reply.
        </p>
      </div>
      <button
        className="agnonymous-ribbon-button"
        onClick={() => openAgnonymousDiscussion({ title, body, propertyId, kind: "clarification" })}
      >
        {cta}
      </button>
    </section>
  );
}

function buildPortfolioMetrics() {
  const byProvince = {};
  let totalTitledAcres = 0;
  let totalTitles = 0;
  let totalMappedParcels = 0;
  let totalRealGeometryRows = 0;
  let mappedPropertyCount = 0;
  let syntheticPropertyCount = 0;
  let pointOnlyPropertyCount = 0;

  for (const prop of D.properties || []) {
    const rows = ((Q && Q[prop.id]) || []);
    const mappedParcels = rows.length;
    const realRows = rows.filter((row) => row && !row.isSample).length;
    totalTitledAcres += prop.titled || 0;
    totalTitles += prop.parcels || 0;
    totalMappedParcels += mappedParcels;
    totalRealGeometryRows += realRows;

    if (realRows > 0) mappedPropertyCount += 1;
    else if (mappedParcels > 0) syntheticPropertyCount += 1;
    else pointOnlyPropertyCount += 1;

    const province = byProvince[prop.province] || {
      key: prop.province,
      properties: 0,
      totalAcres: 0,
      owned: 0,
      rented: 0,
      mappedParcels: 0,
      largest: null,
    };

    province.properties += 1;
    province.totalAcres += prop.titled || 0;
    province.owned += prop.owned || 0;
    province.rented += prop.rented || 0;
    province.mappedParcels += mappedParcels;
    province.realGeometryRows = (province.realGeometryRows || 0) + realRows;
    province.pointOnlyProperties = (province.pointOnlyProperties || 0) + (mappedParcels ? 0 : 1);

    if (!province.largest || (prop.titled || 0) > province.largest.titled) {
      province.largest = { name: prop.name, titled: prop.titled || 0 };
    }

    byProvince[prop.province] = province;
  }

  for (const province of Object.values(byProvince)) {
    province.pctOwned = province.totalAcres ? Math.round((province.owned / province.totalAcres) * 100) : 0;
  }

  return {
    totalProperties: (D.properties || []).length,
    totalTitledAcres,
    totalRosterAcres: totalTitledAcres,
    totalTitles,
    totalMappedParcels,
    totalRealGeometryRows,
    mappedPropertyCount,
    syntheticPropertyCount,
    pointOnlyPropertyCount,
    mappedCoveragePct: totalTitles ? Math.round((totalMappedParcels / totalTitles) * 100) : 0,
    courtOwnedAcres: D.portfolioTotals ? D.portfolioTotals.ownedRosterAcres : totalTitledAcres,
    farmedAcresLabel: D.portfolioTotals ? D.portfolioTotals.farmedAcresLabel : `${fmt(totalTitledAcres)}`,
    leasedAcresApprox: D.portfolioTotals ? D.portfolioTotals.leasedAcresApprox : 0,
    availableAcres: D.portfolioTotals ? D.portfolioTotals.availableAcres : 0,
    plannedSeededAcres: D.portfolioTotals ? D.portfolioTotals.plannedSeededAcres : 0,
    byProvince,
  };
}

const PORTFOLIO = buildPortfolioMetrics();

// Per-quarter owner lookup, sourced from each property's XLSX Owner column
// via build script — see quarter-owners.js (window.MONETTE_QUARTER_OWNERS).
// Returns one of: "monette" | "raptor" | "third-party" | "missing" (property has
// a table but this quarter isn't in it) | null (no table for this property).
function ownerCategoryFor(propId, qloc) {
  const map = (window.MONETTE_QUARTER_OWNERS || {})[propId];
  if (!map) return null;
  const owner = map[qloc];
  if (!owner) return "missing";
  const lower = String(owner).toLowerCase();
  if (lower.includes("monette")) return "monette";
  if (lower.includes("raptor"))  return "raptor";
  return "third-party";
}

function seedQuarter(propId, q, i) {
  // `provisional` marks a Ledger-editorial seed override that has NOT been
  // graduated by community confirmation. It renders the pill dashed with a "?"
  // so viewers can tell it apart from a confirmed status.
  let ownership;
  let provisional = false;

  const cat = ownerCategoryFor(propId, q.loc);
  if (cat === "monette") {
    ownership = "owned-monette";
  } else if (cat === "raptor" || cat === "third-party") {
    ownership = "rented-monette";
  } else if (cat === "missing") {
    const totals = (window.MONETTE_QUARTER_OWNER_TOTALS || {})[propId] || {};
    let dominant = null, dominantAc = 0;
    for (const [name, ac] of Object.entries(totals)) {
      if (ac > dominantAc) { dominant = name; dominantAc = ac; }
    }
    if (dominant && /monette/i.test(dominant))      ownership = "owned-monette";
    else if (dominant && /raptor/i.test(dominant))  ownership = "rented-monette";
    else if (dominant)                               ownership = "rented-monette";
    else                                             ownership = "unknown";
  } else if (q.owner) {
    // Real parcel record with an owner field (US cadastral / AZ-CO pipelines
    // embed record owners per parcel). Trust it over the synthetic fallback —
    // e.g. all 220 Montana parcels are titled to MONETTE FARMS USA INC.
    ownership = /monette/i.test(String(q.owner)) ? "owned-monette" : "rented-monette";
  } else {
    const rng = (propId + q.loc).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const fallback = ["owned-monette", "owned-monette", "owned-monette", "owned-monette", "rented-monette"];
    ownership = fallback[rng % fallback.length];
  }

  // Hafford: per community intel 2026-04-25, Walter Farms purchased ALL the
  // Hafford land — display ALL Hafford quarters under "sold-rented-back",
  // provisional until court documentation lands.
  if (propId === "hafford") {
    ownership = "sold-rented-back";
    provisional = true;
  }

  // Per-property `rumoredSoldQuarters` — opt-in mechanism for quarter-level
  // rumored dispositions. Flagged "sold" (not "sold-rented-back") with
  // provisional pill. Wymark/Waldeck example 2026-04-26.
  const propMeta = (window.MONETTE_DATA && window.MONETTE_DATA.properties || [])
    .find(p => p && p.id === propId);
  if (propMeta && Array.isArray(propMeta.rumoredSoldQuarters) &&
      propMeta.rumoredSoldQuarters.includes(q.loc)) {
    ownership = "sold";
    provisional = true;
  }

  // Official SISP listing overlay: a property flagged "listed" or "likely" in
  // sispByProperty lights its OWNED quarters as "listed-for-sale". Confirmed
  // ("listed") renders a solid pill; in-scope-but-unconfirmed ("likely") renders
  // a provisional dashed pill.
  //
  // A per-parcel "for sale" claim is public and litigation-adjacent, so it
  // requires SOURCE-BACKED tenure for the specific quarter: a quarter-owners
  // table hit or a real parcel owner field (cadastral/broker record). Quarters
  // whose ownership came from statistical inference (dominant-owner fill-in or
  // the synthetic hash fallback) and synthesized sample parcels never light —
  // the property-level claim lives in the drawer's SISP block instead.
  // (Codex review 2026-07-02, BLOCKER #1.)
  let listing = "not-listed";
  let listingProvisional = false;
  const sispMeta = (window.MONETTE_DATA && window.MONETTE_DATA.sispByProperty || {})[propId];
  if (sispMeta && (sispMeta.status === "listed" || sispMeta.status === "likely") &&
      ownership === "owned-monette" && !q.isSample) {
    const evidenceBacked = cat === "monette" || /monette/i.test(String(q.owner || ""));
    if (evidenceBacked) {
      listing = "listed-for-sale";
      listingProvisional = sispMeta.status === "likely";
    }
  }

  return {
    ownership,
    provisional,
    listing,
    listingProvisional,
  };
}

// Highest-count value wins.
function topValue(counts, fallback) {
  if (!counts) return fallback;
  let best = fallback, bestN = 0;
  for (const [k, n] of Object.entries(counts)) { if (n > bestN) { best = k; bestN = n; } }
  return best;
}

// Local state for a quarter — XLSX-derived ownership/listing with no vote merge.
// This function keeps its shape for downstream consumers while remaining read-only.
function loadQState(propId, q, i) {
  return seedQuarter(propId, q, i);
}

// Per-quarter state hook (read-only after satellite pivot).
function useQuarter(propId, q, i) {
  const st = useMemo(() => seedQuarter(propId, q, i), [propId, q && q.loc, i]);
  return [
    {
      ...st,
      seeded: false,
      seededAt: null,
      harvested: false,
      harvestedAt: null,
      sprays: [],
      ownershipVotes: {},
      listingVotes: {},
      seasonVotes: {},
    },
    {},  // actions: empty — voting is removed
    {},  // myVotes: empty
  ];
}

// Fold all quarters of one property into portfolio-level counts for display.
function rollupProperty(propId) {
  const quarters = ((Q && Q[propId]) || []).map((q, i) => ({ q, i, st: loadQState(propId, q, i) }));
  const rollup = { total: quarters.length, owned: 0, sold: 0, soldRentedBack: 0, rented: 0, returned: 0, unknown: 0, forSale: 0, forRent: 0, seeded: 0, sprayed: 0, harvested: 0 };
  quarters.forEach(({ st }) => {
    if (st.ownership === "owned-monette")    rollup.owned++;
    if (st.ownership === "sold")             rollup.sold++;
    if (st.ownership === "sold-rented-back") rollup.soldRentedBack++;
    if (st.ownership === "rented-monette")   rollup.rented++;
    if (st.ownership === "returned-to-ll")   rollup.returned++;
    if (st.ownership === "unknown")          rollup.unknown++;
    if (st.listing === "listed-for-sale")   rollup.forSale++;
    if (st.listing === "listed-for-rent")   rollup.forRent++;
  });
  return { quarters, rollup };
}

// ------- UI PRIMITIVES -------
function StatusDot({ kind, size = 8 }) {
  const m = OWN[kind] || LIST[kind] || { color: "#6a6a6a" };
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: m.color, verticalAlign: "middle", marginRight: 6 }} />;
}

function OwnershipPill({ kind, compact, provisional }) {
  const m = OWN[kind] || OWN.unknown;
  const borderStyle = provisional ? "dashed" : "solid";
  const title = provisional
    ? `${m.label} — Ledger-provisional, awaiting official confirmation`
    : m.label;
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontFamily: '"JetBrains Mono", monospace',
      fontSize: compact ? 9 : 10, padding: compact ? "3px 6px" : "4px 8px",
      border: `1px ${borderStyle} ${m.color}`, color: m.color,
      letterSpacing: "0.06em", textTransform: "uppercase",
      fontStyle: provisional ? "italic" : "normal",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, opacity: provisional ? 0.55 : 1 }} />
      {provisional ? "? " : ""}{m.short}
    </span>
  );
}

function ListingPill({ kind, provisional }) {
  if (kind === "not-listed") return null;
  const m = LIST[kind];
  const isSale = kind === "listed-for-sale";
  const label = isSale
    ? (provisional ? "In SISP scope" : "Listed for sale · SISP")
    : m.label;
  const title = isSale
    ? (provisional
        ? "Owned land inside the FTI SISP offering — specific package/listing not yet public"
        : "Officially for sale via the court-supervised FTI SISP")
    : m.label;
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontFamily: '"JetBrains Mono", monospace',
      fontSize: 9, padding: "3px 6px", border: `1px ${provisional ? "dashed" : "solid"} ${m.color}`, color: m.color,
      letterSpacing: "0.06em", textTransform: "uppercase",
      fontStyle: provisional ? "italic" : "normal",
    }}>◎ {provisional ? "? " : ""}{label}</span>
  );
}

// Proportional bar showing ownership mix across a property's quarters.
function RollupBar({ rollup }) {
  const t = rollup.total || 1;
  const segs = [
    ["owned",          rollup.owned,          OWN["owned-monette"].color],
    ["sold-rent-back", rollup.soldRentedBack, OWN["sold-rented-back"].color],
    ["rented",         rollup.rented,         OWN["rented-monette"].color],
    ["sold",           rollup.sold,           OWN.sold.color],
    ["returned",       rollup.returned,       OWN["returned-to-ll"].color],
    ["unknown",        rollup.unknown,        OWN.unknown.color],
  ];
  return (
    <div style={{ display: "flex", height: 6, background: "var(--rule)" }}>
      {segs.map(([k, v, c]) => v ? <div key={k} title={`${k}: ${v}`} style={{ width: `${(v / t) * 100}%`, background: c }} /> : null)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reader support / "tip jar" — payment-provider-agnostic config
// ─────────────────────────────────────────────────────────────────────────────
const MONETTE_SUPPORT = {
  customAmountUrl: "https://paypal.me/buperac",
  tiers: [
    { label: "$5",  amount: 5,  url: "https://paypal.me/buperac/5"  },
    { label: "$20", amount: 20, url: "https://paypal.me/buperac/20" },
    { label: "$50", amount: 50, url: "https://paypal.me/buperac/50" },
  ],
};

function supportCustomAmountUrl() {
  return MONETTE_SUPPORT.customAmountUrl || "#";
}

function supportTierUrl(tier) {
  if (!tier || !tier.url) return supportCustomAmountUrl();
  return tier.url;
}

function SupportCard({ headline, sub, signoff, dense = false }) {
  return (
    <aside className={"support-card" + (dense ? " support-card-dense" : "")} role="complementary" aria-label="Support The Monette Ledger">
      <div className="support-card-text">
        <div className="support-card-head serif">
          {headline || "Independent reporting, no paywall."}
        </div>
        <div className="support-card-sub">
          {sub || "If this work is useful to you, chip in. One-time, processed by PayPal — no account required if you pay by card."}
        </div>
        {signoff && (
          <div className="support-card-signoff">{signoff}</div>
        )}
      </div>
      <div className="support-card-actions">
        {MONETTE_SUPPORT.tiers.map((tier) => (
          <a
            key={tier.label}
            href={supportTierUrl(tier)}
            target="_blank"
            rel="noopener noreferrer"
            className="support-tier-btn"
            data-tier-amount={tier.amount}
          >
            {tier.label}
          </a>
        ))}
        <a
          href={supportCustomAmountUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="support-custom-link"
        >
          Custom amount →
        </a>
      </div>
    </aside>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          The Monette Ledger · Independent reporting · CCAA Day {getCcaaDay()}
        </div>
        <nav className="site-footer-links" aria-label="Site footer">
          <a href={supportCustomAmountUrl()} target="_blank" rel="noopener noreferrer">
            Support this work
          </a>
          <span className="site-footer-sep" aria-hidden="true">·</span>
          <a href="#privacy">Privacy</a>
          <span className="site-footer-sep" aria-hidden="true">·</span>
          <a
            href={window.AGNONYMOUS_URL || "https://agnonymous.buperac.com"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact
          </a>
        </nav>
        <div className="site-footer-disclaimer">
          Not affiliated with Monette Farms, the Monitor, or the courts. Satellite observations, editorial annotations, and field reports are labeled separately so all public claims stay auditable.
        </div>
      </div>
    </footer>
  );
}

function LatestCourtUpdatePanel({ compact = false }) {
  const update = D.latestCourtUpdate || null;
  if (!update || !Array.isArray(update.items) || update.items.length === 0) return null;
  const primaryUpdate = update.items[0];
  const additionalUpdateCount = Math.max(0, update.items.length - 1);
  const updateDateLabel = new Date(`${update.asOf}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  const summaryTitle = update.summaryTitle || `${primaryUpdate.title} · ${primaryUpdate.status}`;
  const renderItems = () => update.items.map((item) => (
    <article key={item.title} className="home-court-update-card">
      <div className="mono home-court-update-status">{item.status}</div>
      <h3 className="serif">{item.title}</h3>
      <p>{item.text}</p>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
        {item.sourceLabel} →
      </a>
    </article>
  ));
  const panel = (
    <section className={`home-court-update${compact ? " is-compact court-update-desktop" : ""}`} aria-labelledby={compact ? "atlas-court-update-title" : "home-court-update-title"}>
      <header className="home-court-update-head">
        <div>
          <div className="mono home-court-update-kicker">{update.label}</div>
          <h2 id={compact ? "atlas-court-update-title" : "home-court-update-title"} className="serif">What changed in the latest filings</h2>
        </div>
        <time className="mono" dateTime={update.asOf}>Through Aug 19, 2026</time>
      </header>
      <div className="home-court-update-grid">
        {renderItems()}
      </div>
    </section>
  );
  if (!compact) return panel;
  return (
    <>
      <details className="court-update-desktop court-update-desktop-compact">
        <summary aria-label={`Latest court-file updates through ${updateDateLabel}: ${summaryTitle}; ${update.items.length} updates`}>
          <span className="mono court-update-desktop-kicker">Latest court-file update · {updateDateLabel}</span>
          <strong className="serif">{summaryTitle}</strong>
          <span className="mono court-update-desktop-count">+{additionalUpdateCount} updates</span>
          <span className="mono court-update-desktop-action court-update-action-closed">View details ↓</span>
          <span className="mono court-update-desktop-action court-update-action-open">Close details ↑</span>
        </summary>
        <div className="court-update-desktop-body">
          <div className="home-court-update-grid">{renderItems()}</div>
        </div>
      </details>
      <details className="court-update-mobile">
        <summary>
          <span className="mono">Latest court-file update · {updateDateLabel}</span>
          <strong className="serif">{summaryTitle} <em>+{additionalUpdateCount} updates</em></strong>
        </summary>
        <div className="home-court-update-grid">{renderItems()}</div>
      </details>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeHero — top-of-page hero stats portion. Hoisted out of view-editorial.jsx
// (which is now silent-redirected to #map per the satellite pivot). Renders
// the "400,000+ acre footprint" headline, the per-province stats grid, and
// the Verified Observations card. Used as the bare-#map landing surface;
// suppressed when a property deep-link is in the URL (#map/{property})
// per Codex bvqyinxv4 Q1 — deep-linked atlases skip the hero so shared
// property links land directly on the map.
// ─────────────────────────────────────────────────────────────────────────────
function HomeHero({ onSwitchView, onOpenSubmit }) {
  const provinceNames = {
    AB: "Alberta", SK: "Saskatchewan", MB: "Manitoba", BC: "British Columbia",
    MT: "Montana", CO: "Colorado", AZ: "Arizona",
  };
  const provinces = Object.entries(PORTFOLIO.byProvince)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, stats]) => [provinceNames[key] || key, stats]);

  const submit = () => {
    if (typeof onOpenSubmit === "function") {
      onOpenSubmit({
        title: "Monette Ledger correction or evidence thread",
        body: "Add the property, claim, source link, and confidence level. If this should change the controlled Monette record, say exactly what should change.",
        kind: "clarification",
      });
      return;
    }
    if (window.openAgnonymousDiscussion) {
      window.openAgnonymousDiscussion({
        title: "Monette Ledger correction or evidence thread",
        body: "Add the property, claim, source link, and confidence level.",
        kind: "clarification",
      });
      return;
    }
    window.open(window.AGNONYMOUS_URL || "https://agnonymous.buperac.com", "_blank", "noopener,noreferrer");
  };

  return (
    <section className="home-hero ed-hero" style={{ padding: "48px 48px 28px", borderBottom: "1px solid var(--ink)", background: "var(--paper)", color: "var(--ink)" }}>
      <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 480px", gap: 48 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a3a2a", marginBottom: 20 }}>
            ● Filing date · Apr 21, 2026
          </div>
          <h1 className="serif" style={{ margin: 0, fontSize: 86, lineHeight: 0.95, letterSpacing: "-0.03em", fontWeight: 400 }}>
            {PORTFOLIO.farmedAcresLabel} acre footprint.<br />
            {fmt(PORTFOLIO.courtOwnedAcres)} owned acres in court file.<br />
            <span style={{ color: "var(--mute)" }}>{fmt(PORTFOLIO.totalMappedParcels)} parcel rows live.</span>
          </h1>
          <div style={{ marginTop: 26, fontSize: 16, lineHeight: 1.55, maxWidth: 640, color: "var(--ink-2)" }}>
            Monette Farms Ltd. entered creditor protection under the CCAA on April 21, 2026. The Ledger separates the court-file roster from the parcel-mapped satellite layer: {PORTFOLIO.totalProperties} property records, {PORTFOLIO.mappedPropertyCount} parcel-mapped records, {PORTFOLIO.syntheticPropertyCount} synthetic fallback record, and {PORTFOLIO.pointOnlyPropertyCount} point-only records waiting on better geometry.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            <button onClick={() => onSwitchView && onSwitchView("list")} className="btn btn-dark">Browse properties →</button>
            <button onClick={submit} className="btn">+ Submit Update</button>
          </div>
        </div>
        <div>
          <div className="prov-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
            {provinces.map(([name, stats]) => (
              <div key={name} style={{ borderTop: "1px solid var(--ink)", paddingTop: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>{name}</div>
                <div className="serif" style={{ fontSize: 38, lineHeight: 1, marginTop: 4 }}>
                  {fmt(stats.totalAcres)}<span style={{ fontSize: 11, color: "var(--mute)", marginLeft: 4 }}>ac</span>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>{stats.properties} prop.</span>
                  <span>{stats.pctOwned}% owned</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: "18px 20px", background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 10 }}>
              Verified observations + corrections
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)", margin: "0 0 14px" }}>
              Submit verified field observations, legal-description corrections, and source-cited rumors through agnonymous.buperac.com — the single intake channel for all tips.
            </p>
            <a
              href={window.AGNONYMOUS_URL || "https://agnonymous.buperac.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-dark"
              style={{ display: "inline-block" }}
            >
              agnonymous.buperac.com →
            </a>
          </div>
        </div>
      </div>
      <LatestCourtUpdatePanel />
    </section>
  );
}

Object.assign(window, {
  D,
  Q,
  OWN,
  LIST,
  SEA,
  PORTFOLIO,
  fmt,
  fmtM,
  getHammondSaleSummary,
  fmtAskingCompact,
  now,
  onActionKey,
  currentMonetteUrl,
  buildAgnonymousUrl,
  openAgnonymousDiscussion,
  AgnonymousRibbon,
  useQuarter,
  rollupProperty,
  StatusDot,
  OwnershipPill,
  ListingPill,
  RollupBar,
  seedQuarter,
  loadQState,
  MONETTE_SUPPORT,
  supportCustomAmountUrl,
  supportTierUrl,
  SupportCard,
  SiteFooter,
  LatestCourtUpdatePanel,
  HomeHero,
});
