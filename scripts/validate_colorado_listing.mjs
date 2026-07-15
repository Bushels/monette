import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"), context, {
    filename: "data.js",
  });
  return context.window.MONETTE_DATA;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const D = loadData();
const geojson = JSON.parse(fs.readFileSync(path.join(ROOT, "quarters.geojson"), "utf8"));
const quarterContext = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, "quarters-data.js"), "utf8"),
  quarterContext,
  { filename: "quarters-data.js" },
);
const property = D.properties.find((row) => row.id === "genoa");
const sale = D.sispByProperty?.genoa;
const features = geojson.features.filter((feature) => feature.properties?.property_id === "genoa");
const expectedAccounts = ["R008634", "R008636", "R008638", "R008641", "R008643", "R008645"];
const expectedParcels = [
  "2581-311-00-112",
  "2581-183-00-114",
  "2581-281-00-116",
  "2797-042-00-112",
  "2797-061-00-114",
  "2581-301-00-119",
];

assert(property?.name === "Monette Farm & Ranch", "Colorado property name is not current");
assert(property.parcels === 6, "Colorado property must report six assessor accounts");
assert(property.titled === 4085 && property.owned === 4085, "Colorado owned acreage must be 4,085");
assert(property.cultivated === 3085 && property.nativeGrassAc === 1000, "Colorado land-use split drifted");
assert(!property.hideMapMarker, "Colorado map marker must be visible after full-account mapping");
assert(!property.tags?.includes("partial-geometry"), "Colorado must not retain the partial-geometry tag");
assert(property.tenureBreakdown?.courtSwornAc === 4079, "Helkaa court acreage must remain visible");
assert(property.tenureBreakdown?.courtToAssessorDeltaAc === 6, "Court-to-assessor acreage delta must remain six acres");

assert(sale?.status === "listed" && sale.confidence === "high", "Colorado offering must remain confirmed");
assert(sale.price === "$5,106,250 USD", "Clark asking price drifted");
assert(sale.deededAc === 4085 && sale.totalAc === 4085, "Clark offering acreage drifted");
assert(sale.cultivatedAc === 3085 && sale.nativeGrassAc === 1000, "Clark land-use split drifted");
assert(sale.listingUrl === "https://www.clarklandbrokers.com/property-listings/monette-farm-%26-ranch-", "Clark listing URL drifted");
assert(sale.sourceCheckedAt === "2026-07-15", "Clark source check date drifted");

assert(features.length === 6, `Expected six Colorado account features, found ${features.length}`);
const accounts = features.map((feature) => feature.properties.account_no).sort();
const parcels = features.map((feature) => feature.properties.parcel_id).sort();
assert(JSON.stringify(accounts) === JSON.stringify([...expectedAccounts].sort()), "Colorado assessor account set drifted");
assert(JSON.stringify(parcels) === JSON.stringify([...expectedParcels].sort()), "Colorado parcel-number set drifted");
const mappedAcres = features.reduce((total, feature) => total + Number(feature.properties.titled_ac || 0), 0);
assert(mappedAcres === 4085, `Colorado mapped assessed acres drifted: ${mappedAcres}`);
assert(features.every((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type)), "Colorado feature has unsupported geometry");
assert(features.filter((feature) => feature.geometry?.type === "MultiPolygon").length >= 2, "Two multi-part Colorado accounts must remain multi-polygons");
assert(features.filter((feature) => feature.properties.geometry_note).length === 2, "Only the two derived aliquot accounts should carry geometry notes");
assert(features.every((feature) => feature.properties.source_checked_at === "2026-07-15"), "Colorado geometry source dates drifted");
assert(features.every((feature) => feature.properties.owner === "MONETTE FARMS USA, INC., A MONTANA CORPORATION"), "Colorado assessor owner identity drifted");
const runtimeRows = quarterContext.window.MONETTE_QUARTERS_REAL?.genoa || [];
assert(runtimeRows.length === 6, `Expected six generated Colorado runtime rows, found ${runtimeRows.length}`);
assert(runtimeRows.every((row) => row.geometry), "Generated Colorado runtime payload dropped account geometry");
assert(runtimeRows.filter((row) => row.geometry.type === "MultiPolygon").length >= 2, "Generated payload dropped Colorado multi-polygons");

console.log("Colorado listing validation passed");
console.log("  offering: $5,106,250 / 4,085 acres / 3,085 organic farm ground / 1,000 native grass");
console.log(`  ownership: ${features.length} Lincoln County accounts / ${mappedAcres.toLocaleString()} assessed acres`);
console.log("  disclosure: Helkaa 4,079 acres vs assessor and Clark 4,085 acres (6-acre delta)");
console.log("  geometry: BLM PLSS sections; S2SW4 Sec 18 and NW4 Sec 4 are bbox-derived aliquots");
