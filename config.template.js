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
// Montana, Colorado, and Arizona assets. `bounds` ([[west, south], [east, north]])
// is fitted to the actual map frame at load and on "Reset map", so the footprint
// fills the frame at any size or aspect ratio. `center`/`zoom` are only the
// pre-fit fallback.
window.MAPBOX_HOME = {
  center: [-109.5, 44.0],
  zoom: 3.4,
  bounds: [[-123.5, 32.4], [-96.0, 56.0]],
};

// Prairie snow-extent overlay (scripts/snow_map.py). Off by default: the
// /snow/ assets are not part of the production deploy, so probing for the
// manifest only produced a 404 on every page load. Set true once /snow/
// manifest.json + imagery ship with the site.
window.MONETTE_SNOW_ENABLED = false;

// Public discussion layer. Monette keeps reviewed source evidence; free-form
// corrections, clarifications, and discussion are routed to Agnonymous.
window.AGNONYMOUS_URL = "https://agnonymous.buperac.com";
