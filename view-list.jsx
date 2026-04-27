// VIEW 2 - Register. Operator-facing asset table with real sorting and
// export, plus the shared moderated update queue.

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadRegisterCsv(rows) {
  const header = [
    "property_id",
    "property",
    "province",
    "region",
    "segment",
    "beneficial_owner",
    "geometry_status",
    "titles",
    "quarter_rows",
    "file_acres",
    "owned_acres",
    "rented_acres",
    "assessed_value",
    "sold_quarters",
    "for_sale_quarters",
    "seeded_quarters",
    "sprayed_quarters",
    "crop_2025",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) => ([
      row.id,
      row.name,
      row.province,
      row.region,
      row.segment || "",
      row.beneficialOwner || "",
      row.coverageStatus,
      row.parcels,
      row.mappedQuarters,
      row.titled,
      row.owned,
      row.rented,
      row.assessment,
      row.sold,
      row.forSale,
      row.seeded,
      row.sprayed,
      row.crop25,
    ].map(escapeCsvCell).join(","))),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `monette-register-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const REGISTER_SORTERS = {
  name: (row) => row.name,
  province: (row) => row.province,
  parcels: (row) => row.parcels,
  mappedQuarters: (row) => row.mappedQuarters,
  titled: (row) => row.titled,
  owned: (row) => row.owned,
  rented: (row) => row.rented,
  sold: (row) => row.sold,
  forSale: (row) => row.forSale,
  seeded: (row) => row.seeded,
  sprayed: (row) => row.sprayed,
  crop25: (row) => row.crop25 || "",
};

function compareRegisterRows(a, b, sortKey, dir) {
  const accessor = REGISTER_SORTERS[sortKey];
  if (!accessor) return 0;

  const av = accessor(a);
  const bv = accessor(b);

  if (typeof av === "string" || typeof bv === "string") {
    return av.toString().localeCompare(bv.toString(), "en-CA") * dir;
  }

  return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
}

const ListView = ({ onSwitchView, onOpenHeadlineForm }) => {
  const [sel, setSel] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "titled", dir: -1 });
  const openAgnonymous = () => {
    if (window.openAgnonymousDiscussion) {
      window.openAgnonymousDiscussion({
        title: "Monette asset register correction",
        body: "What register row, acreage, ownership status, listing status, or source note should be corrected? Include the property name and source link if available.",
        kind: "clarification",
      });
      return;
    }
    if (onOpenHeadlineForm) onOpenHeadlineForm("");
  };
  const talliesVersion = useTalliesVersion();

  const rows = useMemo(() => (
    D.properties.map((property) => {
      const rollup = rollupProperty(property.id).rollup;
      const coverageStatus = rollup.total
        ? (rollup.total > 0 && (property.geometryStatus === "partial" ? "partial geometry" : "parcel rows"))
        : "point-only";
      return {
        ...property,
        rollup,
        mappedQuarters: rollup.total,
        coverageStatus,
        sold: rollup.sold,
        forSale: rollup.forSale,
        seeded: rollup.seeded,
        sprayed: rollup.sprayed,
        crop25: property.crops2025 && property.crops2025[0] ? property.crops2025[0][0] : "",
      };
    })
  ), [talliesVersion]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => (
      `${row.name} ${row.region} ${row.province}`.toLowerCase().includes(needle)
    ));
  }, [query, rows]);

  const visibleRows = useMemo(() => (
    [...filteredRows].sort((a, b) => compareRegisterRows(a, b, sort.key, sort.dir))
  ), [filteredRows, sort]);

  const toggleSort = (key) => {
    setSort((prev) => (
      prev.key === key
        ? { key, dir: -prev.dir }
        : { key, dir: -1 }
    ));
  };

  const totals = visibleRows.reduce((acc, row) => ({
    titled: acc.titled + row.titled,
    owned: acc.owned + row.owned,
    rented: acc.rented + row.rented,
    parcels: acc.parcels + row.parcels,
    mappedQuarters: acc.mappedQuarters + row.mappedQuarters,
    assessment: acc.assessment + row.assessment,
    pointOnly: acc.pointOnly + (row.mappedQuarters ? 0 : 1),
  }), {
    titled: 0,
    owned: 0,
    rented: 0,
    parcels: 0,
    mappedQuarters: 0,
    assessment: 0,
    pointOnly: 0,
  });

  const columns = [
    { label: "#", align: "left" },
    { label: "Property", key: "name", align: "left" },
    { label: "Prov", key: "province", align: "left" },
    { label: "Titles", key: "parcels", align: "right" },
    { label: "Rows", key: "mappedQuarters", align: "right" },
    { label: "File ac", key: "titled", align: "right" },
    { label: "Owned", key: "owned", align: "right" },
    { label: "Rented", key: "rented", align: "right" },
    { label: "Sold q", key: "sold", align: "right" },
    { label: "For sale q", key: "forSale", align: "right" },
    { label: "Seeded q", key: "seeded", align: "right" },
    { label: "Sprayed q", key: "sprayed", align: "right" },
    { label: "2025", key: "crop25", align: "left" },
    { label: "Rollup", align: "left" },
  ];

  return (
    <div style={{ minHeight: "100%", background: "var(--paper)", fontSize: 13 }}>
      <div style={{
        padding: "20px 32px",
        borderBottom: "1px solid var(--ink)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
          <div className="serif" style={{ fontSize: 26 }}>Monette Register</div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--mute)" }}>
            CCAA DAY 0 · APR 21, 2026 · ASSET REGISTER
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label htmlFor="register-search" className="visually-hidden">Search properties</label>
          <input
            id="register-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties..."
            aria-label="Search properties"
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              padding: "8px 10px",
              border: "1px solid var(--rule-2)",
              background: "var(--paper)",
              width: 240,
            }}
          />
          <button className="btn" onClick={() => downloadRegisterCsv(visibleRows)}>
            Export CSV
          </button>
          <button className="btn btn-dark" onClick={openAgnonymous}>
            + Submit Update
          </button>
        </div>
      </div>

      <HeadlineTicker onOpenSubmit={openAgnonymous} />

      <div style={{
        padding: "16px 32px",
        background: "var(--paper-2)",
        borderBottom: "1px solid var(--ink)",
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        gap: 24,
      }}>
        {[
          ["Properties", visibleRows.length],
          ["Titles", fmt(totals.parcels)],
          ["Quarter rows", fmt(totals.mappedQuarters)],
          ["Point-only", fmt(totals.pointOnly)],
          ["Row ac", fmt(totals.titled)],
          ["Owned ac", fmt(totals.owned)],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>
              {label}
            </div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mono" style={{
        padding: "10px 32px",
        borderBottom: "1px solid var(--rule)",
        background: "rgba(180,134,56,0.10)",
        color: "var(--ink-2)",
        fontSize: 11,
      }}>
        Court-file owned total: {fmt(PORTFOLIO.courtOwnedAcres)} ac. Register row acres are source-specific records and should not be treated as a single audited portfolio sum.
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--ink)" }}>
              {columns.map((column) => (
                <th
                  key={column.label}
                  onClick={() => column.key && toggleSort(column.key)}
                  style={{
                    padding: "10px 8px",
                    textAlign: column.align,
                    color: "var(--mute)",
                    cursor: column.key ? "pointer" : "default",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  {column.label}
                  {sort.key === column.key && (
                    <span style={{ marginLeft: 4, color: "var(--ink)" }}>
                      {sort.dir === 1 ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${row.name}`}
                onClick={() => setSel(row)}
                onKeyDown={(e) => onActionKey(e, () => setSel(row))}
                style={{ borderBottom: "1px solid var(--rule)", cursor: "pointer" }}
                onMouseOver={(e) => { e.currentTarget.style.background = "var(--paper-2)"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = ""; }}
              >
                <td style={{ padding: "10px 8px", fontFamily: '"JetBrains Mono", monospace', color: "var(--mute)" }}>
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td style={{ padding: "10px 8px" }}>
                  <div style={{ fontWeight: 500 }}>{row.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--mute)" }}>{row.region}</div>
                  <div className="mono" style={{ fontSize: 9, color: row.mappedQuarters ? "var(--gold-ink)" : "#9a3a2a", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {row.coverageStatus}
                  </div>
                </td>
                <td style={{ padding: "10px 8px", fontFamily: '"JetBrains Mono", monospace' }}>{row.province}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace' }}>{row.parcels ? fmt(row.parcels) : "pending"}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: "var(--mute)" }}>{fmt(row.mappedQuarters)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace' }}>{fmt(row.titled)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace' }}>{fmt(row.owned)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: "var(--mute)" }}>{fmt(row.rented)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: OWN.sold.color }}>{row.sold}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: LIST["listed-for-sale"].color }}>{row.forSale}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: "#4e6a30" }}>{row.seeded}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: "#b48638" }}>{row.sprayed}</td>
                <td style={{ padding: "10px 8px" }}>{row.crop25 || "-"}</td>
                <td style={{ padding: "10px 8px", width: 110 }}><RollupBar rollup={row.rollup} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PropertyDrawer
        prop={sel}
        onClose={() => setSel(null)}
        onZoomMap={(property) => {
          setSel(null);
          if (onSwitchView) onSwitchView("map", property.id);
        }}
        onOpenHeadlineForm={onOpenHeadlineForm}
      />
    </div>
  );
};

window.ListView = ListView;
