// VIEW - Dossiers Index (the public roadmap). The full internal queue stays in
// dossiers/index.js, but the public page only exposes the released work plus
// the next three files. Showing all 14 too early makes the investigation look
// thinner, not deeper.

const PUBLIC_UPCOMING_LIMIT = 3;

const StatusBadge = ({ status }) => {
  const map = {
    released:      { label: "READ NOW",     className: "dossier-status-released" },
    scheduled:     { label: "COMING SOON",  className: "dossier-status-scheduled" },
    investigating: { label: "INVESTIGATING", className: "dossier-status-investigating" },
  };
  const m = map[status] || map.investigating;
  return <span className={`dossier-status ${m.className} caps`}>{m.label}</span>;
};

const DossierCard = ({ d }) => {
  const canOpen = d.status === "released" || d.status === "scheduled";
  const onClick = () => {
    if (canOpen) window.location.hash = `#dossier/${d.id}`;
  };

  return (
    <article
      className={`dossier-card dossier-card-${d.status}`}
      onClick={onClick}
      onKeyDown={(e) => { if (canOpen && (e.key === "Enter" || e.key === " ")) onClick(); }}
      role={canOpen ? "link" : "article"}
      tabIndex={canOpen ? 0 : -1}
    >
      <div className="dossier-card-num mono">{String(d.number).padStart(2, "0")}</div>
      <div className="dossier-card-body">
        <div className="caps mute">{d.kicker}</div>
        <h2 className="serif dossier-card-headline">{d.headline}</h2>
        <p className="dossier-card-teaser">{d.teaser}</p>
        <div className="dossier-card-meta">
          <StatusBadge status={d.status} />
          <span className="mono mute">{d.releasedAt}</span>
        </div>
      </div>
    </article>
  );
};

const DossiersIndexView = () => {
  const all = (window.MONETTE_DOSSIERS_INDEX || []).slice().sort((a, b) => a.number - b.number);
  const released = all.filter((d) => d.status === "released");
  const upcoming = all
    .filter((d) => d.status !== "released")
    .sort((a, b) => (a.releasedAt || "").localeCompare(b.releasedAt || ""));
  const publicUpcoming = upcoming.slice(0, PUBLIC_UPCOMING_LIMIT);
  const heldBackCount = Math.max(upcoming.length - publicUpcoming.length, 0);
  const next = window.MONETTE_DOSSIERS_NEXT;

  return (
    <div className="dossiers-index-wrap">
      <header className="dossiers-index-header">
        <div className="caps mute">The Monette Ledger</div>
        <h1 className="serif dossiers-index-title">The Dossiers</h1>
        <p className="dossiers-index-deck">
          A serial investigation into the corporate finance, court documents, and community fault-lines of the Monette Farms CCAA filing.
          Released one Sunday at a time. The public queue shows the next {PUBLIC_UPCOMING_LIMIT}; later files stay inside the reporting notebook until they are strong enough to preview.
        </p>
        {next && (
          <div className="dossiers-next-up">
            <span className="caps">Next up - {next.releasedAt}</span>
            <span className="serif dossiers-next-up-text"> {next.headline}</span>
          </div>
        )}
      </header>

      {released.length > 0 && (
        <section className="dossiers-section">
          <div className="caps dossiers-section-label">Released</div>
          <div className="dossiers-list">
            {released.map((d) => <DossierCard key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {publicUpcoming.length > 0 && (
        <section className="dossiers-section">
          <div className="caps dossiers-section-label">Next three</div>
          <div className="dossiers-list">
            {publicUpcoming.map((d) => <DossierCard key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {heldBackCount > 0 && (
        <aside className="dossiers-queue-note">
          <div className="caps">Reporting queue held back</div>
          <p>
            {heldBackCount} later files are being worked privately. They will move onto this page only when the thesis, source trail, and legal exposure are publication-ready.
          </p>
        </aside>
      )}

      <footer className="dossiers-index-footer">
        <p className="mute">
          The Monette Ledger is an independent crowdsourced tracker. Not affiliated with Monette Farms, FTI Consulting, the Court of King's Bench of Alberta, or any party to the CCAA proceeding. All claims sourced to public court filings or named press; community submissions are flagged.
        </p>
      </footer>
    </div>
  );
};

window.DossiersIndexView = DossiersIndexView;
