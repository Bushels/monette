// Deployment gate for the public SISP / for-sale data (data.js).
//
// Checks that the numbers the header, toolbar and drawers print are internally
// consistent and that the evidence-gated pieces (Hafford court split, Aguila
// approved-not-closed, SISP dates) have not drifted. It does NOT re-check live
// broker pages or court filings: that is a manual source pass. Instead it warns
// when a listing's `sourceCheckedAt` is getting old so a refresh is not forgotten.
//
// Usage: npm run validate:sisp

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const STALE_WARN_DAYS = 30;

function load(file, context) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const parseAsk = (value) => {
  const match = /\$([\d,]+)/.exec(String(value || ""));
  return match ? Number(match[1].replace(/,/g, "")) : 0;
};

const dataContext = { window: {} };
load("data.js", dataContext);
const D = dataContext.window.MONETTE_DATA;
const quarterContext = { window: {} };
load("quarters-data.js", quarterContext);
const REAL = quarterContext.window.MONETTE_QUARTERS_REAL || {};
const S = D.sispByProperty;
const today = new Date();
const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

// ---- SISP dates ------------------------------------------------------------
const sisp = D.sisp;
assert(sisp.bindingBidDeadline === "2026-10-15", "Binding bid deadline drifted from the Oct 15, 2026 SISP date");
assert(sisp.terminationDate === "2026-11-30", "SISP Termination Date drifted from Nov 30, 2026");
assert(sisp.earlyBidApprovalOutsideDate === "2026-10-31", "Early-bid court-approval outside date drifted from Oct 31, 2026");
assert(!("closing" in sisp), "sisp.closing was retired: Nov 30 is the SISP Termination Date, not a closing date");
assert(Array.isArray(sisp.brokers) && sisp.brokers.some((b) => /LandQuest/.test(b.name)), "Broker roster must name the BC broker (LandQuest)");

// ---- CAD asking totals, by jurisdiction (mirrors getCadSaleSummary) ---------
const provinceOf = Object.fromEntries(D.properties.map((p) => [p.id, p.province]));
const byRegion = {};
const total = { listingCount: 0, totalAskingCAD: 0, listingAcres: 0 };
for (const [id, meta] of Object.entries(S)) {
  if (!meta || meta.status !== "listed" || !meta.sourceCheckedAt || !meta.price) continue;
  if (!/\bCAD\b/.test(String(meta.price))) continue;
  const region = provinceOf[id] || "other";
  const slot = (byRegion[region] ||= { listingCount: 0, totalAskingCAD: 0, listingAcres: 0 });
  const count = Array.isArray(meta.listings) ? meta.listings.length : 1;
  for (const t of [slot, total]) {
    t.listingCount += count;
    t.totalAskingCAD += parseAsk(meta.price);
    t.listingAcres += Number(meta.listingAc || 0);
  }
}
for (const region of ["SK", "MB", "BC"]) assert(byRegion[region], `No priced CAD listings found for ${region}`);
assert(!byRegion.other, "A priced CAD listing belongs to a property with no province");
assert(
  Object.values(byRegion).reduce((s, r) => s + r.listingCount, 0) === total.listingCount,
  "Regional listing counts do not add up to the header total",
);

// The sum check above adds the same loop twice, so it cannot catch a drifted price, a dropped listing or a
// mangled currency (found by mutation testing, 2026-09-29). Pin the published snapshot. If a listing really
// changed, re-read the broker page, then update PINNED here on purpose.
const PINNED = { total: [35, 1009715040], SK: [18, 773851040], MB: [6, 103125000], BC: [11, 132739000] };
assert(
  total.listingCount === PINNED.total[0] && total.totalAskingCAD === PINNED.total[1],
  `Header total drifted: ${total.listingCount} listings / ${total.totalAskingCAD} CAD (pinned ${PINNED.total[0]} / ${PINNED.total[1]})`,
);
for (const region of ["SK", "MB", "BC"]) {
  assert(
    byRegion[region].listingCount === PINNED[region][0] && byRegion[region].totalAskingCAD === PINNED[region][1],
    `${region} drifted: ${byRegion[region].listingCount} listings / ${byRegion[region].totalAskingCAD} CAD (pinned ${PINNED[region][0]} / ${PINNED[region][1]})`,
  );
}
for (const [id, meta] of Object.entries(S)) {
  if (!meta || !meta.price) continue;
  assert(/^\$\d{1,3}(,\d{3})+ (CAD|USD)( total)?$/.test(String(meta.price)), `${id}: price "${meta.price}" must read like "$1,234,567 CAD" or "USD"`);
  if (meta.status === "listed") assert(meta.sourceCheckedAt, `${id}: a priced listing needs sourceCheckedAt`);
}
assert(S.montana.price === "$96,000,000 USD", "Montana umbrella ask drifted from Premier's $96,000,000");
assert(S.tonopah.price === "$5,000,000 USD", "Arizona cooler and seed facility ask drifted from Southwest's $5,000,000");

// ---- Sub-listings must add up to their package -------------------------------
for (const [id, meta] of Object.entries(S)) {
  if (!meta || !Array.isArray(meta.listings) || !/\bCAD\b/.test(String(meta.price || ""))) continue;
  const askSum = meta.listings.reduce((s, l) => s + parseAsk(l.price), 0);
  assert(askSum === parseAsk(meta.price), `${id}: sub-listing prices (${askSum}) do not add up to the package price (${parseAsk(meta.price)})`);
  const acSum = meta.listings.reduce((s, l) => s + Number(l.listingAc || 0), 0);
  assert(Math.abs(acSum - Number(meta.listingAc)) <= 1.5, `${id}: sub-listing acres (${acSum}) do not match listingAc (${meta.listingAc})`);
  for (const l of meta.listings) {
    assert(/^https:\/\//.test(String(l.listingUrl || "")), `${id}: sub-listing "${l.name}" needs an https listingUrl`);
    assert(/\bCAD\b/.test(String(l.price)), `${id}: sub-listing "${l.name}" price must state its currency`);
  }
}

// ---- Currency on every priced package ----------------------------------------
for (const [id, meta] of Object.entries(S)) {
  if (!meta || !meta.price) continue;
  assert(/\b(CAD|USD)\b/.test(String(meta.price)), `${id}: price must state CAD or USD`);
}

// ---- Aguila: approved, not closed --------------------------------------------
const aguila = S.aguila;
assert(aguila.status === "sale-approved", "Aguila must stay sale-approved until a Monitor's Closing Certificate is public");
assert(aguila.price === null, "Aguila must not carry an asking price once a sale is approved");
assert(/^US\$17,000,000$/.test(aguila.reportedPrice), "Aguila reported price must match the executed purchase agreement, D.I. 56-1 section 3.1 (US$17,000,000)");
assert(/Not closed/.test(aguila.closingStatus), "Aguila closing status must say it has not closed");
assert(Array.isArray(aguila.closingConditions) && aguila.closingConditions.length >= 4, "Aguila closing conditions are missing");
assert(/^https:\/\//.test(String(aguila.usMotionUrl || "")), "Aguila needs the U.S. sale motion link");

// ---- Hafford: court split ----------------------------------------------------
const hafford = D.properties.find((p) => p.id === "hafford");
const confirmed = hafford.courtConfirmedSoldQuarters || [];
assert(confirmed.length === 16, `Hafford court-confirmed quarters must be the 16 in para 7(a)(i) / Schedule B of the vesting order (found ${confirmed.length})`);
assert(new Set(confirmed).size === 16, "Hafford court-confirmed quarters contain a duplicate");
const hafRows = new Set((REAL.hafford || []).map((row) => row.loc));
const missing = confirmed.filter((loc) => !hafRows.has(loc));
assert(missing.length === 0, `Hafford court-confirmed quarters missing from the map data: ${missing.join(", ")}`);
assert(!((D.sispByProperty || {}).hafford && D.sispByProperty.hafford.status === "listed"), "Hafford must not be marked as an SISP listing: no public source puts Monette Hafford land in the SISP (owned position sold May 13)");
const soldRow = D.soldProperties.find((row) => row.id === "sold-hafford-phase-2");
assert(soldRow.acres === 2553 && soldRow.pricePerAcre === null, "Hafford sold record must keep the documented 2,553 ac line item and no derived $/ac");
assert(soldRow.buyerStatus === "court-confirmed", "Hafford buyer is court-confirmed (May 1 vesting order)");
assert(!/3,657/.test(String(hafford.notes)) || /Withdrawn 2026-09-29/.test(String(hafford.notes)), "Hafford notes still present the withdrawn 3,657-ac assumption as fact");

// ---- Freshness (warning only) --------------------------------------------------
const stale = [];
for (const [id, meta] of Object.entries(S)) {
  if (!meta || !["listed", "sale-approved", "likely"].includes(meta.status) || !meta.sourceCheckedAt) continue;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meta.sourceCheckedAt);
  assert(m, `${id}: sourceCheckedAt must be an ISO date`);
  const age = Math.round((todayUtc - Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) / 86400000);
  if (age > STALE_WARN_DAYS) stale.push(`${id} (${age} days)`);
}

const fmtM = (n) => `C$${(n / 1e6).toFixed(1)}M`;
console.log("SISP listings validation passed");
console.log(
  `  CAD asks: ${total.listingCount} listings, ${Math.round(total.listingAcres).toLocaleString("en-CA")} broker-listed ac, ${fmtM(total.totalAskingCAD)} ` +
    `(${["SK", "MB", "BC"].map((r) => `${r} ${byRegion[r].listingCount} / ${fmtM(byRegion[r].totalAskingCAD)}`).join(" · ")})`,
);
console.log(`  SISP: bids ${sisp.bindingBidDeadline} · early-bid approval by ${sisp.earlyBidApprovalOutsideDate} · termination ${sisp.terminationDate}`);
console.log(`  Aguila: sale-approved, ${aguila.reportedPrice} reported, not closed · Hafford: ${confirmed.length} court-confirmed quarters of ${hafRows.size}`);
if (stale.length) console.log(`  WARNING: source check older than ${STALE_WARN_DAYS} days: ${stale.join(", ")}`);
