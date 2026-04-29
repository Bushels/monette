# Homepage Redesign — Session 2 Retrospective (2026-04-29)

**Status:** Implementation complete, awaiting Codex post-review verdict.
**Plan:** [`2026-04-29-homepage-redesign-plan.md`](./2026-04-29-homepage-redesign-plan.md)
**Codex pre-implementation pressure-test:** `bvqyinxv4`
**Branch:** `main` — two commits landed:
- `af4fcea feat: make seeding atlas the home surface`
- `d31b563 chore: remove Stewart Valley sold marker from public atlas`

---

## What got built (vs the plan)

| Plan item (Codex Q#) | Outcome | Notes |
|---|---|---|
| Q1 — Map-as-homepage layout, explicit height contract | ✅ Implemented | `clamp(620px, 72svh, 820px)` desktop, `clamp(390px, 58svh, 560px)` mobile. New `HomeHero` component renders above atlas on bare `#map`. |
| Q1 — Deep-link rule: `#map/{property}` skips hero | ✅ Implemented | `showHomeHero = !forcedSelect` in MapView; `key={view + "/" + (prop || "")}` in app.jsx forces remount on route change. |
| Q2 — `#editorial` → `#map` silent redirect | ✅ Implemented | `parseHash()` checks for both `editorial` and `dossiers` and `replaceState`s to `#map`. Default route is `#map`. |
| Q2 — Drop Ledger top-nav tab | ✅ Implemented | VIEWS array shrunk from 6 to 5 entries. Mobile tabs grid updated `repeat(5, ...)`. |
| Q3 — Mode toggle reduction (3 → 2) | ✅ Implemented | Modes: `seeding` (default Apr–Jun) + `land-status` (default else). NEW key VALUES so old `tenure`/`vigor` localStorage falls through to default — practice #13 in memory. |
| Q3 — Bonus: removed orphan `vigorColorFor` | ✅ Done | Pre-existing function with one caller (`vigor_color: ...`); both removed cleanly. Memory note about the bug now obsolete. |
| Q4 — Stewart Valley thorough deletion | ✅ Implemented | Sold record + headline + timeline clause + Swift Current note + leadSale + lead block + README section. Excluded: `creditors-data.js` registered-office address, court materials in `docs/`. |
| Q5 — Live feed reframe | ⏸ Deferred | Session 3 work. Plan flagged this as separate. |
| Q6 — Donate button next to Submit Update | ✅ Implemented | Ghost-style anchor → `paypal.me/buperac`. Both CTAs carry `.nav-cta-full` + `.nav-cta-short` for desktop/mobile labels. |
| Q7 — Two commits, narrow staging | ✅ Mostly | Commit 1 swept up 3 pre-staged docs files (`docs/superpowers/plans/2026-04-25-homepage-voting-board.md` + 2 specs) — they were already in the index from a prior session. Topically related (original homepage planning docs), benign. Commit 2 staged exactly the 4 files I touched. |

---

## Deviations from the plan

### 1. Hero placement vs the original screenshot

User's req #3 said: nav → hero → map. Codex Q1 layout matched. But the existing `MapView` already had its own `.atlas-toolbar` (Owned/Rented/Sold/For sale pills) directly above the 3-col atlas grid. I kept the toolbar visible **between** hero and atlas because it's part of the atlas widget, not redundant with the hero (toolbar = lead-status counts; hero = province distribution).

If the user wants the toolbar suppressed on bare `#map`, that's a 5-line follow-up.

### 2. Live feed (HeadlineTicker) not on the homepage

The HeadlineTicker that previously lived in EditorialView is **not** rendered on the new homepage. Per the plan layout, only nav + hero + atlas. The ticker becomes unreachable until Session 3 reframes + reintroduces it.

Trade-off: the live feed temporarily disappears between Session 2 and Session 3. If that's a problem, Session 3 should be prioritized.

### 3. Mixed README.md commit

Commit 2 (`d31b563`) staged README.md changes that mix:
- My Stewart Valley removal (lines 53, 105–109)
- Pre-existing operator-relationship doc updates (lines 17, 53 addition, 113, 116) — already dirty in the workdir from a prior session

I called this out in the commit message. Cleanly separating would have required `git add -p` interactive splitting; took the pragmatic call to land them together.

### 4. EditorialView is unreachable but not deleted

Since `#editorial` silent-redirects, `EditorialView` never mounts. I kept the file (and its now-unused `EditorialLeadMap` helper) intact except for the Stewart Valley removal — the surface area to delete the whole view + its window export felt out of scope for this session.

---

## Verification results

Browser smoke at `localhost:8765/#map`:

| Check | Result |
|---|---|
| Hero present on bare `#map` | ✅ |
| Hero suppressed on `#map/swift-current` | ✅ |
| `#editorial` redirects to `#map` (hero re-appears) | ✅ |
| `#dossiers` redirects to `#map` | ✅ |
| Atlas grid height computed = 620px (clamp floor at 720-tall viewport) | ✅ |
| Mode pills: exactly `[Seeding, Land Status]` | ✅ |
| Default mode = `seeding` (Apr 29 in window) | ✅ |
| Mode click → localStorage persists `land-status` | ✅ |
| Land Status legend swap works | ✅ |
| Donate link → `paypal.me/buperac` | ✅ |
| Mobile 375×812: nav fits, no horizontal scroll | ✅ |
| Mobile map height: 470.95px (within `clamp(390, 58svh, 560)`) | ✅ |
| Mobile labels swap to short text | ✅ (after CSS source-order fix) |
| No console errors | ✅ |
| `D.soldProperties` length 5→4, no `sold-stewart-valley` | ✅ |
| Updated headline #11 reads `$30.78M Sale Programme (2 SK sales)` | ✅ |
| Updated timeline reads `Sale Programme ends — $30.78M / 2 sales` | ✅ |
| Swift Current notes free of Stewart Valley sentence | ✅ |
| `npm run build` clean | ✅ |

---

## Bug found + fixed mid-session

**Symptom:** Mobile viewport showed both `.nav-cta-full` and `.nav-cta-short` as `display: none` — Donate label rendered as zero-width.

**Root cause:** I added a default `.nav-cta-short { display: none; }` rule at the top-level (no media query). It appeared at line 3383 in `styles.css`, AFTER the 900px media-query rule at line 1198 that says `.nav-cta-short { display: inline; }`. Both rules have specificity 0,0,1 — CSS source order broke the tie in favor of the later rule, which won at all viewports.

**Fix:** Wrapped the default in `@media (min-width: 901px)` so it only applies on desktop and can't shadow the 900px MQ rule.

**Lesson for memory practice #15** (already tracked): when adding default CSS rules outside media queries, place them BEFORE all media queries OR scope them to a non-overlapping `min-width` so source-order can't subvert them. Equivalent to the parent-scoped CSS specificity gotcha already in `vote_noise_controls.md`.

---

## Files changed

**Commit 1 (`af4fcea`):**
- `app.jsx` (+30/-13) — parseHash default + redirect, VIEWS shrink, Donate button, ViewComponent dropping editorial branch
- `components.jsx` (+98/-1) — new HomeHero component + window export
- `index.html` (+1/-1) — styles.css cache-bust v28→v29
- `styles.css` (+30/-15) — height contract + label-swap rules + Donate-stays-on-mobile override
- `view-dossier.jsx` (+1/-1) — `#editorial` fallback → `#map`
- `view-map.jsx` (+10/-96) — ATLAS_MODES reduction, vigor cleanup, HomeHero render conditional, removed inline `minHeight: 780` and rail `maxHeight: 780`
- (3 unrelated docs files swept in from a stale staging area — see Q7 deviation note)

**Commit 2 (`d31b563`):**
- `data.js` (+3/-5) — sold-stewart-valley record removed, timeline + headline #11 updated, Swift Current notes cleaned, headline #10 dropped
- `view-editorial.jsx` (+8/-66) — leadSale + Stewart lead block removed
- `README.md` (+5/-7) — Homepage lead story → Homepage shell; soldProperties description; bundles operator-relationship doc updates from prior session
- `index.html` (+1/-1) — data.js cache-bust v33→v34

---

## Memory updates needed

1. **`session_workflow_practices.md`** — append entry for this session under the satellite-pivot ledger:
   > 2026-04-29 mid-day Session 2 (homepage redesign): map is now the front door (`#map` default + `#editorial` silent redirect). HomeHero hoisted from view-editorial.jsx into components.jsx. Map modes reduced 3→2 (Seeding + Land Status). Donate button next to + Submit Update. Stewart Valley sold marker retired from public surfaces. 2 commits `af4fcea..d31b563`. Codex pre-implementation pressure-test: `bvqyinxv4`. Pre-existing `vigorColorFor` orphan bug cleaned up as a bonus during vigor mode removal.

2. **New entry** — `homepage_shell.md`:
   > Bare `/#map` = hero (HomeHero) + atlas. `/#map/{property}` = atlas only (deep-link rule, hero suppressed via `forcedSelect` check). `/#editorial` and `/#dossiers` silently redirect to `/#map`; `/#dossier/<slug>` reader is preserved. Atlas height contract: desktop `clamp(620px, 72svh, 820px)`, mobile `clamp(390px, 58svh, 560px)` (svh > vh because iOS Safari address-bar collapse pushed atlas below the fold with vh).

3. **Update** existing memory `session_workflow_practices.md` practice #15:
   > Add: when adding default CSS rules outside media queries, place them BEFORE the media queries OR wrap in a non-overlapping `min-width` scope. CSS source-order resolves specificity ties in favor of later rules — defaults at end-of-file silently shadow earlier media-query rules.

---

## Open follow-ups

1. **Session 3** — Live feed reframe. Plan section "Session 3 kickoff" is paste-ready in the redesign plan.
2. **Codex review** — In progress, background agent `a998a52f51779bfa1`. Will append findings here.
3. **EditorialView dead-code audit** — `view-editorial.jsx` is unreachable (silent-redirected) but still ~600 lines of unused JSX. A future cleanup commit could delete the file + its window export + the script tag in index.html. Out of scope for this session.
4. **Atlas-toolbar visibility on bare `#map`** — Currently shown above the atlas grid; could be suppressed when hero is present if user prefers the cleaner hero→atlas transition.
5. **Vercel deployment** — All changes live on `main` locally. User can `vercel --prod` from C: when ready (per memory `project_local_copy.md`).
