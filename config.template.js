// Runtime config TEMPLATE. The build script (scripts/build-jsx.mjs) reads
// this file, substitutes the placeholder below from process.env.MAPBOX_TOKEN
// (loaded from .env.local locally, from Vercel env in production), and writes
// the resolved version to ./config.js and ./public/config.js — both gitignored.
//
// Do NOT put the literal Mapbox token in this file. Put it in .env.local.
window.MAPBOX_TOKEN = "__MAPBOX_TOKEN__";

// Map style: dark basemap is used for all atlas modes (Tenure / Vigor /
// Seeding) so the parcel fills (ownership colors, NDVI vigor ramp, satellite
// seeding ramp) read hard without basemap noise. Sentinel-1 SAR data drives
// the Seeding mode; the basemap stays dark even when "satellite" is the
// active mode. The legacy MAPBOX_STYLE_* aliases are kept so older callers
// don't break — they all resolve to the same dark style.
window.MAPBOX_STYLE_STATUS    = "mapbox://styles/mapbox/dark-v11";
window.MAPBOX_STYLE_SATELLITE = window.MAPBOX_STYLE_STATUS;
window.MAPBOX_STYLE_LIGHT     = window.MAPBOX_STYLE_STATUS;
window.MAPBOX_STYLE_DARK      = window.MAPBOX_STYLE_STATUS;

// Initial view framing covers the full court-file footprint: BC/AB/SK/MB plus
// Montana, Colorado, and Arizona point-only assets.
window.MAPBOX_HOME = { center: [-111.0, 45.9], zoom: 3.1 };

// Public discussion layer. Monette keeps reviewed source evidence; free-form
// corrections, clarifications, and discussion are routed to Agnonymous.
window.AGNONYMOUS_URL = "https://agnonymous.buperac.com";
