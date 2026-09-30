// VIEW - Court File (#court, #court/{propertyId}).
//
// Every filing in the Monette CCAA (Court of King's Bench of Alberta,
// 2601-07148) and the U.S. Chapter 15 case (Bankr. D. Del. 26-10547),
// newest first. Key documents carry a one-line plain summary plus cited
// points; routine filings (service, docket admin) are hidden by default.
//
// Source: window.MONETTE_DATA.courtFile (court-file-data.js). One record per
// document; the court strip and each property drawer read the same list.
//
// Evidence rules carried into the copy: a filing whose text is not public says
// so and nothing about what it decides; "approved" is never "closed"; a step
// in "Where the sale stands" is done only when a filed document shows it.

const COURT_FILE = (window.MONETTE_DATA && window.MONETTE_DATA.courtFile) || null;

const COURT_FILTERS = [
  { key: "key", label: "Key documents", test: (f) => f.key },
  { key: "all", label: "Everything", test: () => true },
  { key: "order", label: "Orders", test: (f) => f.kind === "order" },
  { key: "report", label: "Monitor's reports", test: (f) => f.court === "monitor" && (f.kind === "report" || f.kind === "certificate") },
  { key: "us", label: "U.S. court", test: (f) => f.court === "us" },
  { key: "sisp", label: "Sale process", test: (f) => f.kind === "sisp" },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function courtMonthLabel(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : "Undated";
}

function milestoneStatus(ms) {
  const days = daysUntilIso(ms.date);
  if (ms.state === "done") return { cls: "is-done", tag: "Done" };
  if (days == null) return { cls: "", tag: "" };
  if (days < 0) return { cls: "is-passed", tag: ms.state === "deadline" ? "Date passed" : "Passed" };
  if (days === 0) return { cls: "is-next", tag: "Today" };
  return { cls: "is-upcoming", tag: days === 1 ? "Tomorrow" : `In ${days} days` };
}

function SaleSteps({ milestones }) {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;
  const rows = milestones.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const nextIndex = rows.findIndex((ms) => ms.state !== "done" && (daysUntilIso(ms.date) ?? -1) >= 0);
  // Keep the page about what is next: the latest two finished steps stay visible,
  // earlier finished steps fold into "Earlier steps".
  const lastDone = rows.reduce((acc, ms, i) => (ms.state === "done" ? i : acc), -1);
  const foldBefore = Math.max(0, lastDone - 1);
  const renderStep = (ms, i) => {
    const st = milestoneStatus(ms);
    const href = safeHttpHref(ms.url);
    return (
      <li key={`${ms.date}-${ms.label}`} className={`cf-step ${st.cls}${i === nextIndex ? " is-next" : ""}`}>
        <span className="mono cf-step-date">{fmtIsoDate(ms.date)}</span>
        <span className="cf-step-body">
          <span className="cf-step-label">{ms.label}</span>
          <span className="mono cf-step-meta">
            {i === nextIndex ? <strong>Next · {st.tag}</strong> : st.tag}
            {ms.state === "outside-date" && " · outside date"}
            {ms.source && <> · {href ? <a href={href} target="_blank" rel="noopener noreferrer">{ms.source}</a> : ms.source}</>}
          </span>
        </span>
      </li>
    );
  };
  return (
    <section className="cf-steps" aria-labelledby="cf-steps-title">
      <h2 id="cf-steps-title" className="serif">Where the sale stands</h2>
      <p className="cf-steps-note">
        A step is marked done only when a filed document shows it happened. Outside dates are the latest a step can happen, not scheduled hearings.
      </p>
      {foldBefore > 0 && (
        <details className="cf-steps-earlier">
          <summary className="mono">Earlier steps · {foldBefore} done since {fmtIsoDate(rows[0].date)}</summary>
          <ol className="cf-step-list">{rows.slice(0, foldBefore).map((ms, i) => renderStep(ms, i))}</ol>
        </details>
      )}
      <ol className="cf-step-list">
        {rows.slice(foldBefore).map((ms, i) => renderStep(ms, i + foldBefore))}
      </ol>
    </section>
  );
}

function FilingRow({ filing }) {
  const href = safeHttpHref(filing.url);
  const points = Array.isArray(filing.points) ? filing.points : [];
  const affects = Array.isArray(filing.affects) ? filing.affects : [];
  return (
    <article className={`cf-row${filing.key ? " is-key" : ""}`} id={`filing-${filing.id}`}>
      <div className="mono cf-row-date">{fmtIsoDate(filing.date, false)}</div>
      <div className="cf-row-body">
        <div className="mono cf-row-meta">
          <span className={`cf-badge cf-badge-${filing.court}`}>{COURT_LABELS[filing.court] || filing.court}</span>
          <span>{FILING_KIND_LABELS[filing.kind] || "Filing"}</span>
          {filing.docRef && <span>{filing.docRef}</span>}
          {filing.textAvailable === false && <span className="cf-badge cf-badge-muted">Text not yet posted (PACER only)</span>}
          {isNewFiling(filing) && <span className="court-new-tag">New · added {fmtIsoDate(filing.addedAt, false)}</span>}
        </div>
        <h3 className="serif cf-row-title">{filing.title}</h3>
        {filing.summary && filing.textAvailable !== false && <p className="cf-row-summary">{filing.summary}</p>}
        {points.length > 0 && (
          <details className="cf-points">
            <summary className="mono">What it says · {points.length} point{points.length === 1 ? "" : "s"}</summary>
            <ul>
              {points.map((p) => (
                <li key={p.text}>{p.text} <span className="mono cf-cite">{p.cite}</span></li>
              ))}
            </ul>
          </details>
        )}
        {filing.notSaid && <p className="mono cf-notsaid">{filing.notSaid}</p>}
        <div className="cf-row-foot">
          {affects.length > 0 && (
            <span className="cf-affects">
              {affects.map((id) => id === "all"
                ? <span key={id} className="mono cf-chip cf-chip-all">Whole case</span>
                : <a key={id} className="mono cf-chip" href={`#map/${id}`}>{propertyNameFor(id)}</a>)}
            </span>
          )}
          {href && (
            <a className="mono cf-doc-link" href={href} target="_blank" rel="noopener noreferrer">
              {filing.textAvailable === false ? "Docket entry →" : `${filing.urlLabel || "Open document"} →`}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function CourtFileView({ forcedSelect, onSwitchView }) {
  const propertyId = forcedSelect && (D.properties || []).some((p) => p.id === forcedSelect) ? forcedSelect : null;
  // A property view starts on "Everything" (all filings about that land); the full list starts on "Key documents".
  const [filterKey, setFilterKey] = useState(propertyId ? "all" : "key");
  const [showRoutine, setShowRoutine] = useState(false);
  const all = courtFileFilings();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!COURT_FILE || all.length === 0) {
    return (
      <div className="cf-page">
        <header className="cf-head">
          <div className="mono cf-kicker">Court File</div>
          <h1 className="serif">Court filings</h1>
          <p>The court file is not available right now. The Monitor's case site has every document.</p>
        </header>
      </div>
    );
  }

  const filter = COURT_FILTERS.find((f) => f.key === filterKey) || COURT_FILTERS[0];
  const scoped = propertyId ? all.filter((f) => Array.isArray(f.affects) && f.affects.includes(propertyId)) : all;
  const effectiveFilter = filter;
  const visible = scoped.filter((f) => effectiveFilter.test(f) && (showRoutine || !ROUTINE_FILING_KINDS.has(f.kind)));
  const hiddenRoutine = scoped.filter((f) => effectiveFilter.test(f) && ROUTINE_FILING_KINDS.has(f.kind)).length;
  const groups = [];
  for (const f of visible) {
    const label = courtMonthLabel(f.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(f);
    else groups.push({ label, rows: [f] });
  }
  const newCount = all.filter(isNewFiling).length;
  const checkedLabel = COURT_FILE.checkedAt ? fmtIsoDate(String(COURT_FILE.checkedAt).slice(0, 10)) : null;
  const sources = COURT_FILE.sources || {};

  return (
    <div className="cf-page">
      <header className="cf-head">
        <div className="mono cf-kicker">Court File</div>
        <h1 className="serif">Every filing, newest first</h1>
        <p className="cf-lede">
          The Alberta CCAA case (Court of King's Bench, file 2601-07148) and the U.S. Chapter 15 case (Delaware, 26-10547).
          Key documents have a plain summary; every point cites the page or paragraph it comes from.
        </p>
        {checkedLabel && (
          <div className="mono cf-checked">
            Checked {checkedLabel}{COURT_FILE.checkedTime ? `, ${COURT_FILE.checkedTime}` : ""}{COURT_FILE.checkedNote ? `: ${COURT_FILE.checkedNote}` : ""}
            {newCount > 0 && <span className="court-new-tag">{newCount} added in the last {NEW_FILING_DAYS} days</span>}
          </div>
        )}
        <div className="cf-source-links">
          {safeHttpHref(sources.monitor) && <a className="mono" href={sources.monitor} target="_blank" rel="noopener noreferrer">Monitor's case site (FTI) →</a>}
          {safeHttpHref(sources.usDocket) && <a className="mono" href={sources.usDocket} target="_blank" rel="noopener noreferrer">U.S. docket →</a>}
        </div>
      </header>

      {!propertyId && <SaleSteps milestones={COURT_FILE.milestones} />}

      <section className="cf-list" aria-label="Court filings">
        {propertyId && (
          <div className="cf-scope">
            <span>Filings about <strong>{propertyNameFor(propertyId)}</strong> · {scoped.length}</span>
            <a className="mono" href={`#map/${propertyId}`}>Open on the map →</a>
            <button type="button" className="mono" onClick={() => onSwitchView && onSwitchView("court")}>Show every filing</button>
          </div>
        )}
        <div className="cf-filters" role="group" aria-label="Filter filings">
          {COURT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`mono cf-filter${effectiveFilter.key === f.key ? " on" : ""}`}
              aria-pressed={effectiveFilter.key === f.key}
              onClick={() => setFilterKey(f.key)}
            >
              {f.label}
            </button>
          ))}
          <label className="mono cf-routine">
            <input type="checkbox" checked={showRoutine} onChange={(e) => setShowRoutine(e.target.checked)} />
            Show routine filings{hiddenRoutine > 0 && !showRoutine ? ` (${hiddenRoutine} hidden)` : ""}
          </label>
        </div>
        <div className="mono cf-count">{visible.length} of {scoped.length} filings shown</div>
        {groups.length === 0 && <p className="cf-empty">No filings match this filter.</p>}
        {groups.map((g) => (
          <div key={g.label} className="cf-month">
            <h2 className="mono cf-month-label">{g.label}</h2>
            {g.rows.map((f) => <FilingRow key={f.id} filing={f} />)}
          </div>
        ))}
      </section>
    </div>
  );
}

window.CourtFileView = CourtFileView;
