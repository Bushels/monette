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
const now = () => new Date().toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ACTION_KEYS = new Set(["Enter", " "]);

function onActionKey(e, fn) {
  if (!ACTION_KEYS.has(e.key)) return;
  e.preventDefault();
  fn();
}

function currentMonetteUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.hash || "#editorial"}`;
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

function formatRelativeTime(value) {
  if (!value) return "recent";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "recent";
  const deltaMs = Date.now() - then.getTime();
  const deltaHours = Math.max(0, Math.round(deltaMs / (1000 * 60 * 60)));
  if (deltaHours < 1) return "just now";
  if (deltaHours < 24) return `${deltaHours}h`;
  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) return `${deltaDays}d`;
  const deltaWeeks = Math.round(deltaDays / 7);
  return `${deltaWeeks}w`;
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

if (!Array.isArray(window.MONETTE_HEADLINES)) {
  window.MONETTE_HEADLINES = [...(D.headlines || [])];
}

if (!window.onHeadlinesChange || !window.monetteSetHeadlines) {
  const headlineListeners = new Set();
  window.onHeadlinesChange = (fn) => {
    headlineListeners.add(fn);
    return () => headlineListeners.delete(fn);
  };
  window.monetteSetHeadlines = (heads) => {
    window.MONETTE_HEADLINES = Array.isArray(heads) ? heads : [...(D.headlines || [])];
    headlineListeners.forEach((fn) => {
      try { fn(window.MONETTE_HEADLINES); } catch (e) {}
    });
  };
}

function propertyNameFor(propId) {
  const property = (D.properties || []).find((p) => p.id === propId);
  return property ? property.name : propId || "Unknown property";
}

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
  return {
    ownership,
    provisional,
    listing: "not-listed",
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
// SUPA_TALLIES no longer exists after the satellite pivot; this function
// keeps its shape for downstream consumers but reads nothing from Supabase.
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

// Headline ticker store.
function useHeadlines() {
  const [heads, setHeads] = useState(() => window.MONETTE_HEADLINES || D.headlines || []);
  useEffect(() => {
    if (!window.onHeadlinesChange) return;
    return window.onHeadlinesChange(() => setHeads(window.MONETTE_HEADLINES || D.headlines || []));
  }, []);
  return heads;
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

function ListingPill({ kind }) {
  if (kind === "not-listed") return null;
  const m = LIST[kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontFamily: '"JetBrains Mono", monospace',
      fontSize: 9, padding: "3px 6px", border: `1px dashed ${m.color}`, color: m.color,
      letterSpacing: "0.06em", textTransform: "uppercase",
    }}>◎ {m.label}</span>
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
          The Monette Ledger · Independent reporting · CCAA Day {D.day}
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

// SubmitHeadlineModal — agnonymous tip-submission modal triggered by the
// "Submit Update" nav button (and openHeadlineForm callback from per-property
// drawers). Originally lived in tutorial.jsx, which was deleted in the
// 2026-04-29 satellite pivot (commit c50e6e2) because the rest of that file
// was vote-tutorial content. This modal is independent of voting — it writes
// to the public.tips Supabase table via window.monetteSubmitTip — so it
// belongs here alongside SiteFooter and other shared chrome. Restored 2026-04-29.
function SubmitHeadlineModal({ open, onClose, initialPropertyId, initialText = "" }) {
  const [propertyId, setPropertyId] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setPropertyId("");
    setText("");
    setAuthor("");
    setStatus("idle");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPropertyId(initialPropertyId || "");
    setText(initialText || "");
  }, [open, initialPropertyId, initialText]);

  if (!open) return null;

  const submit = async () => {
    const body = text.trim();
    if (!body || status === "saving") return;

    setStatus("saving");
    setError("");

    try {
      const ok = await (window.monetteSubmitTip
        ? window.monetteSubmitTip({
            kind: "headline",
            propId: propertyId || null,
            body,
            author: author.trim() || null,
          })
        : false);

      if (!ok) {
        setStatus("error");
        setError("Update queue unavailable. Enable Supabase or check the tips table permissions.");
        return;
      }

      setStatus("success");
      if (window.monetteHydrateHeadlines) {
        window.monetteHydrateHeadlines().catch(() => {});
      }
    } catch (err) {
      setStatus("error");
      setError(err && err.message ? err.message : "Unable to queue the update.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(19,17,14,0.62)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 680,
          maxWidth: "100%",
          background: "var(--paper)",
          border: "2px solid var(--ink)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            background: "var(--ink)",
            color: "var(--paper)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>Submit an update</span>
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "#b48638" }}>
              MODERATED QUEUE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              fontSize: 11,
              fontFamily: "inherit",
              border: "1px solid #3a342a",
              background: "transparent",
              color: "var(--paper)",
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            Close x
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {status === "success" ? (
            <div style={{
              padding: "14px 16px",
              background: "rgba(78,106,48,0.08)",
              border: "1px solid rgba(78,106,48,0.28)",
              color: "var(--ink)",
            }}>
              <div className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>Queued for review</div>
              <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
                Your update was stored in the moderation queue. Reviewed items can be promoted into the public ticker, used to update point-only files, or used to create future parcel rows.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)", marginBottom: 16 }}>
                Use this only for grounded source evidence a Monette moderator needs to review directly. Public correction threads and banter belong on Agnonymous.
              </div>

              <label htmlFor="submit-property" style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, fontWeight: 600 }}>
                Property (optional)
              </label>
              <select
                id="submit-property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                style={{
                  width: "100%",
                  fontFamily: "inherit",
                  fontSize: 13,
                  padding: "10px 12px",
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  marginBottom: 14,
                }}
              >
                <option value="">General / not tied to one property</option>
                {D.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} · {property.province}
                  </option>
                ))}
              </select>

              <label htmlFor="submit-body" style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, fontWeight: 600 }}>
                What did you see?
              </label>
              <textarea
                id="submit-body"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                rows={4}
                placeholder="Example: Regina South sale report - link/source, buyer if known, quarter/legal description, and how certain you are."
                style={{
                  width: "100%",
                  fontFamily: "inherit",
                  fontSize: 14,
                  padding: "10px 12px",
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  marginBottom: 14,
                  resize: "vertical",
                }}
              />

              <label htmlFor="submit-author" style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, fontWeight: 600 }}>
                Your handle (optional)
              </label>
              <input
                id="submit-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="@prairiespotter"
                style={{
                  width: "100%",
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 13,
                  padding: "10px 12px",
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  marginBottom: 16,
                }}
              />

              <div
                className="mono"
                style={{
                  padding: "10px 12px",
                  background: "var(--paper-2)",
                  borderLeft: "3px solid var(--gold)",
                  fontSize: 12,
                  color: "var(--ink)",
                  marginBottom: 18,
                }}
              >
                Queue rule: one concrete observation per submission. If the claim is uncertain, say that plainly. Reviewed updates can become public ticker items or source material for new parcel rows.
              </div>

              {status === "error" && (
                <div style={{ marginBottom: 12, color: "#9a3a2a", fontSize: 12 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "14px 24px",
            borderTop: "1px solid var(--rule)",
            background: "var(--paper-2)",
          }}
        >
          {status === "success" ? (
            <button onClick={onClose} className="btn btn-dark">
              Close
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn">Cancel</button>
              <button
                onClick={submit}
                className="btn btn-dark"
                disabled={!text.trim() || status === "saving"}
                style={{
                  opacity: text.trim() && status !== "saving" ? 1 : 0.45,
                  cursor: text.trim() && status !== "saving" ? "pointer" : "default",
                }}
              >
                {status === "saving" ? "Queueing..." : "Queue for review"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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
  now,
  onActionKey,
  currentMonetteUrl,
  buildAgnonymousUrl,
  openAgnonymousDiscussion,
  AgnonymousRibbon,
  formatRelativeTime,
  useQuarter,
  rollupProperty,
  useHeadlines,
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
  SubmitHeadlineModal,
});
