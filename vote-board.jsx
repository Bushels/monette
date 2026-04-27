// vote-board.jsx — homepage area-level vote rollup.
//
// Two parallel stacked bars per property:
//   Ownership: owned · rented · sold · other (collapses returned-to-ll +
//              unknown + below-threshold quarters into a muted gray segment)
//   Season:    seeded · sprayed · harvested · unworked (muted gray)
//
// STATUS_THRESHOLD = 3 — if you change it here, also change the
// `n >= 3` guards in the supabase migration that builds quarter_current_state.

const VB_OWNERSHIP_BUCKETS = [
  { id: "owned-monette",  label: "Owned",  color: "#5a7a3a" },
  { id: "rented-monette", label: "Rented", color: "#b48638" },
  { id: "sold",           label: "Sold",   color: "#9a3a2a" },
  { id: "other",          label: "Other",  color: "#b9b3a4" },
];

const VB_SEASON_BUCKETS = [
  { id: "unworked",  label: "Unworked",  color: "#b9b3a4" },
  { id: "seeded",    label: "Seeded",    color: "#5a7a3a" },
  { id: "sprayed",   label: "Sprayed",   color: "#b48638" },
  { id: "harvested", label: "Harvested", color: "#9a3a2a" },
];

// Legend lists ownership buckets first, then season-stage buckets except
// "unworked" — its swatch is identical to ownership "Other" muted gray.
const VB_LEGEND_BUCKETS = [
  ...VB_OWNERSHIP_BUCKETS,
  ...VB_SEASON_BUCKETS.filter((b) => b.id !== "unworked"),
];

function vbBucketOwnership(state) {
  if (!state) return "other";
  switch (state.ownership_status) {
    case "owned-monette":  return "owned-monette";
    case "rented-monette": return "rented-monette";
    case "sold":           return "sold";
    default:               return "other"; // returned-to-ll, unknown
  }
}

function vbBucketSeason(state) {
  if (!state) return "unworked";
  return state.season_stage || "unworked";
}

function vbCountsForProperty(property, statesByQuarter) {
  const totalParcels = Math.max(0, Number(property.parcels) || 0);
  const ownership = { "owned-monette": 0, "rented-monette": 0, "sold": 0, "other": 0 };
  const season = { unworked: 0, seeded: 0, sprayed: 0, harvested: 0 };
  let mapped = 0;

  for (const key in statesByQuarter) {
    const state = statesByQuarter[key];
    if (!state || state.prop_id !== property.id) continue;
    mapped++;
    ownership[vbBucketOwnership(state)] = (ownership[vbBucketOwnership(state)] || 0) + 1;
    season[vbBucketSeason(state)] = (season[vbBucketSeason(state)] || 0) + 1;
  }

  // Quarters with no qualifying state at all -> add to "other" (ownership)
  // and "unworked" (season).
  const unmapped = Math.max(0, totalParcels - mapped);
  ownership.other = (ownership.other || 0) + unmapped;
  season.unworked = (season.unworked || 0) + unmapped;

  return { ownership, season, totalParcels, mapped, unmapped };
}

function VbBar({ buckets, counts, total, ariaLabel }) {
  if (total <= 0) {
    return (
      <div className="vb-bar vb-bar-empty" aria-label={`${ariaLabel}: no quarters`}>
        <span className="vb-bar-empty-label">no quarters mapped</span>
      </div>
    );
  }
  return (
    <div className="vb-bar" role="group" aria-label={ariaLabel}>
      {buckets.map((b) => {
        const n = counts[b.id] || 0;
        if (n <= 0) return null;
        const pct = (n / total) * 100;
        const title = `${b.label}: ${n} of ${total} (${pct.toFixed(0)}%)`;
        return (
          <div
            key={b.id}
            className={`vb-seg vb-seg-${b.id}`}
            style={{ width: `${pct}%`, background: b.color }}
            title={title}
            aria-label={title}
          />
        );
      })}
    </div>
  );
}

function VbLegend({ buckets }) {
  return (
    <div className="vb-legend">
      {buckets.map((b) => (
        <span key={b.id} className="vb-legend-item">
          <span className="vb-legend-swatch" style={{ background: b.color }} />
          <span className="vb-legend-label">{b.label}</span>
        </span>
      ))}
    </div>
  );
}

function VbPropertyRow({ property }) {
  // VoteBoard subscribes to onTalliesChange via useTalliesVersion, which
  // re-renders all rows on every update. Counts are recomputed each render
  // — O(quarters) per property, fine at this scale and avoids a memo whose
  // deps would churn on every fresh `window.QUARTER_STATES || {}` fallback.
  const counts = vbCountsForProperty(property, window.QUARTER_STATES || {});

  return (
    <div className="vb-row">
      <div className="vb-row-head">
        <div className="vb-row-name">{property.name}</div>
        <div className="vb-row-meta caps">
          {counts.totalParcels} quarters · {counts.mapped} reporting
        </div>
      </div>
      <div className="vb-row-bars">
        <div className="vb-bar-block">
          <div className="vb-bar-label caps">Ownership</div>
          <VbBar
            buckets={VB_OWNERSHIP_BUCKETS}
            counts={counts.ownership}
            total={counts.totalParcels}
            ariaLabel={`${property.name} ownership status`}
          />
        </div>
        <div className="vb-bar-block">
          <div className="vb-bar-label caps">Season</div>
          <VbBar
            buckets={VB_SEASON_BUCKETS}
            counts={counts.season}
            total={counts.totalParcels}
            ariaLabel={`${property.name} season stage`}
          />
        </div>
      </div>
    </div>
  );
}

function VoteBoard({ properties }) {
  // useTalliesVersion (defined in components.jsx) subscribes to
  // window.onTalliesChange and force-rerenders this tree on every update.
  useTalliesVersion();

  if (!Array.isArray(properties) || properties.length === 0) return null;

  return (
    <section className="vb-section" aria-label="Live community vote rollup">
      <header className="vb-section-head">
        <div className="vb-kicker caps">● Live · community vote rollup</div>
        <h2 className="serif vb-section-headline">What the swarm is seeing right now</h2>
        <p className="vb-section-sub">
          Each row is one property. Status flips when ≥3 distinct visitors have
          voted the same way. Muted gray = not enough votes yet.
        </p>
      </header>
      <div className="vb-property-list">
        {properties.map((p) => (
          <VbPropertyRow key={p.id} property={p} />
        ))}
      </div>
      <VbLegend buckets={VB_LEGEND_BUCKETS} />
    </section>
  );
}

window.VoteBoard = VoteBoard;
