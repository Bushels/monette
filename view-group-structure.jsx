// VIEW - Group Structure. Renders the Monette Group corporate tree with
// 5 TopCos (parent corporations) + their subsidiaries + the 3 Land-Holding
// Limited Partnerships that hold beneficial title to substantially all
// Canadian Real Property.
//
// Source: window.MONETTE_DATA.corporateTree (built from Helkaa Declaration
// paras 15-22 + the Monette Group Structure & Relationships diagram).
//
// Layout:
//   1. Hero with the case caption (17 Applicants + 3 Non-Debtor Stay LPs)
//   2. Control & Ownership row (Family Trust + Darrel Monette + Deon Vissar)
//   3. The 5 TopCos as side-by-side cards, each with its subsidiaries listed
//   4. Land-Holding LPs (the "Non-Debtor Stay Parties") as a separate row
//   5. Professional advisors footer

const TREE = (window.MONETTE_DATA && window.MONETTE_DATA.corporateTree) || null;
const PERSONNEL = (window.MONETTE_DATA && window.MONETTE_DATA.personnel) || null;
const COURT_FACTS = (window.MONETTE_DATA && window.MONETTE_DATA.courtFacts) || null;

function JurisdictionPill({ jurisdiction }) {
  if (!jurisdiction) return null;
  // Color-code jurisdictions to match the Group Structure diagram legend:
  //   yellow = SK Corp, gold = AB, green = BC, navy = ON, orange = US
  const j = String(jurisdiction).toLowerCase();
  let bg = "#444"; let fg = "#fff";
  if (j.includes("sk")) { bg = "#c8a64a"; fg = "#1b1410"; }
  else if (j.includes("ab")) { bg = "#b48638"; fg = "#1b1410"; }
  else if (j.includes("bc")) { bg = "#3f6a32"; fg = "#fff"; }
  else if (j.includes("ontario") || j.includes("on")) { bg = "#3a4a6e"; fg = "#fff"; }
  else if (j.includes("delaware") || j.includes("us") || j.includes("llc") || j.includes("corp")) { bg = "#9a3a2a"; fg = "#fff"; }
  return React.createElement("span", { className: "gs-pill", style: { background: bg, color: fg } }, jurisdiction);
}

function FeinChip({ fein }) {
  if (!fein) return null;
  return React.createElement("span", { className: "gs-fein" }, "· FEIN " + fein);
}

function SubsidiaryRow({ sub, depth }) {
  const indent = (depth || 0) * 12;
  const subSubs = Array.isArray(sub.subsidiaries) ? sub.subsidiaries : [];
  return React.createElement("div", { className: "gs-sub", style: { marginLeft: indent } },
    React.createElement("div", { className: "gs-sub-line" },
      React.createElement("span", { className: "gs-sub-name" }, sub.name),
      React.createElement(JurisdictionPill, { jurisdiction: sub.jurisdiction }),
      React.createElement(FeinChip, { fein: sub.fein })
    ),
    sub.role ? React.createElement("div", { className: "gs-sub-role" }, sub.role) : null,
    subSubs.length ? React.createElement("div", { className: "gs-sub-children" },
      subSubs.map((ss, i) => React.createElement(SubsidiaryRow, { key: ss.name + i, sub: ss, depth: (depth || 0) + 1 }))
    ) : null
  );
}

function TopCoCard({ topco }) {
  const subs = Array.isArray(topco.subsidiaries) ? topco.subsidiaries : [];
  return React.createElement("div", { className: "gs-topco" },
    React.createElement("div", { className: "gs-topco-head" },
      React.createElement("div", { className: "serif gs-topco-name" }, topco.name),
      React.createElement(JurisdictionPill, { jurisdiction: topco.jurisdiction }),
      React.createElement(FeinChip, { fein: topco.fein })
    ),
    topco.ownership ? React.createElement("div", { className: "gs-topco-ownership" }, topco.ownership) : null,
    topco.formationDate ? React.createElement("div", { className: "gs-topco-meta" },
      React.createElement("strong", null, "Formation: "), topco.formationDate
    ) : null,
    topco.amalgamation ? React.createElement("div", { className: "gs-topco-meta" },
      React.createElement("strong", null, "Statute: "), topco.amalgamation
    ) : null,
    topco.employees ? React.createElement("div", { className: "gs-topco-meta" },
      React.createElement("strong", null, "Employees: "), topco.employees
    ) : null,
    topco.role ? React.createElement("div", { className: "gs-topco-meta" },
      React.createElement("strong", null, "Role: "), topco.role
    ) : null,
    topco.operationsNote ? React.createElement("div", { className: "gs-topco-meta" }, topco.operationsNote) : null,
    typeof topco.residualValueCAD === "number" ? React.createElement("div", { className: "gs-topco-meta gs-topco-residual" },
      React.createElement("strong", null, "Residual asset value: "),
      "$" + (topco.residualValueCAD / 1000000).toFixed(1) + "M"
    ) : null,
    topco.formationNote ? React.createElement("div", { className: "gs-topco-note" }, topco.formationNote) : null,
    subs.length ? React.createElement("div", { className: "gs-topco-subs" },
      React.createElement("div", { className: "gs-topco-subs-head" }, "Subsidiaries (" + subs.length + ")"),
      subs.map((s, i) => React.createElement(SubsidiaryRow, { key: s.name + i, sub: s }))
    ) : React.createElement("div", { className: "gs-topco-subs gs-topco-subs-empty" }, "No direct subsidiaries.")
  );
}

function LandLPRow({ lp }) {
  return React.createElement("div", { className: "gs-lp" },
    React.createElement("div", { className: "gs-lp-head" },
      React.createElement("div", { className: "serif gs-lp-name" }, lp.name),
      React.createElement(JurisdictionPill, { jurisdiction: lp.jurisdiction })
    ),
    lp.role ? React.createElement("div", { className: "gs-lp-role" }, lp.role) : null,
    lp.debtorStatus ? React.createElement("div", { className: "gs-lp-status" }, lp.debtorStatus) : null
  );
}

function ControlPersonRow({ person }) {
  return React.createElement("div", { className: "gs-control-person" },
    React.createElement("div", { className: "serif gs-control-name" }, person.name),
    person.titles && person.titles.length ? React.createElement("div", { className: "gs-control-titles" }, person.titles.join(" · ")) : null,
    person.role ? React.createElement("div", { className: "gs-control-role" }, person.role) : null,
    person.residence ? React.createElement("div", { className: "gs-control-meta" },
      React.createElement("strong", null, "Residence: "), person.residence) : null,
    person.entity ? React.createElement("div", { className: "gs-control-meta" },
      React.createElement("strong", null, "Entity: "), person.entity) : null,
    person.source ? React.createElement("div", { className: "gs-control-source" }, person.source) : null
  );
}

function GroupStructureView() {
  if (!TREE) {
    return React.createElement("div", { className: "view-shell" },
      React.createElement("div", { className: "vb-section" },
        React.createElement("div", { className: "serif vb-section-headline" }, "Group structure"),
        React.createElement("p", null, "Corporate tree data not loaded.")
      )
    );
  }

  const topCos = Array.isArray(TREE.topCos) ? TREE.topCos : [];
  const lps = Array.isArray(TREE.landHoldingLPs) ? TREE.landHoldingLPs : [];
  const control = Array.isArray(TREE.control) ? TREE.control : [];
  const officers = (PERSONNEL && Array.isArray(PERSONNEL.keyOfficers)) ? PERSONNEL.keyOfficers : [];
  const senior = (PERSONNEL && Array.isArray(PERSONNEL.seniorManagement)) ? PERSONNEL.seniorManagement : [];
  const counterparties = (PERSONNEL && Array.isArray(PERSONNEL.counterparties)) ? PERSONNEL.counterparties : [];
  const counsel = PERSONNEL && PERSONNEL.counsel ? PERSONNEL.counsel : null;
  const advisors = TREE.professionalAdvisors || null;

  const subCount = topCos.reduce((acc, t) => acc + ((t.subsidiaries || []).length), 0);
  const totalCount = topCos.length + subCount + lps.length;

  return React.createElement("div", { className: "view-shell gs-shell" },
    // Hero
    React.createElement("section", { className: "gs-hero" },
      React.createElement("div", { className: "gs-hero-kicker" }, "Group Structure & Relationships"),
      React.createElement("h1", { className: "serif gs-hero-title" }, "The Monette Group corporate tree"),
      React.createElement("div", { className: "gs-hero-stats" },
        React.createElement("div", { className: "gs-hero-stat" },
          React.createElement("div", { className: "serif gs-hero-stat-num" }, topCos.length),
          React.createElement("div", { className: "gs-hero-stat-label" }, "TopCos (parent corporations)")
        ),
        React.createElement("div", { className: "gs-hero-stat" },
          React.createElement("div", { className: "serif gs-hero-stat-num" }, subCount),
          React.createElement("div", { className: "gs-hero-stat-label" }, "Subsidiaries")
        ),
        React.createElement("div", { className: "gs-hero-stat" },
          React.createElement("div", { className: "serif gs-hero-stat-num" }, lps.length),
          React.createElement("div", { className: "gs-hero-stat-label" }, "Land-holding LPs (non-debtor stay parties)")
        ),
        React.createElement("div", { className: "gs-hero-stat" },
          React.createElement("div", { className: "serif gs-hero-stat-num" }, totalCount),
          React.createElement("div", { className: "gs-hero-stat-label" }, "Entities total")
        )
      ),
      TREE.source ? React.createElement("div", { className: "gs-hero-source" }, "Source: " + TREE.source + " · As of " + (TREE.asOf || "petition date")) : null,
      TREE.headquarters ? React.createElement("div", { className: "gs-hero-source" }, "HQ: " + TREE.headquarters) : null
    ),

    // Control & Ownership
    React.createElement("section", { className: "gs-section" },
      React.createElement("div", { className: "serif gs-section-title" }, "Control & ownership"),
      React.createElement("div", { className: "gs-control-grid" },
        control.map((p, i) => React.createElement(ControlPersonRow, { key: p.name + i, person: p }))
      )
    ),

    // 5 TopCos
    React.createElement("section", { className: "gs-section" },
      React.createElement("div", { className: "serif gs-section-title" }, "The five TopCos"),
      React.createElement("div", { className: "gs-section-sub" },
        "Each parent corporation listed below is a Debtor in the CCAA Proceeding. Together with their subsidiaries they form the 17 Applicants."),
      React.createElement("div", { className: "gs-topco-grid" },
        topCos.map((t) => React.createElement(TopCoCard, { key: t.id, topco: t }))
      )
    ),

    // Land-holding LPs
    lps.length ? React.createElement("section", { className: "gs-section gs-section-lps" },
      React.createElement("div", { className: "serif gs-section-title" }, "Land-holding limited partnerships"),
      React.createElement("div", { className: "gs-section-sub" },
        "These three LPs hold beneficial title to substantially all of the Group’s Canadian Real Property — the primary collateral under the Senior Facilities Agreement. They are NOT Applicants in the CCAA but the Initial Order extends the automatic stay over them as Non-Debtor Stay Parties."),
      React.createElement("div", { className: "gs-lp-grid" },
        lps.map((lp, i) => React.createElement(LandLPRow, { key: lp.name + i, lp: lp }))
      )
    ) : null,

    // Officers
    officers.length ? React.createElement("section", { className: "gs-section" },
      React.createElement("div", { className: "serif gs-section-title" }, "Key officers"),
      React.createElement("div", { className: "gs-officer-grid" },
        officers.map((p, i) => React.createElement(ControlPersonRow, { key: p.name + i, person: p }))
      )
    ) : null,

    // Senior management
    senior.length ? React.createElement("section", { className: "gs-section" },
      React.createElement("div", { className: "serif gs-section-title" }, "Senior management (residence-based)"),
      React.createElement("div", { className: "gs-officer-grid" },
        senior.map((p, i) => React.createElement(ControlPersonRow, { key: p.role + i, person: p }))
      )
    ) : null,

    // Counterparties
    counterparties.length ? React.createElement("section", { className: "gs-section" },
      React.createElement("div", { className: "serif gs-section-title" }, "Notable counterparties"),
      React.createElement("div", { className: "gs-officer-grid" },
        counterparties.map((c, i) => React.createElement("div", { key: c.name + i, className: "gs-control-person" },
          React.createElement("div", { className: "serif gs-control-name" }, c.name),
          c.role ? React.createElement("div", { className: "gs-control-role" }, c.role) : null,
          c.source ? React.createElement("div", { className: "gs-control-source" }, c.source) : null
        ))
      )
    ) : null,

    // Professional advisors + counsel
    (advisors || counsel) ? React.createElement("section", { className: "gs-section" },
      React.createElement("div", { className: "serif gs-section-title" }, "Professional advisors & counsel"),
      React.createElement("div", { className: "gs-advisor-grid" },
        advisors && advisors.monitor ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Monitor"),
          React.createElement("div", { className: "gs-advisor-name" }, advisors.monitor)
        ) : null,
        advisors && advisors.restructuringCounsel ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Restructuring counsel"),
          React.createElement("div", { className: "gs-advisor-name" }, advisors.restructuringCounsel)
        ) : null,
        advisors && advisors.syndicateAdvisor ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Syndicate financial advisor"),
          React.createElement("div", { className: "gs-advisor-name" }, advisors.syndicateAdvisor)
        ) : null,
        counsel && counsel.applicants ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Applicants’ counsel"),
          React.createElement("div", { className: "gs-advisor-name" }, counsel.applicants)
        ) : null,
        counsel && counsel.monitorCanadian ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Monitor’s Canadian counsel"),
          React.createElement("div", { className: "gs-advisor-name" }, counsel.monitorCanadian)
        ) : null,
        counsel && counsel.monitorUSForeignRep ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Monitor’s US (Foreign Rep) counsel"),
          React.createElement("div", { className: "gs-advisor-name" }, counsel.monitorUSForeignRep)
        ) : null,
        counsel && counsel.syndicate ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Syndicate counsel"),
          React.createElement("div", { className: "gs-advisor-name" }, counsel.syndicate)
        ) : null,
        counsel && counsel.syndicateFA ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Syndicate FA"),
          React.createElement("div", { className: "gs-advisor-name" }, counsel.syndicateFA)
        ) : null,
        counsel && counsel.soderglenCounsel ? React.createElement("div", { className: "gs-advisor" },
          React.createElement("div", { className: "gs-advisor-role" }, "Soderglen counsel"),
          React.createElement("div", { className: "gs-advisor-name" }, counsel.soderglenCounsel)
        ) : null
      )
    ) : null,

    // Court file footer
    COURT_FACTS && COURT_FACTS.canadianProceedings ? React.createElement("section", { className: "gs-section gs-court-footer" },
      React.createElement("div", { className: "serif gs-section-title" }, "Court file"),
      React.createElement("div", { className: "gs-court-grid" },
        React.createElement("div", null, React.createElement("strong", null, "CCAA: "), COURT_FACTS.canadianProceedings.court + " · file " + COURT_FACTS.canadianProceedings.caseFileNumber),
        React.createElement("div", null, React.createElement("strong", null, "Judge: "), COURT_FACTS.canadianProceedings.judge),
        React.createElement("div", null, React.createElement("strong", null, "Filed: "), COURT_FACTS.canadianProceedings.filingDate),
        COURT_FACTS.usProceedings ? React.createElement("div", null, React.createElement("strong", null, "Chapter 15: "), COURT_FACTS.usProceedings.court + " · case " + COURT_FACTS.usProceedings.caseNumber + " · filed " + COURT_FACTS.usProceedings.petitionFilingDate) : null,
        COURT_FACTS.canadianProceedings.caseWebsite ? React.createElement("div", null,
          React.createElement("strong", null, "Case website: "),
          React.createElement("a", { href: COURT_FACTS.canadianProceedings.caseWebsite, target: "_blank", rel: "noopener noreferrer" }, COURT_FACTS.canadianProceedings.caseWebsite)
        ) : null
      )
    ) : null,

    // Source note
    TREE.note ? React.createElement("section", { className: "gs-section gs-source-note" },
      React.createElement("p", null, TREE.note)
    ) : null
  );
}

window.GroupStructureView = GroupStructureView;
