// Shared education plus the legacy reviewed-update modal. Public correction
// discussion now routes to Agnonymous; this modal remains as a fallback queue.

function tutorialMetrics() {
  const largest = [...(D.properties || [])].sort((a, b) => (b.titled || 0) - (a.titled || 0))[0] || null;
  return {
    largestName: largest ? largest.name : "Vanguard",
    largestAcres: largest ? largest.titled || 0 : 0,
  };
}

function HowVotingWorks({ open, onClose, onStart }) {
  const [step, setStep] = useState(0);
  const [demoOwnership, setDemoOwnership] = useState("owned-monette");
  const [demoVotes, setDemoVotes] = useState({
    "owned-monette": 12,
    sold: 3,
    "rented-monette": 4,
    "returned-to-ll": 1,
    unknown: 0,
  });

  const metrics = tutorialMetrics();
  const totalSteps = 4;

  const nextStep = () => setStep((n) => Math.min(totalSteps - 1, n + 1));
  const prevStep = () => setStep((n) => Math.max(0, n - 1));

  const castDemo = (key) => {
    setDemoVotes((prev) => {
      const next = { ...prev };
      if (demoOwnership && demoOwnership !== key) {
        next[demoOwnership] = Math.max(0, (next[demoOwnership] || 0) - 1);
      }
      if (demoOwnership !== key) next[key] = (next[key] || 0) + 1;
      return next;
    });
    setDemoOwnership(key);
  };

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setStep(0);
    setDemoOwnership("owned-monette");
    setDemoVotes({
      "owned-monette": 12,
      sold: 3,
      "rented-monette": 4,
      "returned-to-ll": 1,
      unknown: 0,
    });
  }, [open]);

  if (!open) return null;

  const steps = [
    {
      kicker: "STEP 1 · PICK A PROPERTY",
      title: "Start with a block you actually know.",
      blurb: `The ledger covers ${PORTFOLIO.totalProperties} Monette properties across Saskatchewan, Manitoba, and Montana. The largest titled block right now is ${metrics.largestName} at ${fmt(metrics.largestAcres)} acres, but the workflow is the same on every file: open the property, scan the rollup, then drill into titles and quarter rows.`,
      visual: <MockPropertyRow />,
      caption: "Open any property from the Ledger, Register, or Atlas.",
    },
    {
      kicker: "STEP 2 · OPEN A TITLE OR QUARTER ROW",
      title: "Registry titles and mapped quarter rows are not the same thing.",
      blurb: `Each property file shows the public title count, while the quarter drawer shows the rows that have been prepared for voting. Today the register carries ${fmt(PORTFOLIO.totalTitles)} titles and the drawers expose ${fmt(PORTFOLIO.totalMappedParcels)} quarter rows. The atlas map has its own geometry count, so the app keeps those numbers separate on purpose.`,
      visual: <MockQuarterRow />,
      caption: "The drawer shows the current quarter-row set instead of pretending map geometry is complete everywhere.",
    },
    {
      kicker: "STEP 3 · VOTE WHAT YOU SAW",
      title: "Three categories, one action at a time.",
      blurb: "Ownership and listing are single-pick community votes. Season observations are one-and-done event logs for seeded, sprayed, and harvested. Try the demo below: the highlighted bar moves exactly the way the live ownership vote bars move in the real quarter drawer.",
      visual: (
        <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", padding: 18 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-2)",
            marginBottom: 10,
            fontWeight: 600,
          }}>
            OWNERSHIP · WHO CONTROLS THIS QUARTER?
          </div>
          <VoteBars entries={demoVotes} meta={OWN} active={demoOwnership} onVote={castDemo} />
          <div className="mono" style={{ marginTop: 12, fontSize: 11, color: "var(--ink-2)" }}>
            Practice only. The real drawer writes through the vote RPC and updates the shared tally view.
          </div>
        </div>
      ),
      caption: "The vote widgets in this tutorial are the same primitives used in the live app.",
    },
    {
      kicker: "STEP 4 · WATCH THE ROLLUP MOVE",
      title: "Votes change the rollup, not the registry.",
      blurb: "Every quarter vote feeds the property rollup bar so readers can see where the community thinks land has been sold, rented, or returned. The hard numbers stay separate: titled acres and title counts come from the property file, while quarter-row coverage and vote tallies change as data and submissions improve.",
      visual: <MockRollupShift />,
      caption: "This is why the app now labels titles, quarter rows, and map geometry separately.",
    },
  ];

  const current = steps[step];

  return (
    <div
      onClick={onClose}
      className="tut-scrim"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(19,17,14,0.62)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="tut-modal"
        style={{
          width: 900,
          maxWidth: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--paper)",
          border: "2px solid var(--ink)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          className="tut-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 28px",
            borderBottom: "2px solid var(--ink)",
            background: "var(--ink)",
            color: "var(--paper)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span className="serif tut-title" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>
              How voting works
            </span>
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "#b48638" }}>
              {step + 1} / {totalSteps}
            </span>
          </div>
          <button
            onClick={onClose}
            className="tut-close"
            style={{
              padding: "8px 12px",
              fontSize: 12,
              fontFamily: "inherit",
              border: "1px solid #3a342a",
              background: "transparent",
              color: "var(--paper)",
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            Close x
          </button>
        </div>

        <div className="tut-progress" style={{ display: "flex", gap: 6, padding: "12px 28px 0" }}>
          {steps.map((item, index) => (
            <button
              key={item.kicker}
              type="button"
              onClick={() => setStep(index)}
              aria-label={`Go to tutorial step ${index + 1}`}
              style={{
                flex: 1,
                height: 8,
                cursor: "pointer",
                border: 0,
                background: index <= step ? "var(--ink)" : "var(--rule)",
              }}
            />
          ))}
        </div>

        <div
          className="tut-body"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 32,
            padding: "28px 28px 20px",
          }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a3a2a", fontWeight: 600 }}>
              {current.kicker}
            </div>
            <div className="serif tut-step-title" style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0 14px", letterSpacing: "-0.015em" }}>
              {current.title}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
              {current.blurb}
            </div>
            <div
              className="mono"
              style={{
                marginTop: 18,
                padding: "10px 12px",
                background: "var(--paper-2)",
                borderLeft: "3px solid var(--gold)",
                fontSize: 12,
                color: "var(--ink)",
                letterSpacing: "0.02em",
              }}
            >
              {current.caption}
            </div>
          </div>

          <div>{current.visual}</div>
        </div>

        <div
          className="tut-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 28px",
            borderTop: "1px solid var(--rule)",
            background: "var(--paper-2)",
            gap: 10,
          }}
        >
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="tut-back"
            style={{
              padding: "11px 16px",
              fontSize: 13,
              fontFamily: "inherit",
              border: "1px solid var(--rule-2)",
              background: "transparent",
              color: "var(--ink)",
              cursor: step === 0 ? "default" : "pointer",
              opacity: step === 0 ? 0.35 : 1,
              letterSpacing: "0.04em",
            }}
          >
            Back
          </button>

          <div className="tut-hint mono" style={{ fontSize: 10, color: "var(--mute)", letterSpacing: "0.08em" }}>
            Use left/right arrows or the progress rail
          </div>

          {step < totalSteps - 1 ? (
            <button onClick={nextStep} className="btn btn-dark tut-next" style={{ padding: "11px 18px", fontSize: 13 }}>
              Next
            </button>
          ) : (
            <button
              onClick={() => {
                if (onStart) onStart();
                onClose();
              }}
              className="btn btn-dark tut-next"
              style={{ padding: "11px 18px", fontSize: 13 }}
            >
              Open register
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MockPropertyRow() {
  const vanguard = D.properties.find((property) => property.id === "vanguard") || D.properties[0];
  const rollup = vanguard ? rollupProperty(vanguard.id).rollup : { total: 0, owned: 0, rented: 0, sold: 0, returned: 0, unknown: 0 };

  return (
    <div style={{ border: "1px solid var(--ink)", padding: 16, background: "var(--paper)" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>
        {vanguard.province} · {vanguard.region}
      </div>
      <div className="serif" style={{ fontSize: 38, lineHeight: 1, marginTop: 6, letterSpacing: "-0.01em" }}>
        {vanguard.name}
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 6 }}>
        {fmt(vanguard.titled)} titled ac · {fmt(vanguard.parcels)} titles · {fmt(rollup.total)} quarter rows
      </div>
      <div style={{ marginTop: 14 }}>
        <RollupBar rollup={rollup} />
      </div>
      <div className="mono" style={{ marginTop: 12, borderTop: "1px dashed var(--rule-2)", paddingTop: 10, fontSize: 11, color: "var(--gold-ink)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
        Open the file, then drill into one row at a time
      </div>
    </div>
  );
}

function MockQuarterRow() {
  return (
    <div style={{ border: "1px solid var(--rule)", background: "var(--paper)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr auto auto",
          gap: 10,
          alignItems: "center",
          padding: "12px 14px",
          borderBottom: "1px dashed var(--rule-2)",
        }}
      >
        <span className="mono" style={{ fontSize: 11, color: "var(--mute)" }}>07</span>
        <div>
          <div className="mono" style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>NE-12-35-18-W3</div>
          <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>160 ac · Canola · soil F</div>
        </div>
        <OwnershipPill kind="owned-monette" compact />
        <span className="mono" style={{ fontSize: 10, color: "var(--gold-ink)", border: "1px solid var(--gold-ink)", padding: "2px 6px", letterSpacing: "0.08em" }}>
          OPEN
        </span>
      </div>
      <div
        style={{
          padding: "12px 14px",
          background: "var(--paper-2)",
          fontSize: 11,
          color: "var(--ink-2)",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span className="mono" style={{ letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gold-ink)", fontWeight: 600 }}>
          Expanded
        </span>
        <span>Ownership, listing, and season voting all live inside the same drawer.</span>
      </div>
    </div>
  );
}

function MockRollupShift() {
  const before = { total: 16, owned: 16, rented: 0, sold: 0, returned: 0, unknown: 0 };
  const after = { total: 16, owned: 9, rented: 3, sold: 3, returned: 1, unknown: 0 };

  return (
    <div style={{ border: "1px solid var(--rule)", background: "var(--paper)", padding: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 4, fontWeight: 600 }}>
        Before community votes
      </div>
      <RollupBar rollup={before} />
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>
        16 owned · 0 sold · 0 rented
      </div>

      <div style={{ textAlign: "center", padding: "14px 0", fontSize: 22, color: "var(--mute)" }}>↓</div>

      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a3a2a", marginBottom: 4, fontWeight: 600 }}>
        After repeated field reports
      </div>
      <RollupBar rollup={after} />
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>
        9 owned · 3 sold · 3 rented · 1 returned
      </div>
    </div>
  );
}

function SubmitHeadlineModal({ open, onClose, initialPropertyId, initialText = "" }) {
  const [propertyId, setPropertyId] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setPropertyId("");
    setText("");
    setAuthor("");
    setStatus("idle");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPropertyId(initialPropertyId || "");
    setText(initialText || "");
  }, [open, initialPropertyId, initialText]);

  if (!open) return null;

  const submit = async () => {
    const body = text.trim();
    if (!body || status === "saving") return;

    setStatus("saving");
    setError("");

    try {
      const ok = await (window.monetteSubmitTip
        ? window.monetteSubmitTip({
            kind: "headline",
            propId: propertyId || null,
            body,
            author: author.trim() || null,
          })
        : false);

      if (!ok) {
        setStatus("error");
        setError("Update queue unavailable. Enable Supabase or check the tips table permissions.");
        return;
      }

      setStatus("success");
      if (window.monetteHydrateHeadlines) {
        window.monetteHydrateHeadlines().catch(() => {});
      }
    } catch (err) {
      setStatus("error");
      setError(err && err.message ? err.message : "Unable to queue the update.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(19,17,14,0.62)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 680,
          maxWidth: "100%",
          background: "var(--paper)",
          border: "2px solid var(--ink)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            background: "var(--ink)",
            color: "var(--paper)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>Submit an update</span>
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "#b48638" }}>
              MODERATED QUEUE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              fontSize: 11,
              fontFamily: "inherit",
              border: "1px solid #3a342a",
              background: "transparent",
              color: "var(--paper)",
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            Close x
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {status === "success" ? (
            <div style={{
              padding: "14px 16px",
              background: "rgba(78,106,48,0.08)",
              border: "1px solid rgba(78,106,48,0.28)",
              color: "var(--ink)",
            }}>
              <div className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>Queued for review</div>
              <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
                Your update was stored in the moderation queue. Reviewed items can be promoted into the public ticker, used to update point-only files, or used to create future parcel rows.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)", marginBottom: 16 }}>
                Use this only for grounded source evidence a Monette moderator needs to review directly. Public correction threads and banter belong on Agnonymous. Quarter votes publish through mapped quarter rows; point-only assets open Agnonymous evidence threads first.
              </div>

              <label htmlFor="submit-property" style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, fontWeight: 600 }}>
                Property (optional)
              </label>
              <select
                id="submit-property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                style={{
                  width: "100%",
                  fontFamily: "inherit",
                  fontSize: 13,
                  padding: "10px 12px",
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  marginBottom: 14,
                }}
              >
                <option value="">General / not tied to one property</option>
                {D.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} · {property.province}
                  </option>
                ))}
              </select>

              <label htmlFor="submit-body" style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, fontWeight: 600 }}>
                What did you see?
              </label>
              <textarea
                id="submit-body"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                rows={4}
                placeholder="Example: Regina South sale report - link/source, buyer if known, quarter/legal description, and how certain you are."
                style={{
                  width: "100%",
                  fontFamily: "inherit",
                  fontSize: 14,
                  padding: "10px 12px",
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  marginBottom: 14,
                  resize: "vertical",
                }}
              />

              <label htmlFor="submit-author" style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, fontWeight: 600 }}>
                Your handle (optional)
              </label>
              <input
                id="submit-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="@prairiespotter"
                style={{
                  width: "100%",
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 13,
                  padding: "10px 12px",
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  marginBottom: 16,
                }}
              />

              <div
                className="mono"
                style={{
                  padding: "10px 12px",
                  background: "var(--paper-2)",
                  borderLeft: "3px solid var(--gold)",
                  fontSize: 12,
                  color: "var(--ink)",
                  marginBottom: 18,
                }}
              >
                Queue rule: one concrete observation per submission. If the claim is uncertain, say that plainly. Reviewed updates can become public ticker items or source material for new parcel rows.
              </div>

              {status === "error" && (
                <div style={{ marginBottom: 12, color: "#9a3a2a", fontSize: 12 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "14px 24px",
            borderTop: "1px solid var(--rule)",
            background: "var(--paper-2)",
          }}
        >
          {status === "success" ? (
            <button onClick={onClose} className="btn btn-dark">
              Close
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn">Cancel</button>
              <button
                onClick={submit}
                className="btn btn-dark"
                disabled={!text.trim() || status === "saving"}
                style={{
                  opacity: text.trim() && status !== "saving" ? 1 : 0.45,
                  cursor: text.trim() && status !== "saving" ? "pointer" : "default",
                }}
              >
                {status === "saving" ? "Queueing..." : "Queue for review"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.HowVotingWorks = HowVotingWorks;
window.SubmitHeadlineModal = SubmitHeadlineModal;
