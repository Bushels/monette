// Quarter detail panel - the heart of community voting.
// Shows ownership + listing vote bars, seed / spray / harvest toggles with
// timestamps, and the sprayer-spotted event log.
//
// The QuarterRow is collapsed by default; clicking expands QuarterDetail
// inline so voters can stay in the drawer's scroll context instead of
// bouncing through a modal stack.

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
          gridTemplateColumns: "24px 170px 80px 1fr auto auto auto",
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
        <span className="pd-hide-sm"><ListingPill kind={st.listing} /></span>
        <span style={{ display: "flex", gap: 4, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}>
          <span title="Seeded" style={{ padding: "2px 5px", border: "1px solid var(--rule-2)", color: st.seeded ? "#4e6a30" : "var(--mute)" }}>
            {st.seeded ? "OK SDD" : "SDD"}
          </span>
          <span title="Sprayer" style={{ padding: "2px 5px", border: "1px solid var(--rule-2)", color: st.sprays.length ? "#b48638" : "var(--mute)" }}>
            {st.sprays.length ? `${st.sprays.length}x SPR` : "SPR"}
          </span>
          <span title="Harvested" style={{ padding: "2px 5px", border: "1px solid var(--rule-2)", color: st.harvested ? "#9a3a2a" : "var(--mute)" }}>
            {st.harvested ? "OK HRV" : "HRV"}
          </span>
        </span>
      </div>
      {expanded && <QuarterDetail propId={propId} q={q} i={i} onClose={() => onOpen(null)} />}
    </div>
  );
}

function QuarterDetail({ propId, q, i, onClose }) {
  const [st, actions] = useQuarter(propId, q, i);
  const [sprayNote, setSprayNote] = useState("");

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
      <div className="qd-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 8 }}>
            OWNERSHIP - WHO CONTROLS THIS QUARTER?
          </div>
          <VoteBars entries={st.ownershipVotes} meta={OWN} active={st.ownership} onVote={actions.voteOwn} dense />
        </div>

        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 8 }}>
            LISTING - IS IT ON THE MARKET?
          </div>
          <VoteBars entries={st.listingVotes} meta={LIST} active={st.listing} onVote={actions.voteList} dense />
        </div>

        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 8 }}>
            SEASON - WHAT HAS HAPPENED HERE?
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <button onClick={actions.toggleSeed} style={{
              padding: "8px 10px",
              border: st.seeded ? "1.5px solid #4e6a30" : "1px solid var(--rule)",
              background: st.seeded ? "rgba(78,106,48,0.08)" : "transparent",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 12 }}>{st.seeded ? "OK Seeded" : "Unseeded"}</span>
              <span style={{ fontSize: 10, color: "var(--mute)", fontFamily: '"JetBrains Mono", monospace' }}>{st.seededAt || "tap to mark"}</span>
            </button>
            <button onClick={actions.toggleHarvest} style={{
              padding: "8px 10px",
              border: st.harvested ? "1.5px solid #9a3a2a" : "1px solid var(--rule)",
              background: st.harvested ? "rgba(154,58,42,0.06)" : "transparent",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 12 }}>{st.harvested ? "OK Harvested" : "Unharvested"}</span>
              <span style={{ fontSize: 10, color: "var(--mute)", fontFamily: '"JetBrains Mono", monospace' }}>{st.harvestedAt || "tap to mark"}</span>
            </button>
            <div style={{ border: "1px solid var(--rule)", padding: "8px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>Sprayer spotted <span style={{ color: "#b48638" }}>● {st.sprays.length}</span></span>
                <span style={{ fontSize: 10, color: "var(--mute)", fontFamily: '"JetBrains Mono", monospace' }}>timestamped log</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  value={sprayNote}
                  onChange={(e) => setSprayNote(e.target.value)}
                  name="spray_note"
                  autoComplete="off"
                  aria-label="Sprayer note"
                  placeholder="Note (e.g. pre-seed burn-off)"
                  style={{
                    flex: 1,
                    fontFamily: "inherit",
                    fontSize: 11,
                    padding: "5px 7px",
                    border: "1px solid var(--rule-2)",
                    background: "var(--paper)",
                  }}
                />
                <button onClick={() => { actions.addSpray(sprayNote); setSprayNote(""); }} style={{
                  padding: "5px 9px",
                  fontSize: 11,
                  fontFamily: "inherit",
                  border: "1px solid var(--ink)",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  cursor: "pointer",
                }}>
                  + Log
                </button>
              </div>
              {st.sprays.length > 0 && (
                <div style={{ marginTop: 8, display: "grid", gap: 3, maxHeight: 110, overflowY: "auto" }}>
                  {st.sprays.map((s, j) => (
                    <div key={j} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: "var(--ink-2)", display: "flex", justifyContent: "space-between" }}>
                      <span>{s.at} - {s.by}</span>
                      <span style={{ color: "var(--mute)" }}>{s.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", marginTop: 12 }}>
        <button onClick={onClose} style={{ padding: "6px 10px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--rule-2)", background: "transparent", cursor: "pointer" }}>
          Close quarter
        </button>
      </div>
    </div>
  );
}

// Top-of-page ticker. Votes come from Supabase; free-form correction
// discussion is routed outside the controlled Monette record.
function HeadlineTicker({ dark, onOpenSubmit }) {
  const heads = useHeadlines();
  const activity = useActivityFeed(8);
  const canOpenSubmit = typeof onOpenSubmit === "function";
  const voteItems = activity.map((item) => ({
    id: `activity-${item.id}`,
    text: `${item.propertyName} ${item.quarterLoc}: ${item.action} - ${item.label}`,
    author: "Vote",
    when: formatRelativeTime(item.createdAt),
    color: item.color,
  }));
  const tickerItems = [...voteItems, ...heads];

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
          ● LIVE FEED
        </div>
        <div className="ticker-window" style={{ flex: 1, overflow: "hidden", padding: "8px 0" }}>
          <div className="ticker-track" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: dark ? "var(--paper)" : "var(--ink-2)" }}>
            {[...tickerItems, ...tickerItems].map((h, idx) => (
              <span key={idx} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                {h.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: h.color }} />}
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
