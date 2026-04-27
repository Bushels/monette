// Monette Farms — status helpers + shared voting primitives.
//
// Vote tallies are the source of truth; they live server-side in Supabase
// (public.votes -> vote_tallies view) and are hydrated into window.SUPA_TALLIES
// at page load. A couple of small things stay in localStorage as visitor-local
// memory: this person's own pick, and their own spotted-events timeline.
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
          Structured votes and reviewed source-of-truth updates stay on Monette. Comments,
          challenges, and requests for clarification go to Agnonymous where others can reply.
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

function useTalliesVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!window.onTalliesChange) return undefined;
    return window.onTalliesChange(() => setVersion((n) => n + 1));
  }, []);

  return version;
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

const ACTIVITY_KEY = "monette.activity.v1";
const ACTIVITY_LIMIT = 40;

function propertyNameFor(propId) {
  const property = (D.properties || []).find((p) => p.id === propId);
  return property ? property.name : propId || "Unknown property";
}

function activityMeta(category, value) {
  if (category === "ownership") {
    const meta = OWN[value] || OWN.unknown;
    return { label: meta.short || meta.label || value, action: "Control vote", color: meta.color };
  }
  if (category === "listing") {
    const meta = LIST[value] || { label: value, color: "var(--mute)" };
    return { label: meta.label || value, action: "Market vote", color: meta.color };
  }

  const seasonLabels = { seeded: "Seeded", sprayed: "Sprayer spotted", harvested: "Harvested" };
  const seasonColors = { seeded: "#5a7a3a", sprayed: "#b48638", harvested: "#9a3a2a" };
  return {
    label: seasonLabels[value] || value,
    action: "Season mark",
    color: seasonColors[value] || "#6a6a6a",
  };
}

function normalizeActivityItem(row) {
  if (!row) return null;
  const propId = row.propId || row.prop_id;
  const quarterLoc = row.quarterLoc || row.quarter_loc;
  const category = row.category;
  const value = row.value;
  if (!propId || !quarterLoc || !category || !value) return null;

  const createdAt = row.createdAt || row.created_at || new Date().toISOString();
  const meta = activityMeta(category, value);
  return {
    id: row.id || `${createdAt}:${propId}:${quarterLoc}:${category}:${value}`,
    propId,
    propertyName: propertyNameFor(propId),
    quarterLoc,
    category,
    value,
    label: meta.label,
    action: meta.action,
    color: meta.color,
    createdAt,
    optimistic: !!row.optimistic,
  };
}

function dedupeActivity(items) {
  const seen = new Set();
  const out = [];
  const sorted = (items || [])
    .map(normalizeActivityItem)
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const item of sorted) {
    const key = item.id || `${item.createdAt}:${item.propId}:${item.quarterLoc}:${item.category}:${item.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= ACTIVITY_LIMIT) break;
  }
  return out;
}

function loadStoredActivity() {
  try {
    const saved = localStorage.getItem(ACTIVITY_KEY);
    if (saved) return dedupeActivity(JSON.parse(saved));
  } catch (e) {}
  return [];
}

function saveStoredActivity(items) {
  try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items.slice(0, ACTIVITY_LIMIT))); } catch (e) {}
}

if (!Array.isArray(window.MONETTE_ACTIVITY_FEED)) {
  window.MONETTE_ACTIVITY_FEED = loadStoredActivity();
}

if (!window.onActivityFeedChange || !window.monetteSetActivityFeed) {
  const activityListeners = new Set();
  window.onActivityFeedChange = (fn) => {
    activityListeners.add(fn);
    return () => activityListeners.delete(fn);
  };
  const notifyActivity = () => activityListeners.forEach((fn) => {
    try { fn(window.MONETTE_ACTIVITY_FEED || []); } catch (e) {}
  });
  window.monetteSetActivityFeed = (items) => {
    const next = dedupeActivity(items || []);
    window.MONETTE_ACTIVITY_FEED = next;
    saveStoredActivity(next);
    notifyActivity();
  };
  window.monettePushActivity = (item) => {
    const normalized = normalizeActivityItem(item);
    if (!normalized) return null;
    window.monetteSetActivityFeed([normalized, ...(window.MONETTE_ACTIVITY_FEED || [])]);
    return normalized.id;
  };
  window.monetteRemoveActivity = (id) => {
    if (!id) return;
    window.monetteSetActivityFeed((window.MONETTE_ACTIVITY_FEED || []).filter((item) => item.id !== id));
  };
}

// Initial per-quarter display guess: until the community tells us otherwise,
// every quarter is assumed still owned or rented by Monette Farms. No pre-
// filled sold / returned / unknown — those statuses only appear when real
// votes land.
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
  // graduated by community votes. It renders the pill dashed with a "?" so
  // viewers can tell it apart from a confirmed community-voted status.
  // Cleared in mergeTallies the moment any vote lands on the quarter.
  let ownership;
  let provisional = false;

  const cat = ownerCategoryFor(propId, q.loc);
  if (cat === "monette") {
    ownership = "owned-monette";
  } else if (cat === "raptor" || cat === "third-party") {
    ownership = "rented-monette";
  } else if (cat === "missing") {
    // Property has an owner table but this specific quarter's loc string
    // doesn't match (MB/AB legal-description formats sometimes differ
    // between XLSX and geojson). Default to the property's DOMINANT owner
    // from the table — better than guessing via hash.
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
    // Fallback for properties that don't yet have an owner side-table —
    // use the original 80/20 hash so legacy properties keep working.
    const rng = (propId + q.loc).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const fallback = ["owned-monette", "owned-monette", "owned-monette", "owned-monette", "rented-monette"];
    ownership = fallback[rng % fallback.length];
  }

  // Hafford: per community intel 2026-04-25, Simmons owns Raptor Enterprises
  // Inc., AND Walter Farms purchased ALL the Hafford land — the Monette
  // 3,658 ac PLUS the Raptor/Simmons 20,795 ac. Whether Monette is still
  // farming under leaseback is unconfirmed. Display ALL Hafford quarters
  // (Monette + Raptor) under "sold-rented-back", provisional until court
  // documentation lands. The 22,013 unmapped rented ac in the tender package
  // is also reportedly part of the Walter Farms acquisition (total 46,466).
  if (propId === "hafford") {
    ownership = "sold-rented-back";
    provisional = true;
  }

  // Per-property `rumoredSoldQuarters` — opt-in mechanism for quarter-level
  // rumored dispositions where the rumor names specific quarters (vs. the
  // whole-property Hafford pattern above). Each property's data.js record
  // can carry `rumoredSoldQuarters: ["NW-3-16-12-W3", ...]`. Flagged "sold"
  // (not "sold-rented-back" — leaseback isn't implied) with provisional pill.
  // Wymark example 2026-04-26: 5 quarters reportedly sold to Carefoot Acres.
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
    seeded: false,
    seededAt: null,
    harvested: false,
    harvestedAt: null,
    sprays: [],
  };
}

// Highest-count value wins. Used to promote the community's top vote into
// the single-status pills (OwnershipPill, ListingPill) and the rollup bar.
function topValue(counts, fallback) {
  if (!counts) return fallback;
  let best = fallback, bestN = 0;
  for (const [k, n] of Object.entries(counts)) { if (n > bestN) { best = k; bestN = n; } }
  return best;
}

// Merge server-side vote tallies into the base state. Winner of each category
// becomes the displayed ownership/listing; raw counts drive the vote bars.
function mergeTallies(propId, qloc, base) {
  const k = `${propId}:${qloc}`;
  const t = (window.SUPA_TALLIES && window.SUPA_TALLIES[k]) || {};
  // Strip stale "owned-monette" votes when the XLSX-derived ownership
  // disagrees: (a) sold-rented-back seed = post-sale state, "owned" is the
  // pre-sale state and is stale; (b) the quarter is XLSX-titled to a
  // non-Monette entity (Raptor at Hafford) so an "owned-monette" vote
  // contradicts ISC titles. Other vote values (sold, returned-to-ll,
  // unknown) can still graduate the pill.
  let ownershipTally = t.ownership || {};
  const xlsxCat = ownerCategoryFor(propId, qloc);
  const xlsxSaysNotMonette = xlsxCat && xlsxCat !== "monette";
  const seedSaysSold = base.ownership === "sold-rented-back";
  if ((seedSaysSold || xlsxSaysNotMonette) && ownershipTally["owned-monette"]) {
    const { "owned-monette": _stale, ...rest } = ownershipTally;
    ownershipTally = rest;
  }
  // Any remaining community ownership vote graduates a Ledger-provisional
  // seed to a confirmed status — the pill switches from dashed/"?" to solid.
  const ownershipVoteCount = Object.values(ownershipTally).reduce((a, b) => a + b, 0);
  return {
    ...base,
    ownership:      topValue(ownershipTally, base.ownership),
    provisional:    ownershipVoteCount > 0 ? false : !!base.provisional,
    listing:        topValue(t.listing,   base.listing),
    ownershipVotes: { ...ownershipTally },
    listingVotes:   { ...(t.listing   || {}) },
    seasonVotes:    { ...(t.season    || {}) },
  };
}

// Visitor-local memory: their own spotted-events (seeded/harvested/sprayed
// timeline). Community-wide counts are computed from SUPA_TALLIES at render.
// Bumped namespace to 'v3' on 2026-04-25 so the new sold-rented-back seed for
// Hafford takes effect for returning visitors whose browsers still held the
// pre-Walter-Farms-rumor synthetic state. Old monette.q.v2.* keys are ignored.
const LOCAL_NS = "monette.q.v4";
function loadVisitorLocal(propId, q, i) {
  const key = `${LOCAL_NS}.${propId}:${q.loc}`;
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch (e) {}
  return seedQuarter(propId, q, i);
}
function saveVisitorLocal(propId, qloc, st) {
  const { ownership, listing, seeded, seededAt, harvested, harvestedAt, sprays } = st;
  try { localStorage.setItem(`${LOCAL_NS}.${propId}:${qloc}`, JSON.stringify({ ownership, listing, seeded, seededAt, harvested, harvestedAt, sprays })); } catch (e) {}
}

// Synchronous read used by rollupProperty and the list/map views. Merges
// visitor-local pick with server tallies so the rollup reflects community data.
function loadQState(propId, q, i) {
  return mergeTallies(propId, q.loc, loadVisitorLocal(propId, q, i));
}
function saveQState(propId, qloc, st) { saveVisitorLocal(propId, qloc, st); }

// Per-quarter state hook. Votes are fire-and-forget inserts to Supabase;
// SUPA_TALLIES is bumped optimistically so the UI moves instantly. Visitor-
// local flags (seeded spotted / sprays timeline) stay in localStorage.
function useQuarter(propId, q, i) {
  const [local, setLocal] = useState(() => loadVisitorLocal(propId, q, i));
  const [, force] = useState(0);
  useEffect(() => {
    if (!window.onTalliesChange) return;
    return window.onTalliesChange(() => force((n) => n + 1));
  }, []);

  const st = mergeTallies(propId, q.loc, local);
  const update = (patch) => setLocal((prev) => {
    const n = { ...prev, ...patch };
    saveVisitorLocal(propId, q.loc, n);
    return n;
  });

  const insert = (cat, val, note) => {
    if (window.monetteInsertVote) window.monetteInsertVote(propId, q.loc, cat, val, note);
  };

  // "My own pick" comes from the server-sync'd MY_VOTES cache (survives
  // reloads and matches what's actually in public.votes). Local ownership
  // is only used as an optimistic fallback while the first write lands.
  const myOwn    = (window.myPollVote   && window.myPollVote(propId, q.loc, "ownership")) || null;
  const myList   = (window.myPollVote   && window.myPollVote(propId, q.loc, "listing"))   || null;
  const mySeeded    = !!(window.mySeasonVote && window.mySeasonVote(propId, q.loc, "seeded"));
  const mySprayed   = !!(window.mySeasonVote && window.mySeasonVote(propId, q.loc, "sprayed"));
  const myHarvested = !!(window.mySeasonVote && window.mySeasonVote(propId, q.loc, "harvested"));

  const voteOwn  = (k) => { if (myOwn !== k)  { update({ ownership: k }); insert("ownership", k); } };
  const voteList = (k) => { if (myList !== k) { update({ listing: k });   insert("listing",   k); } };
  const toggleSeed = () => {
    if (mySeeded) return;                                         // one-and-done
    update({ seeded: true, seededAt: now() });
    insert("season", "seeded");
  };
  const toggleHarvest = () => {
    if (myHarvested) return;
    update({ harvested: true, harvestedAt: now() });
    insert("season", "harvested");
  };
  const addSpray = (note) => {
    if (mySprayed) return;
    update({ sprays: [{ by: "you", at: now(), note: note || "Sprayer spotted" }, ...local.sprays] });
    insert("season", "sprayed", note || null);
  };
  return [
    st,
    { voteOwn, voteList, toggleSeed, toggleHarvest, addSpray, update },
    { myOwn, myList, mySeeded, mySprayed, myHarvested },
  ];
}

// Fold all quarters of one property into portfolio-level counts used by
// the list, editorial, and map views.
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
    const sv = st.seasonVotes || {};
    if ((sv.seeded    || 0) > 0 || st.seeded)               rollup.seeded++;
    if ((sv.sprayed   || 0) > 0 || (st.sprays && st.sprays.length)) rollup.sprayed++;
    if ((sv.harvested || 0) > 0 || st.harvested)            rollup.harvested++;
  });
  return { quarters, rollup };
}

// Headline ticker store. Community submissions persist alongside the
// starter feed in data.js. Local-only for now; future Supabase tips table
// will hydrate the same list via window.monetteSubmitTip.
function useHeadlines() {
  const [heads, setHeads] = useState(() => window.MONETTE_HEADLINES || D.headlines || []);
  useEffect(() => {
    if (!window.onHeadlinesChange) return;
    return window.onHeadlinesChange(() => setHeads(window.MONETTE_HEADLINES || D.headlines || []));
  }, []);
  return heads;
}

function useActivityFeed(limit) {
  const [items, setItems] = useState(() => window.MONETTE_ACTIVITY_FEED || []);
  useEffect(() => {
    if (!window.onActivityFeedChange) return;
    return window.onActivityFeedChange(() => setItems(window.MONETTE_ACTIVITY_FEED || []));
  }, []);
  return typeof limit === "number" ? items.slice(0, limit) : items;
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
    ? `${m.label} — Ledger-provisional, awaiting community votes / official confirmation`
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

// Shared vote-bars widget used for both ownership and listing votes.
function VoteBars({ entries, meta, active, onVote, dense }) {
  const total = Object.values(entries).reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ display: "grid", gap: dense ? 3 : 4 }}>
      {Object.entries(meta).map(([k, m]) => {
        const cnt = entries[k] || 0;
        const pct = (cnt / total) * 100;
        const on = active === k;
        return (
          <button key={k} onClick={() => onVote(k)} style={{
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center",
            padding: dense ? "6px 8px" : "8px 10px",
            border: on ? `1.5px solid ${m.color}` : "1px solid var(--rule-2)",
            background: on ? "var(--paper)" : "var(--paper)",
            cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--ink)",
          }}>
            <StatusDot kind={k} size={7} />
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>{m.label || m.short}</span>
              <span style={{ flex: 1, height: 3, background: "var(--rule)", position: "relative", minWidth: 30 }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: m.color }} />
              </span>
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "var(--ink-2)", minWidth: 20, textAlign: "right", fontWeight: 500 }}>{cnt}</span>
          </button>
        );
      })}
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
  useTalliesVersion,
  useActivityFeed,
  useQuarter,
  rollupProperty,
  useHeadlines,
  StatusDot,
  OwnershipPill,
  ListingPill,
  RollupBar,
  VoteBars,
  seedQuarter,
  loadQState,
});
