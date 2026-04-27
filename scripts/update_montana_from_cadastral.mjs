import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GEOJSON_PATH = path.join(ROOT, "quarters.geojson");
const OWNER_NAME = "MONETTE FARMS USA INC";
const SERVICE_URL =
  "https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/MapServer/0/query";

function titleCaseCounty(code) {
  return code === 22 ? "Big Horn" : null;
}

function parseTownship(value) {
  const match = String(value || "").trim().match(/^0*(\d+)\s*([NS])$/i);
  return match ? { number: Number(match[1]), direction: match[2].toUpperCase() } : null;
}

function parseRange(value) {
  const match = String(value || "").trim().match(/^0*(\d+)\s*([EW])$/i);
  return match ? { number: Number(match[1]), direction: match[2].toUpperCase() } : null;
}

function rounded(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function roundGeometry(geometry) {
  if (!geometry) return geometry;

  const roundRing = (ring) => ring.map(([lng, lat]) => [rounded(lng), rounded(lat)]);
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map(roundRing),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) => polygon.map(roundRing)),
    };
  }
  return geometry;
}

function buildLoc(attrs) {
  const township = parseTownship(attrs.Township);
  const range = parseRange(attrs.Range);
  const section = Number(attrs.Section);
  if (!township || !range || !Number.isFinite(section)) return String(attrs.PARCELID);

  return `T${String(township.number).padStart(2, "0")}${township.direction}-R${String(range.number).padStart(2, "0")}${range.direction}-S${String(section).padStart(2, "0")}-${attrs.PARCELID}`;
}

function convertFeature(feature) {
  const attrs = feature.attributes || feature.properties || {};
  const township = parseTownship(attrs.Township);
  const range = parseRange(attrs.Range);
  const section = Number(attrs.Section);
  const totalAcres = Number(attrs.TotalAcres);
  const gisAcres = Number(attrs.GISAcres);

  return {
    type: "Feature",
    geometry: roundGeometry(
      feature.geometry?.rings
        ? { type: "Polygon", coordinates: feature.geometry.rings }
        : feature.geometry
    ),
    properties: {
      property_id: "montana",
      loc: buildLoc(attrs),
      loc_raw:
        township && range && Number.isFinite(section)
          ? `Sec ${section}, T${township.number} ${township.direction}, R${range.number} ${range.direction}`
          : attrs.LegalDescriptionShort || String(attrs.PARCELID),
      qtr: null,
      sec: Number.isFinite(section) ? section : null,
      twp: township?.number ?? null,
      rng: range?.number ?? null,
      meridian: "MT-PM",
      twp_dir: township?.direction ?? null,
      rng_dir: range?.direction ?? null,
      titled_ac: Number.isFinite(totalAcres) ? totalAcres : gisAcres,
      gis_ac: Number.isFinite(gisAcres) ? gisAcres : null,
      county: attrs.CountyName || titleCaseCounty(attrs.COUNTYCD),
      county_cd: attrs.COUNTYCD ?? null,
      parcel_id: attrs.PARCELID,
      property_id_mt: attrs.PropertyID ?? null,
      tax_year: attrs.TaxYear ?? null,
      assessment: attrs.AssessmentCode ?? null,
      land_value: attrs.TotalLandValue ?? null,
      total_value: attrs.TotalValue ?? null,
      owner: attrs.OwnerName,
      title:
        attrs.LegalDescriptionShort ||
        (township && range && Number.isFinite(section)
          ? `Section ${section}, Township ${township.number} ${township.direction}, Range ${range.number} ${range.direction}`
          : null),
      property_card: attrs.PropertyCardLink ?? null,
      title_count: 1,
      source: "Montana DNRC Cadastral ArcGIS service, owner query",
    },
  };
}

async function fetchMontanaFeatures() {
  const params = new URLSearchParams({
    where: `OwnerName = '${OWNER_NAME}'`,
    outFields:
      "PARCELID,COUNTYCD,GISAcres,TotalAcres,TaxYear,PropertyID,AssessmentCode,Township,Range,Section,LegalDescriptionShort,TotalLandValue,TotalValue,OwnerName,PropertyCardLink",
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "PARCELID",
    f: "json",
  });

  const response = await fetch(`${SERVICE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Montana cadastral request failed: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  if (result.error) {
    throw new Error(`Montana cadastral request failed: ${JSON.stringify(result.error)}`);
  }
  if (!Array.isArray(result.features)) {
    throw new Error("Montana cadastral response did not contain an ArcGIS feature list");
  }
  if (result.exceededTransferLimit) {
    throw new Error("Montana cadastral response exceeded the transfer limit; pagination is required");
  }
  return result.features.map(convertFeature);
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf8"));
  const currentFeatures = Array.isArray(existing.features) ? existing.features : [];
  const nonMontana = currentFeatures.filter((feature) => feature.properties?.property_id !== "montana");
  const montana = await fetchMontanaFeatures();

  const duplicateLocs = montana
    .map((feature) => feature.properties.loc)
    .filter((loc, index, all) => all.indexOf(loc) !== index);
  if (duplicateLocs.length) {
    throw new Error(`Duplicate Montana loc keys: ${[...new Set(duplicateLocs)].join(", ")}`);
  }

  const next = {
    type: "FeatureCollection",
    features: [...nonMontana, ...montana],
  };
  fs.writeFileSync(GEOJSON_PATH, `${JSON.stringify(next)}\n`, "utf8");

  const totalAcres = montana.reduce((sum, feature) => sum + (Number(feature.properties.titled_ac) || 0), 0);
  const gisAcres = montana.reduce((sum, feature) => sum + (Number(feature.properties.gis_ac) || 0), 0);
  console.log(
    `Replaced Montana slice: ${montana.length} parcels, ${totalAcres.toFixed(3)} assessed acres, ${gisAcres.toFixed(3)} GIS acres`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
