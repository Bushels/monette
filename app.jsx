// app.jsx — top-level shell. Replaces the DesignCanvas artboard wrapper
// from the prototype with real site navigation between the views.
//
// View state lives in the URL hash so refreshes (and direct links from
// external sources like X/Instagram) land on the right view.
//   #map                   → Field atlas (default homepage; satellite seeding mode in Apr-Jun)
//   #map/{property}        → Atlas focused on one property; hero suppressed
//   #map/{property}/{loc}  → Atlas focused on a specific quarter; hero suppressed
//   #dossier/{slug}        → A single dossier article (e.g. #dossier/insurance-tower)
//   #list                  → Asset register
//
// Note: the editorial Ledger and dossiers index were removed in the homepage
// redesign (2026-04-29). Both #editorial and #dossiers silently redirect to #map.

const VIEWS = [
  { key: "list",      label: "Register",  Component: () => null /* filled below */ },
  { key: "creditors", label: "Creditors", Component: () => null },
  { key: "structure", label: "Structure", Component: () => null },
  { key: "stack",     label: "Debt",      Component: () => null },
  { key: "map",       label: "Atlas",     Component: () => null },
];

function parseHash() {
  const h = (window.location.hash || "#map").replace(/^#/, "");
  // Silently redirect retired routes to #map. The singular #dossier/<slug>
  // route is preserved so individual article links still work.
  if (h === "dossiers" || h === "dossiers/" || h === "editorial" || h === "editorial/") {
    history.replaceState({}, "", "#map");
    return { view: "map", prop: null, quarter: null };
  }
  const [view, prop, quarter] = h.split("/");
  const known = ["dossier", "list", "creditors", "structure", "stack", "map"];
  return {
    view: known.includes(view) ? view : "map",
    prop: prop || null,
    quarter: quarter || null,
  };
}

function App() {
  const [{ view, prop, quarter }, setRoute] = useState(parseHash());
  const [headlineFormOpen, setHeadlineFormOpen] = useState(false);
  const [headlineFormPropertyId, setHeadlineFormPropertyId] = useState("");
  const [headlineFormDraft, setHeadlineFormDraft] = useState("");

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (nextView, nextProp, nextQuarter) => {
    const parts = [nextView || "map"];
    if (nextProp) parts.push(nextProp);
    if (nextQuarter) parts.push(nextQuarter);
    window.location.hash = parts.join("/");
  };

  const openHeadlineForm = (input) => {
    if (input && typeof input === "object") {
      setHeadlineFormPropertyId(typeof input.propertyId === "string" ? input.propertyId : "");
      setHeadlineFormDraft(typeof input.draft === "string" ? input.draft : "");
    } else {
      setHeadlineFormPropertyId(typeof input === "string" ? input : "");
      setHeadlineFormDraft("");
    }
    setHeadlineFormOpen(true);
  };

  const openAgnonymous = () => {
    if (window.openAgnonymousDiscussion) {
      window.openAgnonymousDiscussion({
        title: "Monette Ledger correction or clarification",
        body: "What should be corrected, clarified, or investigated? Add the location, source link, and confidence level if you have them.",
        kind: "clarification",
      });
      return;
    }
    window.open(window.AGNONYMOUS_URL || "https://agnonymous.buperac.com", "_blank", "noopener,noreferrer");
  };

  const ViewComponent =
    view === "list"     ? window.ListView :
    view === "creditors" ? window.CreditorsView :
    view === "structure" ? window.GroupStructureView :
    view === "stack"    ? window.DebtStackView :
    view === "dossier"  ? window.DossierView :
                          window.MapView;

  // The Dossier reader takes a slug as its first hash segment (#dossier/{slug}),
  // not a property id. We pass it through `forcedSelect` like the map view.
  // (#dossiers index and #editorial have been removed; both redirect to #map.)
  const navTab = view;
  const supportUrl = (typeof window.supportCustomAmountUrl === "function")
    ? window.supportCustomAmountUrl()
    : "https://paypal.me/buperac";

  return (
    <>
      <nav className="site-nav">
        <div className="brand">
          <span className="wordmark">The Monette Ledger</span>
          <span className="tag">CCAA · DAY {D.day}</span>
        </div>
        <div className="tabs">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => go(v.key)} className={navTab === v.key ? "on" : ""}>{v.label}</button>
          ))}
        </div>
        <div className="nav-ctas">
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-cta nav-cta-ghost nav-cta-donate"
          >
            <span className="nav-cta-full">Donate</span>
            <span className="nav-cta-short">Donate</span>
          </a>
          <button className="nav-cta nav-cta-gold" onClick={openAgnonymous}>
            <span className="nav-cta-full">+ Submit Update</span>
            <span className="nav-cta-short">Submit</span>
          </button>
        </div>
      </nav>
      <div className="view-wrap">
        <ViewComponent
          key={view + "/" + (prop || "")}
          forcedSelect={view === "map" || view === "dossier" ? prop : null}
          forcedQuarter={view === "map" ? quarter : null}
          onSwitchView={go}
          onOpenHeadlineForm={openHeadlineForm}
        />
      </div>
      {/* Persistent site footer with low-pressure support link.
          The map view fills its container so the footer ends up below the
          fold there, which is the desired behavior — readers of the long-form
          views (editorial, dossiers) get an inline support card too. */}
      <SiteFooter />
      <SubmitHeadlineModal
        open={headlineFormOpen}
        initialPropertyId={headlineFormPropertyId}
        initialText={headlineFormDraft}
        onClose={() => setHeadlineFormOpen(false)}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
