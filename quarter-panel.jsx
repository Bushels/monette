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

function QuarterDetail({ propId, q, i, onClose }) {
  const [st] = useQuarter(propId, q, i);

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
        {/* Satellite-row placeholder — wired in commit 5 */}
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
