// VIEW 1 - Editorial. Investigation-style landing surface.
//
// Masthead -> live ticker -> hero headline -> known sale lead story ->
// "also in the file" cards -> full court-file ledger table -> disclaimer.
// Seeding progress and live vote feed have been removed in the satellite
// pivot 2026-04-29; seeding status is now satellite-driven.

const EditorialLeadMap = ({ prop, onOpen, eyebrow, ctaLabel = "open file ->" }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !window.mapboxgl) return;
    setPreviewError("");
    if (window.mapboxgl.supported && !window.mapboxgl.supported()) {
      setPreviewError("Map preview unavailable in this browser.");
      return;
    }
    window.mapboxgl.accessToken = window.MAPBOX_TOKEN;
    try {
      const map = new window.mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [prop.lng, prop.lat],
        zoom: 7.2,
        interactive: false,
        attributionControl: true,
      });
      mapRef.current = map;

      const el = document.createElement("div");
      el.style.width = "22px";
      el.style.height = "22px";
      el.style.borderRadius = "50%";
      el.style.background = "#9a3a2a";
      el.style.border = "2.5px solid #fffdf7";
      el.style.boxShadow = "0 0 0 2px #9a3a2a, 0 2px 6px rgba(0,0,0,0.25)";
      new window.mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([prop.lng, prop.lat])
        .addTo(map);
    } catch (error) {
      console.warn("editorial lead map unavailable:", error);
      setPreviewError("Map preview unavailable in this browser.");
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [prop.id]);

  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => onActionKey(e, onOpen)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${prop.name} file`}
      style={{ height: 420, border: "1px solid var(--ink)", position: "relative", cursor: "pointer", background: "var(--paper-2)", overflow: "hidden" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {previewError && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(245,241,234,0.92), rgba(236,230,219,0.92))",
          padding: 24,
          textAlign: "center",
        }}>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold-ink)" }}>
              Preview fallback
            </div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 10 }}>
              {prop.name}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)", maxWidth: 320 }}>
              {previewError} Open the property file for the title register and community rollup.
            </div>
          </div>
        </div>
      )}
      <div style={{
        position: "absolute",
        top: 12,
        left: 12,
        background: "rgba(255,253,247,0.94)",
        border: "1px solid var(--ink)",
        padding: "6px 10px",
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--mute)",
      }}>
        ● Filing · {prop.province} · {prop.region}
      </div>
      <div style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        background: "rgba(255,253,247,0.94)",
        border: "1px solid var(--ink)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}>
        <span className="serif" style={{ fontSize: 22, color: "#9a3a2a", lineHeight: 1 }}>{prop.name}</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)" }}>
          {ctaLabel}
        </span>
      </div>
    </div>
  );
};

const editorialNavButtonStyle = {
  color: "var(--mute)",
  cursor: "pointer",
  background: "transparent",
  border: "none",
  padding: 0,
  font: "inherit",
  letterSpacing: "inherit",
  textTransform: "inherit",
};

const EditorialView = ({ onSwitchView, onOpenHeadlineForm }) => {
  const [sel, setSel] = useState(null);
  const props = D.properties;
  const leadSale = (D.soldProperties || []).find((sale) => sale.id === "sold-stewart-valley");
  const leadProperty = props.find((p) => p.id === "swift-current") || props.find((p) => p.id === "vanguard");
  const headline = leadProperty;
  const secondary = props.filter((p) => p.headline && p.id !== leadProperty?.id);
  const provinceNames = { AB: "Alberta", SK: "Saskatchewan", MB: "Manitoba", BC: "British Columbia", MT: "Montana", CO: "Colorado", AZ: "Arizona" };
  const provinces = Object.entries(PORTFOLIO.byProvince)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, stats]) => [provinceNames[key] || key, stats]);

  const rollups = useMemo(() => {
    const map = {};
    props.forEach((p) => { map[p.id] = rollupProperty(p.id).rollup; });
    return map;
  }, [props]);
  const openAgnonymous = (payload = {}) => {
    if (window.openAgnonymousDiscussion) {
      window.openAgnonymousDiscussion(payload);
      return;
    }
    if (onOpenHeadlineForm) onOpenHeadlineForm(payload.body || "");
  };

  return (
    <div style={{ minHeight: "100%", background: "var(--paper)", color: "var(--ink)" }}>
      <div className="editorial-masthead" style={{ borderBottom: "2px solid var(--ink)", padding: "14px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="editorial-title-group" style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>The Monette Ledger</div>
          <div className="editorial-meta" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)", letterSpacing: "0.08em" }}>
            VOL. I · ISSUE 01 · APR 21, 2026 · CCAA DAY 0
          </div>
        </div>
        <div className="editorial-nav" style={{ display: "flex", gap: 18, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          <button onClick={() => onSwitchView && onSwitchView("list")} style={editorialNavButtonStyle}>Properties</button>
          <button onClick={() => onSwitchView && onSwitchView("map")} style={editorialNavButtonStyle}>Map</button>
          <span style={{ color: "var(--mute)" }}>Field notes</span>
          <span style={{ color: "var(--ink)", borderBottom: "1.5px solid var(--ink)" }}>Ledger</span>
        </div>
      </div>

      <HeadlineTicker onOpenSubmit={() => openAgnonymous({
        title: "Monette Ledger correction or clarification",
        body: "What should be corrected, clarified, or investigated? Add the property name, source link, and confidence level if you have them.",
        kind: "clarification",
      })} />

      <div className="ed-hero" style={{ padding: "48px 48px 28px", borderBottom: "1px solid var(--ink)" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 480px", gap: 48 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a3a2a", marginBottom: 20 }}>
              ● Filing date · Apr 21, 2026
            </div>
            <h1 className="serif" style={{ margin: 0, fontSize: 86, lineHeight: 0.95, letterSpacing: "-0.03em", fontWeight: 400 }}>
              {PORTFOLIO.farmedAcresLabel} acre footprint.<br />
              {fmt(PORTFOLIO.courtOwnedAcres)} owned acres in court file.<br />
              <span style={{ color: "var(--mute)" }}>{fmt(PORTFOLIO.totalMappedParcels)} parcel rows live.</span>
            </h1>
            <div style={{ marginTop: 26, fontSize: 16, lineHeight: 1.55, maxWidth: 640, color: "var(--ink-2)" }}>
              Monette Farms Ltd. entered creditor protection under the CCAA on April 21, 2026. The Ledger separates the court-file roster from the parcel-mapped satellite layer: {PORTFOLIO.totalProperties} property records, {PORTFOLIO.mappedPropertyCount} parcel-mapped records, {PORTFOLIO.syntheticPropertyCount} synthetic fallback record, and {PORTFOLIO.pointOnlyPropertyCount} point-only records waiting on better geometry.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => onSwitchView && onSwitchView("list")} className="btn btn-dark">Browse properties -></button>
              <button onClick={() => onSwitchView && onSwitchView("map")} className="btn">Explore the atlas -></button>
              <button onClick={() => openAgnonymous({
                title: "Monette Ledger correction or evidence thread",
                body: "Add the property, claim, source link, and confidence level. If this should change the controlled Monette record, say exactly what should change.",
                kind: "clarification",
              })} className="btn">+ Submit Update</button>
            </div>
          </div>
          <div>
            <div className="prov-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
              {provinces.map(([name, stats]) => (
                <div key={name} style={{ borderTop: "1px solid var(--ink)", paddingTop: 10 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>{name}</div>
                  <div className="serif" style={{ fontSize: 38, lineHeight: 1, marginTop: 4 }}>
                    {fmt(stats.totalAcres)}<span style={{ fontSize: 11, color: "var(--mute)", marginLeft: 4 }}>ac</span>
                  </div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>{stats.properties} prop.</span>
                    <span>{stats.pctOwned}% owned</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: "18px 20px", background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 10 }}>
                Verified observations + corrections
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)", margin: "0 0 14px" }}>
                Submit verified field observations, legal-description corrections, and source-cited rumors through agnonymous.buperac.com — the single intake channel for all tips.
              </p>
              <a
                href={window.AGNONYMOUS_URL || "https://agnonymous.buperac.com"}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-dark"
                style={{ display: "inline-block" }}
              >
                agnonymous.buperac.com →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Reader-support card placed ABOVE the Stewart Valley lead-sale. */}
      <div className="editorial-support-wrap editorial-support-wrap-mid">
        <SupportCard
          headline="Built by hand, one quarter-section at a time."
          sub="Title-record digging, court-file extraction, and the parcel atlas all take real time. If this work is useful to you, chip in, it is appreciated."
          signoff="~bushels"
        />
      </div>

      <div style={{ padding: "40px 48px", borderBottom: "1px solid var(--ink)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>
            Lead · {headline.region}
          </div>
          <div className="serif" style={{ fontSize: 52, lineHeight: 1, marginTop: 10, letterSpacing: "-0.02em" }}>
            Stewart Valley set a <span style={{ color: "#9a3a2a" }}>real sale marker</span>.
          </div>
          <div style={{ marginTop: 20, fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
            Court materials say the Swift Current-area Stewart Valley Farm sold in March 2026 for {leadSale ? (leadSale.priceLabel || fmtM(leadSale.price)) : "$54.08M"} across {leadSale ? fmt(leadSale.acres) : "12,932"} acres. The filing materials also describe the result as 158% over the 2025 appraisal. That is a hard transaction, not a rumour, and it is the right anchor for the community map.
          </div>
          <div className="sale-lead-actions">
            <button onClick={() => leadProperty && setSel(leadProperty)} className="btn btn-dark">Open Swift Current file -></button>
            <button onClick={() => onSwitchView && leadProperty && onSwitchView("map", leadProperty.id)} className="btn">View on status map</button>
          </div>
          <div className="sale-lead-card">
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 8 }}>
              Community rollup · {rollups[headline.id].total} quarter rows
            </div>
            <div className="sale-fact-grid">
              <div className="sale-fact-card">
                <span>Price</span>
                <strong>{leadSale ? (leadSale.priceLabel || fmtM(leadSale.price)) : "$54.08M"}</strong>
              </div>
              <div className="sale-fact-card">
                <span>Acres</span>
                <strong>{leadSale ? fmt(leadSale.acres) : "12,932"}</strong>
              </div>
              <div className="sale-fact-card">
                <span>Closed</span>
                <strong>{leadSale ? leadSale.closed : "Mar 2026"}</strong>
              </div>
              <div className="sale-fact-card">
                <span>Vs 2025 appraisal</span>
                <strong>+158%</strong>
              </div>
            </div>
            <div className="sale-source-note mono">
              Price per acre is held off the public card until the court-record acreage and price-per-acre math is reconciled.
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 14 }}>
            Map · {headline.rms[0]}
          </div>
          <EditorialLeadMap
            prop={leadSale || leadProperty}
            onOpen={() => leadProperty && setSel(leadProperty)}
            eyebrow="Known sale - SK - Swift Current"
            ctaLabel="open Swift Current file ->"
          />
        </div>
      </div>

      <div style={{ padding: "36px 48px", borderBottom: "1px solid var(--ink)" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 18 }}>
          Also in the file
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
          {secondary.map((p) => {
            const openProperty = () => setSel(p);
            return (
              <article
                key={p.id}
                onClick={openProperty}
                onKeyDown={(e) => onActionKey(e, openProperty)}
                role="button"
                tabIndex={0}
                aria-label={`Open ${p.name} file`}
                style={{ cursor: "pointer", borderTop: "1px solid var(--ink)", paddingTop: 14 }}
              >
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>{p.province} · {p.region}</div>
                <div className="serif" style={{ fontSize: 32, lineHeight: 1, margin: "10px 0", letterSpacing: "-0.01em" }}>{p.name}</div>
                <div style={{ marginTop: 8 }}><RollupBar rollup={rollups[p.id]} /></div>
                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>{p.notes}</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "var(--mute)", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <span>{fmt(p.titled)} ac</span>
                  <span>{p.parcels} titles</span>
                  <span>{fmtM(p.assessment)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "36px 48px", borderBottom: "1px solid var(--ink)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>
            The full ledger · {props.length} property records
          </div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "var(--mute)" }}>Click to open files</div>
        </div>
        <div className="ed-ledger-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
              {["Property", "Prov", "File ac", "Titles", "Owned", "Sold", "Rented", "For sale", "Rollup"].map((heading) => (
                <th key={heading} style={{
                  padding: "10px 8px",
                  color: "var(--mute)",
                  fontWeight: 500,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  textAlign: ["File ac", "Titles", "Owned", "Sold", "Rented", "For sale"].includes(heading) ? "right" : "left",
                }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.map((p) => {
              const rollup = rollups[p.id];
              const openProperty = () => setSel(p);
              return (
                <tr
                  key={p.id}
                  onClick={openProperty}
                  onKeyDown={(e) => onActionKey(e, openProperty)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${p.name} file`}
                  style={{ borderBottom: "1px dashed var(--rule-2)", cursor: "pointer" }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "var(--paper-2)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "12px 8px" }}>
                    <span className="serif" style={{ fontSize: 20 }}>{p.name}</span>
                    <div className="mono" style={{ fontSize: 9, color: rollup.total ? "var(--gold-ink)" : "#9a3a2a", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>
                      {rollup.total ? `${rollup.total} rows` : "point-only"}
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px", color: "var(--mute)", fontFamily: '"JetBrains Mono", monospace' }}>{p.province}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace' }}>{fmt(p.titled)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: "var(--mute)" }}>{p.parcels || "pending"}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: OWN["owned-monette"].color }}>{rollup.owned}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: OWN.sold.color }}>{rollup.sold}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: OWN["rented-monette"].color }}>{rollup.rented}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: LIST["listed-for-sale"].color }}>{rollup.forSale}</td>
                  <td style={{ padding: "12px 8px", width: 100 }}><RollupBar rollup={rollup} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div style={{ padding: "32px 48px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
        An independent, satellite-assisted tracker. Not affiliated with Monette Farms, the Monitor, or the courts. Court-file acreage, mapped quarter rows, point-only assets, title counts, and satellite observations are labeled separately so public claims stay auditable.
      </div>

      <PropertyDrawer
        prop={sel}
        onClose={() => setSel(null)}
        onZoomMap={(p) => {
          setSel(null);
          if (onSwitchView) onSwitchView("map", p.id);
        }}
        onOpenHeadlineForm={onOpenHeadlineForm}
      />
    </div>
  );
};

window.EditorialView = EditorialView;
