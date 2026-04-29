# Session Retrospective — 2026-04-29 — Satellite Pivot

**Topic:** Major architectural pivot — removed entire community voting feature; consolidated to satellite-driven atlas as the main page
**Total commits:** 6 on top of `b7d7b30` (post-Bucket-B)
**Wall-clock:** ~3 hours
**Pickup point for next session:** SQL migration execution (user-authorized) + browser smoke test + Bucket C production readiness

This retrospective extends the Bucket A/B loop documented in:
- `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md`
- `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md`

The new pattern this session: **Codex-as-architect for a strategic pivot** (not just a feature increment). Codex's pressure-test surfaced 5 files we'd missed in the initial scope, recommended a removal order that prevents a dangerous middle state, and flagged a pre-existing crash bug (`vigorColorFor` undefined) that Bucket B's data work made imminent.

---

## What shipped

| Commit | What | Files |
|---|---|---|
| `43f6a98` | Operator-relationship layer + supporting data | `view-map.jsx` (+277), `data.js` (+610) |
| `6dfebf6` | Quiesce voting backend (Supabase reads/writes) | `supabase-client.js` 319→104 lines, mirrored to `public/` |
| `d99433d` | Kill Farm Progress page; `#dossiers` redirects to `#map` | `view-dossiers-index.jsx` deleted; `app.jsx` route logic; `index.html` script tag removed |
| `c50e6e2` | Remove all vote UI/copy/tutorial/live feed | 11 files, −914 net lines; `tutorial.jsx` deleted; `vote-board.jsx` deleted; vote-bars + vote-confirm-modal CSS deleted; LiveActivityPanel removed; HeadlineTicker removed; `useQuarter` hook collapsed; localStorage cleanup of `monette.voter.fp`, `monette.myvotes.v1`, `monette.activity.v1`, `monette.q.v4.*` |
| `bb550d6` | Add Seeding mode to atlas + drawer satellite-row + `vigorColorFor` fix | `view-map.jsx` +521/−48, `property-drawer.jsx` updated; new layers `PARCEL_SEEDING_FILL_LAYER` + `PARCEL_SEEDING_OUTLINE_LAYER` (dashed for low-QC); `vigorColorFor(ndvi)` defined with 4-stop ramp |
| `bd492e0` | DROP migration SQL (file written, not executed) | new `supabase/migrations/20260429000000_drop_voting_tables.sql` |
| `7bf8284` | Codex review (`bwgf1888o`) post-fix: corrected migration SQL (`quarter_current_state` is a VIEW not a TABLE; `submit_vote` is `(text x 6)` not `(uuid, text...)`); drawer guardrails for `prior_crop="unknown"` badge + `last_obs_date` SAR-presence check; stale vote copy in mobile legend + point-only drawer + `config.template.js`; confidence-aware `seedingFillColor` ramp (linear-interpolate between pale and bold colors keyed on `seeding_confidence`) | `quarter-panel.jsx`, `view-map.jsx`, `property-drawer.jsx`, `styles.css`, `config.template.js`, migration SQL |

**Atlas state post-pivot:**
- Mode toggle: Tenure / Vigor / Seeding (mutually exclusive, persisted in `localStorage` key `monette.atlas.mode`)
- Default mode: **Seeding** during Apr 1 – Jun 30 window (today is Apr 29 → Seeding default)
- 533 active-window parcels visible: 99 confirmed-seeded (green ramp), 135 not-yet-seeded (red ramp), remainder uncertain (amber)
- `polygon_quality=low` parcels render with dashed outline via separate line layer

**Drawer satellite-row state:**
- 🛰 status string from `seeding_applicability` × `seeding_seeded`
- Confidence percentage
- `last_obs_date` shown only when `dvh_db` is non-null (Codex `beyzs2ym9` Q5 guardrail)
- Collapsible optical features panel (NDTI/BSI/NDVI + source_scene)
- "Crop type unmapped" badge for `prior_crop="unknown"` records (177 active records affected)

**Supabase footprint:**
- After `6dfebf6`: client no longer reads/writes votes; only `tips` is touched (agnonymous tip submission)
- After `bd492e0`: migration file written and committed; tables remain live for ~24h before user-authorized execution

**localStorage cleanup:**
- One-time sweep in `supabase-client.js` removes `monette.voter.fp`, `monette.myvotes.v1`, `monette.activity.v1`, `monette.q.v4.*` on every page load (idempotent, wrapped in try/catch for iOS private mode)

---

## Architectural decisions made

| Decision | Rationale | Source |
|---|---|---|
| **Removal order: Stop reads/writes → Remove UI → Add satellite mode → Drop tables** | Per Codex Q2: prevents the dangerous middle state where deployed clients hammer deleted tables. Three days from commit to deploy gives time for the dropped paths to drain. | Codex `b05w54lpy` Q2 |
| **`#dossiers` silent `replaceState` redirect to `#map`** | Existing links land on the new primary atlas without polluting browser history. 404 would break shared links; hash no-op would leave users on a broken page. | Codex `b05w54lpy` Q3 |
| **Keep `#dossier/<slug>` (singular) for individual dossier articles** | User asked to kill the index, not every article. Article pages still resolve via direct link. | Codex `b05w54lpy` Q3 |
| **Move mode toggle to primary map toolbar** | Atlas is the headline view now; mode is not secondary chrome. | Codex `b05w54lpy` Q6 |
| **Default mode = Seeding during Apr 1 – Jun 30** | Spec §2 phenology window. Today (2026-04-29) is in window. | Spec §2 + Codex Q6 |
| **Keep Vigor mode** | Bucket B populated `ndvi_mean` for 1087 parcels; Vigor remains a useful inspection layer. | Codex `b05w54lpy` Q6 |
| **No Harvest mode in v1** | No real harvest data yet. Don't add a placeholder mode that's empty. | Codex `b05w54lpy` Q6 |
| **vigorColorFor 4-stop ramp** | NDVI thresholds: <0.2 brown (bare), 0.2–0.4 tan (sparse), 0.4–0.6 light green (moderate), >0.6 dark green (dense). null/undefined → transparent. | Implementer choice + Codex review |
| **Delete `tutorial.jsx` rather than rewrite** | Tutorial taught voting. Replacing with a satellite-methodology walkthrough is a separate scope. | Codex `b05w54lpy` Q1 |
| **Delete `vote-board.jsx` (orphan)** | Codex Q8 confirmed: file references `window.QUARTER_STATES` which is never hydrated. Was already dead code. | Codex `b05w54lpy` Q8 |
| **DROP migration file written but not executed** | Destructive shared-infrastructure change requires explicit user authorization. Same gate as the GEE T0 deletion in Bucket A. | Standing practice |
| **localStorage cleanup runs on every page load (idempotent)** | Existing users carry orphan vote state across visits. Run cleanup unconditionally; `removeItem` is no-op on missing keys. | Codex `b05w54lpy` Q1 |
| **`vigorColorFor` fix landed in commit 5 (satellite mode)** | Bucket B's `ndvi_mean` population for 1087 parcels made the latent crash imminent. Fixing it here pairs with the satellite-mode work that surfaces NDVI in the UI. | Codex `b05w54lpy` Q8 + Bucket B impact |

---

## Workflow demonstration: Codex-as-architect for strategic pivots

This was the second session using Codex-as-architect (after Bucket B). The pivot is more *strategic* than Bucket B was — it removes a feature category, not just adds schema fields. Codex's role expanded accordingly.

**Codex contributions:**
1. **Scope expansion:** I'd identified 6 files with vote coupling. Codex Q1 flagged 5 more I'd missed (`tutorial.jsx`, `view-editorial.jsx`, `quarter-panel.jsx`, `vote-board.jsx`, plus localStorage keys).
2. **Removal ordering:** Codex Q2 explicitly recommended Option B (reads → UI → satellite → tables) and named the failure mode it avoids: deployed clients hammering soon-dead tables.
3. **UX defaults:** Codex Q6 confirmed Seeding default during Apr 1 – Jun 30 window (today is in window) + recommended toolbar placement.
4. **Pre-existing bug surface:** Codex Q8 caught `vigorColorFor` undefined — Bucket B's data work made it imminent. Caught before any user hit it.
5. **Commit plan:** Codex Q9 produced the 6-commit ordering that the implementer subagent followed verbatim.

**Implementer subagent contributions:**
- 5 commits in sequence (commits 2–6)
- Surgical staging of each file (no `git add .`)
- 42/42 pytest preserved
- Fresh build outputs (`build/`, `public/build/`)
- Migration SQL written but not executed (respected the "user authorizes destructive shared changes" boundary)

**What I (main session) did:**
- Operator-relationship commit (43f6a98) — minimum-viable surgery on the dirty workdir to preserve the user's in-flight feature work
- Dispatched + monitored Codex pressure-test
- Translated Codex's plan into a structured implementer prompt
- Dispatched + monitored Codex review
- Drafted this retrospective + status doc updates while Codex reviews

**Net effect:** what looked like ~2 hours of careful manual work (figuring out the removal order, finding all the coupling, fixing the latent bug, dropping tables safely) compressed into ~3 hours of mostly-parallel orchestration. Codex did the design + auditor work; subagent did the surgery; I did the orchestration + docs.

---

## Lessons learned

### 1. Codex-as-architect scales from feature increments to strategic pivots.

Bucket B used Codex-as-architect to make 6 design choices for a schema-completeness add. The pivot used the same pattern for a feature-category removal — scope expanded, but the workflow shape didn't. The pressure-test → implementer → review loop holds regardless of whether the work is additive or subtractive.

The unexpected benefit: Codex's pressure-test for a removal naturally surfaces *coupling we'd forgotten about*. Bucket B's design pressure-test focused on "what should we build?"; the pivot's pressure-test focused on "what's actually wired together?" That's a different kind of value-add.

### 2. Pre-existing bugs can become imminent crashes when adjacent quality improves.

`vigorColorFor` had been undefined in `view-map.jsx` for an unknown amount of time. The function was called but with `ndvi_mean=null` flowing through (because the producer hadn't been populating it), the call path was inert — Mapbox's `match` expression presumably short-circuited on null inputs, never reaching the missing function.

Bucket B populated `ndvi_mean` for 1087 parcels. The call path went from "always null input" to "real values 1087/1260 of the time." The undefined function call was now a live crash on the next deploy.

This is the same pattern as Bucket A round-2's `cropland_coverage` projection-mismatch surfacing once the snow QC was fixed: each layer of correctness exposes the next layer's defects. **When you ship a quality improvement, audit adjacent code paths that were dormant because the data was empty.**

### 3. Strategic pivots benefit from preserving a "pre-pivot" historical marker.

The operator-relationship commit (`43f6a98`) is technically separate from the pivot proper, but its inclusion in the pivot session creates a clean snapshot: "this is what was in flight when we changed direction." Future readers (including future-us) can see the operator-relationship feature was an in-flight branch that survived the pivot, alongside the things that didn't.

The alternative (committing operator-relationship in a separate session, then pivoting in another) would have lost that narrative.

### 4. localStorage cleanup is non-obvious but important for graceful migrations.

Removing a feature from the codebase doesn't remove its persisted state from existing users' browsers. `monette.voter.fp` and `monette.myvotes.v1` would have lingered indefinitely without the explicit cleanup in `supabase-client.js`. This applies broadly: any feature that uses `localStorage`, IndexedDB, cookies, or service-worker caches needs a one-time sweep when removed.

The implementation is idempotent (`removeItem` is a no-op on missing keys), wrapped in try/catch for iOS private mode, and runs on every page load until enough users have visited that the cleanup is no longer needed. Practical retention: ~30–60 days of cleanup in place is sufficient for most user bases.

### 5. The dirty workdir was bigger than it looked, and pragmatic > perfect for sorting it out.

The dirty workdir entering this session had 2,155 lines across 16 files mixing operator-relationships, Farm Progress refinements, support cards, site footer, and other unrelated work. I considered three approaches: (a) commit operator-relationship cleanly and leave the rest, (b) snapshot everything as one "pre-pivot" commit, (c) careful per-hunk slicing.

I chose (a) for the visible operator-relationship work (`view-map.jsx` + `data.js` were clean of vote refs after grep verification) and let the pivot commits naturally consume the rest of the dirty hunks. The pivot work was going to touch most of those files anyway; the dirty additions either survived (Site footer, support cards) or got removed alongside the vote code.

Net effect: minimum-viable separation, no per-hunk surgery, clean git history.

### 6. Codex's pressure-test now systematically surfaces 5+ missed touchpoints per session.

Bucket B: Codex flagged the "single best vs median composite" call I'd missed.
Pivot: Codex flagged 5 files I'd missed (`tutorial.jsx`, `view-editorial.jsx`, `quarter-panel.jsx`, `vote-board.jsx`, plus localStorage).

This isn't Codex being "smarter" — it's Codex being **fresh-eyes in a way no in-session subagent can replicate**. By the time I'm proposing scope, I've narrowed my attention to the obvious files. Codex reads the codebase from scratch each time and catches the un-narrowed-to.

**Practice:** the pressure-test prompt should explicitly ask "what am I missing?" not just "is my plan correct?" The former invites Codex to broaden; the latter invites it to narrow.

---

## Standing practices added or refined

The Bucket A/B retrospectives established 11 practices. The pivot reinforces all 11 and adds:

### 12. For strategic pivots (feature-category removals), Codex-as-architect's pressure-test is more valuable than for feature increments.

Removals require knowing all the coupling that exists — knowledge that's rarely fully held by anyone, even the original author. Codex's fresh-eyes scan reliably finds 5+ touchpoints per pivot that the in-session driver missed. For additive feature work, the value is design-decision quality; for removal work, the value is coupling-discovery completeness.

When dispatching a Codex pressure-test for a removal, explicitly ask Q1: "what coupling am I missing?" — open question, not yes/no.

### 13. Audit adjacent code paths when shipping data-quality improvements.

When a producer fix makes a previously-empty data slot non-empty (or fixes a previously-wrong value), adjacent consumers that were inert (or quietly producing wrong output) become live. Bucket B's `ndvi_mean` population made `vigorColorFor` imminent. Bucket A round-2's `cropland_coverage` correction made the CDL semantics bug visible.

Practice: after any data-correctness commit, grep for consumers of the corrected field and audit their code paths. If they assume a different shape or a missing function, fix before deploying.

### 14. Persisted state needs explicit cleanup when its writer is removed.

`localStorage`, IndexedDB, cookies, service-worker caches — any state that outlives the page session needs explicit cleanup when the feature that wrote it is removed. The cleanup is idempotent (safe to run on every page load until orphan keys are extinct) and try/catch-wrapped (iOS private mode and storage quotas can throw).

For Monette: any future feature removal that touched `localStorage` should add a sweep at `supabase-client.js` IIFE top, alongside the existing one.

---

## Pre-existing bugs surfaced (and addressed)

| Bug | Found by | Status |
|---|---|---|
| `vigorColorFor` called but undefined in `view-map.jsx` | Codex `b05w54lpy` Q8 | FIXED in commit `bb550d6` |
| `vote-board.jsx` orphan referencing `window.QUARTER_STATES` | Codex `b05w54lpy` Q8 | FIXED — file deleted in commit `c50e6e2` |
| Farm Progress homepage totals leak local visitor vote state into "public" view | Codex `b05w54lpy` Q8 | MOOT — page deleted in commit `d99433d` |
| `vote_latest_seeded_per_prop` view read by client but no migration creates it | Codex `b05w54lpy` Q8 | DROP migration handles it (in `bd492e0`); the missing-creation is a Bucket-C audit item |
| `config.template.js` may have stale satellite-mode aliasing | Codex `b05w54lpy` Q8 | Bucket C audit item — not blocking the pivot |

---

## Next session pickup (priority order)

1. **Execute the SQL migration** (`supabase/migrations/20260429000000_drop_voting_tables.sql`) once 24+ hours have elapsed since deploy. The migration is idempotent + transactional. After execution, verify `tips` table is preserved and the 4 vote-related objects are gone.

2. **Browser smoke test** against the local preview server. Confirm:
   - Atlas loads with Seeding mode default (Apr–Jun)
   - Mode toggle persists across reloads
   - Drawer satellite-row renders correctly for active / perennial / out-of-season / insufficient_baseline / unmapped applicability values
   - "Crop type unmapped" badge appears on `prior_crop="unknown"` records
   - `last_obs_date` is suppressed for non-SAR records
   - Optical-features panel collapsible chrome works
   - `#dossiers` URL silent-redirects to `#map` (clean back button)
   - No console errors related to undefined functions or missing globals
   - localStorage shows orphan keys cleared on next visit

3. **Bucket C — production readiness** (per status doc):
   - Server-side `reduceRegions` per territory shard
   - S1 collection filter completeness (VV/VH `listContains`, resolution, edge masking)
   - ERA5 lag dynamic detection + `precip_data_partial` flag
   - Audit `config.template.js` for stale satellite aliasing (Codex Q8)
   - Audit `vote_latest_seeded_per_prop` migration definition (Codex Q8)

4. **Mid-May calendar item** — rerun SK T0 once ERA5 publishes through May ~21 → unblock Hafford/Kamsack/Wymark active calls (currently insufficient_baseline due to lingering snow).

5. **Genoa CO `cropland_coverage = 0` diagnosis** (small, non-blocking) — pixel-alignment edge case at small CO bbox + strict CDL filter.

6. **Phase 8 — per-territory threshold calibration** (after vote labels accrue — but with voting removed, this calibration source no longer exists; alternative source needed: ground-truth seeding observations submitted via agnonymous, satellite-vote disagreement labels from operator review, etc.).

---

## Reference index

| Topic | Path |
|---|---|
| Canonical project status | `docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md` |
| Design contract (spec, rev 4) | `docs/superpowers/specs/2026-04-28-monette-satellite-seeding-design.md` |
| v1 ship + initial Codex review retrospective | `docs/superpowers/specs/2026-04-28-session-retrospective.md` |
| Bucket A cleanup retrospective (3-round Codex review loop) | `docs/superpowers/specs/2026-04-28-bucket-a-cleanup-retrospective.md` |
| Bucket B retrospective (Codex-as-architect debut) | `docs/superpowers/specs/2026-04-29-bucket-b-retrospective.md` |
| **This file (satellite pivot retrospective)** | `docs/superpowers/specs/2026-04-29-satellite-pivot-retrospective.md` |
| GEE platform gotchas (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/gee_setup_gotchas.md` |
| Workflow practices (cross-session memory) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md` |
| CLI reference (Codex/Gemini/Claude) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/cli_reference.md` |
