// app.jsx — top-level shell. Replaces the DesignCanvas artboard wrapper
// from the prototype with real site navigation between the views.
//
// View state lives in the URL hash so refreshes (and direct links from
// external sources like X/Instagram) land on the right view.
//   #editorial             → The Monette Ledger (default)
//   #dossiers              → The serial-investigation roadmap
//   #dossier/{slug}        → A single dossier (e.g. #dossier/insurance-tower)
//   #list                  → Asset register
//   #map                   → Field atlas
// Extra hash segments target a specific property / quarter:
//   #map/vanguard
//   #map/vanguard/NW-26-10-16-W3

const VIEWS = [
  { key: "editorial", label: "Ledger",   Component: () => null /* filled below */ },
  { key: "dossiers",  label: "Dossiers", Component: () => null },
  { key: "list",      label: "Register", Component: () => null },
  { key: "creditors", label: "Creditors", Component: () => null },
  { key: "map",       label: "Atlas",    Component: () => null },
];

function parseHash() {
  const h = (window.location.hash || "#editorial").replace(/^#/, "");
  const [view, prop, quarter] = h.split("/");
  const known = ["editorial", "dossiers", "dossier", "list", "creditors", "map"];
  return {
    view: known.includes(view) ? view : "editorial",
    prop: prop || null,
    quarter: quarter || null,
  };
}

function App() {
  const [{ view, prop, quarter }, setRoute] = useState(parseHash());
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [headlineFormOpen, setHeadlineFormOpen] = useState(false);
  const [headlineFormPropertyId, setHeadlineFormPropertyId] = useState("");
  const [headlineFormDraft, setHeadlineFormDraft] = useState("");

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (nextView, nextProp, nextQuarter) => {
    const parts = [nextView || "editorial"];
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
    view === "map"      ? window.MapView  :
    view === "dossiers" ? window.DossiersIndexView :
    view === "dossier"  ? window.DossierView :
                          window.EditorialView;

  // The Dossier reader takes a slug as its first hash segment (#dossier/{slug}),
  // not a property id. We pass it through `forcedSelect` like the map view.
  const navTab = view === "dossier" ? "dossiers" : view;

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
          {/* Keep education + public correction discussion reachable from every view. */}
          <button className="nav-cta nav-cta-ghost" onClick={() => setTutorialOpen(true)}>
            ? How voting works
          </button>
          <button className="nav-cta nav-cta-gold" onClick={openAgnonymous}>
            + Submit Update
          </button>
        </div>
      </nav>
      <div className="view-wrap">
        <ViewComponent
          key={view + "/" + (prop || "")}
          forcedSelect={view === "map" || view === "dossier" ? prop : null}
          forcedQuarter={view === "map" ? quarter : null}
          onSwitchView={go}
          onOpenTutorial={() => setTutorialOpen(true)}
          onOpenHeadlineForm={openHeadlineForm}
        />
      </div>
      <HowVotingWorks
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onStart={() => go("list")}
      />
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
