// VIEW — Dossier (singular reader). Renders one dossier from
// window.MONETTE_DOSSIERS at #dossier/{slug}. The body is an array of
// section objects produced by dossiers/{slug}.js so each story can
// be authored in plain JS with rich, mixed content (lede, h2, p,
// pullquote, callout, tip) without HTML strings.

const DossierBody = ({ blocks, dossier }) => (
  <div className="dossier-body">
    {blocks.map((b, i) => {
      if (b.type === "lede") return <p key={i} className="dossier-lede">{b.text}</p>;
      if (b.type === "h2")   return <h2 key={i} className="dossier-h2 serif">{b.text}</h2>;
      if (b.type === "p")    return <p key={i} className="dossier-p">{b.text}</p>;
      if (b.type === "pullquote") return (
        <figure key={i} className="dossier-pull">
          <blockquote className="serif">{b.text}</blockquote>
          {b.attrib && <figcaption className="caps">— {b.attrib}</figcaption>}
        </figure>
      );
      if (b.type === "callout") return (
        <aside key={i} className="dossier-callout">
          {b.title && <div className="caps dossier-callout-title">{b.title}</div>}
          <div className="dossier-callout-text">{b.text}</div>
        </aside>
      );
      if (b.type === "tip") return (
        <aside key={i} className="dossier-tip">
          <div className="caps">Got info?</div>
          <p>{b.text}</p>
          <button
            className="btn btn-dark"
            onClick={() => {
              if (window.openAgnonymousDiscussion) {
                window.openAgnonymousDiscussion({
                  title: `Monette dossier correction: ${dossier ? dossier.headline : "public file"}`,
                  body: `${b.text}\n\nAdd the correction, source link, and confidence level.`,
                  kind: "clarification",
                });
                return;
              }
              window.location.hash = "#editorial";
            }}
          >
            + Submit Update on Agnonymous
          </button>
        </aside>
      );
      return null;
    })}
  </div>
);

const DossierBriefing = ({ briefing }) => (
  <aside className="dossier-briefing">
    <div className="caps dossier-briefing-title">The briefing</div>

    {briefing.parties && briefing.parties.length > 0 && (
      <section className="dossier-brief-section">
        <div className="caps mute">Parties</div>
        <ul className="dossier-brief-list">
          {briefing.parties.map((p, i) => (
            <li key={i}>
              <strong>{p.name}</strong>
              <span className="mute"> · {p.role}</span>
            </li>
          ))}
        </ul>
      </section>
    )}

    {briefing.headlineNumbers && briefing.headlineNumbers.length > 0 && (
      <section className="dossier-brief-section">
        <div className="caps mute">By the numbers</div>
        <table className="dossier-numbers">
          <tbody>
            {briefing.headlineNumbers.map((n, i) => (
              <tr key={i}>
                <td className="dossier-num-label">{n.label}</td>
                <td className="dossier-num-value mono">{n.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )}

    {briefing.keyDates && briefing.keyDates.length > 0 && (
      <section className="dossier-brief-section">
        <div className="caps mute">Key dates</div>
        <ol className="dossier-dates">
          {briefing.keyDates.map((d, i) => (
            <li key={i}>
              <span className="mono dossier-date">{d.date}</span>
              <span className="dossier-date-text">{d.text}</span>
            </li>
          ))}
        </ol>
      </section>
    )}

    {briefing.related_dossiers && briefing.related_dossiers.length > 0 && (
      <section className="dossier-brief-section">
        <div className="caps mute">Related dossiers</div>
        <ul className="dossier-brief-links">
          {briefing.related_dossiers.map((id) => {
            const d = (window.MONETTE_DOSSIERS_INDEX_BY_ID || {})[id];
            if (!d) return null;
            return (
              <li key={id}>
                <a href={`#dossier/${id}`}>
                  <span className="mono">{String(d.number).padStart(2, "0")}</span>
                  &nbsp;·&nbsp;{d.headline}
                  {d.status !== "released" && <span className="mute"> ({d.status})</span>}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    )}

    {briefing.related_properties && briefing.related_properties.length > 0 && (
      <section className="dossier-brief-section">
        <div className="caps mute">Related properties</div>
        <ul className="dossier-brief-links">
          {briefing.related_properties.map((id) => {
            const p = ((window.MONETTE_DATA || {}).properties || []).find((x) => x.id === id);
            return (
              <li key={id}>
                <a href={`#map/${id}`}>{(p && p.name) || id}</a>
              </li>
            );
          })}
        </ul>
      </section>
    )}
  </aside>
);

const DossierSources = ({ sources }) => {
  if (!sources || !sources.length) return null;
  return (
    <section className="dossier-sources">
      <div className="caps">Sources</div>
      <ol>
        {sources.map((s, i) => (
          <li key={i}>
            {s.href ? <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a> : s.label}
            {s.type && <span className="mute mono dossier-source-type"> · {s.type}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
};

const DossierNext = ({ next }) => {
  if (!next) return null;
  return (
    <section className="dossier-next">
      <div className="caps">Next dossier · {String(next.number).padStart(2, "0")}</div>
      <h3 className="serif dossier-next-headline">{next.headline}</h3>
      <p className="dossier-next-subhead">{next.subhead}</p>
      <div className="mono mute">Releases {next.releasesOn}</div>
    </section>
  );
};

const DossierView = ({ forcedSelect, onSwitchView }) => {
  const slug = forcedSelect || (window.MONETTE_DOSSIERS_CURRENT && window.MONETTE_DOSSIERS_CURRENT.id);
  const dossier = slug ? (window.MONETTE_DOSSIERS || {})[slug] : null;
  const meta = slug ? (window.MONETTE_DOSSIERS_INDEX_BY_ID || {})[slug] : null;

  if (!dossier) {
    // If the dossier isn't loaded yet (e.g., scheduled but not released),
    // fall back to a placeholder card based on index metadata.
    if (meta) {
      return (
        <div className="dossier-wrap">
          <div className="dossier-placeholder">
            <div className="caps">Dossier {String(meta.number).padStart(2, "0")} · {meta.kicker}</div>
            <h1 className="serif dossier-placeholder-headline">{meta.headline}</h1>
            <p className="dossier-placeholder-teaser">{meta.teaser}</p>
            <div className="dossier-placeholder-status mono">
              Status: {meta.status} · Releases {meta.releasedAt}
            </div>
            <button className="btn" onClick={() => window.location.hash = "#dossiers"}>
              ← Back to all dossiers
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="dossier-wrap">
        <div className="dossier-placeholder">
          <h1 className="serif">No dossier selected.</h1>
          <button className="btn" onClick={() => window.location.hash = "#dossiers"}>
            Browse the dossiers →
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="dossier-wrap">
      <header className="dossier-header">
        <div className="dossier-crumb caps">
          <a href="#dossiers">Dossiers</a>
          <span className="mute"> · </span>
          <span>Dossier {String(dossier.number).padStart(2, "0")}</span>
        </div>
        <div className="caps dossier-kicker">{dossier.kicker}</div>
        <h1 className="serif dossier-headline">{dossier.headline}</h1>
        <p className="dossier-subhead">{dossier.subhead}</p>
        <div className="dossier-meta">
          <span className="mono">{dossier.byline}</span>
          {dossier.releasedAt && <span className="mono mute"> · Released {dossier.releasedAt}</span>}
          {dossier.readingTime && <span className="mono mute"> · {dossier.readingTime} read</span>}
        </div>
      </header>

      <div className="dossier-grid">
        <main className="dossier-main">
          <DossierBody blocks={dossier.body || []} dossier={dossier} />
          <DossierSources sources={dossier.sources} />
          <DossierNext next={dossier.next} />
        </main>
        <DossierBriefing briefing={dossier.briefing || {}} />
      </div>
    </article>
  );
};

window.DossierView = DossierView;
