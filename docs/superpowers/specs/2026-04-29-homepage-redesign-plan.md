# Homepage Redesign Plan — 2026-04-29

**Status:** Plan + handoff brief; execution split across 2 future sessions per user direction ("we will likely need to spin up new sessions to complete all this work").
**Codex pressure-test:** `bvqyinxv4` — see below for the integrated guidance.
**Repo state:** HEAD = `b770cc0` (satellite pivot complete; voting fully removed; Atlas already satellite-driven).
**Branch:** `main`.

---

## What the user asked for (paraphrased verbatim)

1. **Map mode toggle** between Seeding and Land Status only (currently Tenure / Vigor / Seeding). Default to Seeding.
2. **Map becomes the home page** (currently `#editorial`).
3. **Homepage layout:** Donate button at top → existing hero stats portion (the screenshot: "400,000+ acre footprint" / province grid / Verified Observations card) → new map embed below.
4. **Delete the Stewart Valley sold marker.** Land moves into the register only.
5. **Live feed** = the subject line of the last 5 Agnonymous posts (tips).
6. User explicitly said the work is too big for one session: "we will likely need to spin up new sessions to complete all this work."

---

## Investigation summary (this session)

| Touchpoint | Where | Notes |
|---|---|---|
| Default route | `app.jsx:26-41` `parseHash()` | Default is `#editorial`. Already has the `#dossiers → #map` redirect from the satellite pivot. New default = `#map`. |
| Hero stats portion | `view-editorial.jsx:183-235` | Exact match to the user's screenshot. PORTFOLIO acres + province grid + Verified Observations card. PRESERVE. |
| Editorial extras | `view-editorial.jsx:236+` | Vanguard lead story, "also in the file" secondary cards, full 13-property ledger table. **Decision pending — see Codex Q8 below.** |
| Map mode toggle | `view-map.jsx` | Tenure / Vigor / Seeding. Seeding fill confidence-modulated (commit `7bf8284`). Default Seeding for Apr 1 – Jun 30. |
| Vigor mode | uses `ndvi_mean` | 1087/1260 parcels populated by Bucket B. Dropping Vigor wastes that surface unless folded into Seeding. |
| Donate config | `components.jsx:379` `MONETTE_SUPPORT` | PayPal-based: tiers $5/$20/$50 + custom-amount URL `paypal.me/buperac`. Currently surfaced via `SupportCard` (multi-tier card). User wants a *single* nav-level Donate button. |
| Existing nav CTA | `app.jsx:112` `+ Submit Update` (gold) | Opens agnonymous in new tab. Question: keep alongside Donate, or replace? |
| Stewart Valley | `data.js:1075` `sold-stewart-valley` in `D.soldProperties` (12,932 ac, $54M Phase 1) | Consumer 1: `view-editorial.jsx:138 leadSale = ...` (homepage uses as lead-sale card). Consumer 2: sold-asset markers layer on `view-map.jsx`. Consumer 3: textual references in timeline + headlines. |
| Live feed | `quarter-panel.jsx:146 HeadlineTicker` + `supabase-client.js hydrateHeadlines` (LIMIT 20) + `components.jsx:178 MONETTE_HEADLINES`/`useHeadlines` | Reads `tips` where `kind='headline'` `published=true`. tips table has `body` only — no `subject`. |

---

## Codex pressure-test verdict (`bvqyinxv4`)

**TL;DR (Codex):** *Ship it, with one risk to fix first*. Bare `#map` becomes the homepage, but `#map/{property}` links should **bypass the hero** and open directly into the atlas so shared property links still feel instant.

### Q1 — Map-as-homepage layout

**Stacked, explicit-height contract:**

```
┌──────────────────────────────────────────────────┐
│ Top nav: brand · tabs · Donate · + Submit Update │
├──────────────────────────────────────────────────┤
│ Compressed hero stats (preserved verbatim from   │
│ view-editorial.jsx:183-235)                      │
├──────────────────────────────────────────────────┤
│ Atlas (explicit height — see below)              │
│   - Mode toggle: Seeding · Land Status           │
│   - Default: Seeding                             │
└──────────────────────────────────────────────────┘
```

**Map height contract:**

| Breakpoint | CSS |
|---|---|
| Desktop | `height: clamp(620px, 72svh, 820px)` |
| Mobile | `height: clamp(390px, 58svh, 560px)` |

`svh` (small viewport height) is intentional — safer on phones with collapsing browser chrome (Safari address bar etc.). Call `map.resize()` after the embedded map becomes visible (post-mount + on container-size changes).

### Q2 — Routing

- **Default route changes** from `#editorial` to `#map` in `app.jsx:26-41`
- **`#editorial` redirects to `#map`** via `history.replaceState` — same pattern as the existing `#dossiers → #map` redirect
- **Preserve `#dossier/{slug}`** for individual articles (already preserved in pivot)
- **Kill the top-nav `Ledger` tab** — it has no defined post-pivot job; `Register` already owns the land-rows table
- **Absorb ONLY the hero stats portion** of editorial. Do NOT preserve the Vanguard lead, secondary "also in the file" cards, or the legacy ledger table as homepage content. They were vote-era artifacts that don't fit the satellite-driven framing.

**Critical rule (Codex flagged twice):**

> `#map` shows hero + map. `#map/{property}` or `#map/{property}/{quarter}` should **SKIP/COLLAPSE the hero** and focus the atlas.

This means the homepage shell needs to be **conditional on the URL pattern** — when a property is selected via deep-link, the hero collapses (or is suppressed) so the user doesn't have to scroll past it to see the map they were sent to.

### Q3 — Mode toggle reduction

**Drop public Vigor entirely.** Keep only:
- **Seeding** (default)
- **Land Status** (renamed from Tenure)

**Implementation detail (Codex's clever trick):** use new mode keys `seeding` and `land-status` (not `tenure`). That makes old saved `tenure` / `vigor` localStorage values invalid → users naturally default back to Seeding → **no migration code needed**. This is practice #13 (persisted-state cleanup) applied at design-time.

NDVI data (`ndvi_mean`, populated for 1087/1260 parcels by Bucket B) stays as **model evidence** in the producer pipeline — not exposed as a public mode. v1.5 may bring it back as a Seeding overlay or admin-only view.

### Q4 — Stewart Valley deletion (thorough, not surgical)

Remove from `data.js`:
- `sold-stewart-valley` record at `D.soldProperties` (line 1075 area)
- Public headline reference (line ~1147)
- Timeline references (lines ~1176 + ~1219)
- Swift Current note that "includes Stewart Valley sale story" (line ~812)

Remove from `view-editorial.jsx`:
- `leadSale` constant at line 138
- The Stewart lead block that consumes it (deeper in the file)

Update if public-facing:
- `README.md` references

**Do NOT touch** court research docs / affidavit transcripts in `docs/` — those are source material, not UI surfaces.

### Q5 — Live feed subject line

**Critical re-framing from Codex:** the current code is **NOT an Agnonymous feed**. It reads `public.tips.body` where `kind='headline'` (Monette-internal moderated headlines submitted via `SubmitHeadlineModal`). Calling it "Agnonymous live feed" without integrating Agnonymous would be **dishonest UX**.

**Recommendation:** Option A with Option C fallback:
- Query `LIMIT 5` (was 20)
- Display **first non-empty line of `body`** (split on `\n`, take first non-empty)
- Truncate to ~80 chars with ellipsis if needed
- Do NOT add a `subject` column yet — that's a schema migration with auth implications

**Copy correction:** the feed label should say "Recent updates" or "Latest dispatches" — NOT "Agnonymous live feed" — unless we actually integrate the Agnonymous API. If the user wants real Agnonymous post subjects, that's a separate integration in a separate session.

### Q6 — Donate button

**ADD next to `+ Submit Update`** (don't replace):

```
[Brand] [Tabs] · · · · · · · · · · · · · [Donate] [+ Submit Update]
```

- Reuse existing `supportCustomAmountUrl()` from `components.jsx:388` (returns `paypal.me/buperac`)
- No icon dependency
- Mobile: short labels — `Donate` and `Submit` (drop the `+`)

### Q7 — Session / commit split

**Session 2 — homepage + atlas simplification (LARGE):** TWO commits, in order:

| # | Commit | Scope |
|---|---|---|
| 1 | `feat: make seeding atlas the home surface` | Routing default change · `#editorial → #map` redirect · top-nav cleanup (kill Ledger tab) · hero stats hoisted above map · explicit map height (clamp + svh) · `map.resize()` on visibility · mode toggle reduced to Seeding / Land Status with new key names · Donate button in nav · `#map/{property}` collapses hero |
| 2 | `chore: remove Stewart Valley sold marker from public atlas` | `sold-stewart-valley` data record · `leadSale` + Stewart lead block in editorial · timeline/headline/UI copy · README references if needed |

**Session 3 — live feed reframe (SMALL):** ONE commit:

| # | Commit | Scope |
|---|---|---|
| 1 | `feat(headlines): tighten live feed to last 5 with subject-line extraction` | `hydrateHeadlines` LIMIT 5 · `normalizeHeadline` first-line-of-body extraction with 80-char truncate · feed-label copy corrected to NOT claim Agnonymous unless we integrate it |

**Validation per session:** `npm run build`, desktop root, mobile 390×844, `#map`, `#map/hafford`, and no-Supabase fallback (when `window.supabase` is missing).

### Q8 — Break risks to fix while here

| Risk | Fix |
|---|---|
| Mapbox blank map from missing height | Explicit `clamp()` height per Q1 + `map.resize()` on visibility |
| `#map/{property}` deep-links buried below hero | Conditional hero (skip when property is in URL) |
| Old `vigor` / `tenure` localStorage overriding Seeding | Rename keys (Q3) — invalidates old values |
| Mobile nav grid: assumes fixed tab count in CSS | Audit + flex-wrap fallback |
| Hard-coded Stewart fallback values surviving after data deletion | Search-and-clean per Q4 thorough deletion |
| Feed copy claiming Agnonymous when source is `public.tips` | Q5 copy correction |
| Visible vote-era wording | Hunt + fix anything visible. Do NOT rip internal empty vote-shape plumbing — that's token burn for this session. |

Codex also noted: current checkout has unrelated modified/untracked files (operator-relationship work + the new untracked `.bak` files etc.) — **commits need narrow staging** (specific paths to `git add`, never `-A`).

---

## Recommended session split

**Provisional (will adjust after Codex verdict):**

### Session 2 — Homepage redesign + map-mode reduction + Stewart Valley deletion (large)

These are coupled — they share `app.jsx`, `view-editorial.jsx`, `view-map.jsx`, `data.js`, `components.jsx`, and the new home contract.

**Scope:**
- Switch default route from `#editorial` to `#map`
- Reduce map modes from 3 to 2 (drop Vigor; rename Tenure → Land Status; default Seeding)
- New homepage shell: nav with Donate button at top → existing hero stats (preserved verbatim) → map embed below
- Donate button reuses `supportCustomAmountUrl()` to open `paypal.me/buperac` in new tab (decision: ADD next to Submit Update, vs REPLACE — see Codex Q6)
- Delete `sold-stewart-valley` from `D.soldProperties` + remove `leadSale` consumer in editorial (or fall back to a different sale)
- Editorial extras (Vanguard lead, secondary cards, ledger table) — disposition per Codex Q8
- Smoke test in browser (preview server, Chrome MCP)
- pytest still 42/42 (GEE producer untouched)

**Files expected to change:**
- `app.jsx` (default route + maybe redirect for #editorial)
- `view-editorial.jsx` (deletion or redirect; the hero portion may be hoisted into a shared `HomeHero` component to be embedded in the new map-home)
- `view-map.jsx` (mode toggle reduction; rename labels; Vigor logic removal; new homepage shell wrapping the map)
- `data.js` (delete `sold-stewart-valley` record; update timeline/headlines text references)
- `components.jsx` (maybe new `DonateButton` component; possibly new `HomeHero` shared component)
- `styles.css` + `public/styles.css` (homepage shell layout; donate button style; mobile responsive map height)

**Workflow:**
- Codex pressure-test was THIS session; the implementer subagent inherits the design choices below
- Implementer subagent does the edits + builds + commits per Codex's recommended ordering
- Codex review of the diff after implementation
- Browser smoke via Chrome MCP (same pattern as the satellite pivot)
- Memory + retrospective at end

### Session 3 — Live feed reframe (small)

**Scope:**
- `supabase-client.js` `hydrateHeadlines`: LIMIT 20 → LIMIT 5
- `normalizeHeadline`: extract subject line from `body` per Codex Q5 recommendation
- `HeadlineTicker` (`quarter-panel.jsx`) display tweak if needed
- Smoke test the live feed renders 5 items with subject-line extraction

**Files expected to change:**
- `supabase-client.js` + `public/supabase-client.js` mirror
- `quarter-panel.jsx` (only if rendering changes)
- `components.jsx` (only if `useHeadlines` fan-out changes)

---

## Paste-able session kickoffs

### Session 2 kickoff (paste into a fresh Claude session)

```
Resume the Monette satellite atlas at HEAD b770cc0. Buckets A+B + the
satellite pivot are complete (community voting removed; Atlas is at
#map; SQL migration applied; tips submission preserved). Next: make
the satellite Atlas the actual homepage with hero stats above and the
map embedded below.

REQUIRED READING (before any edits):
  docs/superpowers/specs/2026-04-29-homepage-redesign-plan.md  ← this brief
  docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md
  docs/superpowers/specs/2026-04-29-satellite-pivot-retrospective.md
  ~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md (15 standing practices)

Codex pressure-test ID: bvqyinxv4. Design baked in:

ROUTING (Codex Q2):
  - parseHash default: #editorial → #map (app.jsx:26-41)
  - #editorial silent-redirects to #map via replaceState (same pattern
    as the existing #dossiers → #map redirect)
  - #dossier/<slug> preserved (already done)
  - Top-nav 'Ledger' tab removed (no post-pivot job)
  - Editorial extras (Vanguard lead, secondary cards, ledger table)
    are NOT preserved — they were vote-era artifacts

LAYOUT (Codex Q1):
  Stack: [global nav: Donate + Submit Update] →
         [hero stats from view-editorial.jsx:183-235, hoisted into a
          new shared component (HomeHero or similar)] →
         [map embed]
  Map height contract:
    Desktop: clamp(620px, 72svh, 820px)
    Mobile:  clamp(390px, 58svh, 560px)
  CRITICAL: call map.resize() after the embedded map becomes visible.
  Mapbox does NOT auto-resize on container size changes.

DEEP-LINK RULE (Codex Q1, called out twice):
  Bare #map shows hero + map.
  #map/{property} or #map/{property}/{quarter} SKIPS/COLLAPSES the
  hero so deep-linked property views land directly on the atlas.
  Implementation: conditional render the hero based on parseHash().prop.

MAP MODES (Codex Q3):
  Drop public Vigor entirely.
  Keep only 'Seeding' (default) and 'Land Status' (renamed from Tenure).
  Use NEW localStorage key VALUES: 'seeding' and 'land-status'.
  This intentionally invalidates old 'tenure'/'vigor' values so users
  default back to Seeding without explicit migration code.
  NDVI data (ndvi_mean) stays in producer pipeline as model evidence,
  not exposed as a public mode. v1.5 can bring it back as a Seeding
  overlay or admin-only view.

DONATE BUTTON (Codex Q6):
  ADD a Donate anchor in the global nav next to + Submit Update
  (don't replace). Reuse window.supportCustomAmountUrl()
  (components.jsx:388 → paypal.me/buperac). No icon dependency.
  Mobile: short labels 'Donate' and 'Submit' (drop the +).

STEWART VALLEY DELETION (Codex Q4 — thorough, not surgical):
  Remove from data.js:
    - sold-stewart-valley record in D.soldProperties (~line 1075)
    - public headline reference (~line 1147)
    - timeline references (~lines 1176, 1219)
    - Swift Current note "includes Stewart Valley sale story"
      (~line 812)
  Remove from view-editorial.jsx:
    - leadSale constant at line 138
    - the Stewart lead block that consumes it
  Update if public-facing: README.md references
  Do NOT touch court research / affidavit transcripts in docs/ —
  those are source material, not UI.

WORKFLOW:
  1. Implementer subagent does the work in 2 commits per Codex Q7:

     Commit 1: feat: make seeding atlas the home surface
       - Routing default + #editorial redirect
       - Top-nav cleanup (kill Ledger tab)
       - Hero stats hoisted above map (new HomeHero or inline in MapView)
       - Explicit map height (clamp + svh)
       - map.resize() on visibility
       - Mode toggle reduced to Seeding / Land Status; new key names
       - Donate button next to Submit Update
       - #map/{property} collapses hero

     Commit 2: chore: remove Stewart Valley sold marker from public atlas
       - sold-stewart-valley data record
       - leadSale + Stewart lead block in editorial
       - timeline/headline/UI copy
       - README references if any

  2. Codex review of the full delta (background, same pattern as
     bwgf1888o)
  3. Browser smoke via Chrome MCP at localhost:8000:
     - Desktop root #map: hero + map visible, Seeding default
     - Desktop deep-link #map/hafford: hero collapsed, atlas focused
     - Mobile 390x844: nav fits, map height ≥ 390px, no horizontal scroll
     - #editorial silent-redirects to #map
     - #dossier/insurance-tower still resolves
     - Donate button opens paypal.me/buperac in new tab
     - Mode toggle: 2 buttons (Seeding default, Land Status secondary)
     - localStorage 'monette.atlas.mode' values are 'seeding' or
       'land-status' (not 'tenure'/'vigor')
     - Stewart Valley sale marker absent from sold-asset layer on map
     - No console errors
     - npm run build clean
  4. Update memory + write retrospective at
     docs/superpowers/specs/2026-04-29-homepage-redesign-retrospective.md

CONSTRAINTS:
  - Surgical staging: workdir has unrelated modified/untracked files
    from earlier sessions. Stage ONLY the files you intentionally
    edited per commit. Never 'git add .' or 'git add -A'.
  - pytest 42/42 must still pass (GEE producer untouched).
  - No internal vote-shape plumbing teardown unless visible in UI —
    that's token burn (Codex Q8 explicit guidance).

BREAK RISKS (Codex Q8) to address as part of the commits:
  - Mapbox blank from missing height → fixed by explicit clamp + resize
  - Deep-link buried below hero → fixed by conditional hero
  - Old localStorage mode values → fixed by key-rename trick
  - Mobile nav grid assuming fixed tab count → audit; flex-wrap fallback
  - Hard-coded Stewart fallback values surviving → thorough deletion
  - Visible vote-era wording → hunt + fix as you encounter

Stop after Codex review passes and the retrospective is committed.
Live feed reframe is Session 3.
```

### Session 3 kickoff (paste into a fresh Claude session AFTER Session 2 lands)

```
Resume the Monette satellite atlas. Session 2 (homepage redesign) is
complete. Next: reframe the live feed to show only the latest 5
moderated tip subject lines.

REQUIRED READING:
  docs/superpowers/specs/2026-04-29-homepage-redesign-plan.md
  ~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md

Codex Q5 (from bvqyinxv4):

CRITICAL FRAMING:
  The current 'live feed' is NOT an Agnonymous feed. It reads
  public.tips.body where kind='headline' — Monette-internal moderated
  headlines submitted via SubmitHeadlineModal. Calling it an
  'Agnonymous live feed' without integrating Agnonymous would be
  dishonest UX. If the user wants REAL Agnonymous post subjects,
  that's a separate integration session — flag and stop.

Codex recommendation (Option A + C fallback):
  - hydrateHeadlines query: LIMIT 20 → LIMIT 5
  - normalizeHeadline: extract first non-empty line of body (split
    on '\n', filter empty), truncate to ~80 chars with ellipsis if
    needed
  - Do NOT add a 'subject' column to public.tips yet — that's a
    schema migration with auth implications, separate session.
  - Feed label copy: 'Recent updates' / 'Latest dispatches' / similar
    — NOT 'Agnonymous live feed'.

Files expected to change:
  - supabase-client.js (hydrateHeadlines + normalizeHeadline) +
    public/supabase-client.js mirror
  - Possibly quarter-panel.jsx HeadlineTicker rendering tweak (only
    if the rendering needs to handle the new subject-line shape)
  - Possibly view-editorial.jsx or wherever the feed appears in the
    new homepage shell — copy correction only

Smoke verify:
  - At localhost:8000, the live feed renders ≤ 5 items
  - Each item shows the first line of body, truncated if > 80 chars
  - Feed label does not claim 'Agnonymous'
  - No console errors

Workflow:
  1. Implementer subagent (1 commit):
     feat(headlines): tighten live feed to last 5 with subject-line
     extraction
  2. Codex review of the diff
  3. Browser smoke via Chrome MCP
  4. Update retrospective

pytest 42/42 must still pass.

Surgical staging — workdir may still have leftover modified/untracked
files. Stage only supabase-client.js + public/supabase-client.js (+
any JSX file you touched).
```

---

## Risks + things to watch

1. **Mapbox embed in scrollable page:** Mapbox doesn't auto-resize when its container height changes — explicit height + `map.resize()` calls on layout changes are required. Codex Q1 should address.
2. **#editorial deep-link breakage:** External links (social shares, archived posts) pointing at the old root may exist. A silent redirect to root preserves them; a 404 breaks them. Codex Q2 should address.
3. **Vigor mode dropped data:** `ndvi_mean` populated for 1087 parcels would have no UI surface. v1.5 may want to bring it back (overlay on Seeding, or a click-to-show toggle) — preserve the producer-side data path even if UI hides it.
4. **Stewart Valley headlines/timeline references:** Deleting the data record is one thing; deleting the textual mentions in `data.js` is broader. Decide: surgical (just the sold-asset record) or thorough (also strip the headline + timeline entries).
5. **Donate button friction:** PayPal opens in a new tab. No analytics tracking on donate clicks unless we add one (Microsoft Clarity is configured but doesn't auto-track outbound link clicks). v2 consideration.
6. **Live feed "subject" UX:** If we use first-line-of-body, posters need to know to write a subject line first. Maybe add a hint to `SubmitHeadlineModal` ("First line is the public preview").

---

## Reference index

| Topic | Path |
|---|---|
| Canonical project status | `docs/superpowers/specs/SATELLITE_SEEDING_PROJECT_STATUS.md` |
| Satellite pivot retrospective | `docs/superpowers/specs/2026-04-29-satellite-pivot-retrospective.md` |
| **This brief** | `docs/superpowers/specs/2026-04-29-homepage-redesign-plan.md` |
| Workflow practices (15 standing) | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/session_workflow_practices.md` |
| CLI reference | `~/.claude/projects/G--My-Drive-Agriculture-Monette/memory/cli_reference.md` |
