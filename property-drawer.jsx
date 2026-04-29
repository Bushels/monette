// PropertyDrawer — the full file for one property.
// Renders:
//   - masthead with titled acres, parcel count, assessed value
//   - ownership rollup (proportional bar + counters from XLSX/editorial data)
//   - the quarter list (each row is a QuarterRow → QuarterDetail satellite view)
//
// The "Zoom Mapbox →" button flies the atlas to the property's bbox.

// Default page size for the drawer's "Load more" pagination. Kept at module
// scope so it doesn't allocate a fresh binding every render.
const DRAWER_PAGE_SIZE = 40;

function CurrentLandAcreBar({ status }) {
  const owned = status && status.mappedOwnedAc ? status.mappedOwnedAc : 0;
  const sold = status && status.soldUnlocatedAc ? status.soldUnlocatedAc : 0;
  const rented = status && status.assumedRentedUnmappedAc ? status.assumedRentedUnmappedAc : 0;
  const total = owned + sold + rented || 1;
  const segs = [
    ["owned", owned, OWN["owned-monette"].color],
    ["sold", sold, OWN.sold.color],
    ["rented", rented, OWN["rented-monette"].color],
  ];
  return (
    <div style={{ display: "flex", height: 6, background: "var(--rule)" }}>
      {segs.map(([key, value, color]) =>
        value ? <div key={key} title={`${key}: ${fmt(value)} ac`} style={{ width: `${(value / total) * 100}%`, background: color }} /> : null
      )}
    </div>
  );
}

function PropertyDrawer({ prop, initialQuarterLoc, onClose, onZoomMap, onQuarterRouteChange, onOpenHeadlineForm }) {
  const [openQ, setOpenQ] = useState(initialQuarterLoc || null);
  const rowRefs = useRef({});
  const scrollContainerRef = useRef(null);
  // Tracks the last target we successfully scrolled to, so the effect that
  // reacts to filter state changes (in case we needed to clear a filter)
  // doesn't re-scroll on every keystroke once the target is in view.
  const lastTargetKeyRef = useRef(null);
  // Tracks the last non-null property id we rendered for, so the
  // filter-reset-on-property-switch effect can distinguish a genuine
  // switch (A → B) from a close/reopen of the same property (A → null → A).
  const lastSeenPropIdRef = useRef(null);

  // The "open + scroll to LSD" effect lives further down, after `filtered`
  // and `visibleCount` are declared, so it can paginate forward when the
  // targeted LSD sits past the current visible slice.

  // Derive quarters before early-return so hooks are always called in the same order.
  const quarters = (Q && prop && Q[prop.id]) || [];
  const imageryStore = window.MONETTE_IMAGERY || { parcels: {} };
  const imageryRows = imageryStore.parcels || {};

  const [filterText, setFilterText] = useState("");
  const [filterSoil, setFilterSoil] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Available soils for this property, derived from actual rows.
  const availableSoils = useMemo(() => {
    const s = new Set();
    for (const q of quarters) if (q.soil) s.add(q.soil);
    return Array.from(s).sort();
  }, [quarters]);

  const filtered = useMemo(() => {
    const txt = filterText.trim().toLowerCase();
    return quarters.filter((q) => {
      if (txt && !(q.loc || "").toLowerCase().includes(txt)) return false;
      if (filterSoil !== "all" && q.soil !== filterSoil) return false;
      if (filterStatus !== "all") {
        const st = loadQState(prop?.id, q, 0);
        if (filterStatus === "owned"   && st.ownership !== "owned-monette") return false;
        if (filterStatus === "rented"  && st.ownership !== "rented-monette") return false;
        if (filterStatus === "sold"    && st.ownership !== "sold" && st.ownership !== "sold-rented-back")          return false;
        if (filterStatus === "listed"  && st.listing   !== "listed-for-sale") return false;
      }
      return true;
    });
  }, [quarters, filterText, filterSoil, filterStatus, prop?.id]);

  const [visibleCount, setVisibleCount] = useState(DRAWER_PAGE_SIZE);
  // Reset pagination when filter inputs change.
  useEffect(() => { setVisibleCount(DRAWER_PAGE_SIZE); }, [filterText, filterSoil, filterStatus]);

  // Reset filters when the user genuinely switches to a different property.
  // We only reset on prop A → prop B transitions (not on null → A or A → null
  // → A close/reopen cycles), so filters set during a single property session
  // survive the user closing and reopening the drawer on the same block.
  useEffect(() => {
    const currentId = prop?.id;
    if (!currentId) return;
    if (lastSeenPropIdRef.current && lastSeenPropIdRef.current !== currentId) {
      setFilterText("");
      setFilterSoil("all");
      setFilterStatus("all");
    }
    lastSeenPropIdRef.current = currentId;
  }, [prop?.id]);

  // When the drawer opens from a map-parcel click (or the user clicks a
  // different parcel while the drawer is already open), pre-expand that
  // quarter's row and scroll it into view so the vote UI is immediately
  // actionable — no hunting through ~90 rows.
  //
  // Two gaps this effect handles:
  //  1. Pagination — if the targeted LSD lives past the current visible
  //     slice, bump `visibleCount` so the row mounts before scrollIntoView.
  //  2. Filter exclusion — if the user previously set a filter (e.g.
  //     filterStatus="rented") and now clicks a parcel that filter would
  //     exclude, the click should win: reset filters so the targeted LSD
  //     becomes reachable. The cascade (filter reset -> re-render -> filter
  //     state in deps fires this effect again) is what gets us back to the
  //     scroll path; the lastTargetKeyRef dedupes so we don't re-scroll on
  //     every subsequent filter keystroke.
  useEffect(() => {
    if (!initialQuarterLoc) {
      lastTargetKeyRef.current = null;
      return;
    }
    const targetKey = `${prop?.id || ""}:${initialQuarterLoc}`;
    // Already scrolled to this exact target — don't repeat the work just
    // because a filter input changed (which the user did intentionally).
    // This MUST come before the filter-reset path: if the user applies a
    // filter that excludes their currently-open LSD, that's their intent,
    // not a stale-filter mistake. We only reset filters for genuinely new
    // navigations (initialQuarterLoc just changed).
    if (lastTargetKeyRef.current === targetKey) return;
    const idx = filtered.findIndex((q) => q.loc === initialQuarterLoc);
    // Gap 2: a stale filter is hiding the parcel the user just clicked.
    // Reset filters so the click takes precedence; the effect will re-run
    // with the cleared filter values and complete the scroll path.
    if (idx < 0 && (filterText !== "" || filterSoil !== "all" || filterStatus !== "all")) {
      setFilterText("");
      setFilterSoil("all");
      setFilterStatus("all");
      return;
    }

    setOpenQ(initialQuarterLoc);
    if (idx >= 0) setVisibleCount((cur) => (idx >= cur ? idx + 1 : cur));
    lastTargetKeyRef.current = targetKey;

    // Two animation frames: the first lets any pagination bump commit;
    // the second runs after the new row's ref is populated AND the
    // expanded QuarterDetail has laid out, so scrollIntoView measures
    // the final element height (and centers correctly).
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        const el = rowRefs.current[initialQuarterLoc];
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [initialQuarterLoc, prop?.id, filtered, filterText, filterSoil, filterStatus]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const realMappedCount = useMemo(
    () => quarters.filter((q) => !q.isSample).length,
    [quarters]
  );
  const imageryOkCount = useMemo(
    () => quarters.reduce((count, q) => {
      const row = imageryRows[`${prop?.id}:${q.loc}`];
      return count + (row && row.status === "ok" && typeof row.ndvi_mean === "number" ? 1 : 0);
    }, 0),
    [imageryRows, prop?.id, quarters]
  );
  const imageryMissingCount = useMemo(
    () => quarters.reduce((count, q) => {
      const row = imageryRows[`${prop?.id}:${q.loc}`];
      return count + (row && row.status && row.status !== "ok" ? 1 : 0);
    }, 0),
    [imageryRows, prop?.id, quarters]
  );

  if (!prop) return null;
  const { rollup } = rollupProperty(prop.id);
  const openPointOnlyUpdate = (draft, title = `${prop.name} land evidence`) => {
    if (window.openAgnonymousDiscussion) {
      window.openAgnonymousDiscussion({
        title,
        body: draft,
        propertyId: prop.id,
        kind: "clarification",
      });
      return;
    }
    if (!onOpenHeadlineForm) return;
    onOpenHeadlineForm({ propertyId: prop.id, draft });
  };
  const canOpenPublicThread = !!window.openAgnonymousDiscussion || !!onOpenHeadlineForm;
  const communityAsk = prop.communityAsk || null;
  // Per-property purchaser rumor — opt-in via prop.purchaserRumor so a tip
  // about one block doesn't bleed into unrelated property drawers. Sold
  // properties already have a buyer/price story so suppress on prop.phase.
  const purchaserRumor = (prop.phase ? null : prop.purchaserRumor) || null;
  // Per-property change log — every meaningful editorial / intel / data-fix
  // event with a timestamp so visitors (and we) can see what happened last.
  const changeLog = Array.isArray(prop.changeLog) ? prop.changeLog : [];
  // Property Summary unmapped acres — surface a "help locate" CTA that
  // points to agnonymous.buperac.com so visitors can submit LSDs / quarter
  // descriptions for the rented portion we don't have geometry for.
  const propertySummary = prop.propertySummary || null;
  const currentLandStatus = prop.currentLandStatus || null;
  const sourceTruth = prop.sourceOfTruth || null;
  const propertySummarySource = sourceTruth
    ? `${sourceTruth.ownerQuery}; pulled ${sourceTruth.pulledAt || "date unknown"}`
    : (propertySummary && propertySummary.source) || "docs/Land/Acre Sheet.jpg";
  const unmappedAc = propertySummary && propertySummary.unmappedAc ? propertySummary.unmappedAc : 0;
  const operatorRelationships = (D.operatorRelationships || [])
    .filter((relationship) => relationship.linkedPropertyId === prop.id);
  return (
    <div onClick={onClose} className="drawer-scrim" style={{ position: "fixed", inset: 0, background: "rgba(19,17,14,0.55)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div ref={scrollContainerRef} onClick={(e) => e.stopPropagation()} className="scroll property-drawer" style={{
        width: 780, maxWidth: "100%", height: "100%", background: "var(--paper)", overflowY: "auto", borderLeft: "1px solid var(--ink)",
      }}>
        <div className="pd-header" style={{ padding: "24px 28px 20px", borderBottom: "2px solid var(--ink)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>{prop.province} · {prop.region}</div>
            <div className="serif pd-title" style={{ fontSize: 50, lineHeight: 1, marginTop: 6 }}>{prop.name}</div>
            <div style={{ marginTop: 10, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "var(--mute)" }}>
              {fmt(prop.titled)} file ac · {prop.parcels ? `${prop.parcels} titles` : "title count pending"} · {prop.assessment ? fmtM(prop.assessment) : "assessment pending"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onZoomMap && <button onClick={() => onZoomMap(prop)} style={{ padding: "8px 12px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--rule-2)", background: "transparent", cursor: "pointer" }}>Zoom Mapbox →</button>}
            <button onClick={onClose} style={{ padding: "8px 12px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--ink)", background: "transparent", cursor: "pointer" }}>Close ✕</button>
          </div>
        </div>

        {/* Rollup */}
        <div className="pd-rollup" style={{ padding: "16px 28px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>
              {rollup.total ? `Status rollup · ${rollup.total} quarters shown` : "Property file · parcel rows needed"}
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)" }}>
              {rollup.total ? "Click any quarter for satellite detail" : "Submit location evidence or field observations"}
            </span>
          </div>
          {currentLandStatus && (
            <div style={{ marginBottom: 12, padding: "10px 12px", background: "rgba(90,166,201,0.12)", borderLeft: "2px solid #5aa6c9" }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 8 }}>
                Current working ownership - Acre Sheet baseline plus sale updates
              </div>
              <CurrentLandAcreBar status={currentLandStatus} />
              <div className="pd-rollup-grid" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                {[
                  ["Current owned", currentLandStatus.mappedOwnedAc || 0, OWN["owned-monette"].color, "ac"],
                  ["Sold dot", currentLandStatus.soldUnlocatedAc || 0, OWN.sold.color, "ac"],
                  ["Rented/unmapped", currentLandStatus.assumedRentedUnmappedAc || 0, OWN["rented-monette"].color, "ac"],
                  ["Mapped rows", rollup.total || 0, "var(--ink-2)", "quarters"],
                ].map(([l, v, c, unit]) => (
                  <div key={l}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
                      <span style={{ color: "var(--mute)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</span>
                    </div>
                    <div className="serif" style={{ fontSize: 22, lineHeight: 1, marginTop: 4, color: c }}>
                      {fmt(v)}<span style={{ fontSize: 11, color: "var(--mute)", marginLeft: 4 }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mono" style={{ marginTop: 9, fontSize: 10, lineHeight: 1.45, color: "var(--ink-2)" }}>
                The rollup below counts mapped quarter rows only. Rented/unmapped acres stay out of the row list until LSDs or quarter descriptions are confirmed.
              </div>
            </div>
          )}
          {currentLandStatus && (
            <div className="mono" style={{ margin: "10px 0 6px", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--mute)" }}>
              Mapped row status rollup
            </div>
          )}
          <RollupBar rollup={rollup} />
          <div className="pd-rollup-grid" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
            {(() => {
              // For properties where the sold-and-rented-back transaction
              // dominates (currently Hafford), swap the "Owned" tile for a
              // "Sold/R-back" tile so the new status is visually obvious.
              const useSoldRentBack = (rollup.soldRentedBack || 0) > (rollup.owned || 0);
              const ownedLikeTile = useSoldRentBack
                ? ["Sold/R-back", rollup.soldRentedBack, OWN["sold-rented-back"].color]
                : ["Owned",       rollup.owned,         OWN["owned-monette"].color];
              return [
                ownedLikeTile,
                ["Rented",   rollup.rented,  OWN["rented-monette"].color],
                ["Sold",     rollup.sold,    OWN.sold.color],
                ["For sale", rollup.forSale, LIST["listed-for-sale"].color],
              ];
            })().map(([l, v, c]) => (
              <div key={l}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
                  <span style={{ color: "var(--mute)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</span>
                </div>
                <div className="serif" style={{ fontSize: 24, lineHeight: 1, marginTop: 4 }}>
                  {v}<span style={{ fontSize: 11, color: "var(--mute)", marginLeft: 4 }}>/ {rollup.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pd-imagery-summary" style={{
          padding: "14px 28px",
          borderBottom: "1px solid var(--rule)",
          background: "rgba(236,230,219,0.45)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>Parcel intelligence</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)" }}>
              {realMappedCount ? `${realMappedCount}/${quarters.length} real geometry` : "Synthetic fallback only"}
            </span>
          </div>
          <div className="pd-imagery-grid" style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            color: "var(--ink-2)",
          }}>
            <span style={{ color: "var(--mute)" }}>Vegetation vigor</span>
            <span>
              {imageryOkCount
                ? `${imageryOkCount} parcels`
                : imageryStore.note || "Pending generated imagery build"}
            </span>
            <span style={{ color: "var(--mute)" }}>Imagery window</span>
            <span>
              {imageryStore.window_days
                ? `Last ${imageryStore.window_days} days`
                : "Not loaded"}
            </span>
            <span style={{ color: "var(--mute)" }}>No clear imagery</span>
            <span>{imageryMissingCount || 0}</span>
          </div>
        </div>

        {false && prop.id === "montana" && (
          <div className="pd-montana-banner" style={{
            padding: "10px 28px", background: "rgba(180,134,56,0.12)",
            borderBottom: "1px solid var(--rule)",
            fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
            color: "var(--gold-ink)", letterSpacing: "0.04em",
          }}>
            ⚠ Parcel set includes un-reconciled PLSS sections — under review.
          </div>
        )}

        {prop.id === "montana" && (
          <div className="pd-montana-banner" style={{
            padding: "10px 28px", background: "rgba(180,134,56,0.12)",
            borderBottom: "1px solid var(--rule)",
            fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
            color: "var(--gold-ink)", letterSpacing: "0.04em",
          }}>
            Source-of-truth baseline: Montana DNRC/DOR public cadastral owner records. Court-file changes and satellite observations are dated overlays against this original map.
          </div>
        )}

        {propertySummary && (
          <div className="pd-property-summary" style={{ padding:"14px 28px", borderBottom:"1px solid var(--rule)", background:"rgba(78,106,48,0.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8, gap:8, flexWrap:"wrap" }}>
              <span className="mono" style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--mute)" }}>
                Monette Property Summary · {propertySummary.rmArea || ""}
              </span>
              <span className="mono" style={{ fontSize:10, color:"var(--mute)" }}>source: {propertySummarySource}</span>
            </div>
            {sourceTruth && (
              <div className="mono" style={{ marginBottom:10, fontSize:10, lineHeight:1.5, color:"var(--ink-2)" }}>
                Original map baseline: {sourceTruth.label}. Acre Sheet figures are retained here as a reconciliation overlay.
              </div>
            )}
            <div className="pd-rollup-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, fontSize:11, fontFamily:'"JetBrains Mono", monospace' }}>
              <div>
                <div style={{ color:"var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Farmed total</div>
                <div className="serif" style={{ fontSize:22, lineHeight:1, marginTop:4 }}>{fmt(propertySummary.farmedAc)}</div>
              </div>
              <div>
                <div style={{ color:"var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>PS owned</div>
                <div className="serif" style={{ fontSize:22, lineHeight:1, marginTop:4, color:"#4e6a30" }}>{fmt(propertySummary.ownedAc)}</div>
              </div>
              <div>
                <div style={{ color:"var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>PS rented</div>
                <div className="serif" style={{ fontSize:22, lineHeight:1, marginTop:4, color:"#5aa6c9" }}>{fmt(propertySummary.rentedAc)}</div>
              </div>
              <div>
                <div style={{ color: unmappedAc ? "#9a3a2a" : "var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Unmapped</div>
                <div className="serif" style={{ fontSize:22, lineHeight:1, marginTop:4, color: unmappedAc ? "#9a3a2a" : "var(--mute)" }}>{fmt(unmappedAc)}</div>
              </div>
            </div>
            {currentLandStatus && (
              <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(90,166,201,0.12)", borderLeft:"2px solid #5aa6c9" }}>
                <div className="mono" style={{ fontSize:10, letterSpacing:"0.10em", textTransform:"uppercase", color:"#5aa6c9", marginBottom:8 }}>
                  Current working status - {currentLandStatus.source || "reviewed overlay"}
                </div>
                <div className="pd-rollup-grid" style={{ display:"grid", gridTemplateColumns: currentLandStatus.soldUnlocatedAc ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap:10, fontFamily:'"JetBrains Mono", monospace', fontSize:11 }}>
                  <div>
                    <div style={{ color:"var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Current owned</div>
                    <div className="serif" style={{ fontSize:21, lineHeight:1, marginTop:4, color:"#4e6a30" }}>{fmt(currentLandStatus.mappedOwnedAc || 0)}</div>
                  </div>
                  {currentLandStatus.soldUnlocatedAc ? (
                    <div>
                      <div style={{ color:"var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Sold dot</div>
                      <div className="serif" style={{ fontSize:21, lineHeight:1, marginTop:4, color:"#9a3a2a" }}>{fmt(currentLandStatus.soldUnlocatedAc || 0)}</div>
                    </div>
                  ) : null}
                  <div>
                    <div style={{ color:"var(--mute)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Assumed rented/unmapped</div>
                    <div className="serif" style={{ fontSize:21, lineHeight:1, marginTop:4, color:"#5aa6c9" }}>{fmt(currentLandStatus.assumedRentedUnmappedAc || 0)}</div>
                  </div>
                </div>
                {currentLandStatus.note && (
                  <div style={{ marginTop:8, fontSize:12, lineHeight:1.5, color:"var(--ink-2)" }}>
                    {currentLandStatus.note}
                  </div>
                )}
              </div>
            )}
            {unmappedAc > 0 && (
              <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(154,58,42,0.08)", borderLeft:"2px solid #9a3a2a" }}>
                <div style={{ fontSize:12, lineHeight:1.5, color:"var(--ink-2)" }}>
                  We have quarter geometry for <strong>{fmt(prop.titled || 0)} ac</strong> at {prop.name}, but Monette's Property Summary lists <strong>{fmt(propertySummary.farmedAc)} ac</strong> total farmed. <strong style={{ color:"#9a3a2a" }}>{fmt(unmappedAc)} ac is unmapped</strong> — most likely the rented / leased portion. If you know the legal land descriptions (LSDs / quarter descriptions) or have an update on this block, post it on agnonymous.buperac.com.
                </div>
                {canOpenPublicThread && (
                  <button
                    className="btn btn-dark"
                    style={{ marginTop:10, padding:"7px 12px", fontSize:11 }}
                    onClick={() => openPointOnlyUpdate(
                      `${prop.name} unmapped acres — ${fmt(unmappedAc)} ac of farmed ground (rented portion) has no quarter-level locations on the map yet. If you know any of the LSDs / quarter descriptions, landlord names, lease terms, or 2026 field activity, share them here.\n\nLSD / quarter (e.g. NW-23-43-10-W3): \nLandlord (if known): \nSource: \nConfidence (low / med / high): `,
                      `${prop.name}: unmapped-acres LSD evidence`
                    )}
                  >
                    + Submit LSDs on agnonymous.buperac.com
                  </button>
                )}
              </div>
            )}
            {propertySummary.note && (
              <div className="mono" style={{ marginTop:10, fontSize:10, lineHeight:1.5, color:"var(--ink-2)", padding:"8px 10px", background:"rgba(78,106,48,0.10)", borderLeft:"2px solid #4e6a30" }}>
                {propertySummary.note}
              </div>
            )}
          </div>
        )}

        {operatorRelationships.length > 0 && (
          <div className="pd-community-ask pd-operator-relationships" style={{ background:"rgba(241,210,132,0.10)", borderLeft:"3px solid #f1d284" }}>
            <div className="pd-community-ask-copy">
              <div className="mono pd-community-ask-label" style={{ color:"var(--gold-ink, #8a6520)" }}>
                Operator relationship layer
              </div>
              <div className="serif pd-community-ask-metric">Partner-managed land</div>
              {operatorRelationships.map((relationship) => (
                <div key={relationship.id} style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(26,24,21,0.12)" }}>
                  <div className="serif" style={{ fontSize:18, lineHeight:1.15 }}>{relationship.name}</div>
                  <div className="mono" style={{ marginTop:6, fontSize:10, lineHeight:1.45, color:"var(--ink-2)" }}>
                    Owner / landholder: <strong>{relationship.owner}</strong> · Monette role: <strong>{relationship.monetteRole}</strong>
                  </div>
                  <p>{relationship.publicNote}</p>
                  <div className="pd-community-ask-contact">
                    Evidence: {relationship.evidence} Source: {relationship.sourceLabel}. Exposure note: {relationship.currentExposureLabel}.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {changeLog.length > 0 && (
          <details className="pd-change-log" style={{ borderBottom:"1px solid var(--rule)", background:"rgba(236,230,219,0.35)" }}>
            <summary style={{ padding:"12px 28px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"baseline", listStyle:"revert" }}>
              <span className="mono" style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--mute)" }}>
                Ledger change log · {changeLog.length} event{changeLog.length === 1 ? "" : "s"}
              </span>
              <span className="mono" style={{ fontSize:10, color:"var(--mute)" }}>
                latest: {(changeLog[0] && changeLog[0].title) || "—"}
              </span>
            </summary>
            <ol style={{ listStyle:"none", padding:"4px 28px 14px", margin:0, display:"grid", gap:8 }}>
              {changeLog.map((evt, idx) => {
                const when = (evt.at || "").replace("T", " ").replace(/(:\d\d)([+-]\d{2}:\d{2}|Z)$/, "$2");
                const typeColor = evt.type === "intel" ? "#b48638"
                  : evt.type === "correction" ? "#9a3a2a"
                  : evt.type === "data-fix" ? "#3f5b6c"
                  : evt.type === "editorial-scope" ? "#6a6a6a"
                  : evt.type === "ledger-status" ? "#4e6a30"
                  : "var(--ink-2)";
                return (
                  <li key={idx} style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:10, alignItems:"baseline" }}>
                    <span className="mono" style={{ fontSize:10, color:"var(--mute)", whiteSpace:"nowrap" }}>{when}</span>
                    <div>
                      <span className="mono" style={{ fontSize:9, padding:"1px 5px", border:`1px solid ${typeColor}`, color:typeColor, textTransform:"uppercase", letterSpacing:"0.08em", marginRight:6 }}>{evt.type || "event"}</span>
                      <span className="serif" style={{ fontSize:13 }}>{evt.title}</span>
                      {evt.detail && <div style={{ fontSize:11, color:"var(--ink-2)", marginTop:3, lineHeight:1.45 }}>{evt.detail}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </details>
        )}

        {purchaserRumor && (
          <div className="pd-community-ask" style={{ background:"rgba(180,134,56,0.10)", borderLeft:"3px solid var(--gold, #b48638)" }}>
            <div className="pd-community-ask-copy">
              <div className="mono pd-community-ask-label" style={{ color:"var(--gold-ink, #8a6520)" }}>
                {purchaserRumor.label || "Purchaser rumor"} · {purchaserRumor.status || "rumored"} · {purchaserRumor.source || "community intel"}
              </div>
              <div className="serif pd-community-ask-metric">{purchaserRumor.metric || "Price unknown"}</div>
              <p>{purchaserRumor.publicBody || purchaserRumor.body}</p>
              <p style={{ marginTop: 8, fontStyle: "italic" }}>{purchaserRumor.publicAsk || purchaserRumor.ask}</p>
              <div className="pd-community-ask-contact">
                Reported buyer: <strong>{purchaserRumor.buyer || "unknown"}</strong>. Help confirm the price, the corporate-entity name, and which blocks have actually changed hands. The Monitor's Report should clarify; community intel welcome before then.
              </div>
            </div>
            <div className="pd-community-ask-actions">
              {canOpenPublicThread && (
                <button
                  className="btn btn-dark"
                  onClick={() => openPointOnlyUpdate(
                    purchaserRumor.publicPrefill || purchaserRumor.prefill || `${prop.name} - purchase rumor: reported price, buyer entity, source, confidence level: `,
                    `${prop.name}: purchase rumor - price and land intel`
                  )}
                >
                  + Submit price intel
                </button>
              )}
            </div>
          </div>
        )}

        {communityAsk && (
          <div className="pd-community-ask">
            <div className="pd-community-ask-copy">
              <div className="mono pd-community-ask-label">{communityAsk.label || "Community evidence request"}</div>
              <div className="serif pd-community-ask-metric">{communityAsk.acres || "Acreage under review"}</div>
              <p>{communityAsk.body}</p>
            <div className="pd-community-ask-contact">
                Post quarter descriptions, owner/entity names, lease status, sale/listing reports, or field activity updates. Reviewed evidence can be promoted back into Monette.
              </div>
            </div>
            <div className="pd-community-ask-actions">
              {canOpenPublicThread && (
                <button
                  className="btn btn-dark"
                  onClick={() => openPointOnlyUpdate(
                    communityAsk.prefill || `${prop.name}: land update - source, legal description, and confidence level: `,
                    `${prop.name}: community land-location evidence`
                  )}
                >
                  + Submit Update
                </button>
              )}
            </div>
          </div>
        )}

        {!quarters.length && (
          <div style={{
            margin: "18px 28px",
            padding: 18,
            border: "1.5px dashed var(--gold)",
            background: "rgba(180,134,56,0.10)",
          }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold-ink)" }}>
              Needs community geometry
            </div>
            <div className="serif" style={{ fontSize: 30, lineHeight: 1.05, marginTop: 8 }}>
              Court-file asset, not parcel-mapped yet.
            </div>
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
              This record is backed by the court-file roster, but we do not yet have defensible quarter rows or parcel polygons. Until parcel mapping catches up, open a public evidence thread on Agnonymous so others can comment under it.
            </div>
            <div className="pd-point-only-explain">
              <div>
                <span className="mono">Where does this go?</span>
                <p>
                  The discussion opens on Agnonymous with this property context attached. It does not instantly change the Monette rollup; reviewed evidence can be promoted into the ticker or used to create parcel rows/status updates.
                </p>
              </div>
              <div>
                <span className="mono">Why no satellite data?</span>
                <p>
                  Satellite seeding analysis requires mapped quarter geometry. Without parcel rows, no per-parcel SAR change-detection can run. Evidence threads on Agnonymous help us map these blocks.
                </p>
              </div>
            </div>
            <div className="pd-imagery-grid" style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              color: "var(--ink-2)",
            }}>
              <span style={{ color: "var(--mute)" }}>Segment</span>
              <span>{prop.segment || "Not classified"}</span>
              <span style={{ color: "var(--mute)" }}>Legal owner</span>
              <span>{prop.legalOwner || "Pending"}</span>
              <span style={{ color: "var(--mute)" }}>Beneficial owner</span>
              <span>{prop.beneficialOwner || "Pending"}</span>
              <span style={{ color: "var(--mute)" }}>Map precision</span>
              <span>{prop.locationPrecision || "approximate"}</span>
            </div>
            {canOpenPublicThread && (
              <div className="pd-point-actions">
                <button
                  className="btn btn-dark"
                  onClick={() => openPointOnlyUpdate(
                    `${prop.name}: sale / returned-land report - source link, buyer or landlord if known, legal description or title reference, and confidence level: `,
                    `${prop.name}: report sold or returned land`
                  )}
                >
                  Report sold / returned
                </button>
                <button
                  className="btn"
                  onClick={() => openPointOnlyUpdate(
                    `${prop.name}: listing report - listing link, broker/contact if public, asking price if shown, and date seen: `,
                    `${prop.name}: report listing`
                  )}
                >
                  Report listing
                </button>
                <button
                  className="btn"
                  onClick={() => openPointOnlyUpdate(
                    `${prop.name}: parcel evidence - legal description, title screenshot details, map screenshot notes, or local boundary evidence: `,
                    `${prop.name}: submit parcel evidence`
                  )}
                >
                  Submit parcel evidence
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filter bar */}
        {!!quarters.length && <div className="pd-filter-bar" style={{
          display: "flex", gap: 8, padding: "10px 14px",
          borderBottom: "1px solid var(--rule)", background: "var(--paper)",
          alignItems: "center", flexWrap: "wrap",
        }}>
          <label htmlFor="pd-filter-loc" className="visually-hidden">Filter by quarter location</label>
          <input
            id="pd-filter-loc"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search loc (e.g. NW-26)…"
            aria-label="Filter by quarter location"
            style={{
              flex: "1 1 160px", minWidth: 140,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              padding: "6px 8px", border: "1px solid var(--rule-2)",
              background: "var(--paper-2)",
            }}
          />
          <label htmlFor="pd-filter-soil" className="visually-hidden">Filter by soil</label>
          <select id="pd-filter-soil" aria-label="Filter by soil" value={filterSoil} onChange={(e) => setFilterSoil(e.target.value)} style={{
            fontFamily: "inherit", fontSize: 11, padding: "6px 8px",
            border: "1px solid var(--rule-2)", background: "var(--paper-2)",
          }}>
            <option value="all">All soils</option>
            {availableSoils.map((s) => <option key={s} value={s}>Soil {s}</option>)}
          </select>
          <label htmlFor="pd-filter-status" className="visually-hidden">Filter by ownership or listing status</label>
          <select id="pd-filter-status" aria-label="Filter by ownership or listing status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{
            fontFamily: "inherit", fontSize: 11, padding: "6px 8px",
            border: "1px solid var(--rule-2)", background: "var(--paper-2)",
          }}>
            <option value="all">All status</option>
            <option value="owned">Monette owned</option>
            <option value="rented">Rented</option>
            <option value="sold">Sold / sale-leaseback</option>
            <option value="listed">Listed for sale</option>
          </select>
          <span className="pd-filter-count" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "var(--mute)" }}>
            {filtered.length} of {quarters.length}
          </span>
        </div>}

        {/* Column headers */}
        {!!quarters.length && <div className="pd-colheader" style={{
          display: "grid", gridTemplateColumns: "24px 170px 80px 1fr auto auto auto", gap: 12,
          padding: "10px 14px", borderBottom: "1.5px solid var(--ink)",
          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)",
        }}>
          <span>#</span>
          <span>Quarter</span>
          <span className="pd-hide-sm" style={{ textAlign: "right" }}>Acres</span>
          <span className="pd-hide-sm">Soil / Crop '25</span>
          <span>Mapped row</span>
          <span className="pd-hide-sm">Listing</span>
          <span>Season</span>
        </div>}

        {/* Quarter rows */}
        {visible.map((q, i) => (
          <div key={q.loc} ref={(el) => { if (el) rowRefs.current[q.loc] = el; }}>
            <QuarterRow
              propId={prop.id}
              q={q}
              i={i}
              onOpen={(loc) => {
                const nextLoc = openQ === loc ? null : loc;
                setOpenQ(nextLoc);
                if (onQuarterRouteChange) onQuarterRouteChange(prop.id, nextLoc);
              }}
              expanded={openQ === q.loc}
            />
          </div>
        ))}

        {!!quarters.length && filtered.length === 0 && (
          <div style={{
            padding: "18px 24px",
            borderTop: "1px solid var(--rule)",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--ink-2)",
          }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6 }}>
              No mapped quarter rows match this filter
            </div>
            {filterStatus === "rented" && currentLandStatus?.assumedRentedUnmappedAc ? (
              <div>
                <strong style={{ color: OWN["rented-monette"].color }}>{fmt(currentLandStatus.assumedRentedUnmappedAc)} ac is carried as rented/unmapped</strong> in the current working status, but no legal quarter descriptions are confirmed yet. Those acres stay out of the row list until they can be mapped.
              </div>
            ) : (
              <div>Try clearing the filters or switching back to all status.</div>
            )}
          </div>
        )}

        {visible.length < filtered.length && (
          <div className="pd-pagination" style={{
            padding: "14px 18px", textAlign: "center",
            borderTop: "1px dashed var(--rule-2)",
          }}>
            <button
              onClick={() => setVisibleCount((n) => n + DRAWER_PAGE_SIZE)}
              style={{
                padding: "10px 16px", fontSize: 12, fontFamily: "inherit",
                border: "1px solid var(--ink)", background: "transparent",
                cursor: "pointer", letterSpacing: "0.04em",
              }}
            >
              Load {Math.min(DRAWER_PAGE_SIZE, filtered.length - visible.length)} more ↓
              <span style={{ marginLeft: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)" }}>
                ({visible.length} of {filtered.length})
              </span>
            </button>
          </div>
        )}

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--rule)", fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: "var(--mute)" }}>
          {quarters.length
            ? currentLandStatus
              ? `Showing ${visible.length} of ${filtered.length} mapped rows (${quarters.length} total). Rented/unmapped acres are not listed until legal locations are confirmed.`
              : `Showing ${visible.length} of ${filtered.length} filtered (${quarters.length} total) · ${prop.parcels} titles in public registry.`
            : "No parcel rows yet. This file is waiting on community geometry or source documents."}
        </div>
      </div>
    </div>
  );
}

window.PropertyDrawer = PropertyDrawer;
