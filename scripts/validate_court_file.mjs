// Gate for court-file-data.js (window.MONETTE_DATA.courtFile) and the court copy around it.
// Run: npm run validate:court   (also runs first in npm run build)
//
// Rules pinned here (evidence rules for the Court File page):
//  - every filing has id/date/court/kind/title/url; ids unique; https links only
//  - affects[] uses known property ids or "all"
//  - a filing whose text has not been posted carries no summary points, says so, and its
//    notes say it was not read (never what it decides)
//  - every summary point and every court-strip point cites a paragraph or page
//    (docket-entry and dated listing-check cites excepted)
//  - no public string calls a sale closed unless a Monitor's certificate record exists for
//    that property (conditional/negated wording like "not closed", "until ... closes" is allowed)
//  - a milestone is "done" only with a source
//  - no internal working notes, local file paths or editor/tool names in any public data,
//    including comments in the raw data files
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawData = readFileSync(path.join(root, "data.js"), "utf8");
const rawCourt = readFileSync(path.join(root, "court-file-data.js"), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(rawData, ctx);
vm.runInContext(rawCourt, ctx);
const D = ctx.window.MONETTE_DATA;
const cf = D.courtFile;
const errors = [];
const fail = (msg) => errors.push(msg);

if (!cf || !Array.isArray(cf.filings)) {
  console.error("courtFile.filings missing");
  process.exit(1);
}
const props = D.properties || [];
const propIds = new Set(props.map((p) => p.id));
const COURTS = new Set(["alberta", "us", "monitor"]);
const KINDS = new Set(["order", "report", "certificate", "application", "affidavit", "motion", "notice", "sisp", "service", "admin", "other"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PINPOINT = /(\bparas?\b|¶|\bpp?\.\s?\d|\bpage\s?\d|\bs\.\s?\d|§|\bschedule\b|\bexhibit\b|\brecital\b|\bpreamble\b|\bterm table\b)/i;
const CITE_EXEMPT = /(^|;\s*)D\.I\. \d+|checked \w+ \d+|\blistings?\b/i;
const certified = new Set(cf.filings.filter((f) => f.kind === "certificate").flatMap((f) => (f.affects || []).filter((a) => a !== "all")));
const seen = new Set();

// ---- "closed" claims ---------------------------------------------------------------
const CLOSED = /\b(closed|closing (occurred|completed)|title (has )?(passed|transferred)|sale (is )?complete)\b/gi;
const CONDITIONAL = /\b(not|until|once|when|if|before|unless|no later than|will|would|may|must|needs?|still|outside|earliest|latest)\b/i;
function checkClosed(text, ctxIds, where) {
  if (typeof text !== "string" || !text) return;
  for (const m of text.matchAll(CLOSED)) {
    const start = Math.max(text.lastIndexOf(".", m.index), text.lastIndexOf(";", m.index)) + 1;
    const endDot = text.slice(m.index).search(/[.;]/);
    const clause = text.slice(start, endDot < 0 ? text.length : m.index + endDot);
    if (CONDITIONAL.test(clause)) continue;
    const ids = new Set(ctxIds.filter((id) => id && id !== "all"));
    for (const p of props) if (p.name && clause.includes(p.name)) ids.add(p.id);
    const ok = ids.size > 0 && [...ids].every((id) => certified.has(id));
    if (!ok) fail(`${where}: says closed without a Monitor's certificate record for ${[...ids].join(",") || "(no property)"}: "${clause.trim().slice(0, 90)}"`);
  }
}

// ---- filings -----------------------------------------------------------------------
for (const f of cf.filings) {
  const tag = f.id || "(no id)";
  for (const k of ["id", "date", "court", "kind", "title", "url"]) if (!f[k]) fail(`${tag}: missing ${k}`);
  if (seen.has(f.id)) fail(`${tag}: duplicate id`);
  seen.add(f.id);
  if (f.date && !ISO.test(f.date)) fail(`${tag}: bad date ${f.date}`);
  if (f.addedAt && !ISO.test(f.addedAt)) fail(`${tag}: bad addedAt ${f.addedAt}`);
  if (!COURTS.has(f.court)) fail(`${tag}: bad court ${f.court}`);
  if (!KINDS.has(f.kind)) fail(`${tag}: bad kind ${f.kind}`);
  if (f.url && !/^https:\/\//.test(f.url)) fail(`${tag}: url must be https`);
  if (f.url && /\s/.test(f.url)) fail(`${tag}: url has unencoded spaces`);
  for (const a of f.affects || []) if (a !== "all" && !propIds.has(a)) fail(`${tag}: unknown property id in affects: ${a}`);
  const pts = Array.isArray(f.points) ? f.points : [];
  if (f.textAvailable === false) {
    if (pts.length) fail(`${tag}: text not posted but has summary points`);
    if (f.summary && !/not (yet )?(posted|public)/i.test(f.summary)) fail(`${tag}: text not posted but summary does not say so`);
    const notes = `${f.summary || ""} ${f.notSaid || ""}`;
    if (f.key && !/(not read|do not know|don't know|not known|not yet)/i.test(f.notSaid || "")) fail(`${tag}: unread key filing must say it was not read`);
    if (/\b(it|the order|this order) (approves|grants|denies|dismisses|authorizes|recognizes)\b/i.test(notes)) fail(`${tag}: unread filing described as deciding something`);
  }
  for (const p of pts) {
    if (!p.text) fail(`${tag}: empty point`);
    if (!p.cite || !PINPOINT.test(p.cite)) fail(`${tag}: point without a paragraph/page cite: "${(p.text || "").slice(0, 60)}" [${p.cite || ""}]`);
  }
  if (f.key && !f.summary) fail(`${tag}: key document without a summary`);
  const ctxIds = f.affects || [];
  checkClosed(f.summary, ctxIds, tag);
  checkClosed(f.notSaid, ctxIds, tag);
  for (const p of pts) checkClosed(p.text, ctxIds, tag);
}

// ---- milestones ----------------------------------------------------------------------
for (const m of cf.milestones || []) {
  if (!ISO.test(m.date || "")) fail(`milestone "${m.label}": bad date`);
  if (m.state === "done" && !m.source) fail(`milestone "${m.label}": done without a source`);
  if (m.url && !/^https:\/\//.test(m.url)) fail(`milestone "${m.label}": url must be https`);
  checkClosed(m.label, [], `milestone ${m.date}`);
}

// ---- court strip -----------------------------------------------------------------------
const strip = D.latestCourtUpdate || {};
checkClosed(strip.summaryTitle, [], "latestCourtUpdate.summaryTitle");
for (const item of strip.items || []) {
  const ids = item.propertyId ? [item.propertyId] : [];
  if (item.propertyId && !propIds.has(item.propertyId)) fail(`latestCourtUpdate "${item.title}": unknown propertyId ${item.propertyId}`);
  for (const s of [item.status, item.title, item.text, item.notSaid]) checkClosed(s, ids, `latestCourtUpdate "${item.title}"`);
  for (const p of item.points || []) {
    if (!p.cite || !(PINPOINT.test(p.cite) || CITE_EXEMPT.test(p.cite))) fail(`latestCourtUpdate "${item.title}": point without a paragraph/page cite [${p.cite || ""}]`);
    checkClosed(p.text, ids, `latestCourtUpdate "${item.title}"`);
  }
}

// ---- sale records and property lead blocks -----------------------------------------------
for (const [id, rec] of Object.entries(D.sispByProperty || {})) {
  checkClosed(rec.closingStatus, [id], `sispByProperty.${id}.closingStatus`);
  checkClosed(rec.note, [id], `sispByProperty.${id}.note`);
}
for (const p of props) {
  if (p.courtSale) for (const s of [p.courtSale.label, p.courtSale.headline]) checkClosed(s, [p.id], `properties.${p.id}.courtSale`);
  checkClosed(p.courtConfirmedSoldNote, [p.id], `properties.${p.id}.courtConfirmedSoldNote`);
}

// ---- internal notes: whole public data + raw file text (comments ship verbatim) ------------
const INTERNAL = /(VERIFIER:|scratchpad|(^|[^/\w])docs\/|\b[A-Z]:\\|\.(xlsx|md|py)\b|\bCodex\b|\bClaude\b|\bkyle\b|first-hand|User clarified|intel_unverified)/i;
const walk = (v, where) => {
  if (typeof v === "string") { if (INTERNAL.test(v)) fail(`${where}: internal note in public text: "${v.slice(0, 80)}"`); return; }
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
};
walk(cf, "courtFile");
walk(D.latestCourtUpdate, "latestCourtUpdate");
walk(D.sispByProperty, "sispByProperty");
walk(D.properties, "properties");
walk(D.soldProperties, "soldProperties");
walk(D.courtFacts, "courtFacts");
for (const [name, raw] of [["data.js", rawData], ["court-file-data.js", rawCourt]]) {
  raw.split(/\r?\n/).forEach((line, i) => {
    const m = INTERNAL.exec(line);
    if (m) fail(`${name}:${i + 1}: internal note in shipped file ("${m[0]}"): ${line.trim().slice(0, 90)}`);
  });
}

if (errors.length) {
  console.error(`Court file validation FAILED (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
const key = cf.filings.filter((f) => f.key).length;
const routine = cf.filings.filter((f) => f.kind === "service" || f.kind === "admin").length;
console.log("Court file validation passed");
console.log(`  filings: ${cf.filings.length} (${key} key, ${routine} routine) · milestones: ${(cf.milestones || []).length}`);
console.log(`  checked: ${cf.checkedAt || "?"}`);
