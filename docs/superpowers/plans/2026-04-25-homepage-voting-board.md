# Homepage Voting Board Implementation Plan

> 🗄️ **HISTORICAL — feature removed in the satellite pivot 2026-04-29.** The voting board this plan described was implemented at `2026-04-25` and removed entirely in commits `43f6a98..b770cc0`. The design assumptions (community votes drive seeding state) are no longer valid — satellite-derived seeding is the source of truth now. See `docs/superpowers/specs/2026-04-29-satellite-pivot-retrospective.md` for the removal ledger and the current architecture. This plan is preserved for historical context only; **do not execute any of its checkboxes**.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an area-level voting board to the editorial homepage that shows, per Monette property, two parallel stacked bars — current ownership status and current season stage — derived from the existing community vote data with a 3-vote threshold and live realtime updates.

**Architecture:** A new SQL view (`public.quarter_current_state`) derives per-quarter status from raw votes using LWW + threshold + recency for ownership and a monotonic FSM for season. A new browser-side hydrate function pulls the view into `window.QUARTER_STATES`. A new JSX component (`vote-board.jsx`) renders the bars per property, subscribed to the existing realtime change channel. A server-side guard in `submit_vote` prevents out-of-order season votes (sprayed/harvested with no prior seeded).

**Tech Stack:** Supabase (Postgres + Realtime), React 18 (UMD), JSX precompiled with esbuild, Babel-style window globals (no ES modules), local Python http.server preview, Vercel for prod deploy. **No git repo.** **No automated tests** — manual verification only.

**Spec:** [2026-04-25-homepage-voting-board-design.md](../specs/2026-04-25-homepage-voting-board-design.md)

---

## Working environment notes (read once before starting)

- Edit + preview + deploy from `C:/Users/kyle/Agriculture/Monette`. Do NOT edit on the G: drive copy — it's a downstream mirror.
- Preview server: `py -m http.server 8766 --directory C:/Users/kyle/Agriculture/Monette` (or just open the `monette-ledger-c` debug config in VS Code, which uses `.claude/launch.json`).
- After editing any `.jsx` file, you MUST run `npm run build` from the repo root for changes to reach the browser. The build script (`scripts/build-jsx.mjs`) reads `entries[]`, transpiles each `.jsx` → `build/<name>.js`, and also writes to `public/build/<name>.js` for the Vercel deploy path.
- After editing static-asset files like `supabase-client.js`, `npm run build` copies them to `public/`, but the preview server reads from the C: root directly so reloading is sufficient. Run `npm run build` anyway before deploying.
- No git repo here. "Save the file" is the checkpoint. If a step fails, recover by re-reading the file or reverting your edit by hand.
- Bump `?v=N` cache busters on `<script>` tags in `index.html` ONLY for files you change in this list (`data.js`, `creditors-data.js`, etc.). The `build/` scripts have no version query string and pick up changes automatically when esbuild rewrites them.

---

## Task 1: SQL migration — `quarter_current_state` view + progression guard

**Files:**
- Create: `supabase/migrations/20260425150000_homepage_voting_board.sql`

The migration adds one new view (`quarter_current_state`) and replaces the existing `submit_vote` function with a version that includes the season-progression guard.

- [ ] **Step 1.1: Verify Supabase CLI is linked**

Run:
```bash
cd C:/Users/kyle/Agriculture/Monette && cat supabase/.temp/linked-project.json
```
Expected: a JSON file with a `project_id` field. If it errors with "no such file," the project isn't linked. Stop and ask the user to run `supabase login` and `supabase link`.

- [ ] **Step 1.2: Create the migration file**

Create `supabase/migrations/20260425150000_homepage_voting_board.sql` with this exact content:

```sql
-- Homepage voting board derived state.
-- STATUS_THRESHOLD = 3. If you change this value, also update the
-- threshold reference comment in vote-board.jsx.
--
-- This migration:
--   1. Creates public.quarter_current_state — derived per-quarter status.
--   2. Adds a season-progression guard to public.submit_vote so sprayed/harvested
--      votes are rejected when no prior seeded vote exists for the quarter.

-- 1. The derived view ----------------------------------------------------

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
         prop_id, quarter_loc,
         value as ownership_status,
         last_at as ownership_last_at
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
         prop_id, quarter_loc,
         value as season_stage,
         last_at as season_last_at
  from season_tally
  where n >= 3
  order by prop_id, quarter_loc,
           case value
             when 'harvested' then 0
             when 'sprayed'   then 1
             when 'seeded'    then 2
             else 3
           end
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

grant select on public.quarter_current_state to anon;

-- 2. Replace submit_vote with progression-guarded version ----------------

create or replace function public.submit_vote(
  p_prop_id text,
  p_quarter_loc text,
  p_category text,
  p_value text,
  p_note text default null,
  p_voter_fingerprint text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop_id text := nullif(btrim(p_prop_id), '');
  v_quarter_loc text := nullif(btrim(p_quarter_loc), '');
  v_category text := nullif(btrim(p_category), '');
  v_value text := nullif(btrim(p_value), '');
  v_note text := nullif(btrim(p_note), '');
  v_fingerprint text := nullif(btrim(p_voter_fingerprint), '');
begin
  if v_prop_id is null then
    raise exception 'prop_id required';
  end if;

  if v_quarter_loc is null then
    raise exception 'quarter_loc required';
  end if;

  if v_category not in ('ownership', 'listing', 'season') then
    raise exception 'invalid category';
  end if;

  if v_value is null then
    raise exception 'value required';
  end if;

  if v_fingerprint is null then
    raise exception 'voter_fingerprint required';
  end if;

  if v_category = 'ownership' and v_value not in ('owned-monette', 'rented-monette', 'sold', 'returned-to-ll', 'unknown') then
    raise exception 'invalid ownership value';
  end if;

  if v_category = 'listing' and v_value not in ('not-listed', 'listed-for-sale', 'listed-for-rent') then
    raise exception 'invalid listing value';
  end if;

  if v_category = 'season' and v_value not in ('seeded', 'sprayed', 'harvested') then
    raise exception 'invalid season value';
  end if;

  -- NEW: progression guard. Sprayed and harvested require prior seeded.
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

  if v_category in ('ownership', 'listing') then
    insert into public.votes (
      prop_id,
      quarter_loc,
      category,
      value,
      voter_fingerprint,
      note
    )
    values (
      v_prop_id,
      v_quarter_loc,
      v_category,
      v_value,
      v_fingerprint,
      v_note
    )
    on conflict (prop_id, quarter_loc, category, voter_fingerprint)
      where category in ('ownership', 'listing')
    do update
      set value = excluded.value,
          note = excluded.note,
          created_at = now();
    return;
  end if;

  insert into public.votes (
    prop_id,
    quarter_loc,
    category,
    value,
    voter_fingerprint,
    note
  )
  values (
    v_prop_id,
    v_quarter_loc,
    v_category,
    v_value,
    v_fingerprint,
    v_note
  )
  on conflict (prop_id, quarter_loc, category, value, voter_fingerprint)
    where category = 'season'
  do nothing;
end;
$$;

revoke all on function public.submit_vote(text, text, text, text, text, text) from public;
grant execute on function public.submit_vote(text, text, text, text, text, text) to anon;
```

- [ ] **Step 1.3: Apply the migration to the production Supabase project**

Run:
```bash
cd C:/Users/kyle/Agriculture/Monette && supabase db push
```
Expected: output ends with `Finished supabase db push.` and no errors. If the CLI prompts for confirmation, accept.

If `supabase db push` is not available or the project isn't linked, apply the SQL manually via the Supabase dashboard SQL editor (paste the migration file content, run it).

- [ ] **Step 1.4: Verify the view exists and is queryable as anon**

Open the Supabase dashboard SQL editor (or use psql) and run:
```sql
select count(*) as total_rows from public.quarter_current_state;
```
Expected: a single row with a non-negative integer. The number reflects how many quarters currently meet the 3-vote threshold for either ownership or season.

Also run:
```sql
select prop_id, quarter_loc, ownership_status, season_stage
from public.quarter_current_state
limit 10;
```
Expected: up to 10 rows, each with non-null `ownership_status` (one of the 5 ownership values or 'unknown') and non-null `season_stage` (one of harvested/sprayed/seeded/unworked).

- [ ] **Step 1.5: Verify the progression guard rejects out-of-order votes**

In the SQL editor, run:
```sql
select public.submit_vote(
  'TEST_GUARD_PROP',
  'TEST_GUARD_QUARTER',
  'season',
  'harvested',
  null,
  'test-fingerprint-001'
);
```
Expected: ERROR with message `progression: harvested requires a prior seeded vote on this quarter`.

Then test the happy path:
```sql
select public.submit_vote('TEST_GUARD_PROP','TEST_GUARD_QUARTER','season','seeded',null,'test-fingerprint-001');
select public.submit_vote('TEST_GUARD_PROP','TEST_GUARD_QUARTER','season','harvested',null,'test-fingerprint-002');
```
Expected: both succeed.

Clean up the test data:
```sql
delete from public.votes where prop_id = 'TEST_GUARD_PROP';
```
Expected: `DELETE 2`.

---

## Task 2: Hydrate quarter states in `supabase-client.js`

**Files:**
- Modify: `C:/Users/kyle/Agriculture/Monette/supabase-client.js`

We add `window.QUARTER_STATES`, a `hydrateQuarterStates()` function, and wire it into both the startup hydrate and the realtime refresh path.

- [ ] **Step 2.1: Add `window.QUARTER_STATES = {}` near the existing tallies init**

Find the line in `supabase-client.js`:
```js
window.SUPA_TALLIES = {};
```
(Around line 41 in the current file.)

Add immediately after it:
```js
window.QUARTER_STATES = {};
```

- [ ] **Step 2.2: Add the `hydrateQuarterStates()` function**

Find the existing function `async function hydrateActivityFeed()` (around line 149).

Immediately AFTER the closing brace of `hydrateActivityFeed`, paste this new function:

```js
async function hydrateQuarterStates() {
  const { data, error } = await supa
    .from("quarter_current_state")
    .select("prop_id,quarter_loc,ownership_status,ownership_last_at,season_stage,season_last_at");

  if (error) {
    console.warn("[supa] quarter_current_state hydrate failed", error.message);
    return;
  }

  const next = {};
  for (const row of data || []) {
    const key = `${row.prop_id}:${row.quarter_loc}`;
    next[key] = {
      prop_id: row.prop_id,
      quarter_loc: row.quarter_loc,
      ownership_status: row.ownership_status,
      ownership_last_at: row.ownership_last_at,
      season_stage: row.season_stage,
      season_last_at: row.season_last_at,
    };
  }
  window.QUARTER_STATES = next;
  notify();
}
```

- [ ] **Step 2.3: Expose it on `window`**

Find the line:
```js
window.monetteHydrateActivityFeed = hydrateActivityFeed;
```

Add this line right after:
```js
window.monetteHydrateQuarterStates = hydrateQuarterStates;
```

- [ ] **Step 2.4: Wire it into `refreshCommunityState`**

Find the existing function:
```js
function refreshCommunityState() {
  return Promise.all([hydrateTallies(), hydrateActivityFeed()]);
}
```

Replace with:
```js
function refreshCommunityState() {
  return Promise.all([hydrateTallies(), hydrateQuarterStates(), hydrateActivityFeed()]);
}
```

- [ ] **Step 2.5: Wire it into the startup hydrate**

Find the existing `Promise.all` startup call:
```js
Promise.all([hydrateTallies(), hydrateHeadlines(), hydrateActivityFeed()]).catch((error) => {
  console.warn("[supa] initial hydrate failed", error?.message || error);
});
```

Replace with:
```js
Promise.all([hydrateTallies(), hydrateHeadlines(), hydrateQuarterStates(), hydrateActivityFeed()]).catch((error) => {
  console.warn("[supa] initial hydrate failed", error?.message || error);
});
```

- [ ] **Step 2.6: Add a no-op stub to the disabled-fallback branch**

Near the top of the IIFE there's an `if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY)` block that stubs out the API when Supabase is disabled. Add this line inside that block, right after `window.monetteHydrateActivityFeed = async () => false;`:

```js
window.monetteHydrateQuarterStates = async () => false;
```

This keeps the global API consistent so `vote-board.jsx` can call it without crashing in local-only mode.

- [ ] **Step 2.7: Build and verify**

Run from `C:/Users/kyle/Agriculture/Monette`:
```bash
npm run build
```
Expected: output includes `copied supabase-client.js -> public/supabase-client.js` and no errors.

Open the preview server (port 8766) in a browser. Open DevTools → Console.

Run in the console:
```js
JSON.stringify(window.QUARTER_STATES).slice(0, 200)
```
Expected: not `{}` (assuming there's at least some vote data in the prod DB). Should be a JSON object with keys like `"hafford:NW-26-10-16-W3"` and values containing `ownership_status` / `season_stage`.

If `window.QUARTER_STATES` is `{}` after a few seconds, check the Network tab for the `quarter_current_state` REST request and look at its response. If 401, the `grant select` from the migration didn't take. If the response is `[]`, the prod DB has no qualifying votes yet (acceptable; the bars will all read as muted gray).

---

## Task 3: Create `vote-board.jsx` component

**Files:**
- Create: `C:/Users/kyle/Agriculture/Monette/vote-board.jsx`

A self-contained component that renders one row per property with two stacked bars. Reads from `window.MONETTE_DATA.properties` and `window.QUARTER_STATES`, subscribes to `window.onTalliesChange`.

- [ ] **Step 3.1: Create the file with the full component**

Create `C:/Users/kyle/Agriculture/Monette/vote-board.jsx` with this exact content:

```jsx
// vote-board.jsx — homepage area-level vote rollup.
//
// Two parallel stacked bars per property:
//   Ownership: owned · rented · sold · other (collapses returned-to-ll +
//              unknown + below-threshold quarters into a muted gray segment)
//   Season:    seeded · sprayed · harvested · unworked (muted gray)
//
// STATUS_THRESHOLD = 3 — if you change it here, also change the
// `n >= 3` guards in the supabase migration that builds quarter_current_state.

const { useState, useEffect, useMemo } = React;

const VB_OWNERSHIP_BUCKETS = [
  { id: "owned-monette",  label: "Owned",  color: "#5a7a3a" },
  { id: "rented-monette", label: "Rented", color: "#b48638" },
  { id: "sold",           label: "Sold",   color: "#9a3a2a" },
  { id: "other",          label: "Other",  color: "#b9b3a4" },
];

const VB_SEASON_BUCKETS = [
  { id: "unworked",  label: "Unworked",  color: "#b9b3a4" },
  { id: "seeded",    label: "Seeded",    color: "#5a7a3a" },
  { id: "sprayed",   label: "Sprayed",   color: "#b48638" },
  { id: "harvested", label: "Harvested", color: "#9a3a2a" },
];

function vbBucketOwnership(state) {
  if (!state) return "other";
  switch (state.ownership_status) {
    case "owned-monette":  return "owned-monette";
    case "rented-monette": return "rented-monette";
    case "sold":           return "sold";
    default:               return "other"; // returned-to-ll, unknown
  }
}

function vbBucketSeason(state) {
  if (!state) return "unworked";
  return state.season_stage || "unworked";
}

function vbCountsForProperty(property, statesByQuarter) {
  const totalParcels = Math.max(0, Number(property.parcels) || 0);
  const ownership = { "owned-monette": 0, "rented-monette": 0, "sold": 0, "other": 0 };
  const season = { unworked: 0, seeded: 0, sprayed: 0, harvested: 0 };
  let mapped = 0;

  for (const key in statesByQuarter) {
    const state = statesByQuarter[key];
    if (!state || state.prop_id !== property.id) continue;
    mapped++;
    ownership[vbBucketOwnership(state)] = (ownership[vbBucketOwnership(state)] || 0) + 1;
    season[vbBucketSeason(state)] = (season[vbBucketSeason(state)] || 0) + 1;
  }

  // Quarters with no qualifying state at all -> add to "other" (ownership)
  // and "unworked" (season).
  const unmapped = Math.max(0, totalParcels - mapped);
  ownership.other = (ownership.other || 0) + unmapped;
  season.unworked = (season.unworked || 0) + unmapped;

  return { ownership, season, totalParcels, mapped, unmapped };
}

function VbBar({ buckets, counts, total, ariaLabel }) {
  if (total <= 0) {
    return (
      <div className="vb-bar vb-bar-empty" aria-label={`${ariaLabel}: no quarters`}>
        <span className="vb-bar-empty-label">no quarters mapped</span>
      </div>
    );
  }
  return (
    <div className="vb-bar" role="group" aria-label={ariaLabel}>
      {buckets.map((b) => {
        const n = counts[b.id] || 0;
        if (n <= 0) return null;
        const pct = (n / total) * 100;
        const title = `${b.label}: ${n} of ${total} (${pct.toFixed(0)}%)`;
        return (
          <div
            key={b.id}
            className={`vb-seg vb-seg-${b.id}`}
            style={{ width: `${pct}%`, background: b.color }}
            title={title}
            aria-label={title}
          />
        );
      })}
    </div>
  );
}

function VbLegend({ buckets }) {
  return (
    <div className="vb-legend">
      {buckets.map((b) => (
        <span key={b.id} className="vb-legend-item">
          <span className="vb-legend-swatch" style={{ background: b.color }} />
          <span className="vb-legend-label">{b.label}</span>
        </span>
      ))}
    </div>
  );
}

function VbPropertyRow({ property }) {
  const states = window.QUARTER_STATES || {};
  const counts = useMemo(() => vbCountsForProperty(property, states), [property.id, states]);

  return (
    <div className="vb-row">
      <div className="vb-row-head">
        <div className="vb-row-name">{property.name}</div>
        <div className="vb-row-meta caps">
          {counts.totalParcels} quarters · {counts.mapped} reporting
        </div>
      </div>
      <div className="vb-row-bars">
        <div className="vb-bar-block">
          <div className="vb-bar-label caps">Ownership</div>
          <VbBar
            buckets={VB_OWNERSHIP_BUCKETS}
            counts={counts.ownership}
            total={counts.totalParcels}
            ariaLabel={`${property.name} ownership status`}
          />
        </div>
        <div className="vb-bar-block">
          <div className="vb-bar-label caps">Season</div>
          <VbBar
            buckets={VB_SEASON_BUCKETS}
            counts={counts.season}
            total={counts.totalParcels}
            ariaLabel={`${property.name} season stage`}
          />
        </div>
      </div>
    </div>
  );
}

function VoteBoard({ properties }) {
  // Re-render when QUARTER_STATES changes by bumping a tick counter on
  // every onTalliesChange callback. The actual data lives on window.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!window.onTalliesChange) return;
    const unsubscribe = window.onTalliesChange(() => setTick((t) => t + 1));
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  if (!Array.isArray(properties) || properties.length === 0) return null;

  return (
    <section className="vb-section" aria-label="Live community vote rollup">
      <header className="vb-section-head">
        <div className="vb-kicker caps">● Live · community vote rollup</div>
        <h2 className="serif vb-section-headline">What the swarm is seeing right now</h2>
        <p className="vb-section-sub">
          Each row is one property. Status flips when ≥3 distinct visitors have
          voted the same way. Muted gray = not enough votes yet.
        </p>
      </header>
      <div className="vb-property-list">
        {properties.map((p) => (
          <VbPropertyRow key={p.id} property={p} />
        ))}
      </div>
      <VbLegend buckets={[...VB_OWNERSHIP_BUCKETS, ...VB_SEASON_BUCKETS.filter((b) => b.id !== "unworked")]} />
    </section>
  );
}

window.VoteBoard = VoteBoard;
```

- [ ] **Step 3.2: Add it to the build script entries**

Open `C:/Users/kyle/Agriculture/Monette/scripts/build-jsx.mjs` and find the `entries` array (around line 16):

```js
const entries = [
  "components.jsx",
  "quarter-panel.jsx",
  "property-drawer.jsx",
  "tutorial.jsx",
  "view-editorial.jsx",
  ...
```

Add `"vote-board.jsx",` between `"property-drawer.jsx"` and `"tutorial.jsx"`:

```js
const entries = [
  "components.jsx",
  "quarter-panel.jsx",
  "property-drawer.jsx",
  "vote-board.jsx",
  "tutorial.jsx",
  "view-editorial.jsx",
  ...
```

- [ ] **Step 3.3: Build and verify the file compiles**

Run:
```bash
cd C:/Users/kyle/Agriculture/Monette && npm run build
```
Expected: output includes `built build/vote-board.js`. No esbuild errors. The file `C:/Users/kyle/Agriculture/Monette/build/vote-board.js` exists and starts with `// AUTO-GENERATED by scripts/build-jsx.mjs`.

If esbuild errors: fix any JSX syntax issues in the source and rebuild.

---

## Task 4: Wire `<VoteBoard>` into the editorial view

**Files:**
- Modify: `C:/Users/kyle/Agriculture/Monette/index.html`
- Modify: `C:/Users/kyle/Agriculture/Monette/view-editorial.jsx`
- Create: `C:/Users/kyle/Agriculture/Monette/styles.css` additions (append at end)

- [ ] **Step 4.1: Add the script tag to `index.html`**

Open `index.html` and find the build script list near the bottom:

```html
<script src="build/components.js"></script>
<script src="build/quarter-panel.js"></script>
<script src="build/property-drawer.js"></script>
<script src="build/tutorial.js"></script>
<script src="build/view-editorial.js"></script>
```

Add `<script src="build/vote-board.js"></script>` between `property-drawer.js` and `tutorial.js`:

```html
<script src="build/components.js"></script>
<script src="build/quarter-panel.js"></script>
<script src="build/property-drawer.js"></script>
<script src="build/vote-board.js"></script>
<script src="build/tutorial.js"></script>
<script src="build/view-editorial.js"></script>
```

- [ ] **Step 4.2: Bump the styles.css cache buster**

In `index.html`, find:
```html
<link rel="stylesheet" href="styles.css?v=16"/>
```
Change to:
```html
<link rel="stylesheet" href="styles.css?v=17"/>
```

(We will be adding rules to `styles.css` in step 4.5; bumping the version forces browsers to re-fetch.)

- [ ] **Step 4.3: Find the insertion point in `view-editorial.jsx`**

Open `view-editorial.jsx` and locate the main editorial view function — search for the live ticker block. The ticker is rendered just before the `<DossierFeature />` invocation. Read 30 lines around that area to find the exact JSX surrounding it.

The insertion point is **immediately after the live ticker JSX block, before the `<DossierFeature />`**.

- [ ] **Step 4.4: Insert `<VoteBoard />` at that point**

In the editorial view's JSX return, add this single line directly before `<DossierFeature />`:

```jsx
{window.VoteBoard ? <window.VoteBoard properties={D.properties} /> : null}
```

The `window.VoteBoard ?` guard keeps the page from breaking if `vote-board.js` failed to load for any reason.

- [ ] **Step 4.5: Append CSS rules to `styles.css`**

Open `C:/Users/kyle/Agriculture/Monette/styles.css` and append this block at the very end of the file:

```css
/* Vote board (homepage rollup) ------------------------------------------ */

.vb-section {
  margin: 36px 0;
  padding: 28px 24px;
  background: var(--paper-2, #ece6db);
  border-top: 1px solid var(--ink, #1c1a17);
  border-bottom: 1px solid var(--ink, #1c1a17);
}

.vb-section-head { max-width: 720px; margin: 0 auto 24px; text-align: center; }

.vb-kicker {
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--gold-ink, #8a6a18);
  margin-bottom: 8px;
}

.vb-section-headline {
  font-size: 32px;
  line-height: 1.1;
  margin: 6px 0 8px;
  color: var(--ink, #1c1a17);
}

.vb-section-sub {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-2, #4a443c);
  margin: 0;
}

.vb-property-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  max-width: 980px;
  margin: 0 auto;
}

.vb-row {
  background: var(--paper, #fffdf7);
  padding: 14px 16px;
  border: 1px solid rgba(28, 26, 23, 0.12);
}

.vb-row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
  gap: 16px;
}

.vb-row-name {
  font-family: "Instrument Serif", serif;
  font-size: 22px;
  line-height: 1;
}

.vb-row-meta {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--ink-2, #4a443c);
  white-space: nowrap;
}

.vb-row-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vb-bar-block { display: flex; align-items: center; gap: 12px; }

.vb-bar-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--ink-2, #4a443c);
  width: 78px;
  flex-shrink: 0;
}

.vb-bar {
  flex: 1;
  height: 14px;
  display: flex;
  background: #e3ddd0;
  overflow: hidden;
  border-radius: 2px;
}

.vb-bar-empty {
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px dashed rgba(28, 26, 23, 0.25);
}

.vb-bar-empty-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-2, #4a443c);
}

.vb-seg {
  height: 100%;
  transition: width 240ms ease-out;
}

.vb-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: center;
  max-width: 980px;
  margin: 18px auto 0;
}

.vb-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-2, #4a443c);
}

.vb-legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

@media (max-width: 640px) {
  .vb-section { padding: 22px 14px; }
  .vb-section-headline { font-size: 24px; }
  .vb-bar-block { flex-direction: column; align-items: stretch; gap: 4px; }
  .vb-bar-label { width: auto; }
}
```

The CSS reuses existing CSS variables (`--paper`, `--paper-2`, `--ink`, `--ink-2`, `--gold-ink`) with hard-coded fallbacks in case they're not defined.

- [ ] **Step 4.6: Build and reload the preview**

Run:
```bash
cd C:/Users/kyle/Agriculture/Monette && npm run build
```
Expected: success, including `built build/view-editorial.js` and `built build/vote-board.js`.

Open the preview at `http://localhost:8766/` (start the server if not already running with `py -m http.server 8766 --directory C:/Users/kyle/Agriculture/Monette`).

Hard-reload (Ctrl+Shift+R). The Editorial view should render. Scroll down past the live ticker — you should see the new "What the swarm is seeing right now" section with one row per property.

If the section doesn't appear:
- Check DevTools console for errors. Look for `ReferenceError` or 404 on `build/vote-board.js`.
- If 404: re-run `npm run build` and confirm the file exists at `C:/Users/kyle/Agriculture/Monette/build/vote-board.js`.
- If `window.VoteBoard is undefined`: confirm the script tag in `index.html` is in the right order (after `property-drawer.js`, before `view-editorial.js`).

---

## Task 5: Manual verification

**Files:** none (verification only)

These tests cover the spec's §9 manual verification list. Run them in order. Each test has explicit success criteria.

- [ ] **Step 5.1: Visual baseline — bars render at all**

Open the preview. Confirm:
- The "What the swarm is seeing right now" section appears below the ticker, above the dossier feature.
- Each property row shows its name (e.g., "Hafford"), a count line, and two stacked bars labeled "Ownership" and "Season".
- If the prod DB has no qualifying votes, expect bars that are entirely muted gray (the "other" / "unworked" segments at 100%). That's correct.
- The legend at the bottom lists Owned · Rented · Sold · Other · Seeded · Sprayed · Harvested.

If a property row says "no quarters mapped" and that property's `parcels` field in `data.js` is > 0, that's a bug — investigate the `vbCountsForProperty` math.

- [ ] **Step 5.2: Threshold flip (3 votes moves the bar)**

You'll need 3 distinct fingerprints. Use 3 incognito windows, OR clear `localStorage.monette.voter.fp` in DevTools console between votes:
```js
localStorage.removeItem("monette.voter.fp"); location.reload();
```

Pick a quarter. From the map view, open a quarter drawer for any property quarter that currently has 0 ownership votes. Vote `owned-monette` (or whatever's on the button).

Repeat from a 2nd and 3rd incognito window for the same quarter.

After the 3rd vote, return to the editorial view and reload. The property's "Owned" segment should grow by 1 quarter's worth of width (1/parcels of the bar).

If the bar doesn't move:
- Check `window.QUARTER_STATES` in the console. The just-voted quarter should now have `ownership_status: "owned-monette"`.
- If it's not in `QUARTER_STATES`, the SQL view's `n >= 3` filter isn't seeing the votes. Verify in the Supabase SQL editor that the votes are stored.

- [ ] **Step 5.3: Progression rejection**

Pick another quarter that has 0 season votes.

In a fresh incognito window, open the quarter drawer and click "Harvested". The optimistic UI should show the vote, then roll back when the server rejects it.

Verify:
- The console shows `[supa] season submit failed, rolling back` with the error message containing `progression: harvested requires a prior seeded vote on this quarter`.
- The Harvested button in the UI does NOT show a checkmark / persistent "you voted" state.
- After reload, no `harvested` vote is recorded.

- [ ] **Step 5.4: Stale-tally / recency tie-break (ownership)**

This requires manual SQL. In the Supabase SQL editor, pick a real quarter and seed a stale-tally scenario:

```sql
-- Replace these with a real prop_id and quarter_loc from your data:
-- Insert 4 old "owned-monette" votes
insert into public.votes (prop_id, quarter_loc, category, value, voter_fingerprint, created_at)
values
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'owned-monette', 'test-old-1', '2025-10-01 00:00:00+00'),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'owned-monette', 'test-old-2', '2025-10-02 00:00:00+00'),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'owned-monette', 'test-old-3', '2025-10-03 00:00:00+00'),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'owned-monette', 'test-old-4', '2025-10-04 00:00:00+00')
on conflict do nothing;

-- Insert 5 recent "sold" votes
insert into public.votes (prop_id, quarter_loc, category, value, voter_fingerprint, created_at)
values
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'sold', 'test-new-1', now()),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'sold', 'test-new-2', now()),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'sold', 'test-new-3', now()),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'sold', 'test-new-4', now()),
  ('hafford', 'NW-26-10-16-W3', 'ownership', 'sold', 'test-new-5', now())
on conflict do nothing;

-- Verify the view picks "sold"
select * from public.quarter_current_state
where prop_id = 'hafford' and quarter_loc = 'NW-26-10-16-W3';
```

Expected: the row shows `ownership_status = 'sold'` despite 4 owned-monette votes existing — because sold has more recent activity AND meets the threshold.

Reload the editorial view. Hafford's "Sold" segment should include this quarter.

Clean up:
```sql
delete from public.votes where voter_fingerprint like 'test-old-%' or voter_fingerprint like 'test-new-%';
```

- [ ] **Step 5.5: Below-threshold renders muted**

Find a property where most quarters have <3 votes. Verify on the editorial view that most of its bar width is muted gray. Hover over the gray segment — the tooltip should read something like `Other: 145 of 158 (92%)` for the ownership bar or `Unworked: 145 of 158 (92%)` for the season bar.

- [ ] **Step 5.6: Cross-window realtime**

Open two browser windows on `http://localhost:8766/`. In window A, scroll to the editorial view's vote board. In window B, navigate to the map view, open any quarter, and cast a vote.

Switch back to window A within 5 seconds. The bar segment for that property should update without manual reload (this is the realtime channel firing). If you wait the full 30s, the polling fallback also catches it.

- [ ] **Step 5.7: Responsive layout**

Use DevTools device emulation. Verify at 320px, 768px, and 1280px:
- Bars don't overflow.
- Property names truncate or wrap rather than break the layout.
- At 320px the bar labels stack above the bars (per the `@media (max-width: 640px)` rule).

---

## Task 6: Deploy to production

**Files:** none (deployment only)

- [ ] **Step 6.1: Final build**

```bash
cd C:/Users/kyle/Agriculture/Monette && npm run build
```
Expected: clean build, no errors.

- [ ] **Step 6.2: Deploy a Vercel preview first (don't go straight to prod)**

```bash
cd C:/Users/kyle/Agriculture/Monette && vercel
```

(No `--prod` flag.) This deploys to a preview URL like `monette-ledger-XXXXXX.vercel.app`. Open the preview URL and re-run steps 5.1, 5.2, and 5.6 against it. Catches deploy-time issues (e.g., `public/build/vote-board.js` missing) before they hit `monette.buperac.com`.

- [ ] **Step 6.3: Promote to production**

```bash
cd C:/Users/kyle/Agriculture/Monette && vercel --prod --yes
```
Expected: a production deployment URL, with the custom domain `https://monette.buperac.com` redirecting to it within ~30 seconds.

- [ ] **Step 6.4: Smoke test production**

Open `https://monette.buperac.com/`. Verify:
- The vote board section appears.
- DevTools console has no errors related to `vote-board.js`, `supabase-client.js`, or `quarter_current_state`.
- The Network tab shows a successful `quarter_current_state` request returning JSON.

- [ ] **Step 6.5: Mirror to G: (optional, for Drive collaborators)**

```bash
cp "/c/Users/kyle/Agriculture/Monette/vote-board.jsx" "/g/My Drive/Agriculture/Monette/vote-board.jsx"
cp "/c/Users/kyle/Agriculture/Monette/supabase-client.js" "/g/My Drive/Agriculture/Monette/supabase-client.js"
cp "/c/Users/kyle/Agriculture/Monette/index.html" "/g/My Drive/Agriculture/Monette/index.html"
cp "/c/Users/kyle/Agriculture/Monette/styles.css" "/g/My Drive/Agriculture/Monette/styles.css"
cp "/c/Users/kyle/Agriculture/Monette/view-editorial.jsx" "/g/My Drive/Agriculture/Monette/view-editorial.jsx"
cp "/c/Users/kyle/Agriculture/Monette/scripts/build-jsx.mjs" "/g/My Drive/Agriculture/Monette/scripts/build-jsx.mjs"
cp -r "/c/Users/kyle/Agriculture/Monette/public/" "/g/My Drive/Agriculture/Monette/public/"
cp -r "/c/Users/kyle/Agriculture/Monette/supabase/migrations/" "/g/My Drive/Agriculture/Monette/supabase/migrations/"
```

This keeps the G: copy in sync for Google Drive readers. The C: copy remains the source of truth for builds + deploys.

---

## Self-review checklist

Spec coverage check (every requirement → task):

| Spec section | Task |
|---|---|
| §3.1 `vote-board.jsx` | Task 3 |
| §3.2 `quarter_current_state` view | Task 1.2 |
| §3.3 progression guard | Task 1.2 |
| §3.4 `hydrateQuarterStates()` | Task 2.2 |
| §3.5 insertion in editorial view | Task 4.4 |
| §4 status derivation rules (ownership LWW + threshold + recency, season monotonic + threshold) | Task 1.2 SQL |
| §5.1.1 SQL view definition | Task 1.2 |
| §5.1.2 progression guard | Task 1.2 |
| §5.2 vote-board.jsx with 3+other ownership and muted-gray below-threshold | Task 3.1 |
| §5.2 hydrateQuarterStates wiring | Tasks 2.2-2.5 |
| §5.2 view-editorial insertion | Task 4.4 |
| §5.2 index.html script tag | Task 4.1 |
| §5.2 build script update | Task 3.2 |
| §5.3 per-property granularity | Task 3.1 (uses `D.properties`, no region grouping) |
| §6 data flow | Tasks 2 + 3 wire it together |
| §7 edge cases (ownership tie-break, server reject rollback, parcels denominator) | Task 1.2 SQL `ORDER BY last_at desc, value asc`; Task 3.1 component math; existing rollback in supabase-client.js |
| §8 out of scope | Plan does not touch ticker, dossier feature, map, list views — confirmed |
| §9 manual verification | Task 5 (all 7 sub-tests) |
| §10 deployment | Task 6 |
| §11 acceptance | Implicit; satisfied when Tasks 1-6 are green |
| §12.1 ownership 3+other resolution | Task 3.1 (`VB_OWNERSHIP_BUCKETS`) |
| §12.2 muted-gray below-threshold | Task 3.1 (color `#b9b3a4`) + CSS rules in Task 4.5 |

Type/name consistency: `window.VoteBoard`, `window.QUARTER_STATES`, `hydrateQuarterStates`, `monetteHydrateQuarterStates`, `vote-board.jsx` / `vote-board.js` — names match across all tasks.

No placeholders found in any task. All file paths absolute. All commands exact. All code blocks complete.
