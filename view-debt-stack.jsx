// VIEW - Debt Stack. Renders the full Monette Group capital structure as
// a horizontal bar chart with priority ordering, plus a per-facility detail
// table and the DIP Credit Facility milestone schedule.
//
// Source: window.MONETTE_DATA.debtStack (built from Helkaa Declaration
// paras 24-50 + Monette Group Structure & Relationships diagram).
//
// Layout:
//   1. Hero — total liabilities, SFA share, DIP size
//   2. Priority bar — court-ordered super-priority charges (1.5/95/1.5)
//   3. The Stack — each facility as a horizontal bar sized by outstanding
//   4. Per-facility detail cards
//   5. DIP Facility milestones timeline

const DEBT_STACK = (window.MONETTE_DATA && window.MONETTE_DATA.debtStack) || null;

function fmtMoney(n) {
  if (n == null) return "n/a";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("en-CA");
}

const FACILITY_COLORS = {
  "sfa": "#9a3a2a",
  "fcc": "#b48638",
  "soderglen-vtb": "#c8a64a",
  "scotiabank-bilateral-equipment": "#3f6a32",
  "scotia-newlife-policy-debt": "#3a4a6e",
  "john-deere-pmsis": "#6e3b1f",
  "third-party-equipment": "#8c5a2c",
  "real-property-leases": "#5aa6c9",
};

function FacilityBar({ facility, totalForScale }) {
  const out = facility.outstandingApproxCAD || 0;
  const pct = totalForScale ? (out / totalForScale) * 100 : 0;
  const color = FACILITY_COLORS[facility.id] || "#6a6a6a";
  return React.createElement("div", { className: "ds-bar-row" },
    React.createElement("div", { className: "ds-bar-label" }, facility.label),
    React.createElement("div", { className: "ds-bar-track" },
      React.createElement("div", {
        className: "ds-bar-fill",
        style: { width: pct.toFixed(2) + "%", background: color }
      })
    ),
    React.createElement("div", { className: "ds-bar-amount" }, fmtMoney(out))
  );
}

function FacilityCard({ facility }) {
  const components = Array.isArray(facility.components) ? facility.components : [];
  return React.createElement("div", { className: "ds-card" },
    React.createElement("div", { className: "ds-card-head" },
      React.createElement("div", { className: "serif ds-card-title" }, facility.label),
      React.createElement("div", { className: "ds-card-amount" }, fmtMoney(facility.outstandingApproxCAD))
    ),
    facility.agent ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Agent / lender: "), facility.agent + (facility.lenders && facility.lenders !== facility.agent ? " · " + (Array.isArray(facility.lenders) ? facility.lenders.join(", ") : facility.lenders) : "")
    ) : null,
    facility.size ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Facility size: "),
      facility.size.totalCAD ? fmtMoney(facility.size.totalCAD) : "—",
      facility.size.revolvingGeneral ? " (incl. " + fmtMoney(facility.size.revolvingGeneral) + " revolving general + " + fmtMoney(facility.size.revolvingCapex) + " revolving capex + " + fmtMoney(facility.size.swingline) + " swingline)" : ""
    ) : null,
    facility.maturityDate ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Maturity: "), facility.maturityDate
    ) : null,
    facility.originalDate ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Original date: "), facility.originalDate +
      (facility.lastAmendedDate ? " · last amended " + facility.lastAmendedDate : "")
    ) : null,
    facility.interest ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Interest: "), facility.interest
    ) : null,
    facility.collateral ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Collateral: "), facility.collateral
    ) : null,
    facility.guarantors ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Guarantors: "), facility.guarantors
    ) : null,
    facility.status ? React.createElement("div", { className: "ds-card-meta ds-card-status" },
      React.createElement("strong", null, "Status: "), facility.status
    ) : null,
    facility.permittedDebtStatus ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Permitted Debt status: "), facility.permittedDebtStatus
    ) : null,
    facility.policy ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Policy: "),
      "Insured life " + facility.policy.insuredLife +
      " · Maximum benefit (net of loan) " + fmtMoney(facility.policy.maxBenefitNetOfLoanCAD) +
      " · Premium due " + fmtMoney(facility.policy.premiumDueMay4_2026CAD) + " on May 4, 2026"
    ) : null,
    typeof facility.unitsLeased === "number" ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Equipment units: "), facility.unitsLeased + " (across " + facility.registrations + " PMSI registrations) · Annual lease " + fmtMoney(facility.annualLeasePaymentCAD)
    ) : null,
    typeof facility.annualLeasePaymentCAD === "number" && !facility.unitsLeased ? React.createElement("div", { className: "ds-card-meta" },
      React.createElement("strong", null, "Annual obligation: "), fmtMoney(facility.annualLeasePaymentCAD) + " · " + (facility.leasesCount || 0) + " leases · " + (facility.cadence || "")
    ) : null,
    facility.note ? React.createElement("div", { className: "ds-card-note" }, facility.note) : null,
    components.length ? React.createElement("div", { className: "ds-card-components" },
      React.createElement("div", { className: "ds-card-components-head" }, "Components"),
      components.map((c, i) => React.createElement("div", { key: i, className: "ds-component" },
        React.createElement("div", { className: "ds-component-name" }, c.name || c.label),
        React.createElement("div", { className: "ds-component-amount" }, fmtMoney(c.outstandingCAD || c.amount)),
        c.collateralLocation ? React.createElement("div", { className: "ds-component-meta" }, "Location: " + c.collateralLocation) : null,
        c.collateralType ? React.createElement("div", { className: "ds-component-meta" }, "Collateral type: " + c.collateralType) : null
      ))
    ) : null,
    Array.isArray(facility.components) && facility.components.every(c => typeof c === "string") ? React.createElement("ul", { className: "ds-card-bullets" },
      facility.components.map((c, i) => React.createElement("li", { key: i }, c))
    ) : null
  );
}

function PriorityBar({ charges, dipMaxCAD }) {
  if (!charges) return null;
  const total = charges.reduce((s, c) => s + (c.maxCAD || 0), 0) || dipMaxCAD || 1;
  return React.createElement("div", { className: "ds-priority-bar" },
    React.createElement("div", { className: "ds-priority-track" },
      charges.map((c, i) => React.createElement("div", {
        key: c.label + i,
        className: "ds-priority-seg",
        style: { width: ((c.maxCAD || 0) / total * 100).toFixed(1) + "%", background: i === 0 ? "#3f6a32" : (i === 1 ? "#9a3a2a" : "#b48638") },
        title: "#" + c.rank + " " + c.label + " — " + fmtMoney(c.maxCAD)
      },
        React.createElement("div", { className: "ds-priority-rank" }, "#" + c.rank),
        React.createElement("div", { className: "ds-priority-label" }, c.label),
        React.createElement("div", { className: "ds-priority-amount" }, fmtMoney(c.maxCAD))
      ))
    )
  );
}

function MilestoneRow({ ms }) {
  return React.createElement("div", { className: "ds-milestone" },
    React.createElement("div", { className: "ds-milestone-date" }, ms.date),
    React.createElement("div", { className: "ds-milestone-label" }, ms.label)
  );
}

function DebtStackView() {
  if (!DEBT_STACK) {
    return React.createElement("div", { className: "view-shell" },
      React.createElement("div", { className: "vb-section" },
        React.createElement("div", { className: "serif vb-section-headline" }, "Debt stack"),
        React.createElement("p", null, "Capital structure data not loaded.")
      )
    );
  }

  const facilities = Array.isArray(DEBT_STACK.facilities) ? DEBT_STACK.facilities : [];
  const dip = DEBT_STACK.dipFacility || null;
  const totalLiabilities = DEBT_STACK.totalLiabilitiesApproxCAD || 0;

  // Use SFA size as the visual scale anchor — every other facility is shown
  // relative to the SFA so the eye sees the dominance of senior secured.
  const sfa = facilities.find(f => f.id === "sfa");
  const sfaTotal = sfa && sfa.outstandingApproxCAD ? sfa.outstandingApproxCAD : 0;
  const scaleAnchor = Math.max(sfaTotal, ...facilities.map(f => f.outstandingApproxCAD || 0));

  return React.createElement("div", { className: "view-shell ds-shell" },
    // Hero
    React.createElement("section", { className: "ds-hero" },
      React.createElement("div", { className: "ds-hero-kicker" }, "Capital structure"),
      React.createElement("h1", { className: "serif ds-hero-title" }, "The debt stack"),
      React.createElement("div", { className: "ds-hero-stats" },
        React.createElement("div", { className: "ds-hero-stat" },
          React.createElement("div", { className: "serif ds-hero-stat-num" }, fmtMoney(totalLiabilities)),
          React.createElement("div", { className: "ds-hero-stat-label" }, "Total liabilities at petition")
        ),
        sfa ? React.createElement("div", { className: "ds-hero-stat" },
          React.createElement("div", { className: "serif ds-hero-stat-num" }, fmtMoney(sfa.outstandingApproxCAD)),
          React.createElement("div", { className: "ds-hero-stat-label" }, "Senior Facilities (SFA)")
        ) : null,
        dip ? React.createElement("div", { className: "ds-hero-stat" },
          React.createElement("div", { className: "serif ds-hero-stat-num" }, fmtMoney(dip.sizeCAD)),
          React.createElement("div", { className: "ds-hero-stat-label" }, "DIP Credit Facility (max)")
        ) : null
      ),
      DEBT_STACK.source ? React.createElement("div", { className: "ds-hero-source" }, "Source: " + DEBT_STACK.source) : null,
      DEBT_STACK.petitionDate ? React.createElement("div", { className: "ds-hero-source" }, "Petition date: " + DEBT_STACK.petitionDate) : null
    ),

    // DIP Charges priority
    dip && Array.isArray(dip.charges) ? React.createElement("section", { className: "ds-section" },
      React.createElement("div", { className: "serif ds-section-title" }, "Court-ordered super-priority charges"),
      React.createElement("div", { className: "ds-section-sub" },
        "Granted under the CCAA Initial Order (¶40) — these charges rank ahead of ALL pre-petition debt below, except that the DIP Lenders’ Charge and Directors’ Charge are junior to FCC’s lien on cattle (¶42(a))."),
      React.createElement(PriorityBar, { charges: dip.charges, dipMaxCAD: dip.sizeCAD })
    ) : null,

    // The Stack
    React.createElement("section", { className: "ds-section" },
      React.createElement("div", { className: "serif ds-section-title" }, "Pre-petition facilities by outstanding amount"),
      React.createElement("div", { className: "ds-bar-list" },
        facilities.filter(f => typeof f.outstandingApproxCAD === "number" && f.outstandingApproxCAD > 0).map((f) =>
          React.createElement(FacilityBar, { key: f.id, facility: f, totalForScale: scaleAnchor })
        )
      )
    ),

    // Per-facility cards
    React.createElement("section", { className: "ds-section" },
      React.createElement("div", { className: "serif ds-section-title" }, "Facility-by-facility detail"),
      React.createElement("div", { className: "ds-card-grid" },
        facilities.map((f) => React.createElement(FacilityCard, { key: f.id, facility: f }))
      )
    ),

    // DIP Facility detail
    dip ? React.createElement("section", { className: "ds-section ds-section-dip" },
      React.createElement("div", { className: "serif ds-section-title" }, "DIP Credit Facility"),
      React.createElement("div", { className: "ds-dip-meta-grid" },
        React.createElement("div", null, React.createElement("strong", null, "Size: "), fmtMoney(dip.sizeCAD) + " (Initial: " + fmtMoney(dip.initialAvailabilityCAD) + ")"),
        React.createElement("div", null, React.createElement("strong", null, "Type: "), dip.type),
        React.createElement("div", null, React.createElement("strong", null, "Agent: "), dip.agent),
        React.createElement("div", null, React.createElement("strong", null, "Borrowers: "), Array.isArray(dip.borrowers) ? dip.borrowers.join(" + ") : dip.borrowers),
        React.createElement("div", null, React.createElement("strong", null, "Lenders: "), Array.isArray(dip.lenders) ? dip.lenders.join(", ") : dip.lenders),
        React.createElement("div", null, React.createElement("strong", null, "Pricing: "), dip.pricing),
        dip.maturityOutsideDate ? React.createElement("div", null, React.createElement("strong", null, "Maturity: "), dip.maturityOutsideDate) : null,
        dip.cashSweep ? React.createElement("div", null, React.createElement("strong", null, "Cash sweep: "), dip.cashSweep) : null,
        dip.varianceTolerance ? React.createElement("div", null, React.createElement("strong", null, "Variance EoD: "), dip.varianceTolerance) : null,
        dip.grainBusinessWindDown ? React.createElement("div", null, React.createElement("strong", null, "Grain business: "), dip.grainBusinessWindDown) : null,
        dip.cattleBusinessAuthorization ? React.createElement("div", null, React.createElement("strong", null, "Cattle business: "), dip.cattleBusinessAuthorization) : null
      ),
      Array.isArray(dip.milestones) && dip.milestones.length ? React.createElement("div", { className: "ds-milestones" },
        React.createElement("div", { className: "serif ds-milestones-title" }, "Restructuring milestones"),
        dip.milestones.map((ms, i) => React.createElement(MilestoneRow, { key: ms.date + i, ms: ms }))
      ) : null,
      dip.source ? React.createElement("div", { className: "ds-dip-source" }, dip.source) : null
    ) : null,

    DEBT_STACK.note ? React.createElement("section", { className: "ds-section ds-source-note" },
      React.createElement("p", null, DEBT_STACK.note)
    ) : null
  );
}

window.DebtStackView = DebtStackView;
