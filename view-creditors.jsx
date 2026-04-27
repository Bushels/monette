// VIEW - Creditors. Story-driven walk through the FTI creditor listing.
//
// Structure (top -> bottom):
//   1. Hero with single dominant number
//   2. The Stack -- horizontal layered bars showing the priority order
//      (secured banks first, then unsecured CAD, then unsecured USD).
//      Every creditor is a clickable segment within their layer.
//   3. Treemap -- every creditor as a rectangle sized by balance, colored
//      by industry. Currency toggle between CAD and USD.
//   4. Map -- Mapbox markers for every city that's owed money, sized by
//      total balance. Hometown search snaps the camera.
//   5. Industry breakdown -- horizontal bars by industry.
//   6. Full creditor table -- searchable, sortable, paginated.
//   7. Methodology footnote.

const CREDITOR_DATA = window.MONETTE_CREDITORS || {
  source: {},
  summary: { rowCount: 0, totalsByClaim: {}, debtorTotals: [], cityTotals: [] },
  rows: [],
};

const CREDITORS_ROWS = Array.isArray(CREDITOR_DATA.rows) ? CREDITOR_DATA.rows : [];
const CITY_TOTALS = Array.isArray(CREDITOR_DATA.summary?.cityTotals)
  ? CREDITOR_DATA.summary.cityTotals
  : [];
const CURRENCY_LABELS = { CDN: "CAD", USD: "USD" };
const DEFAULT_CREDITOR_LIMIT = 25;

// Industry color palette -- earthy, prairie-toned. Each creditor's industry
// drives the segment fill in The Stack and the treemap, so the colors need
// to be distinguishable but not garish.
const INDUSTRY_COLORS = {
  "Banking & secured finance": "#6e3b1f",
  "Equipment finance & leases": "#8c5a2c",
  "Crop inputs, seed & fertilizer": "#3f6a32",
  "Equipment, parts & machinery": "#a26739",
  "Fuel, energy & utilities": "#b78628",
  "Irrigation, water & infrastructure": "#3d7a8c",
  "Construction & trades": "#7a5237",
  "Livestock, feed & veterinary": "#9a3a2a",
  "Produce, packing & cold chain": "#558b3a",
  "Legal, accounting & advisory": "#4f4a44",
  "Government, taxes & regulators": "#5e5447",
  "Technology, software & communications": "#2f6b6e",
  "Insurance, travel & administration": "#6b4f7a",
  "General supplies & site services": "#8a7a4f",
  "Land, rent & real estate": "#3d5a3a",
  "Farms, gardens & custom operators": "#7c8a3d",
  "Other business services": "#5e5447",
};

const INDUSTRY_FALLBACK_COLOR = "#5e5447";
const industryColor = (industry) => INDUSTRY_COLORS[industry] || INDUSTRY_FALLBACK_COLOR;

function formatCreditorMoney(value, currency) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString("en-CA", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "CAD",
    maximumFractionDigits: 2,
  })} ${currency || ""}`;
}

function formatCompactCreditorMoney(value, currency) {
  const amount = Number(value) || 0;
  const prefix = currency === "USD" ? "US$" : "$";
  if (Math.abs(amount) >= 1000000) return `${prefix}${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `${prefix}${(amount / 1000).toFixed(0)}K`;
  return `${prefix}${Math.round(amount).toLocaleString("en-CA")}`;
}

function creditorSearchText(row) {
  return [
    row.creditor,
    row.debtor,
    row.debtorLabel,
    row.industry,
    row.claimType,
    row.currency,
    row.country,
    row.province,
    row.provinceState,
    row.city,
    row.postalCode,
    row.raw,
  ].filter(Boolean).join(" ").toLowerCase();
}

function escapeCreditorCsv(value) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCreditorsCsv(rows) {
  const header = [
    "creditor",
    "debtor",
    "claim_type",
    "industry",
    "currency",
    "balance",
    "city",
    "country",
    "province_or_state",
    "source_page",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) => ([
      row.creditor,
      row.debtor,
      row.claimType,
      row.industry,
      row.currency,
      row.balance,
      row.city || "",
      row.country || "",
      row.provinceState || row.province || "",
      row.sourcePage,
    ].map(escapeCreditorCsv).join(","))),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `monette-creditors-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const CREDITORS_SORTERS = {
  balance: (row) => row.balance,
  creditor: (row) => row.creditor || "",
  debtor: (row) => row.debtorLabel || row.debtor || "",
  industry: (row) => row.industry || "",
  claimType: (row) => row.claimType || "",
  country: (row) => row.country || "",
  provinceState: (row) => row.provinceState || row.province || "",
  city: (row) => row.city || "",
  currency: (row) => row.currency || "",
};

function compareCreditorRows(a, b, sortKey, dir) {
  const accessor = CREDITORS_SORTERS[sortKey] || CREDITORS_SORTERS.balance;
  const av = accessor(a);
  const bv = accessor(b);
  if (typeof av === "string" || typeof bv === "string") {
    return String(av).localeCompare(String(bv), "en-CA") * dir;
  }
  return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
}

// ---------------------------------------------------------------------------
// The Stack -- 3 horizontal layers (Secured CAD, Unsecured CAD, Unsecured USD).
// Each row inside a layer is sized by its share of THAT layer's total, so
// the largest creditors visually dominate. Tiny creditors collapse into a
// single "...and N more" tail segment on the right.
// ---------------------------------------------------------------------------

function buildStackLayers() {
  const layers = [
    {
      key: "secured-cad",
      claimType: "Secured",
      currency: "CDN",
      title: "1. Secured creditors  /  CAD",
      subtitle: "Banks and lenders ahead of everyone else",
    },
    {
      key: "unsecured-cad",
      claimType: "Unsecured",
      currency: "CDN",
      title: "2. Unsecured creditors  /  CAD",
      subtitle: "Suppliers, landlords, custom operators",
    },
    {
      key: "unsecured-usd",
      claimType: "Unsecured",
      currency: "USD",
      title: "3. Unsecured creditors  /  USD",
      subtitle: "U.S. produce, packing, services",
    },
  ];

  return layers.map((layer) => {
    const matched = CREDITORS_ROWS
      .filter((row) => row.claimType === layer.claimType && row.currency === layer.currency)
      .sort((a, b) => b.balance - a.balance);
    const total = matched.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);
    // Largest segments shown individually; long tail merged.
    const TAIL_THRESHOLD = 0.005; // segments under 0.5% are absorbed into the tail
    const visible = [];
    const tail = [];
    for (const row of matched) {
      const share = total > 0 ? row.balance / total : 0;
      if (share >= TAIL_THRESHOLD || visible.length < 6) {
        visible.push({ ...row, share });
      } else {
        tail.push(row);
      }
    }
    const tailBalance = tail.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);
    const tailShare = total > 0 ? tailBalance / total : 0;
    return {
      ...layer,
      total,
      rowCount: matched.length,
      segments: visible,
      tail: tail.length
        ? { count: tail.length, balance: tailBalance, share: tailShare, rows: tail }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Treemap -- "every creditor as a rectangle". We use a simple slice-and-dice
// layout because we don't want to pull in a graph library. With one massive
// outlier (Scotia $830M) and a long tail, slice-and-dice is actually the
// right call -- it gives Scotia a giant tile and packs the tail as readable
// rows below.
// ---------------------------------------------------------------------------

function squarifyTreemap(items, width, height) {
  const total = items.reduce((acc, item) => acc + (item.value || 0), 0);
  if (total <= 0 || items.length === 0) return [];

  // Normalize: convert each item.value to area-fraction of the rectangle.
  const totalArea = width * height;
  const scaled = items.map((item) => ({
    ...item,
    area: ((item.value || 0) / total) * totalArea,
  }));

  const tiles = [];
  const layout = (entries, x, y, w, h) => {
    if (!entries.length || w <= 0 || h <= 0) return;
    if (entries.length === 1) {
      tiles.push({ ...entries[0], x, y, w, h });
      return;
    }
    // Squarified-lite: split entries into two groups whose total areas roughly
    // match the box's split along its longer dimension, then recurse.
    const totalThis = entries.reduce((acc, item) => acc + item.area, 0);
    const splitAlongWidth = w >= h;
    let acc = 0;
    let splitIndex = 0;
    const target = totalThis / 2;
    for (let i = 0; i < entries.length; i += 1) {
      acc += entries[i].area;
      if (acc >= target) {
        splitIndex = i + 1;
        break;
      }
    }
    splitIndex = Math.min(Math.max(splitIndex, 1), entries.length - 1);
    const leftEntries = entries.slice(0, splitIndex);
    const rightEntries = entries.slice(splitIndex);
    const leftArea = leftEntries.reduce((s, item) => s + item.area, 0);
    if (splitAlongWidth) {
      const leftW = (leftArea / totalThis) * w;
      layout(leftEntries, x, y, leftW, h);
      layout(rightEntries, x + leftW, y, w - leftW, h);
    } else {
      const leftH = (leftArea / totalThis) * h;
      layout(leftEntries, x, y, w, leftH);
      layout(rightEntries, x, y + leftH, w, h - leftH);
    }
  };
  layout(scaled, 0, 0, width, height);
  return tiles;
}

function buildTreemapItems(rows, currency, scope) {
  // scope: "unsecured" (default -- trade creditor story) or "all" (includes
  // the Scotia-sized secured outliers). The secured tier is so dominated by
  // a single $829M facility that mixing it in collapses every supplier into
  // a 1-pixel sliver. We default to unsecured so the treemap actually does
  // its job of showing the supplier landscape.
  const filtered = rows
    .filter((row) => row.currency === currency)
    .filter((row) => (scope === "all" ? true : row.claimType === "Unsecured"))
    .sort((a, b) => b.balance - a.balance);
  return filtered.map((row) => ({
    id: row.id,
    label: row.creditor,
    industry: row.industry,
    city: row.city,
    provinceState: row.provinceState,
    country: row.country,
    claimType: row.claimType,
    debtorLabel: row.debtorLabel,
    currency: row.currency,
    value: Number(row.balance) || 0,
    balance: Number(row.balance) || 0,
  }));
}

// ---------------------------------------------------------------------------
// Map data -- aggregates city totals into Mapbox-ready GeoJSON. Marker
// radius scales with sqrt(balance) so giant amounts don't crush small towns
// off the map; tiny towns still need to be findable for the "hometown" feel.
// ---------------------------------------------------------------------------

function buildCitiesGeojson(cities) {
  return {
    type: "FeatureCollection",
    features: cities
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
      .map((c) => ({
        type: "Feature",
        properties: {
          city: c.city,
          provinceState: c.provinceState,
          country: c.country,
          creditorCount: c.creditorCount,
          balanceCDN: c.balanceCDN,
          balanceUSD: c.balanceUSD,
          totalUsdEquivalent: c.balanceCDN + c.balanceUSD, // rough size signal
          topIndustry: c.topIndustry,
        },
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      })),
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function CreditorHeroStat({ label, value, sub }) {
  return (
    <div className="creditors-hero-stat">
      <span className="mono">{label}</span>
      <strong>{value}</strong>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function StackLayer({ layer, onSelect, activeFilter }) {
  if (!layer.segments.length) return null;
  return (
    <div className="creditors-stack-layer">
      <div className="creditors-stack-head">
        <div>
          <strong>{layer.title}</strong>
          <span>{layer.subtitle}</span>
        </div>
        <div className="creditors-stack-total">
          {formatCompactCreditorMoney(layer.total, layer.currency)} {CURRENCY_LABELS[layer.currency]}
          <em>{fmt(layer.rowCount)} creditors</em>
        </div>
      </div>
      <div className="creditors-stack-bar" role="list" aria-label={`${layer.title} creditors`}>
        {layer.segments.map((seg) => {
          const widthPct = Math.max(seg.share * 100, 1.6);
          const isActive = activeFilter && activeFilter.creditor === seg.creditor;
          return (
            <button
              key={seg.id}
              type="button"
              role="listitem"
              className={`creditors-stack-seg${isActive ? " is-active" : ""}`}
              style={{
                flexGrow: widthPct,
                background: industryColor(seg.industry),
              }}
              onClick={() => onSelect({
                claimType: layer.claimType,
                currency: layer.currency,
                creditor: seg.creditor,
              })}
              title={`${seg.creditor} — ${formatCreditorMoney(seg.balance, seg.currency)} — ${seg.city || seg.provinceState || ""}`}
            >
              <span className="creditors-stack-seg-label">
                <strong>{seg.creditor}</strong>
                <em>
                  {formatCompactCreditorMoney(seg.balance, seg.currency)}
                  {seg.city ? ` · ${seg.city}` : ""}
                </em>
              </span>
            </button>
          );
        })}
        {layer.tail ? (
          <button
            type="button"
            className="creditors-stack-seg is-tail"
            style={{ flexGrow: Math.max(layer.tail.share * 100, 1.6) }}
            onClick={() => onSelect({
              claimType: layer.claimType,
              currency: layer.currency,
              creditor: null,
            })}
            title={`${fmt(layer.tail.count)} smaller creditors totalling ${formatCompactCreditorMoney(layer.tail.balance, layer.currency)}`}
          >
            <span className="creditors-stack-seg-label">
              <strong>+ {fmt(layer.tail.count)} more</strong>
              <em>{formatCompactCreditorMoney(layer.tail.balance, layer.currency)}</em>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TreemapView({ items, currency, hovered, onHover, onSelect }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 460 });

  useEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(rect.width, 200);
      const h = Math.max(Math.min(rect.width * 0.55, 560), 320);
      setSize({ w, h });
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const tiles = useMemo(
    () => squarifyTreemap(items, size.w, size.h),
    [items, size.w, size.h],
  );

  return (
    <div ref={ref} className="creditors-treemap" style={{ height: size.h }}>
      <svg width={size.w} height={size.h} role="img" aria-label="Creditor treemap">
        {tiles.map((tile) => {
          const fill = industryColor(tile.industry);
          const isHovered = hovered === tile.id;
          // Show label only if tile is large enough to fit text.
          const minLabel = tile.w > 88 && tile.h > 36;
          const minAmount = tile.w > 70 && tile.h > 22;
          return (
            <g
              key={tile.id}
              className={`creditors-tm-tile${isHovered ? " is-hovered" : ""}`}
              onMouseEnter={() => onHover(tile.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(tile)}
            >
              <rect
                x={tile.x}
                y={tile.y}
                width={Math.max(tile.w - 1, 0)}
                height={Math.max(tile.h - 1, 0)}
                fill={fill}
                stroke="rgba(255,253,247,0.65)"
                strokeWidth={isHovered ? 2 : 0.5}
              />
              {minLabel ? (
                <foreignObject
                  x={tile.x + 6}
                  y={tile.y + 4}
                  width={Math.max(tile.w - 12, 0)}
                  height={Math.max(tile.h - 8, 0)}
                >
                  <div className="creditors-tm-label">
                    <strong>{tile.label}</strong>
                    <em>
                      {formatCompactCreditorMoney(tile.balance, currency)}
                      {tile.city ? ` · ${tile.city}` : ""}
                    </em>
                  </div>
                </foreignObject>
              ) : minAmount ? (
                <foreignObject
                  x={tile.x + 4}
                  y={tile.y + 2}
                  width={Math.max(tile.w - 8, 0)}
                  height={Math.max(tile.h - 4, 0)}
                >
                  <div className="creditors-tm-label is-tight">
                    <em>{formatCompactCreditorMoney(tile.balance, currency)}</em>
                  </div>
                </foreignObject>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CreditorsMap({ cities, focusCity, onSelectCity, currency }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !window.mapboxgl) return undefined;
    if (window.mapboxgl.supported && !window.mapboxgl.supported()) {
      setError("Map unavailable in this browser.");
      return undefined;
    }
    window.mapboxgl.accessToken = window.MAPBOX_TOKEN;
    let cancelled = false;
    try {
      const map = new window.mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-106, 52], // centred over Saskatchewan
        zoom: 3.6,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      const popup = new window.mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: "creditors-map-popup",
      });
      popupRef.current = popup;

      map.on("load", () => {
        if (cancelled) return;
        const geojson = buildCitiesGeojson(cities);
        map.addSource("creditors-cities", {
          type: "geojson",
          data: geojson,
        });

        // Sized circle layer: log-ish scaling so Toronto's $850M doesn't
        // explode while small prairie towns stay visible.
        map.addLayer({
          id: "creditors-cities-glow",
          type: "circle",
          source: "creditors-cities",
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["sqrt", ["get", "totalUsdEquivalent"]],
              0, 5,
              200, 7,
              2000, 10,
              20000, 14,
              200000, 22,
              2000000, 32,
              30000000, 46,
            ],
            "circle-color": "#9a3a2a",
            "circle-opacity": 0.18,
            "circle-blur": 0.6,
          },
        });
        map.addLayer({
          id: "creditors-cities-core",
          type: "circle",
          source: "creditors-cities",
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["sqrt", ["get", "totalUsdEquivalent"]],
              0, 3,
              200, 4,
              2000, 5,
              20000, 7,
              200000, 11,
              2000000, 16,
              30000000, 22,
            ],
            "circle-color": "#9a3a2a",
            "circle-stroke-color": "#fffdf7",
            "circle-stroke-width": 1.2,
            "circle-opacity": 0.92,
          },
        });

        const showPopup = (feature) => {
          const props = feature.properties || {};
          const cad = Number(props.balanceCDN || 0);
          const usd = Number(props.balanceUSD || 0);
          const html = `
            <div class="cmp-row"><strong>${props.city}</strong><span>${props.provinceState}, ${props.country}</span></div>
            <div class="cmp-row"><span>${props.creditorCount} creditor${props.creditorCount === 1 ? "" : "s"}</span></div>
            ${cad > 0 ? `<div class="cmp-row mono"><span>CAD</span><strong>${formatCompactCreditorMoney(cad, "CDN")}</strong></div>` : ""}
            ${usd > 0 ? `<div class="cmp-row mono"><span>USD</span><strong>${formatCompactCreditorMoney(usd, "USD")}</strong></div>` : ""}
            ${props.topIndustry ? `<div class="cmp-row"><em>${props.topIndustry}</em></div>` : ""}
          `;
          popup.setLngLat(feature.geometry.coordinates).setHTML(html).addTo(map);
        };

        map.on("mousemove", "creditors-cities-core", (e) => {
          map.getCanvas().style.cursor = "pointer";
          if (e.features && e.features[0]) showPopup(e.features[0]);
        });
        map.on("mouseleave", "creditors-cities-core", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
        map.on("click", "creditors-cities-core", (e) => {
          if (!e.features || !e.features[0]) return;
          const props = e.features[0].properties || {};
          onSelectCity({ city: props.city, provinceState: props.provinceState, country: props.country });
        });
      });
    } catch (err) {
      console.warn("creditors map unavailable:", err);
      setError("Map preview unavailable.");
    }
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snap camera when focusCity changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCity) return;
    const target = cities.find((c) => (
      c.city === focusCity.city
      && c.provinceState === focusCity.provinceState
      && c.country === focusCity.country
    ));
    if (!target || !Number.isFinite(target.lat)) return;
    map.flyTo({ center: [target.lng, target.lat], zoom: 7.5, speed: 1.4 });
  }, [focusCity, cities]);

  if (error) return <div className="creditors-map-fallback">{error}</div>;
  return <div ref={containerRef} className="creditors-map-canvas" aria-label="Map of creditor cities" />;
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

function CreditorsView() {
  const [query, setQuery] = useState("");
  const [claimType, setClaimType] = useState("all");
  const [debtor, setDebtor] = useState("all");
  const [country, setCountry] = useState("all");
  const [provinceState, setProvinceState] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState({ key: "balance", dir: -1 });
  const [treemapCurrency, setTreemapCurrency] = useState("CDN");
  const [treemapScope, setTreemapScope] = useState("unsecured");
  const [hoveredTile, setHoveredTile] = useState(null);
  const [hometownInput, setHometownInput] = useState("");
  const [focusCity, setFocusCity] = useState(null);
  const tableRef = useRef(null);

  const debtorOptions = useMemo(() => (
    [...new Set(CREDITORS_ROWS.map((row) => row.debtorLabel || row.debtor).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en-CA"))
  ), []);
  const countryOptions = useMemo(() => (
    [...new Set(CREDITORS_ROWS.map((row) => row.country).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en-CA"))
  ), []);
  const provinceStateOptions = useMemo(() => (
    [...new Set(CREDITORS_ROWS
      .filter((row) => country === "all" || row.country === country)
      .map((row) => row.provinceState || row.province)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en-CA"))
  ), [country]);
  const industryOptions = useMemo(() => (
    [...new Set(CREDITORS_ROWS.map((row) => row.industry).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en-CA"))
  ), []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CREDITORS_ROWS.filter((row) => {
      if (claimType !== "all" && row.claimType !== claimType) return false;
      if (debtor !== "all" && (row.debtorLabel || row.debtor) !== debtor) return false;
      if (country !== "all" && row.country !== country) return false;
      if (provinceState !== "all" && (row.provinceState || row.province) !== provinceState) return false;
      if (industry !== "all" && row.industry !== industry) return false;
      if (currency !== "all" && row.currency !== currency) return false;
      if (!needle) return true;
      return creditorSearchText(row).includes(needle);
    });
  }, [query, claimType, debtor, country, provinceState, industry, currency]);

  const sortedRows = useMemo(() => (
    [...filteredRows].sort((a, b) => compareCreditorRows(a, b, sort.key, sort.dir))
  ), [filteredRows, sort]);

  const hasActiveSearch = Boolean(query.trim()) || claimType !== "all" || debtor !== "all" || country !== "all" || provinceState !== "all" || industry !== "all" || currency !== "all";
  const visibleRows = showAll ? sortedRows : sortedRows.slice(0, DEFAULT_CREDITOR_LIMIT);
  const isLimited = !showAll && sortedRows.length > visibleRows.length;
  const unsecuredCad = CREDITOR_DATA.summary?.totalsByClaim?.Unsecured?.CDN || 0;
  const unsecuredUsd = CREDITOR_DATA.summary?.totalsByClaim?.Unsecured?.USD || 0;
  const securedCad = CREDITOR_DATA.summary?.totalsByClaim?.Secured?.CDN || 0;
  const totalCad = securedCad + unsecuredCad;
  const totalUsd = unsecuredUsd;
  const reconciliation = CREDITOR_DATA.summary?.reconciliation || {};

  const stackLayers = useMemo(() => buildStackLayers(), []);
  const treemapItems = useMemo(
    () => buildTreemapItems(CREDITORS_ROWS, treemapCurrency, treemapScope),
    [treemapCurrency, treemapScope],
  );
  const industryRollup = useMemo(() => {
    const totals = new Map();
    for (const row of CREDITORS_ROWS) {
      const key = row.industry || "Other";
      const entry = totals.get(key) || { industry: key, balanceCDN: 0, balanceUSD: 0, count: 0 };
      if (row.currency === "USD") entry.balanceUSD += row.balance;
      else entry.balanceCDN += row.balance;
      entry.count += 1;
      totals.set(key, entry);
    }
    return [...totals.values()].sort((a, b) => (
      (b.balanceCDN + b.balanceUSD) - (a.balanceCDN + a.balanceUSD)
    ));
  }, []);
  const industryRollupMaxCad = useMemo(() => (
    Math.max(1, ...industryRollup.map((item) => item.balanceCDN))
  ), [industryRollup]);
  const industryRollupMaxUsd = useMemo(() => (
    Math.max(1, ...industryRollup.map((item) => item.balanceUSD))
  ), [industryRollup]);

  const cityOptions = useMemo(() => (
    CITY_TOTALS
      .map((c) => ({ ...c, total: c.balanceCDN + c.balanceUSD }))
      .sort((a, b) => b.total - a.total)
  ), []);

  const matchingCities = useMemo(() => {
    const needle = hometownInput.trim().toLowerCase();
    if (!needle) return [];
    return cityOptions.filter((c) => (
      c.city.toLowerCase().includes(needle)
      || c.provinceState.toLowerCase().includes(needle)
    )).slice(0, 8);
  }, [hometownInput, cityOptions]);

  const sortValue = `${sort.key}:${sort.dir}`;

  const toggleSort = (key) => {
    setSort((prev) => (
      prev.key === key
        ? { key, dir: -prev.dir }
        : { key, dir: key === "balance" ? -1 : 1 }
    ));
  };

  const resetFilters = () => {
    setQuery("");
    setClaimType("all");
    setDebtor("all");
    setCountry("all");
    setProvinceState("all");
    setIndustry("all");
    setCurrency("all");
    setShowAll(false);
    setSort({ key: "balance", dir: -1 });
    setFocusCity(null);
  };

  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const applyStackFilter = ({ claimType: layerClaim, currency: layerCurrency, creditor }) => {
    setClaimType(layerClaim || "all");
    setCurrency(layerCurrency || "all");
    setQuery(creditor || "");
    setDebtor("all");
    setCountry("all");
    setProvinceState("all");
    setIndustry("all");
    setShowAll(false);
    setSort({ key: "balance", dir: -1 });
    scrollToTable();
  };

  const applyTreemapTile = (tile) => {
    setQuery(tile.label);
    setClaimType("all");
    setCurrency(tile.currency);
    setDebtor("all");
    setCountry("all");
    setProvinceState("all");
    setIndustry("all");
    setShowAll(false);
    setSort({ key: "balance", dir: -1 });
    scrollToTable();
  };

  const applyCityFilter = (target) => {
    setQuery("");
    setClaimType("all");
    setCurrency("all");
    setDebtor("all");
    setCountry(target.country || "all");
    setProvinceState(target.provinceState || "all");
    setIndustry("all");
    setShowAll(false);
    setSort({ key: "balance", dir: -1 });
    setFocusCity(target);
    // We filter the full table to rows from this city by setting a query for
    // the city name -- province/state filter alone may include other towns.
    setQuery(target.city);
  };

  const applyIndustryFilter = (industryKey) => {
    setIndustry(industryKey);
    setQuery("");
    setClaimType("all");
    setCurrency("all");
    setDebtor("all");
    setCountry("all");
    setProvinceState("all");
    setShowAll(false);
    setSort({ key: "balance", dir: -1 });
    scrollToTable();
  };

  const handleSortSelect = (value) => {
    const [key, dir] = value.split(":");
    setSort({ key, dir: Number(dir) || -1 });
  };

  const sourceDate = CREDITOR_DATA.source?.postedDate || "2026-04-24";
  const preparedDate = CREDITOR_DATA.source?.preparedAsOf || "2026-04-21";
  const totalRows = CREDITOR_DATA.summary?.rowCount || CREDITORS_ROWS.length;
  const totalCities = cityOptions.length;
  const debtorCount = (CREDITOR_DATA.summary?.debtorTotals || []).length;

  // Clean activeFilter signal for stack-layer highlighting.
  const activeStackFilter = (claimType !== "all" || currency !== "all" || query.trim()) ? {
    claimType,
    currency,
    creditor: query.trim() || null,
  } : null;

  return (
    <main className="creditors-shell">
      {/* ---------------- Section 1: Hero ---------------- */}
      <section className="creditors-hero">
        <div>
          <div className="mono creditors-eyebrow">FTI creditor listing · posted {sourceDate}</div>
          <h1 className="serif">Who Monette Owed</h1>
          <p>
            When Monette Farms filed for CCAA protection, the court file came back with{" "}
            <strong>{fmt(totalRows)} creditors</strong> across{" "}
            <strong>{fmt(totalCities)} towns and cities</strong> — from a Toronto bank tower owed{" "}
            <strong>$830M</strong> to a Saskatchewan tire shop owed a few hundred dollars.
            This is the trail of money, mapped.
          </p>
          <div className="creditors-hero-stats">
            <CreditorHeroStat
              label="Total CAD owed"
              value={formatCompactCreditorMoney(totalCad, "CDN")}
              sub={`${fmt(CREDITORS_ROWS.filter((r) => r.currency === "CDN").length)} creditor rows`}
            />
            <CreditorHeroStat
              label="Total USD owed"
              value={formatCompactCreditorMoney(totalUsd, "USD")}
              sub={`${fmt(CREDITORS_ROWS.filter((r) => r.currency === "USD").length)} creditor rows`}
            />
            <CreditorHeroStat
              label="Communities"
              value={fmt(totalCities)}
              sub="Cities, towns, and counties"
            />
            <CreditorHeroStat
              label="Debtor entities"
              value={fmt(debtorCount)}
              sub="Monette companies in the filing"
            />
          </div>
        </div>
        <aside className="creditors-source-card">
          <div className="mono">Source</div>
          <strong>Monette Creditor Listing</strong>
          <span>Prepared from books and records as of {preparedDate}. Amounts are not final allowed claims.</span>
          <span>
            Reconciliation: {reconciliation.matchedCount || 0}/{reconciliation.checkCount || 0} printed totals matched.
          </span>
          <a href={CREDITOR_DATA.source?.url} target="_blank" rel="noopener noreferrer">
            Open the FTI PDF →
          </a>
        </aside>
      </section>

      {/* ---------------- Section 2: The Stack ---------------- */}
      <section className="creditors-section creditors-stack">
        <header className="creditors-section-head">
          <div className="mono creditors-eyebrow">The order of payment</div>
          <h2 className="serif">In a CCAA filing, money flows top to bottom</h2>
          <p>
            Secured creditors get paid first, out of the assets they hold security on. Trade
            creditors — suppliers, landlords, custom operators — line up behind them. Each bar
            below is a layer, sized so the largest creditors in that layer dominate.
            <strong> Click any segment</strong> to filter the table at the bottom.
          </p>
        </header>
        <div className="creditors-stack-layers">
          {stackLayers.map((layer) => (
            <StackLayer
              key={layer.key}
              layer={layer}
              activeFilter={activeStackFilter}
              onSelect={applyStackFilter}
            />
          ))}
        </div>
      </section>

      {/* ---------------- Section 3: Treemap ---------------- */}
      <section className="creditors-section creditors-treemap-section">
        <header className="creditors-section-head">
          <div className="mono creditors-eyebrow">From the co-op counter to the cold-storage shed</div>
          <h2 className="serif">Every supplier, sized by what they're owed</h2>
          <p>
            One rectangle per creditor. Bigger rectangle = bigger balance. Color by industry. Hover
            for the name and town. <strong>Click a tile</strong> to filter the table at the bottom.
            {treemapScope === "unsecured" ? (
              <>
                {" "}The secured banks ($904M, headed by Scotia) are shown in the Stack above —
                they're set aside here so the supplier story can breathe.
              </>
            ) : (
              <>
                {" "}<strong>Showing all creditors including secured banks.</strong> Scotia's
                $829.5M senior facility dwarfs everything else; switch back to
                <em> Trade creditors only </em>to see the supplier landscape.
              </>
            )}
          </p>
          <div className="creditors-treemap-controls">
            <div className="creditors-segmented" role="group" aria-label="Choose creditor scope">
              <button
                type="button"
                aria-pressed={treemapScope === "unsecured"}
                onClick={() => setTreemapScope("unsecured")}
              >
                Trade creditors only ({fmt(CREDITORS_ROWS.filter((r) => r.claimType === "Unsecured").length)})
              </button>
              <button
                type="button"
                aria-pressed={treemapScope === "all"}
                onClick={() => setTreemapScope("all")}
              >
                All creditors ({fmt(CREDITORS_ROWS.length)})
              </button>
            </div>
            <div className="creditors-segmented" role="group" aria-label="Choose currency for treemap">
              <button
                type="button"
                aria-pressed={treemapCurrency === "CDN"}
                onClick={() => setTreemapCurrency("CDN")}
              >
                CAD ({fmt(CREDITORS_ROWS.filter((r) => r.currency === "CDN" && (treemapScope === "all" || r.claimType === "Unsecured")).length)} rows)
              </button>
              <button
                type="button"
                aria-pressed={treemapCurrency === "USD"}
                onClick={() => setTreemapCurrency("USD")}
              >
                USD ({fmt(CREDITORS_ROWS.filter((r) => r.currency === "USD" && (treemapScope === "all" || r.claimType === "Unsecured")).length)} rows)
              </button>
            </div>
          </div>
        </header>
        <TreemapView
          items={treemapItems}
          currency={treemapCurrency}
          hovered={hoveredTile}
          onHover={setHoveredTile}
          onSelect={applyTreemapTile}
        />
        <div className="creditors-tm-legend" aria-label="Industry colour key">
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <button
              key={name}
              type="button"
              className={industry === name ? "is-active" : ""}
              onClick={() => applyIndustryFilter(name)}
            >
              <span style={{ background: color }} aria-hidden="true"></span>
              {name}
            </button>
          ))}
        </div>
      </section>

      {/* ---------------- Section 4: Map ---------------- */}
      <section className="creditors-section creditors-map-section">
        <header className="creditors-section-head">
          <div className="mono creditors-eyebrow">Where the money is owed</div>
          <h2 className="serif">Find your hometown</h2>
          <p>
            Each dot is a town or city Monette owes money to. Larger dots = larger total. Type a
            town below to fly there, or click any dot for the breakdown.
          </p>
          <div className="creditors-hometown">
            <input
              type="search"
              value={hometownInput}
              onChange={(e) => setHometownInput(e.target.value)}
              placeholder="Search a town: Outlook, Hafford, Swift Current..."
              aria-label="Find your hometown"
            />
            {matchingCities.length > 0 ? (
              <ul className="creditors-hometown-results">
                {matchingCities.map((c) => (
                  <li key={`${c.city}|${c.provinceState}|${c.country}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusCity({ city: c.city, provinceState: c.provinceState, country: c.country });
                        setHometownInput("");
                        applyCityFilter({ city: c.city, provinceState: c.provinceState, country: c.country });
                      }}
                    >
                      <strong>{c.city}, {c.provinceState}</strong>
                      <em>
                        {fmt(c.creditorCount)} creditor{c.creditorCount === 1 ? "" : "s"} ·{" "}
                        {c.balanceCDN > 0 ? formatCompactCreditorMoney(c.balanceCDN, "CDN") : ""}
                        {c.balanceCDN > 0 && c.balanceUSD > 0 ? " + " : ""}
                        {c.balanceUSD > 0 ? formatCompactCreditorMoney(c.balanceUSD, "USD") : ""}
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>
        <div className="creditors-map-layout">
          <div className="creditors-map-frame">
            <CreditorsMap
              cities={cityOptions}
              focusCity={focusCity}
              onSelectCity={(target) => {
                setFocusCity(target);
                applyCityFilter(target);
              }}
              currency={currency}
            />
          </div>
          <aside className="creditors-map-side">
            <div className="mono creditors-eyebrow">Top towns by total owed</div>
            <ol className="creditors-city-list">
              {cityOptions.slice(0, 12).map((c) => (
                <li key={`${c.city}|${c.provinceState}|${c.country}`}>
                  <button
                    type="button"
                    className={focusCity && focusCity.city === c.city && focusCity.provinceState === c.provinceState ? "is-active" : ""}
                    onClick={() => {
                      setFocusCity({ city: c.city, provinceState: c.provinceState, country: c.country });
                      applyCityFilter({ city: c.city, provinceState: c.provinceState, country: c.country });
                    }}
                  >
                    <span>
                      <strong>{c.city}</strong>
                      <em>{c.provinceState}, {c.country}</em>
                    </span>
                    <span className="mono creditors-city-amount">
                      {c.balanceCDN > 0 ? formatCompactCreditorMoney(c.balanceCDN, "CDN") : ""}
                      {c.balanceCDN > 0 && c.balanceUSD > 0 ? " · " : ""}
                      {c.balanceUSD > 0 ? formatCompactCreditorMoney(c.balanceUSD, "USD") : ""}
                      <em>{fmt(c.creditorCount)} row{c.creditorCount === 1 ? "" : "s"}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      {/* ---------------- Section 5: Industries ---------------- */}
      <section className="creditors-section creditors-industries">
        <header className="creditors-section-head">
          <div className="mono creditors-eyebrow">By industry</div>
          <h2 className="serif">Where the trade dollars went</h2>
          <p>
            Industry is keyword-inferred from creditor names — a navigation aid, not a court
            classification. Click a row to filter the table.
          </p>
        </header>
        <div className="creditors-industry-list">
          {industryRollup.map((item) => {
            const cadShare = item.balanceCDN / industryRollupMaxCad;
            const usdShare = item.balanceUSD / industryRollupMaxUsd;
            return (
              <button
                key={item.industry}
                type="button"
                className={industry === item.industry ? "creditors-industry-row is-active" : "creditors-industry-row"}
                onClick={() => applyIndustryFilter(item.industry)}
              >
                <span className="creditors-industry-label">
                  <span className="creditors-industry-swatch" style={{ background: industryColor(item.industry) }} aria-hidden="true"></span>
                  <strong>{item.industry}</strong>
                  <em>{fmt(item.count)} creditor{item.count === 1 ? "" : "s"}</em>
                </span>
                <span className="creditors-industry-bars">
                  {item.balanceCDN > 0 ? (
                    <span className="creditors-industry-bar">
                      <span className="creditors-industry-bar-fill" style={{ width: `${Math.max(cadShare * 100, 2)}%`, background: industryColor(item.industry) }} aria-hidden="true"></span>
                      <span className="mono">CAD {formatCompactCreditorMoney(item.balanceCDN, "CDN")}</span>
                    </span>
                  ) : null}
                  {item.balanceUSD > 0 ? (
                    <span className="creditors-industry-bar">
                      <span className="creditors-industry-bar-fill" style={{ width: `${Math.max(usdShare * 100, 2)}%`, background: industryColor(item.industry), opacity: 0.7 }} aria-hidden="true"></span>
                      <span className="mono">USD {formatCompactCreditorMoney(item.balanceUSD, "USD")}</span>
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- Section 6: Full table ---------------- */}
      <section className="creditors-section creditors-table-section" ref={tableRef}>
        <header className="creditors-section-head">
          <div className="mono creditors-eyebrow">The full ledger</div>
          <h2 className="serif">Browse every creditor row</h2>
          <p>
            Search by creditor name, debtor entity, town, postal code, or industry. Filters compose;
            sort by any column.
          </p>
        </header>
        <div className="creditors-controls" aria-label="Creditor search and filters">
          <div className="creditors-search">
            <label htmlFor="creditors-search" className="visually-hidden">Search creditors</label>
            <input
              id="creditors-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creditor, debtor, town, postal code..."
              aria-label="Search creditors"
            />
          </div>
          <select value={claimType} onChange={(e) => setClaimType(e.target.value)} aria-label="Filter claim type">
            <option value="all">All claims</option>
            <option value="Secured">Secured only</option>
            <option value="Unsecured">Unsecured only</option>
          </select>
          <select value={debtor} onChange={(e) => setDebtor(e.target.value)} aria-label="Filter debtor">
            <option value="all">All debtors</option>
            {debtorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={country} onChange={(e) => { setCountry(e.target.value); setProvinceState("all"); }} aria-label="Filter creditor country">
            <option value="all">All countries</option>
            {countryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={provinceState} onChange={(e) => setProvinceState(e.target.value)} aria-label="Filter creditor province or state">
            <option value="all">All provinces/states</option>
            {provinceStateOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Filter industry">
            <option value="all">All industries</option>
            {industryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Filter currency">
            <option value="all">All currencies</option>
            <option value="CDN">CAD only</option>
            <option value="USD">USD only</option>
          </select>
          <select value={sortValue} onChange={(e) => handleSortSelect(e.target.value)} aria-label="Sort creditor table">
            <option value="balance:-1">Sort: largest balance</option>
            <option value="balance:1">Sort: smallest balance</option>
            <option value="creditor:1">Sort: creditor A-Z</option>
            <option value="city:1">Sort: city A-Z</option>
            <option value="industry:1">Sort: industry A-Z</option>
            <option value="provinceState:1">Sort: province/state</option>
            <option value="debtor:1">Sort: debtor</option>
          </select>
          <button
            className="btn"
            onClick={() => setShowAll((value) => !value)}
            disabled={!showAll && !isLimited}
          >
            {showAll ? `Top ${DEFAULT_CREDITOR_LIMIT}` : (isLimited ? `Show all ${fmt(sortedRows.length)}` : "All shown")}
          </button>
          <button className="btn" onClick={() => downloadCreditorsCsv(sortedRows)}>
            Export CSV
          </button>
          <button className="btn btn-dark" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="mono creditors-status">
          Showing {fmt(visibleRows.length)} of {fmt(sortedRows.length)} matched rows
          {!showAll ? `. Default is top ${DEFAULT_CREDITOR_LIMIT} by listed balance.` : "."}
          {hasActiveSearch && isLimited ? " Use Show all to see every match." : ""}
          {" "}CAD and USD are not converted.
        </div>

        <div className="creditors-table-wrap">
          <table className="creditors-table">
            <thead>
              <tr>
                <th>#</th>
                {[
                  ["Creditor", "creditor"],
                  ["City", "city"],
                  ["Industry", "industry"],
                  ["Listed balance", "balance"],
                  ["Claim", "claimType"],
                  ["Debtor", "debtor"],
                  ["Country", "country"],
                  ["Prov/state", "provinceState"],
                ].map(([label, key]) => (
                  <th key={key}>
                    <button type="button" onClick={() => toggleSort(key)}>
                      {label}
                      {sort.key === key && <span>{sort.dir === 1 ? " ↑" : " ↓"}</span>}
                    </button>
                  </th>
                ))}
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={row.id} className={row.claimType === "Secured" ? "is-secured" : ""}>
                  <td className="mono creditors-rank" data-label="#">{String(index + 1).padStart(2, "0")}</td>
                  <td data-label="Creditor">
                    <strong>{row.creditor}</strong>
                  </td>
                  <td data-label="City">{row.city || "—"}</td>
                  <td data-label="Industry">
                    <span className="creditors-industry-pill" style={{ borderColor: industryColor(row.industry) }}>
                      <span style={{ background: industryColor(row.industry) }} aria-hidden="true"></span>
                      {row.industry}
                    </span>
                  </td>
                  <td className="mono creditors-balance" data-label="Balance">{formatCreditorMoney(row.balance, row.currency)}</td>
                  <td data-label="Claim"><span className={`creditors-claim creditors-claim-${row.claimType.toLowerCase()}`}>{row.claimType}</span></td>
                  <td data-label="Debtor">{row.debtorLabel || row.debtor}</td>
                  <td data-label="Country">{row.country || "Various"}</td>
                  <td data-label="Province/state">{row.provinceState || row.province || "Various"}</td>
                  <td className="mono" data-label="Source">p. {row.sourcePage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- Section 7: Methodology ---------------- */}
      <section className="creditors-section creditors-methodology">
        <header className="creditors-section-head">
          <div className="mono creditors-eyebrow">Methodology</div>
          <h2 className="serif">How this page was built</h2>
        </header>
        <div className="creditors-methodology-grid">
          <article>
            <strong>The list</strong>
            <p>
              FTI Consulting, the court-appointed Monitor, posted the creditor listing on{" "}
              {sourceDate}. The PDF was prepared from Monette books and records as of{" "}
              {preparedDate}. <a href={CREDITOR_DATA.source?.url} target="_blank" rel="noopener noreferrer">Open the source PDF →</a>
            </p>
          </article>
          <article>
            <strong>Locations</strong>
            <p>
              Country, province/state, and town are the creditor's <em>mailing</em> location from
              the FTI listing — not the location of any farm asset. Coordinates were resolved by
              Mapbox geocoding and may snap to a city centroid for accuracy at this zoom.
            </p>
          </article>
          <article>
            <strong>Industries</strong>
            <p>
              Industry is keyword-inferred from creditor names ("Cargill" → Crop inputs, "Kal-Tire"
              → Equipment & parts, etc.). It's a navigation aid, not a court classification.
            </p>
          </article>
          <article>
            <strong>Amounts</strong>
            <p>
              Balances are listed by FTI <em>without admission as to liability or quantum</em>.
              No claims procedure had been established when the notice was posted, so these are
              books-and-records balances, not allowed claims. CAD and USD figures are not
              converted to a single currency.
            </p>
          </article>
        </div>
        <p className="creditors-note">
          Reconciliation: {reconciliation.matchedCount || 0}/{reconciliation.checkCount || 0} of
          the printed page totals in the FTI PDF reconcile to the extracted rows on this page (max
          difference {formatCreditorMoney(reconciliation.maxDifference || 0, "CDN")}). Missing or
          incorrect entries can be flagged through the Monette Ledger feedback link in the
          masthead.
        </p>
      </section>
    </main>
  );
}

window.CreditorsView = CreditorsView;
