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

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

const D = loadData();
const geojson = JSON.parse(fs.readFileSync(path.join(ROOT, "quarters.geojson"), "utf8"));
const properties = new Map(D.properties.map((property) => [property.id, property]));
const sales = D.sispByProperty || {};
const childIds = [
  "mt-fly-creek",
  "mt-st-xavier-camp4",
  "mt-nieden-camp1",
  "mt-pivot",
  "mt-hardin-rail",
];
const mappedChildIds = childIds.slice(0, 4);
const children = childIds.map((id) => sales[id]);
const parent = properties.get("montana");
const parentSale = sales.montana;

assert(parent?.aggregator === true, "Montana parent must remain an aggregator");
assert(JSON.stringify(parent.childPropertyIds) === JSON.stringify(childIds), "Montana offering child IDs drifted");
assert(parent.nonOfferingRelatedPropertyIds?.includes("mt-ragland-camp1"), "Unreconciled 737-acre court row must stay outside the offering");
assert(childIds.every((id) => properties.has(id) && sales[id]?.status === "listed"), "A current Montana child is missing or not listed");
assert(!properties.has("mt-ragland"), "Legacy mt-ragland ID must be replaced by the proven Pivot crosswalk");
assert(sales["mt-ragland-camp1"]?.status === "excluded", "The 737-acre court row must not receive a sale outline");

assert(sum(children, "deededAc") === 53751, "Montana child deeded acres must reconcile to 53,751");
assert(sum(children, "leasedAc") === 38441, "Montana child leased acres must reconcile to 38,441");
assert(sum(children, "totalAc") === 92191, "Montana published child totals drifted from 92,191");
assert(parentSale.deededAc === 53751 && parentSale.leasedAc === 38441 && parentSale.totalAc === 92193, "Montana umbrella totals drifted from its children");
assert(parentSale.seededAc === 63049 && parentSale.price === "$96,000,000 USD", "Montana umbrella seeded acres or asking price drifted");
assert(parent.currentOffering.computedDeededPlusLeasedAc === 92192, "Published deeded-plus-leased reconciliation changed");
assert(parent.currentOffering.sumPublishedChildTotalsAc === 92191, "Published child-total reconciliation changed");
assert(parent.currentOffering.publishedTotalReconciliationDeltaAc === 1, "Published portfolio arithmetic delta changed");
assert(parent.currentOffering.publishedChildTotalReconciliationDeltaAc === 2, "Published child-total arithmetic delta changed");

const montanaFeatures = geojson.features.filter((feature) => feature.properties?.parent_property_id === "montana");
const geometryIds = new Set(montanaFeatures.map((feature) => feature.properties.property_id));
assert(montanaFeatures.length === 220, `Expected 220 Montana cadastral parcels, found ${montanaFeatures.length}`);
assert(mappedChildIds.every((id) => geometryIds.has(id)), "A mapped Montana package is missing cadastral geometry");
assert([...geometryIds].every((id) => mappedChildIds.includes(id)), `Unexpected Montana geometry ID: ${[...geometryIds].filter((id) => !mappedChildIds.includes(id)).join(", ")}`);
assert(!geometryIds.has("mt-hardin-rail"), "Hardin rail site must remain point-only until parcel evidence exists");
assert(!geometryIds.has("mt-ragland-camp1"), "Unreconciled Ragland Camp 1 row must not receive offering geometry");

const mappedAcres = sum(montanaFeatures.map((feature) => feature.properties), "titled_ac");
assert(Math.abs(mappedAcres - 51528.893) < 0.001, `Montana mapped assessed acres drifted: ${mappedAcres.toFixed(3)}`);

const mapSource = fs.readFileSync(path.join(ROOT, "view-map.jsx"), "utf8");
assert(!mapSource.includes("Hammond Realty asking price"), "Sale popup still hard-codes Hammond for non-Hammond listings");
assert(mapSource.includes("show_map_marker"), "Point-only Hardin listing marker is not wired into the map");

console.log("Montana portfolio validation passed");
console.log("  offering: Premier publishes 53,751 deeded + 38,441 leased and 92,193 total acres");
console.log("  source arithmetic: deeded + leased = 92,192; five displayed child totals = 92,191");
console.log(`  geometry: ${montanaFeatures.length} DNRC parcels / ${mappedAcres.toFixed(3)} assessed acres across ${mappedChildIds.length} packages`);
console.log("  excluded: 737-acre Ragland Camp 1 court row; point-only: 7-acre Hardin rail site");
