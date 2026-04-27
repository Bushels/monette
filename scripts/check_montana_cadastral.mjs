// Monthly Montana cadastral diff check.
//
// Pulls the current DNRC parcel list under OwnerName='MONETTE FARMS USA INC'
// and compares it to the baseline recorded in data.js (sourceOfTruth block).
// Writes a markdown report to docs/cadastral_diffs/<YYYY-MM>.md and prints a
// short summary to stdout.
//
// This script is OBSERVATIONAL — it does not edit data.js or quarters.geojson.
// Use update_montana_from_cadastral.mjs for the geojson refresh, and hand-edit
// data.js when the diff is reviewed.
//
// Usage: node scripts/check_montana_cadastral.mjs
// Exit codes: 0 = no change, 1 = change detected, 2 = error

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_JS_PATH = path.join(ROOT, "data.js");
const REPORT_DIR = path.join(ROOT, "docs", "cadastral_diffs");
const OWNER_NAME = "MONETTE FARMS USA INC";
const SERVICE_URL =
  "https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/MapServer/0/query";

function readBaselineFromDataJs() {
  // Crude but stable: match the sourceOfTruth block on the Montana record.
  const src = fs.readFileSync(DATA_JS_PATH, "utf8");
  const block = src.match(/id:"montana"[\s\S]+?sourceOfTruth:\{([\s\S]+?)\}/);
  if (!block) throw new Error("Could not find Montana sourceOfTruth block in data.js");
  const body = block[1];

  const num = (label) => {
    const m = body.match(new RegExp(`${label}:\\s*([0-9.]+)`));
    return m ? Number(m[1]) : null;
  };
  const str = (label) => {
    const m = body.match(new RegExp(`${label}:\\s*"([^"]+)"`));
    return m ? m[1] : null;
  };

  return {
    parcels: num("parcels"),
    assessedAcres: num("assessedAcres"),
    gisAcres: num("gisAcres"),
    pulledAt: str("pulledAt"),
    metadataDate: str("metadataDate"),
    taxYear: num("taxYear"),
  };
}

async function fetchMontanaSummary() {
  const params = new URLSearchParams({
    where: `OwnerName = '${OWNER_NAME}'`,
    outFields: "PARCELID,GISAcres,TotalAcres,TaxYear,OwnerName,COUNTYCD",
    returnGeometry: "false",
    outSR: "4326",
    orderByFields: "PARCELID",
    f: "json",
  });

  const response = await fetch(`${SERVICE_URL}?${params}`);
  if (!response.ok) throw new Error(`DNRC HTTP ${response.status} ${response.statusText}`);
  const result = await response.json();
  if (result.error) throw new Error(`DNRC error: ${JSON.stringify(result.error)}`);
  if (!Array.isArray(result.features)) throw new Error("DNRC response missing features[]");
  if (result.exceededTransferLimit) throw new Error("DNRC response exceeded transfer limit");

  const features = result.features.map((f) => f.attributes || {});
  const totalAssessed = features.reduce((s, a) => s + (Number(a.TotalAcres) || 0), 0);
  const totalGis = features.reduce((s, a) => s + (Number(a.GISAcres) || 0), 0);
  const taxYears = [...new Set(features.map((a) => a.TaxYear).filter(Boolean))].sort();
  const counties = [...new Set(features.map((a) => a.COUNTYCD).filter(Boolean))].sort();
  const ownerNames = [...new Set(features.map((a) => a.OwnerName).filter(Boolean))].sort();
  const parcelIds = features.map((a) => a.PARCELID).filter(Boolean).sort();

  return {
    parcels: features.length,
    assessedAcres: Number(totalAssessed.toFixed(3)),
    gisAcres: Number(totalGis.toFixed(3)),
    taxYears,
    counties,
    ownerNames,
    parcelIds,
  };
}

function diff(baseline, current) {
  const changes = [];
  const fmt = (v) => (typeof v === "number" ? v.toLocaleString() : String(v));

  for (const key of ["parcels", "assessedAcres", "gisAcres"]) {
    if (Math.abs((current[key] ?? 0) - (baseline[key] ?? 0)) > 0.01) {
      changes.push(`- **${key}**: ${fmt(baseline[key])} → ${fmt(current[key])} (Δ ${fmt(Number((current[key] - baseline[key]).toFixed(3)))})`);
    }
  }
  if (current.taxYears.length === 1 && baseline.taxYear && current.taxYears[0] !== baseline.taxYear) {
    changes.push(`- **taxYear**: ${baseline.taxYear} → ${current.taxYears[0]}`);
  }
  return changes;
}

async function main() {
  const baseline = readBaselineFromDataJs();
  const current = await fetchMontanaSummary();
  const changes = diff(baseline, current);

  const stamp = new Date().toISOString().slice(0, 10);
  const yearMonth = stamp.slice(0, 7);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `${yearMonth}.md`);

  const lines = [
    `# Montana DNRC cadastral check — ${stamp}`,
    "",
    `Owner query: \`OwnerName = '${OWNER_NAME}'\``,
    `Source: ${SERVICE_URL}`,
    "",
    "## Baseline (data.js sourceOfTruth)",
    `- pulledAt: ${baseline.pulledAt}`,
    `- metadataDate: ${baseline.metadataDate}`,
    `- taxYear: ${baseline.taxYear}`,
    `- parcels: ${baseline.parcels}`,
    `- assessedAcres: ${baseline.assessedAcres}`,
    `- gisAcres: ${baseline.gisAcres}`,
    "",
    "## Current pull",
    `- parcels: ${current.parcels}`,
    `- assessedAcres: ${current.assessedAcres}`,
    `- gisAcres: ${current.gisAcres}`,
    `- taxYears returned: ${current.taxYears.join(", ") || "(none)"}`,
    `- counties returned (codes): ${current.counties.join(", ") || "(none)"}`,
    `- distinct OwnerName variants: ${current.ownerNames.length}`,
    ...current.ownerNames.map((n) => `  - ${n}`),
    "",
    "## Diff vs baseline",
    changes.length ? changes.join("\n") : "_No material change._",
    "",
  ];
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

  console.log(`Report: ${reportPath}`);
  if (changes.length) {
    console.log("CHANGES DETECTED:");
    for (const c of changes) console.log(c);
    process.exit(1);
  } else {
    console.log(`No change — ${current.parcels} parcels, ${current.assessedAcres} assessed ac`);
    process.exit(0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
