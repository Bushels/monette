// Runtime config TEMPLATE. The build script (scripts/build-jsx.mjs) reads
// this file, substitutes the placeholder below from process.env.MAPBOX_TOKEN
// (loaded from .env.local locally, from Vercel env in production), and writes
// the resolved version to ./config.js and ./public/config.js — both gitignored.
//
// Do NOT put the literal Mapbox token in this file. Put it in .env.local.
window.MAPBOX_TOKEN = "__MAPBOX_TOKEN__";

// Map styles:
// - STATUS is the only public atlas mode and uses a dark basemap so ownership
//   colors read hard without exposing geometry drift.
// - SATELLITE is intentionally aliased to STATUS for now so stale callers do
//   not quietly re-enable imagery in the public build.
// Legacy names are retained so older references do not break.
window.MAPBOX_STYLE_STATUS    = "mapbox://styles/mapbox/dark-v11";
window.MAPBOX_STYLE_SATELLITE = window.MAPBOX_STYLE_STATUS;
window.MAPBOX_STYLE_LIGHT     = window.MAPBOX_STYLE_STATUS;
window.MAPBOX_STYLE_DARK      = window.MAPBOX_STYLE_STATUS;

// Initial view framing covers the full court-file footprint: BC/AB/SK/MB plus
// Montana, Colorado, and Arizona point-only assets.
window.MAPBOX_HOME = { center: [-111.0, 45.9], zoom: 3.1 };

// Supabase — the community ledger backend. The anon key is designed to ship
// in the browser; Row-Level Security on public.votes / public.tips limits
// what anon clients can do (SELECT published rows, INSERT new rows only).
window.SUPABASE_URL      = "https://tcsfwdljaedznqiucsdz.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjc2Z3ZGxqYWVkem5xaXVjc2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzYxMDEsImV4cCI6MjA5MjQxMjEwMX0.REK-7sGr4pAbiaotIDFkAGrOpXL0eGvesMo2pxKY8C4";

// Public discussion layer. Monette keeps structured votes and reviewed source
// evidence; free-form corrections / banter are routed to Agnonymous.
window.AGNONYMOUS_URL = "https://agnonymous.buperac.com";
