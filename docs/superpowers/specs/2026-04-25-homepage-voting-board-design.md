# Homepage Voting Board — Design

**Date:** 2026-04-25
**Status:** 🗄️ **HISTORICAL — feature removed in the satellite pivot 2026-04-29.** The community voting feature this design described (season + ownership + listing votes, vote_tallies view, submit_vote RPC, vote-board surface) was removed entirely in commits `43f6a98..b770cc0`. Voting Supabase tables were dropped in migration `20260429000000_drop_voting_tables.sql`. See `2026-04-29-satellite-pivot-retrospective.md` for the removal ledger. This document is preserved as historical context only; do not act on it without re-validating against the current codebase.

**Surface:** `#editorial` view (the homepage / Ledger)
**Depends on:** existing `public.votes`, `public.vote_tallies`, `public.submit_vote` RPC (all dropped)

## 1. Why this exists

The site has had a per-quarter voting system since launch — anonymous visitors mark ownership, listing, and season activity on individual quarters via the quarter drawer in the map and list views. Today those votes are only visible *after* a visitor opens a specific quarter. The homepage doesn't surface the swarm.

This spec adds an **area-level rollup** to the editorial view: one row per property, two parallel bars showing ownership status and season stage across all of that property's quarters. The goal is an at-a-glance "what is the crowd seeing right now" picture — especially the seeding/spraying/harvest progression as the 2026 season unfolds.

## 2. What's already built (do NOT change)

- **Schema.** `public.votes` and `public.vote_tallies` view. Categories and values lock down:
  - `ownership` ∈ {`owned-monette`, `rented-monette`, `sold`, `returned-to-ll`, `unknown`}
  - `listing` ∈ {`not-listed`, `listed-for-sale`, `listed-for-rent`}
  - `season` ∈ {`seeded`, `sprayed`, `harvested`}
- **RPC.** `public.submit_vote` (`supabase/migrations/20260423003000_harden_votes_and_add_submit_vote.sql`) handles dedup-by-fingerprint and value validation. Anon clients have no direct INSERT/UPDATE on `votes`.
- **Realtime.** `supabase-client.js` opens a single `monette-vote-activity` Postgres-changes channel and re-hydrates tallies on every vote, with a 30 s polling fallback and a tab-visibility refresh.
- **Color/label mapping.** `components.jsx:204-221` — ownership and season values already have labels and color tokens.
- **Tutorial copy.** `tutorial.jsx:87` already explains that "Ownership and listing are single-pick community votes; season observations are one-and-done event logs for seeded, sprayed, and harvested."

## 3. What this spec adds

1. **`vote-board.jsx`** — new homepage component. One row per property, two parallel stacked bars (ownership + season). Subscribes to `window.onTalliesChange` for live updates.
2. **`public.quarter_current_state`** view — derives `(prop_id, quarter_loc) → (ownership_status, season_stage)` using the threshold rule below.
3. **Progression guard in `submit_vote`** — rejects `season=sprayed` or `season=harvested` if the quarter has no `season=seeded` row.
4. **`hydrateQuarterStates()`** — new function in `supabase-client.js`. Reads `quarter_current_state`, exposes results on `window.QUARTER_STATES`, called inside `refreshCommunityState()`.
5. **Insertion in `view-editorial.jsx`** — render `<VoteBoard />` between the live ticker and the dossier feature. No restyle of surrounding sections.

## 4. Status derivation rules

A single constant **`STATUS_THRESHOLD = 3`** (in SQL; mirror in JSX for any client-side rendering of "below threshold" hints).

### 4.1 Ownership status (per quarter)

1. Group LWW votes by `value` (the `(prop_id, quarter_loc, category, voter_fingerprint)` unique constraint already gives one current pick per voter, courtesy of the `ON CONFLICT DO UPDATE` in `submit_vote`).
2. Filter to values where `count(distinct voter_fingerprint) >= STATUS_THRESHOLD`.
3. Among qualifying values, pick the one with the **most recent vote activity** (`max(created_at)`).
4. If no value qualifies, status = `unknown`.

This resolves the stale-tally problem: 100 owned-monette votes from 6 months ago lose to 3+ recent sold votes, because sold has more recent activity *among qualifying values*.

### 4.2 Season stage (per quarter)

1. For each season `value`, count `distinct voter_fingerprint`.
2. Pick the **furthest-along** stage with `count >= STATUS_THRESHOLD`.
   Order: `harvested` ≻ `sprayed` ≻ `seeded`.
3. If no stage hits threshold, stage = `unworked`.

The "100 seeded vs 99 harvested" case: harvested ≥ 3 ✓ → harvested wins regardless of seeded count, because harvested is further along the FSM and physically implies seeded already happened.

### 4.3 Worked examples

| Vote pattern | Result |
|---|---|
| 100 seeded, 99 harvested | `harvested` (≥3, furthest along) |
| 100 seeded, 2 harvested | `seeded` (harvested below threshold) |
| 4 owned-monette (latest 2026-03-01), 5 sold (latest 2026-04-20) | `sold` (both qualify, sold has more recent activity) |
| 1 owned-monette, 1 rented-monette, 1 sold | `unknown` (none qualify) |
| 0 votes of any kind | ownership = `unknown`, season = `unworked` |
| 4 sprayed but 0 seeded (impossible after guard) | rejected at RPC; never reaches the view |

## 5. Architecture

### 5.1 New SQL migration

`supabase/migrations/20260425XXXXXX_homepage_voting_board.sql`:

**5.1.1 View `public.quarter_current_state`**

Returns one row per `(prop_id, quarter_loc)` that has at least one vote. Columns:

- `prop_id text`
- `quarter_loc text`
- `ownership_status text` — qualifying value or `'unknown'`
- `ownership_last_at timestamptz` — `max(created_at)` of the chosen ownership value, or NULL
- `season_stage text` — `'harvested' | 'sprayed' | 'seeded' | 'unworked'`
- `season_last_at timestamptz` — `max(created_at)` of the chosen season stage, or NULL

Implementation sketch:

```sql
create or replace view public.quarter_current_state as
with own_tally as (
  select prop_id, quarter_loc, value,
         count(distinct voter_fingerprint) as n,
         max(created_at) as last_at
  from public.votes
  where category = 'ownership'
  group by prop_id, quarter_loc, value
),
own_pick as (
  select distinct on (prop_id, quarter_loc)
         prop_id, quarter_loc, value as ownership_status, last_at as ownership_last_at
  from own_tally
  where n >= 3
  order by prop_id, quarter_loc, last_at desc, value asc
),
season_tally as (
  select prop_id, quarter_loc, value,
         count(distinct voter_fingerprint) as n,
         max(created_at) as last_at
  from public.votes
  where category = 'season'
  group by prop_id, quarter_loc, value
),
season_pick as (
  select distinct on (prop_id, quarter_loc)
         prop_id, quarter_loc, value as season_stage, last_at as season_last_at
  from season_tally
  where n >= 3
  order by prop_id, quarter_loc,
           case value when 'harvested' then 0 when 'sprayed' then 1 when 'seeded' then 2 else 3 end
)
select
  coalesce(o.prop_id, s.prop_id) as prop_id,
  coalesce(o.quarter_loc, s.quarter_loc) as quarter_loc,
  coalesce(o.ownership_status, 'unknown') as ownership_status,
  o.ownership_last_at,
  coalesce(s.season_stage, 'unworked') as season_stage,
  s.season_last_at
from own_pick o
full outer join season_pick s using (prop_id, quarter_loc);
```

`grant select on public.quarter_current_state to anon;`

The `>= 3` literal in the WHERE clauses IS the `STATUS_THRESHOLD`. Add a SQL comment above the view: `-- STATUS_THRESHOLD = 3. If you change this, also update the JSX hint in vote-board.jsx.`

**5.1.2 Progression guard in `submit_vote`**

Add to `submit_vote` body, after the value-validation block, before the season insert:

```sql
if v_category = 'season' and v_value in ('sprayed', 'harvested') then
  if not exists (
    select 1 from public.votes
    where prop_id = v_prop_id
      and quarter_loc = v_quarter_loc
      and category = 'season'
      and value = 'seeded'
  ) then
    raise exception 'progression: % requires a prior seeded vote on this quarter', v_value;
  end if;
end if;
```

This is the **only** server-side enforcement of the FSM. Client-side guards in JSX are UX hints; they do not replace this.

### 5.2 New JS/JSX

**`vote-board.jsx`** (new file at repo root, alongside `quarter-panel.jsx` and `property-drawer.jsx`):

- Top-level export: `window.VoteBoard = function VoteBoard(props) {...}` — same module style as the rest of the site (Babel-standalone, no ES module imports).
- Props: `{ properties: Property[] }` — passed in from `view-editorial.jsx`.
- Reads from `window.QUARTER_STATES` (a map keyed by `${propId}:${quarterLoc}`) and from each property's `parcels` count + quarter list (already in `data.js`).
- Subscribes to `window.onTalliesChange` in `useEffect` to re-derive on every vote.
- Renders a list of property rows. Each row:
  - Property name + total quarter count
  - **Ownership bar** — 4 visible segments, in this order:
    1. `owned-monette` (owned)
    2. `rented-monette` (rented)
    3. `sold` (sold)
    4. `other` — collapsed bucket containing `returned-to-ll` + `unknown` + below-threshold quarters. **Rendered in muted gray** (`var(--mute)` or equivalent neutral tone). Hover tooltip lists the breakdown: e.g., "12 returned-to-LL · 4 unknown · 23 not enough votes".
  - **Season bar** — 4 visible segments: `unworked`, `seeded`, `sprayed`, `harvested`. The `unworked` segment is muted gray (same treatment as the ownership "other" bucket); `seeded` / `sprayed` / `harvested` use their existing colors.
- Segment widths = quarter counts ÷ total quarters in the property.
- Color tokens: reuse the existing `OWN[value].color` map and `seasonColors` from `components.jsx`. The only new visual token is the muted gray for "other" / "unworked" / below-threshold — pull from the existing `--mute` CSS variable; do not invent a new color.

**Below-threshold rule (consistent across both bars):** any quarter that does not yet have ≥3 votes for any qualifying value lands in the muted gray bucket. The bar always sums to 100% of the property's quarters — there are no "missing" segments.

**`supabase-client.js` additions:**

- `window.QUARTER_STATES = {}` initial value next to `window.SUPA_TALLIES`.
- `async function hydrateQuarterStates()` — `select * from quarter_current_state`, build the map, call `notify()`.
- Add `hydrateQuarterStates()` to the `Promise.all` in startup (line ~271) and inside `refreshCommunityState()` (line ~268). Failure path: `console.warn` + leave the previous map in place.

**`view-editorial.jsx` changes:**

- Add `<VoteBoard properties={D.properties} />` between the live ticker block and the dossier feature.
- No restyle of surrounding slabs.

**`index.html` changes:**

- Add `<script type="text/babel" src="vote-board.jsx?v=N"></script>` (or the built `build/vote-board.js`) in the same area as the other view scripts.
- Bump `?v=` cache busters on the editorial scripts touched.

**`build/`:**

- esbuild step picks up `vote-board.jsx` automatically if it's listed in the build script. Verify and adjust the build script if it enumerates files.

### 5.3 Property granularity (no region grouping yet)

`data.js` already has 13 properties total (10 SK + 2 MB + 1 MT) and each carries a `region` field ("West-Central SK", "Central SK", "Southwest SK", etc.). One row per property is readable without further grouping. Region grouping is left out of scope for this spec — easy to add later if the list gets long.

## 6. Data flow

```
User clicks vote in quarter drawer
    ↓
window.monetteInsertVote (supabase-client.js)   — optimistic update
    ↓
RPC: submit_vote(...)                           — validates progression invariants
    ↓
INSERT/UPDATE on public.votes
    ↓
Realtime channel "monette-vote-activity" fires
    ↓
refreshCommunityState():
    - hydrateTallies()         (existing)
    - hydrateQuarterStates()   (NEW)
    - hydrateActivityFeed()    (existing)
    ↓
notify() → window.onTalliesChange listeners
    ↓
VoteBoard re-renders with the new derived state
```

The 30 s polling fallback and the tab-visibility refresh both reach `refreshCommunityState()`, so the new hydrate function inherits both safety nets.

## 7. Edge cases

| Case | Behavior |
|---|---|
| Quarter with 0 votes | Not in `quarter_current_state`. `VoteBoard` treats it as ownership=`unknown`, season=`unworked` based on the property's full quarter list. |
| Property with 0 quarters in `quarters.geojson` | Render the row with a "no quarters mapped" caption, no bars. |
| Realtime channel disconnects | 30 s polling fallback continues. No code change. |
| Voter rapidly toggles ownership pick | Existing optimistic-update + rollback path handles it. |
| Server rejects season vote (missing seeded) | Surface the error via the existing `submitVote` error path; client rolls back optimistic state. The quarter drawer's UI should also gray out sprayed/harvested buttons until seeded has been clicked, but that's a UX hint — the server is the source of truth. |
| Tied ownership recency | `ORDER BY last_at DESC, value ASC` gives a deterministic tie-break. |
| `quarters.geojson` and `data.js` disagree on quarter count | Use `data.js` `parcels` field as the denominator; bars use that count. |
| User has never voted (no fingerprint) | Their first vote creates one in localStorage, same path as today. |

## 8. Out of scope

- **No new vote prompts on the homepage.** Votes still happen in the quarter drawer.
- **No changes** to the live ticker, dossier feature, hero headline, lead story, "also in the file" cards, court-file ledger table, or footer.
- **No changes** to the map, list, dossier, or creditors views.
- **No new vote categories or values.** Schema unchanged except for the `quarter_current_state` view and the progression guard in `submit_vote`.
- **No retroactive cleanup** of votes that violate the new progression invariant. Existing data is grandfathered (rejection only applies to *new* writes).
- **No nested 2D bars.** Parallel bars only.
- **No region grouping.** One row per property.
- **No backfill for "below threshold" UI affordance** beyond a muted segment + tooltip. No "show me what the early signal is" toggle.

## 9. Testing approach

Manual verification in the local preview server (no automated tests in this codebase).

1. **Threshold flip.** Vote `seeded` on a fresh quarter from 3 distinct fingerprints (clear `localStorage.monette.voter.fp` between runs in different incognito windows). After the 3rd vote, the season bar segment for that property should advance.
2. **Progression rejection.** Try to vote `harvested` on a quarter with no `seeded` votes. RPC should error; optimistic UI should roll back; activity feed should not show the vote.
3. **Stale-tally / recency tie-break.** Pre-seed 4× `owned-monette` votes with old `created_at`, then 5× `sold` with current `created_at`. Reload — the property's ownership bar should show sold-leaning, and the quarter's `quarter_current_state.ownership_status` should be `sold`.
4. **Below threshold.** 1 vote of three different ownership values on a quarter. Quarter should be `unknown`; the property's "unknown" segment grows.
5. **Realtime cross-window.** Open two browser windows, vote in window A, verify window B updates within ~5 s (realtime path) and within 30 s in the worst case (polling fallback).
6. **Visual.** 320 px / 768 px / 1280 px viewports. Bars don't overflow; long property names truncate or wrap gracefully.
7. **Production parity.** Deploy to a Vercel preview URL before promoting to `monette.buperac.com`. Verify the prod Supabase project has the new view + RPC change.

## 10. Deployment

1. Apply SQL migration: `cd C:/Users/kyle/Agriculture/Monette && supabase db push` (or apply via Supabase dashboard if `db push` is not configured).
2. Build JSX → JS via the existing esbuild step. Ensure `vote-board.jsx` is included.
3. Bump `?v=` cache busters on all `<script>` tags in `index.html` for any file touched.
4. Vercel deploy: `cd C:/Users/kyle/Agriculture/Monette && vercel --prod --yes`.
5. Mirror to G:\My Drive\Agriculture\Monette\public\... as a secondary step (optional, for Drive collaborators).

## 11. Acceptance

This design is approved when:

- The status derivation rules (§4) are accepted as written.
- The architecture (§5) — files added, files modified, view shape — matches what the implementer will build.
- The out-of-scope list (§8) is read and accepted; nothing in it gets quietly added during implementation.
- The two open items in §12 are resolved.

## 12. Resolved decisions (locked 2026-04-25)

Both items were resolved during design review with Kyle. They live in §5.2; this section is kept as a record of the decision.

1. **Ownership bar segment count.** Resolved: option **(b)** — 3 main segments (owned / rented / sold) plus a muted "other" bucket that collapses `returned-to-ll` + `unknown` + below-threshold quarters. See §5.2.
2. **Below-threshold visual.** Resolved: muted gray segment using the existing `--mute` CSS variable, with a hover tooltip exposing the breakdown. Applied consistently to ownership "other" and season "unworked". See §5.2.

## 13. Notes for future work (NOT in this spec)

- The data.js Layer-3 comment header (`data.js:9-12`) describes `sprayerSpotted[] (timestamped events, many allowed)` — the original design intent. The actual implementation dedupes one sprayed vote per fingerprint per quarter (witness count). This spec keeps the witness-count semantics. The comment header is now slightly stale — worth a follow-up cleanup pass, not a blocker.
- A weekly "as-of" snapshot of `quarter_current_state` could power a time-lapse later (seeding progress over the season). Not in scope here.
- A region-level rollup (group properties by `region` field) is straightforward to add once the per-property version is shipped.
