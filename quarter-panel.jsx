// Quarter detail panel — parcel inspection view.
// Shows parcel metadata (RM, assessed value, owner, etc.) and ownership
// status pills. Voting UI has been removed in the satellite pivot 2026-04-29;
// the QuarterDetail area is a placeholder for satellite-row integration
// (commit 5 wires in seeding_seeded, seeding_confidence, etc.).

function QuarterRow({ propId, q, i, onOpen, expanded }) {
  const [st] = useQuarter(propId, q, i);
  const openRow = () => onOpen(q.loc);

  return (
    <div style={{ borderBottom: "1px solid var(--rule)" }}>
      <div
        onClick={openRow}
        onKeyDown={(e) => onActionKey(e, openRow)}
        className="qr-row"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Open ${q.loc}`}
        style={{
          display: "grid",
          gridTemplateColumns: "24px 170px 80px 1fr auto",
          gap: 12,
          alignItems: "center",
          padding: "10px 14px",
          cursor: "pointer",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "var(--paper-2)")}
        onMouseOut={(e) => (e.currentTarget.style.background = "")}
      >
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)" }}>
          {String(i + 1).padStart(2, "0")}
        </span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {q.loc}
          {q.isSample && (
            <span
              className="pd-sample-chip"
              title="Sample data - parcel pipeline not yet resolved for this property"
              style={{
                fontSize: 9,
                padding: "2px 5px",
                border: "1px dashed var(--mute)",
                color: "var(--mute)",
                letterSpacing: "0.08em",
                flexShrink: 0,
              }}
            >
              SAMPLE
            </span>
          )}
        </span>
        <span className="pd-hide-sm" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "var(--mute)", textAlign: "right" }}>
          {fmt(q.ac)} ac
        </span>
        <span className="pd-hide-sm" style={{ fontSize: 11, color: "var(--mute)" }}>
          <span style={{ color: "var(--ink-2)" }}>{q.crop || "-"}</span>
          <span style={{ marginLeft: 8, opacity: 0.7 }}>soil {q.soil || "-"}</span>
        </span>
        <OwnershipPill kind={st.ownership} compact provisional={st.provisional} />
      </div>
      {expanded && <QuarterDetail propId={propId} q={q} i={i} onClose={() => onOpen(null)} />}
    </div>
  );
}

function SeedingStatusLabel({ applicability, seeded, confidence }) {
  if (!applicability) return React.createElement("span", { style: { color: "var(--mute)" } }, "No satellite data");
  if (applicability === "insufficient_baseline") return React.createElement("span", { style: { color: "#7a7a7a" } }, "Insufficient baseline — SAR pending");
  if (applicability === "out-of-season") return React.createElement("span", { style: { color: "#5a7a8a" } }, "Out of season");
  if (applicability === "perennial") return React.createElement("span", { style: { color: "#5a7a8a" } }, "Perennial crop — seeding n/a");
  // active window
  if (seeded === true) {
    return React.createElement("span", { style: { color: "#3a8c2a", fontWeight: 600 } },
      `Seeded confirmed${confidence ? ` (${confidence}% confidence)` : ""}`
    );
  }
  if (seeded === false) {
    return React.createElement("span", { style: { color: "#c0392b" } },
      `Not yet seeded${confidence ? ` (${confidence}% confidence)` : ""}`
    );
  }
  return React.createElement("span", { style: { color: "#c8a84b" } }, "Active window — indeterminate");
}

function QuarterDetail({ propId, q, i, onClose }) {
  const [st] = useQuarter(propId, q, i);
  const [opticsOpen, setOpticsOpen] = useState(false);
  const imageryStore = window.MONETTE_IMAGERY || { parcels: {} };
  const imgRow = (imageryStore.parcels || {})[`${propId}:${q.loc}`] || null;
  const seedingBlock = imgRow && imgRow.seeding ? imgRow.seeding : null;
  const opticalBlock = seedingBlock && seedingBlock.optical ? seedingBlock.optical : null;
  const hasSatelliteData = !!(imgRow && imgRow.status === "ok");
  const applicability = imgRow ? imgRow.seeding_applicability : null;
  const seeded = imgRow ? imgRow.seeding_seeded : null;
  const confidence = imgRow ? (imgRow.seeding_confidence || 0) : 0;
  const lastObsDate = seedingBlock ? (seedingBlock.last_obs_date || null) : (imgRow ? imgRow.image_to || null : null);
  const polygonQuality = imgRow ? (imgRow.polygon_quality || null) : null;
  const croplandCoverage = imgRow ? (imgRow.cropland_coverage || null) : null;
  const priorCrop = imgRow ? (imgRow.prior_crop || null) : null;
  const isLowQc = polygonQuality === "low";

  return (
    <div className="qd-wrap" style={{ background: "var(--paper-2)", padding: "18px 20px", borderTop: "1px dashed var(--rule-2)" }}>
      {(q.assessment != null || q.rm || q.parcel_no || q.owner || q.tax_year || q.property_card) && (
        <div className="qd-meta" style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          padding: "8px 20px 14px",
          fontSize: 11,
          fontFamily: '"JetBrains Mono", monospace',
          color: "var(--mute)",
          borderBottom: "1px dashed var(--rule-2)",
          marginBottom: 14,
        }}>
          {q.rm && <span><span style={{ color: "var(--ink-2)" }}>RM</span> {q.rm}</span>}
          {q.assessment != null && <span><span style={{ color: "var(--ink-2)" }}>Assessed</span> ${q.assessment.toLocaleString("en-CA")}</span>}
          {q.parcel_no && <span><span style={{ color: "var(--ink-2)" }}>Parcel #</span> {q.parcel_no}</span>}
          {q.tax_year && <span><span style={{ color: "var(--ink-2)" }}>Tax year</span> {q.tax_year}</span>}
          {q.owner && <span><span style={{ color: "var(--ink-2)" }}>Record owner</span> {q.owner}</span>}
          {q.property_card && <a href={q.property_card} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Montana property card</a>}
        </div>
      )}
      <div className="qd-status-row" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <OwnershipPill kind={st.ownership} provisional={st.provisional} />
        {st.listing && st.listing !== "not-listed" && <ListingPill kind={st.listing} />}
      </div>

      {/* Satellite seeding row */}
      <div className={`qd-satellite-row${isLowQc ? " is-low-qc" : ""}`}>
        <div className="qd-satellite-header">
          <span className="qd-satellite-label">Satellite · 2026 seeding</span>
          {isLowQc && (
            <span className="qd-lowqc-badge">low-QC polygon</span>
          )}
          {priorCrop && priorCrop !== "unknown" && (
            <span className="qd-satellite-crop mono">prior: {priorCrop.replace(/_/g, " ")}</span>
          )}
        </div>
        <div className="qd-satellite-status">
          <SeedingStatusLabel applicability={applicability} seeded={seeded} confidence={confidence} />
        </div>
        {lastObsDate && (
          <div className="qd-satellite-obs mono">
            Last obs: {lastObsDate}
            {croplandCoverage != null && ` · cropland cov ${Math.round(croplandCoverage * 100)}%`}
          </div>
        )}
        {!hasSatelliteData && !imgRow && (
          <div className="qd-satellite-obs mono" style={{ color: "var(--mute)" }}>
            No imagery record for this parcel.
          </div>
        )}
        {opticalBlock && (
          <details
            className="qd-optical-details"
            open={opticsOpen}
            onToggle={(e) => setOpticsOpen(e.target.open)}
          >
            <summary className="qd-optical-summary mono">
              Optical indices {opticsOpen ? "▲" : "▼"}
            </summary>
            <div className="qd-optical-grid mono">
              {opticalBlock.ndvi != null && (
                <>
                  <span style={{ color: "var(--mute)" }}>NDVI</span>
                  <span>{Number(opticalBlock.ndvi).toFixed(3)}</span>
                </>
              )}
              {opticalBlock.ndti != null && (
                <>
                  <span style={{ color: "var(--mute)" }}>NDTI</span>
                  <span>{Number(opticalBlock.ndti).toFixed(3)}</span>
                </>
              )}
              {opticalBlock.bsi != null && (
                <>
                  <span style={{ color: "var(--mute)" }}>BSI</span>
                  <span>{Number(opticalBlock.bsi).toFixed(3)}</span>
                </>
              )}
              {seedingBlock && seedingBlock.dvh_db != null && (
                <>
                  <span style={{ color: "var(--mute)" }}>dVH (SAR)</span>
                  <span>{Number(seedingBlock.dvh_db).toFixed(2)} dB</span>
                </>
              )}
              {seedingBlock && seedingBlock.dvv_db != null && (
                <>
                  <span style={{ color: "var(--mute)" }}>dVV (SAR)</span>
                  <span>{Number(seedingBlock.dvv_db).toFixed(2)} dB</span>
                </>
              )}
              {opticalBlock.source_scene && (
                <>
                  <span style={{ color: "var(--mute)" }}>Optical scene</span>
                  <span>{opticalBlock.source_scene}</span>
                </>
              )}
            </div>
          </details>
        )}
      </div>

      <div style={{ textAlign: "right", marginTop: 12 }}>
        <button onClick={onClose} style={{ padding: "6px 10px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--rule-2)", background: "transparent", cursor: "pointer" }}>
          Close quarter
        </button>
      </div>
    </div>
  );
}

// Headline ticker. Shows editorial headlines from the tips table.
// Vote-activity items have been removed; only seed headlines remain.
function HeadlineTicker({ dark, onOpenSubmit }) {
  const heads = useHeadlines();
  const canOpenSubmit = typeof onOpenSubmit === "function";
  const tickerItems = heads;

  return (
    <div style={{ borderBottom: dark ? "1px solid #2a2620" : "1px solid var(--ink)", background: dark ? "#1a1813" : "var(--paper-2)", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          padding: "8px 14px",
          fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: "0.12em",
          background: dark ? "#0e0c09" : "var(--ink)",
          color: dark ? "#b48638" : "var(--paper)",
          flexShrink: 0,
        }}>
          ● FEED
        </div>
        <div className="ticker-window" style={{ flex: 1, overflow: "hidden", padding: "8px 0" }}>
          <div className="ticker-track" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: dark ? "var(--paper)" : "var(--ink-2)" }}>
            {[...tickerItems, ...tickerItems].map((h, idx) => (
              <span key={idx} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <span>{h.text}</span>
                <span style={{ color: dark ? "#8a7f6e" : "var(--mute)" }}>- {h.author} · {h.when}</span>
                <span style={{ color: dark ? "#3a342a" : "var(--rule-2)" }}>///</span>
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={canOpenSubmit ? onOpenSubmit : undefined}
          disabled={!canOpenSubmit}
          style={{
            padding: "8px 14px",
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.1em",
            border: "none",
            background: "transparent",
            color: dark ? "var(--paper)" : "var(--ink)",
            cursor: canOpenSubmit ? "pointer" : "default",
            opacity: canOpenSubmit ? 1 : 0.55,
            borderLeft: dark ? "1px solid #2a2620" : "1px solid var(--rule)",
          }}
        >
          + SUBMIT UPDATE
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { QuarterRow, QuarterDetail, HeadlineTicker });
