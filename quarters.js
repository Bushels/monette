// quarters.js — merge real parcels from quarters-data.js with synthesized
// fallback for any property that lacks geojson coverage (currently: The Pas).
//
// The real data is loaded by quarters-data.js (generated from
// quarters.geojson) and placed on window.MONETTE_QUARTERS_REAL.
// Downstream consumers (components.jsx, property-drawer.jsx, view-list.jsx)
// read window.MONETTE_QUARTERS and only need {loc, ac, soil, crop, isSample}.
// Extra fields (assessment, rm, parcel_no, title, geometry) are additive
// and consumed where present.
(function () {
  const D = window.MONETTE_DATA;
  const REAL = window.MONETTE_QUARTERS_REAL || {};
  const QUARTERS = {};
  const DIRS = ["NW", "NE", "SW", "SE"];

  // DLS range table retained for synthetic fallback only.
  const GEO = {
    "the-pas": { twp: [55, 60], rng: [23, 27], mer: "W1" },
  };

  // Pseudo-hash: stable across reloads, used only for synthesis.
  function h(s, slot) {
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return (n ^ (slot * 2654435761)) >>> 0;
  }

  function pick(arr, n) { return arr[n % arr.length]; }

  // `mer` comes from the GEO table; keeping it a single source of truth
  // avoids the callsite and the function body drifting apart.
  function synthPropertyQuarters(pid, parcels) {
    const range = GEO[pid];
    if (!range) return [];
    const count = Math.min(parcels, 24);
    const out = [];
    for (let i = 0; i < count; i++) {
      const nd = h(pid, i * 3 + 0);
      const ns = h(pid, i * 3 + 1);
      const nt = h(pid, i * 3 + 2);
      const dir = pick(DIRS, nd);
      const sec = 1 + (ns % 36);
      const twp = range.twp[0] + (nt % (range.twp[1] - range.twp[0] + 1));
      const rng = range.rng[0] + ((nt >> 4) % (range.rng[1] - range.rng[0] + 1));
      out.push({
        loc: `${dir}-${sec}-${twp}-${rng}-${range.mer}`,
        ac: 160,
        soil: "—",
        crop: null,
        isSample: true,
      });
    }
    return out;
  }

  // 1. Pull real data for every property that has it.
  for (const pid of Object.keys(REAL)) {
    QUARTERS[pid] = REAL[pid].map(r => ({ ...r, isSample: false }));
  }

  // 2. Synthesize for anything in data.js that's missing from the real set.
  if (D && Array.isArray(D.properties)) {
    for (const prop of D.properties) {
      if (QUARTERS[prop.id]) continue;
      QUARTERS[prop.id] = synthPropertyQuarters(prop.id, prop.parcels);
    }
  } else {
    // data.js ordinarily loads before this script; the warn makes a future
    // script-order regression visible instead of silently dropping synthesis.
    console.warn("quarters.js: window.MONETTE_DATA not available; synthesis skipped.");
  }

  window.MONETTE_QUARTERS = QUARTERS;
})();
